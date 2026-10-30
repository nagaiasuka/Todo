import { type Task } from '../domain/tasks';

export async function requestReminderPermission(): Promise<void> {
  throw new Error('リマインダー通知はiPhone版で利用できます。');
}
export async function syncReminders(_tasks: Task[]): Promise<void> {}
export function observeReminderTaps(_open: (id: string) => void): () => void { return () => {}; }
