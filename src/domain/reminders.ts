import { type Task } from './tasks';

export const REMINDER_PREFIX = 'todo-reminder:';
export const REMINDER_LIMIT = 60;
export type Reminder = { identifier: string; taskId: string; title: string; at: string };
export interface ReminderDriver {
  list(): Promise<Reminder[]>;
  cancel(identifier: string): Promise<void>;
  schedule(reminder: Reminder): Promise<void>;
  allowed(): Promise<boolean>;
}

export function plannedReminders(tasks: Task[], now = Date.now()): Reminder[] {
  return tasks.filter(t => !t.completedAt && t.reminderAt && Date.parse(t.reminderAt) > now)
    .sort((a, b) => Date.parse(a.reminderAt!) - Date.parse(b.reminderAt!) || a.id.localeCompare(b.id))
    .map(t => ({ identifier: REMINDER_PREFIX + t.id, taskId: t.id, title: t.title, at: t.reminderAt! }));
}

// Serial reconciliation keeps a slow, older update from restoring cancelled reminders.
export class ReminderScheduler {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private driver: ReminderDriver) {}
  sync(tasks: Task[]): Promise<void> {
    const work = this.queue.then(async () => {
      const desired = plannedReminders(tasks);
      const wanted = new Map(desired.slice(0, REMINDER_LIMIT).map(r => [r.identifier, r]));
      const existing = await this.driver.list();
      for (const current of existing) {
        if (!current.identifier.startsWith(REMINDER_PREFIX)) continue;
        const next = wanted.get(current.identifier);
        if (next && next.title === current.title && next.at === current.at) wanted.delete(current.identifier);
        else await this.driver.cancel(current.identifier);
      }
      if (desired.length && !await this.driver.allowed()) throw new Error('通知が許可されていません。iPhoneの設定からTodoの通知を許可してください。');
      for (const reminder of wanted.values()) await this.driver.schedule(reminder);
      if (desired.length > REMINDER_LIMIT) throw new Error('通知は日時の近い60件まで予約されます。');
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
}
