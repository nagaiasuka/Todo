import { requireOptionalNativeModule } from 'expo';
import { type Task } from '../domain/tasks';

// Older development clients can still open the task list until rebuilt.
async function driver() {
  if (!requireOptionalNativeModule('ExpoNotificationScheduler'))
    throw new Error('リマインダーを使うにはiPhoneアプリの再ビルドが必要です。');
  return import('./driver');
}
export async function requestReminderPermission(): Promise<void> {
  await (await driver()).requestReminderPermission();
}
export async function syncReminders(tasks: Task[]): Promise<void> {
  if (!requireOptionalNativeModule('ExpoNotificationScheduler') && !tasks.some(t => !t.completedAt && t.reminderAt)) return;
  await (await driver()).syncReminders(tasks);
}
export function observeReminderTaps(open: (id: string) => void): () => void {
  let active = true;
  let cleanup: (() => void) | undefined;
  void driver().then(d => { if (active) cleanup = d.observeReminderTaps(open); }).catch(() => undefined);
  return () => { active = false; cleanup?.(); };
}
