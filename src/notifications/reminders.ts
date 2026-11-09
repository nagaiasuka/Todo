import { type Task } from '../domain/tasks';

// The web editor can save reminder dates; delivery is available on iPhone only.
export async function requestReminderPermission(): Promise<void> {}
export async function syncReminders(_tasks: Task[]): Promise<void> {}
export function observeReminderTaps(_open: (id: string) => void): () => void { return () => {}; }
