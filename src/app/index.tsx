import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../data/Store';
import { categories, categoryOf, dueLabel, pendingTasks, todayCount, type Task } from '../domain/tasks';
import { Action, Card, styles as s } from '../ui/components';
import { useTheme } from '../ui/theme';

export default function ListScreen() {
  const c = useTheme();
  const store = useStore();
  const [completed, setCompleted] = useState(false);
  const [arranging, setArranging] = useState(false);
  const tasks = pendingTasks(store.document.tasks);
  const done = store.document.tasks.filter(t => t.completedAt).sort((a,b) => b.completedAt!.localeCompare(a.completedAt!));
  const run = async (work: Promise<void>) => { try { await work; } catch { Alert.alert('保存できませんでした', '内容は変更していません。もう一度お試しください。'); } };
  const openNew = (category?: number) => router.push({ pathname: '/task', params: category === undefined ? {} : { category } });

  function TaskRow({ task, index, group }: { task: Task; index: number; group: Task[] }) {
    const category = categories[categoryOf(task)];
    const overdue = task.dueAt && !task.completedAt && new Date(task.dueAt).getTime() < store.now.getTime();
    const canMove = (offset: number) => {
      const other = group[index + offset];
      return !!other && !task.completedAt && task.dueAt === other.dueAt;
    };
    return <View style={[local.task, { borderColor: c.line }]}>
      <View style={[s.row, { alignItems: 'flex-start', gap: 6 }]}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!task.completedAt }} accessibilityLabel={`${task.title}を${task.completedAt ? '未完了に戻す' : '完了する'}`}
          disabled={store.saving} onPress={() => void run(store.toggle(task.id))} style={local.checkHit}>
          <View style={[local.check, { borderColor: task.completedAt ? c.accent : c.muted, backgroundColor: task.completedAt ? c.accent : 'transparent' }]}>
            {task.completedAt && <Text style={{ color: c.accentText, fontWeight: '800' }}>✓</Text>}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${task.title}を編集、${category.title}、${dueLabel(task.dueAt)}`} onPress={() => router.push({ pathname: '/task', params: { id: task.id } })} style={{ flex: 1, paddingVertical: 10, gap: 6 }}>
          <Text style={{ color: task.completedAt ? c.muted : c.text, fontSize: 17, fontWeight: '600', lineHeight: 25, textDecorationLine: task.completedAt ? 'line-through' : 'none' }}>{task.title}</Text>
          {!!task.completedAt && <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>{category.title}</Text>}
          {!!task.reminderAt && <Text style={{ color: c.muted, fontSize: 13 }}>{task.completedAt ? '通知停止（完了済み）' : `通知：${dueLabel(task.reminderAt)}`}</Text>}
          <Text style={{ color: overdue ? c.danger : c.muted, fontSize: 13, fontWeight: '600' }}>{overdue ? '期限超過 · ' : ''}{dueLabel(task.dueAt)}{task.note ? '   · メモあり' : ''}</Text>
        </Pressable>
      </View>
      {arranging && !task.completedAt && <View style={[s.row, { justifyContent: 'flex-end', paddingBottom: 8 }]}>
        <Action secondary label={`${task.title}を上へ`} disabled={!canMove(-1) || store.saving} onPress={() => void run(store.move(task.id, -1))}>↑</Action>
        <Action secondary label={`${task.title}を下へ`} disabled={!canMove(1) || store.saving} onPress={() => void run(store.move(task.id, 1))}>↓</Action>
      </View>}
    </View>;
  }
  return <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={s.content}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>Todo</Text>
        <Action secondary onPress={() => router.push('/settings')}>設定</Action>
      </View>
      <Text style={{ color: c.muted, fontSize: 14 }}>未完了 {tasks.length}件　·　今日が期限 {todayCount(tasks, store.now)}件</Text>
      <Action onPress={() => openNew()}>＋ タスクを追加</Action>
      {store.document.draft && <Card><Text style={{ color: c.text, fontWeight: '700' }}>保存前の下書きがあります</Text><Text numberOfLines={2} style={{ color: c.muted }}>{store.document.draft.title || '名称未入力のタスク'}</Text><Action secondary onPress={() => router.push({ pathname: '/task', params: { resume: '1' } })}>編集を再開</Action></Card>}
      {store.widgetError && <Card><Text style={{ color: c.danger }}>タスクは保存済みですが、ウィジェットを更新できませんでした。</Text><Action secondary onPress={store.retryWidgets}>更新を再試行</Action></Card>}
      {store.reminderError && <Card><Text accessibilityRole="alert" style={{ color: c.danger }}>通知の予約を確認してください：{store.reminderError}</Text><Action secondary onPress={store.retryWidgets}>通知の予約を再試行</Action></Card>}
      <View style={[s.row, { flexWrap: 'wrap', justifyContent: 'space-between' }]}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{completed ? '完了済み' : '未完了'}</Text>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {!completed && <Action secondary onPress={() => setArranging(v => !v)}>{arranging ? '並べ替えを終了' : '並べ替え'}</Action>}
          <Action secondary onPress={() => setCompleted(v => !v)}>{completed ? '未完了へ' : `完了済み ${done.length}`}</Action>
        </View>
      </View>
      {arranging && !completed && <Text style={[s.subtitle, { color: c.muted }]}>同じ分類・同じ期限のタスクを上下に移動できます。期限なし同士も並べ替えられます。</Text>}
      {!completed && tasks.length === 0 && <Text style={[s.subtitle, { color: c.muted }]}>タスクはありません。「タスクを追加」から登録できます。</Text>}
      {completed ? <Card>{done.length ? done.map((task, i) => <TaskRow key={task.id} task={task} index={i} group={done} />) : <Text style={{ color: c.muted }}>完了したタスクはまだありません。</Text>}</Card> : <Card style={{ padding: 0, gap: 0 }}>{categories.map((category, index) => {
        const group = tasks.filter(t => categoryOf(t) === index);
        return <View key={category.title} style={{ paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderColor: c.line }}>
          <View style={[s.row, { gap: 8 }]}>
            <View style={{ width: 4, minHeight: 22, borderRadius: 2, backgroundColor: category.color }} />
            <Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '700' }}>{category.title}</Text>
            <Text style={{ color: c.muted, fontWeight: '600', fontSize: 14 }}>{group.length}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`${category.title}のタスクを追加`} onPress={() => openNew(index)} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.muted, fontSize: 22 }}>＋</Text></Pressable>
          </View>
          {group.map((task, i) => <TaskRow key={task.id} task={task} index={i} group={group} />)}
        </View>;
      })}</Card>}
    </ScrollView>
  </SafeAreaView>;
}
const local = StyleSheet.create({
  task: { borderTopWidth: StyleSheet.hairlineWidth },
  checkHit: { minHeight: 48, minWidth: 44, alignItems: 'center', paddingTop: 13 },
  check: { height: 23, width: 23, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
