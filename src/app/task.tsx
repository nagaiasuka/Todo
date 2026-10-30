import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStore } from '../data/Store';
import { categories, categoryOf, type Draft, type TaskInput } from '../domain/tasks';
import { Action, Card, styles as s } from '../ui/components';
import { useTheme } from '../ui/theme';

type TaskParams = { id?: string; category?: string; resume?: string };
export default function TaskScreen() {
  const params = useLocalSearchParams<TaskParams>();
  return <TaskEditor key={`${params.id ?? 'new'}:${params.resume ?? ''}:${params.category ?? ''}`} params={params} />;
}

function TaskEditor({ params }: { params: TaskParams }) {
  const c = useTheme();
  const store = useStore();
  const requestedId = typeof params.id === 'string' ? params.id : null;
  const [cachedDraft] = useState(() => store.document.draft);
  const id = params.resume === '1' ? cachedDraft?.taskId ?? null : requestedId;
  const [original] = useState(() => store.document.tasks.find(t => t.id === id));
  const classification = categories[Number(params.category)] ?? categories[0];
  const fresh: Draft = { taskId: id, title: original?.title ?? '', urgent: original?.urgent ?? classification.urgent,
    important: original?.important ?? classification.important, dueAt: original?.dueAt ?? null, reminderAt: original?.reminderAt ?? null, note: original?.note ?? '' };
  const [input, setInput] = useState<Draft>(() => cachedDraft && (params.resume === '1' || cachedDraft.taskId === id) ? cachedDraft : fresh);
  const latest = useRef(input);
  const [conflict, setConflict] = useState(!!cachedDraft && cachedDraft.taskId !== id && params.resume !== '1');
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [reminderError, setReminderError] = useState('');
  const dirty = JSON.stringify(input) !== JSON.stringify(fresh) || !!cachedDraft && !conflict;
  const missing = id !== null && !original;
  const disablePrevention = usePreventRemove(!allowLeave && dirty && !conflict, () => setClosing(true));
  useEffect(() => {
    if (allowLeave) { disablePrevention(); router.dismissTo('/'); }
  }, [allowLeave, disablePrevention]);

  const persist = async (draft: Draft | null) => {
    try { await store.draft(draft); setDraftStatus('下書きを端末に保存済み'); }
    catch { setDraftStatus('下書きの保存に失敗しました。閉じる前に再試行してください。'); }
  };
  const change = (patch: Partial<TaskInput>) => {
    const next = { ...latest.current, ...patch };
    setReminderError('');
    latest.current = next; setInput(next); setError(''); setDraftStatus('下書きを保存中…');
    void persist(next);
  };
  const handleReminderPreset = (minutes: number, now: number) => {
    const dueAt = latest.current.dueAt;
    if (!dueAt) return;
    const at = Date.parse(dueAt) - minutes * 60000;
    if (at <= now) {
      setReminderError('通知時刻が過去になります。期限日時を変更するか、通知日時を直接指定してください。');
      return;
    }
    change({ reminderAt: new Date(at).toISOString() });
  };
  const work = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : '保存できませんでした。もう一度お試しください。'); }
    finally { setBusy(false); }
  };
  const save = () => void work(async () => {
    if (!input.title.trim()) { setError('タスク名を入力してください。'); return; }
    await store.saveTask(input, id); setAllowLeave(true);
  });
  const leave = (keep: boolean) => void work(async () => {
    await store.draft(keep ? latest.current : null); setAllowLeave(true);
  });
  const fieldStyle = [s.field, { color: c.text, backgroundColor: c.field, borderColor: c.line }];
  if (missing) return <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}><View style={s.content}><Text style={{ color: c.text }}>このタスクは見つかりませんでした。</Text><Action onPress={() => setAllowLeave(true)}>一覧へ戻る</Action></View></SafeAreaView>;
  if (conflict) return <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}><View style={s.content}><Card>
    <Text style={{ color: c.text, fontSize: 21, fontWeight: '700' }}>別の下書きが残っています</Text><Text style={{ color: c.muted }}>{cachedDraft?.title || '名称未入力のタスク'}</Text>
    <Action onPress={() => { setAllowLeave(true); }}>一覧に戻って下書きを再開</Action>
    <Action secondary onPress={() => void work(async () => { await store.draft(null); setConflict(false); })}>下書きを破棄してこのタスクを編集</Action>
    {!!error && <Text style={{ color: c.danger }}>{error}</Text>}
  </Card></View></SafeAreaView>;

  return <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{id ? 'タスクを編集' : '新しいタスク'}</Text>
          <Action secondary disabled={busy} onPress={() => dirty ? setClosing(true) : setAllowLeave(true)}>キャンセル</Action>
        </View>
        {closing && <Card><Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>入力内容をどうしますか？</Text>
          <Action disabled={busy} onPress={() => leave(true)}>下書きを残して閉じる</Action>
          <Action secondary disabled={busy} onPress={() => leave(false)}>変更を破棄して閉じる</Action>
          <Action secondary onPress={() => setClosing(false)}>編集を続ける</Action>
        </Card>}
        <Card>
          <Text style={[s.label, { color: c.text }]}>タスク名 <Text style={{ color: c.danger }}>必須</Text></Text>
          <TextInput testID="task-title" accessibilityLabel="タスク名" placeholder="タスクを入力" placeholderTextColor={c.muted} style={fieldStyle}
            value={input.title} onChangeText={title => change({ title })} maxLength={200} multiline editable={!busy} />
          <Text style={{ color: c.muted, fontSize: 12 }}>{input.title.length} / 200</Text>
        </Card>
        <Card>
          <Text style={[s.label, { color: c.text }]}>優先順位</Text>
          {([['urgent', '緊急', '早く対応する必要がある'], ['important', '重要', '自分にとって大切な成果につながる']] as const).map(([key, label, caption]) => <View key={key} style={s.row}>
            <View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{label}</Text><Text style={{ color: c.muted, fontSize: 13 }}>{caption}</Text></View>
            <Switch accessibilityLabel={label} disabled={busy} value={input[key]} trackColor={{ true: '#719D2D', false: c.line }} onValueChange={v => change({ [key]: v })} />
          </View>)}
          <Text style={{ color: c.text, backgroundColor: c.field, borderRadius: 8, padding: 12, fontWeight: '700' }}>0{categoryOf(input) + 1}　{categories[categoryOf(input)].title}</Text>
        </Card>
        <Card>
          <View style={s.row}><Text style={[s.label, { color: c.text, flex: 1 }]}>期限日時（任意）</Text><Switch accessibilityLabel="期限を設定する" disabled={busy} value={!!input.dueAt} trackColor={{ true: '#719D2D', false: c.line }} onValueChange={value => change({ dueAt: value ? new Date(Math.ceil(Date.now() / 60000) * 60000).toISOString() : null })} /></View>
          {input.dueAt && (Platform.OS === 'ios' ? <DateTimePicker value={new Date(input.dueAt)} mode="datetime" display="compact" locale="ja-JP" themeVariant={c.isDark ? 'dark' : 'light'} disabled={busy}
            onValueChange={(_event, date) => change({ dueAt: date.toISOString() })} /> : <WebDateInput value={input.dueAt} onChange={dueAt => change({ dueAt })} />)}
        </Card>
        <Card>
          <View style={s.row}><Text style={[s.label, { color: c.text, flex: 1 }]}>リマインダー（任意）</Text><Switch accessibilityLabel="リマインダーを設定する" disabled={busy || Platform.OS !== 'ios' && !input.reminderAt} value={!!input.reminderAt} trackColor={{ true: '#719D2D', false: c.line }} onValueChange={value => change({ reminderAt: value ? new Date(input.dueAt && Date.parse(input.dueAt) > Date.now() ? input.dueAt : Math.ceil((Date.now() + 3600000) / 60000) * 60000).toISOString() : null })} /></View>
          <Text style={[s.subtitle, { color: c.muted }]}>{Platform.OS === 'ios' ? '指定した日時に1回通知します。期限とは別に設定できます。完了したタスクは通知しません。' : '通知はiPhone版で利用できます。'}</Text>
          <Text style={[s.label, { color: c.text }]}>期限の前に通知</Text>
          <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
            {([10, 30, 60] as const).map(minutes => {
              const selected = !!input.dueAt && !!input.reminderAt && Date.parse(input.dueAt) - Date.parse(input.reminderAt) === minutes * 60000;
              const disabled = busy || Platform.OS !== 'ios' || !input.dueAt;
              const label = minutes === 60 ? '1時間前' : `${minutes}分前`;
              return <Pressable key={minutes} accessibilityRole="button" accessibilityLabel={`期限の${label}に通知`} accessibilityState={{ selected, disabled }}
                disabled={disabled} onPress={() => handleReminderPreset(minutes, Date.now())}
                style={({ pressed }) => [s.action, { backgroundColor: selected ? c.accent : c.field, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
                <Text style={[s.actionText, { color: selected ? c.accentText : c.text }]}>{label}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={[s.subtitle, { color: c.muted }]}>{!input.dueAt ? '先に期限日時を設定してください。' : 'ボタンを押すとリマインダーがオンになります。期限日時を変更した場合は、もう一度選んでください。'}</Text>
          {!!reminderError && <Text accessibilityRole="alert" style={{ color: c.danger }}>{reminderError}</Text>}
          {!!input.reminderAt && <Text style={[s.label, { color: c.text }]}>通知日時（直接変更できます）</Text>}
          {input.reminderAt && (Platform.OS === 'ios' ? <DateTimePicker value={new Date(input.reminderAt)} mode="datetime" display="compact" locale="ja-JP" themeVariant={c.isDark ? 'dark' : 'light'} disabled={busy}
            onValueChange={(_event, date) => change({ reminderAt: date.toISOString() })} /> : <WebDateInput label="通知日時" value={input.reminderAt} onChange={reminderAt => change({ reminderAt })} />)}
        </Card>
        <Card><Text style={[s.label, { color: c.text }]}>メモ（任意）</Text><TextInput accessibilityLabel="メモ" placeholder="準備すること、忘れたくないこと。" placeholderTextColor={c.muted} value={input.note} onChangeText={note => change({ note })} style={[...fieldStyle, { minHeight: 120, textAlignVertical: 'top' }]} multiline maxLength={4000} editable={!busy} /></Card>
        {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
        <Action disabled={busy || !input.title.trim()} onPress={save}>{busy ? '保存中…' : 'タスクを保存'}</Action>
        {!!draftStatus && <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{draftStatus}</Text>}
        {id && <>
          <Action secondary disabled={busy} onPress={() => setDeleting(v => !v)}>タスクを削除</Action>
          {deleting && <Card><Text style={{ color: c.danger }}>このタスクを削除します。この操作は取り消せません。</Text><Action disabled={busy} onPress={() => void work(async () => { await store.remove(id); setAllowLeave(true); })}>削除する</Action><Action secondary onPress={() => setDeleting(false)}>削除をキャンセル</Action></Card>}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function WebDateInput({ value, onChange, label = '期限日時' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const local = new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16);
  if (Platform.OS !== 'web') return null;
  return <input aria-label={label} type="datetime-local" value={local} onChange={event => {
    const date = new Date(event.target.value);
    if (Number.isFinite(date.getTime())) onChange(date.toISOString());
  }} style={{ fontSize: 18, padding: 12, borderRadius: 8, border: '1px solid #718096', colorScheme: 'light dark', width: '100%', boxSizing: 'border-box' }} />;
}
