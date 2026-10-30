export type Task = {
  id: string;
  title: string;
  urgent: boolean;
  important: boolean;
  dueAt: string | null;
  reminderAt?: string | null;
  note: string;
  order: number;
  completedAt: string | null;
  createdAt: string;
};

export type ThemeMode = 'light' | 'dark' | 'system';
export type Settings = { showTodayCount: boolean; showNextTask: boolean; theme?: ThemeMode };
export type TaskInput = Pick<Task, 'title' | 'urgent' | 'important' | 'dueAt' | 'reminderAt' | 'note'>;
export type Draft = TaskInput & { taskId: string | null };
export type Document = { version: 1; tasks: Task[]; settings: Settings; draft: Draft | null };
export const initialDocument: Document = {
  version: 1, tasks: [], settings: { showTodayCount: true, showNextTask: true, theme: 'light' }, draft: null,
};
export const categories = [
  { title: '緊急かつ重要', short: '緊急・重要', caption: 'まず、ここから。', urgent: true, important: true, color: '#C1443D' },
  { title: '重要だが緊急ではない', short: '重要', caption: '未来のために、時間をつくる。', urgent: false, important: true, color: '#42720C' },
  { title: '緊急だが重要ではない', short: '緊急', caption: '手早く、ひとつずつ。', urgent: true, important: false, color: '#A26716' },
  { title: '緊急でも重要でもない', short: 'その他', caption: '余裕ができた、そのときに。', urgent: false, important: false, color: '#59718E' },
] as const;

export function categoryOf(task: Pick<Task, 'urgent' | 'important'>): number {
  return task.important ? (task.urgent ? 0 : 1) : (task.urgent ? 2 : 3);
}
const dueTime = (task: Task) => task.dueAt ? new Date(task.dueAt).getTime() : Infinity;
export function compareTasks(a: Task, b: Task): number {
  const category = categoryOf(a) - categoryOf(b);
  if (category) return category;
  const aDue = dueTime(a), bDue = dueTime(b);
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
export const pendingTasks = (tasks: Task[]) => tasks.filter(t => !t.completedAt).sort(compareTasks);

export function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function todayCount(tasks: Task[], now: Date): number {
  return tasks.filter(t => !t.completedAt && t.dueAt && sameLocalDay(new Date(t.dueAt), now)).length;
}
export function nextTask(tasks: Task[]): Task | null {
  const pending = pendingTasks(tasks);
  const dated = pending.filter(t => t.dueAt);
  dated.sort((a, b) => dueTime(a) - dueTime(b) || compareTasks(a, b));
  return dated[0] ?? pending[0] ?? null;
}

// Manual ordering never overrides a category or a different deadline.
export function reorder(tasks: Task[], id: string, direction: -1 | 1): Task[] {
  const sorted = pendingTasks(tasks);
  const index = sorted.findIndex(t => t.id === id);
  const task = sorted[index], neighbour = sorted[index + direction];
  if (!task || !neighbour || categoryOf(task) !== categoryOf(neighbour) || task.dueAt !== neighbour.dueAt) return tasks;
  [sorted[index], sorted[index + direction]] = [neighbour, task];
  const orders = new Map(sorted.map((t, i) => [t.id, i]));
  return tasks.map(t => orders.has(t.id) ? { ...t, order: orders.get(t.id)! } : t);
}

export function validInput(input: TaskInput): boolean {
  return !!input.title.trim() && input.title.trim().length <= 200 && input.note.length <= 4000 &&
    typeof input.urgent === 'boolean' && typeof input.important === 'boolean' &&
    (input.dueAt === null || Number.isFinite(Date.parse(input.dueAt))) &&
    (input.reminderAt == null || typeof input.reminderAt === 'string' && Number.isFinite(Date.parse(input.reminderAt)));
}

function isInput(value: unknown): value is TaskInput {
  if (!value || typeof value !== 'object') return false;
  const v = value as TaskInput;
  return typeof v.title === 'string' && typeof v.note === 'string' && validInput(v);
}

export function parseDocument(raw: string): Document {
  const v = JSON.parse(raw) as Document;
  if (v.version !== 1 || !Array.isArray(v.tasks) || !v.settings ||
    typeof v.settings.showTodayCount !== 'boolean' || typeof v.settings.showNextTask !== 'boolean' ||
    !(v.settings.theme === undefined || ['light', 'dark', 'system'].includes(v.settings.theme)) ||
    !v.tasks.every(t => isInput(t) && typeof t.id === 'string' && t.id.length > 0 &&
      Number.isFinite(t.order) && typeof t.createdAt === 'string' && Number.isFinite(Date.parse(t.createdAt)) &&
      (t.completedAt === null || (typeof t.completedAt === 'string' && Number.isFinite(Date.parse(t.completedAt))))) ||
    new Set(v.tasks.map(t => t.id)).size !== v.tasks.length) throw new Error('保存データを読み込めませんでした。');
  // Drafts may intentionally have an empty title.
  if (v.draft !== null) {
    const d = v.draft;
    if (!d || typeof d.title !== 'string' || typeof d.note !== 'string' ||
      typeof d.urgent !== 'boolean' || typeof d.important !== 'boolean' ||
      !(d.reminderAt == null || typeof d.reminderAt === 'string' && Number.isFinite(Date.parse(d.reminderAt))) ||
      !(d.taskId === null || typeof d.taskId === 'string') ||
      !(d.dueAt === null || (typeof d.dueAt === 'string' && Number.isFinite(Date.parse(d.dueAt))))) throw new Error('下書きを読み込めませんでした。');
  }
  return { ...v, settings: { ...v.settings, theme: v.settings.theme ?? 'light' } };
}

export function dueLabel(dueAt: string | null, now = new Date()): string {
  if (!dueAt) return '期限なし';
  const date = new Date(dueAt);
  const day = sameLocalDay(date, now) ? '今日' : `${date.getMonth() + 1}/${date.getDate()}`;
  return `${day} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
