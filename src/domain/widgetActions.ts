import type { Document } from './tasks';

export type WidgetCompletion = { id: string; taskId: string; completedAt: string };
export interface WidgetActionSource {
  read(): WidgetCompletion[];
  acknowledge(ids: string[], completedTaskIds: string[]): void;
}

export function applyWidgetCompletions(document: Document, actions: WidgetCompletion[]): Document {
  const handled = new Set(document.appliedWidgetActions ?? []);
  const dates = new Map<string, string>();
  for (const action of actions) {
    if (handled.has(action.id)) continue;
    handled.add(action.id);
    if (!dates.has(action.taskId) || action.completedAt < dates.get(action.taskId)!) dates.set(action.taskId, action.completedAt);
  }
  if (handled.size === (document.appliedWidgetActions?.length ?? 0)) return document;
  return { ...document, appliedWidgetActions: [...handled], tasks: document.tasks.map(task =>
    !task.completedAt && dates.has(task.id) ? { ...task, completedAt: dates.get(task.id)! } : task) };
}
