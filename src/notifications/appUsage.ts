import type { UsageReminder } from '../domain/tasks';

export interface AppUsage {
  configure(selection: string, interval: number): Promise<UsageReminder | null>;
  sync(tasks: string): Promise<void>;
}

export const appUsage: AppUsage | null = null;

export const appUsagePreview = false;
