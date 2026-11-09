import { reminderDates, type Task } from './tasks';

export const REMINDER_PREFIX = 'todo-reminder:';
export const REMINDER_LIMIT = 60;
export type Recurrence = { hour: number; minute: number; weekday?: number };
export type Reminder = { identifier: string; taskId: string; title: string; at: string; recurrence?: Recurrence };
export interface ReminderDriver {
  list(): Promise<Reminder[]>;
  cancel(identifier: string): Promise<void>;
  schedule(reminder: Reminder): Promise<void>;
  allowed(): Promise<boolean>;
}

export function nextReminderTime(r: Reminder, now: number): number {
  if (!r.recurrence) return Date.parse(r.at);
  const { hour, minute, weekday } = r.recurrence;
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (weekday !== undefined) next.setDate(next.getDate() + (weekday - next.getDay() + 7) % 7);
  if (next.getTime() <= now) next.setDate(next.getDate() + (weekday === undefined ? 1 : 7));
  return next.getTime();
}

export function plannedReminders(tasks: Task[], now = Date.now()): Reminder[] {
  return tasks.filter(t => !t.completedAt).flatMap(t => {
    const prefix = `${REMINDER_PREFIX}${encodeURIComponent(t.id)}:`;
    const reminders: Reminder[] = reminderDates(t).filter(at => Date.parse(at) > now)
      .map(at => ({ identifier: `${prefix}${Date.parse(at)}`, taskId: t.id, title: t.title, at }));
    const repeat = t.recurringReminder;
    if (repeat) {
      const { hour, minute } = repeat;
      const days = repeat.weekdays.length === 7 ? [undefined] : [...repeat.weekdays].sort();
      for (const weekday of days) reminders.push({
        identifier: `${prefix}${weekday === undefined ? 'daily' : `weekday-${weekday}`}`,
        taskId: t.id, title: t.title, at: '', recurrence: { hour, minute, ...(weekday === undefined ? {} : { weekday }) },
      });
    }
    return reminders;
  }).sort((a, b) => nextReminderTime(a, now) - nextReminderTime(b, now) || a.identifier.localeCompare(b.identifier));
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
        if (next && next.title === current.title && next.at === current.at &&
          next.recurrence?.hour === current.recurrence?.hour && next.recurrence?.minute === current.recurrence?.minute &&
          next.recurrence?.weekday === current.recurrence?.weekday) wanted.delete(current.identifier);
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
