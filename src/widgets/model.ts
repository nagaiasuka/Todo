import { categories, categoryOf, dueLabel, nextTask, pendingTasks, todayCount, type Document, type ThemeMode } from '../domain/tasks';

export type HomeProps = { rows: { id: string; title: string; classification: string; category: number; due: string; dueAt: string }[]; total: number; theme?: ThemeMode };
// Expo persists props in UserDefaults (a property list); null/undefined values
// are not supported. Omit disabled keys entirely, including initial props.
export type LockProps = { today?: number; next?: string; nextDeadline?: string; nextEmpty?: boolean };

export function homeProps(document: Document, now: Date): HomeProps {
  const tasks = pendingTasks(document.tasks);
  return { theme: document.settings.theme ?? 'light', total: tasks.length, rows: tasks.map(task => ({ id: task.id, title: task.title,
    classification: categories[categoryOf(task)].short, category: categoryOf(task), due: dueLabel(task.dueAt, now), dueAt: task.dueAt ?? '' })) };
}
export function lockProps(document: Document, now: Date): LockProps {
  const next = document.settings.showNextTask ? nextTask(document.tasks) : null;
  return {
    ...(document.settings.showTodayCount ? { today: todayCount(document.tasks, now) } : {}),
    ...(document.settings.showNextTask ? {
      next: next?.title.replace(/\s+/g, ' ').trim() ?? 'タスクはありません',
      nextEmpty: next === null,
      ...(next?.dueAt ? { nextDeadline: dueLabel(next.dueAt, now) } : {}),
    } : {}),
  };
}

// Every day with a due task and the following day are change points. This
// remains correct after the app is closed, without a finite 7/30-day horizon.
export function lockTimeline(document: Document, now: Date) {
  const dates = new Set<number>([now.getTime()]);
  if (document.settings.showTodayCount || document.settings.showNextTask) {
    for (const task of pendingTasks(document.tasks)) {
      if (!task.dueAt) continue;
      const day = new Date(task.dueAt);
      day.setHours(0, 0, 0, 0);
      if (day.getTime() > now.getTime()) dates.add(day.getTime());
      day.setDate(day.getDate() + 1);
      if (day.getTime() > now.getTime()) dates.add(day.getTime());
    }
  }
  return [...dates].sort((a,b) => a-b).map(time => ({ date: new Date(time), props: lockProps(document, new Date(time)) }));
}
