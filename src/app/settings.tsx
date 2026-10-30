import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { useStore } from '../data/Store';
import { type Settings } from '../domain/tasks';
import { Card, styles as s } from '../ui/components';
import { useTheme } from '../ui/theme';

export default function SettingsScreen() {
  const c = useTheme();
  const store = useStore();
  const [error, setError] = useState('');
  const [linkError, setLinkError] = useState('');
  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setError('');
    try { await store.settings({ ...store.document.settings, [key]: value }); }
    catch { setError('設定を保存できませんでした。もう一度お試しください。'); }
  };
  return <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={s.content}>
    <Text style={[s.label, { color: c.text }]} accessibilityRole="header">配色</Text>
    <Card>
      {([['light', 'オフホワイト'], ['dark', 'ダーク'], ['system', '端末に合わせる']] as const).map(([value, label]) => {
        const selected = (store.document.settings.theme ?? 'light') === value;
        return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} disabled={store.saving}
          onPress={() => void update('theme', value)} style={[s.row, { minHeight: 48, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? c.field : 'transparent' }]}>
          <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: selected ? '700' : '400' }}>{label}</Text>
          {selected && <Text style={{ color: c.text, fontSize: 18 }}>✓</Text>}
        </Pressable>;
      })}
    </Card>
    <Text style={[s.label, { color: c.text }]} accessibilityRole="header">ロック画面ウィジェット</Text>
    <Card>
      {([['showTodayCount', '今日の未完了タスク数', '期限日が今日の未完了タスクを集計します。'], ['showNextTask', '次のタスク', '期限が最も近い未完了タスクを表示します。']] as const).map(([key, title, description]) => <View key={key} style={[s.row, { paddingVertical: 8 }]}>
        <View style={{ flex: 1, gap: 8 }}><Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>{title}</Text><Text style={[s.subtitle, { color: c.muted }]}>{description}</Text></View>
        <Switch accessibilityLabel={title} value={store.document.settings[key]} disabled={store.saving} trackColor={{ true: '#719D2D', false: c.line }} onValueChange={v => void update(key, v)} />
      </View>)}
    </Card>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    {store.widgetError && <Text style={{ color: c.danger }}>設定は保存済みです。ウィジェットの更新に失敗しました。一覧から再試行できます。</Text>}
    <Text style={[s.subtitle, { color: c.muted }]}>両方オフの場合は「Todo」のみ表示します。タップすると一覧が開きます。期限のないタスクだけの場合、次のタスクは4分類の優先順位で選びます。</Text>
    <Text style={[s.subtitle, { color: c.muted }]}>ウィジェットはホーム画面の長押し、またはロック画面のカスタマイズから追加できます。ロック画面は時計の上に1行、下に円形・横長を配置できます。タスク名を読むには横長が向いています。</Text>
    <Text style={[s.label, { color: c.text }]} accessibilityRole="header">サポートとプライバシー</Text>
    <Card>
      {([
        ['サポート', 'https://dopa-min.jp/app-support/todo/'],
        ['プライバシーポリシー', 'https://dopa-min.jp/app-support/todo/privacy/'],
      ] as const).map(([label, url]) => <Pressable key={url} accessibilityRole="link" accessibilityLabel={label} accessibilityHint="外部ブラウザで開きます"
        onPress={() => {
          setLinkError('');
          void Linking.openURL(url).catch(() => setLinkError('ページを開けませんでした。通信環境を確認して、もう一度お試しください。'));
        }} style={[s.row, { minHeight: 48, paddingHorizontal: 12 }]}>
        <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{label}</Text>
        <Text style={{ color: c.muted, fontSize: 18 }}>↗</Text>
      </Pressable>)}
    </Card>
    {!!linkError && <Text accessibilityRole="alert" style={{ color: c.danger }}>{linkError}</Text>}
    <Text style={[s.subtitle, { color: c.muted }]}>Todo 1.0 · データはこの端末に保存されます。</Text>
  </ScrollView>;
}
