import type { Document } from '../domain/tasks';
import TodoHome from './TodoHome';
import TodoLock from './TodoLock';
import { homeProps, lockTimeline } from './model';

export function syncWidgets(document: Document): void {
  const now = new Date();
  TodoHome.updateSnapshot(homeProps(document, now));
  TodoLock.updateTimeline(lockTimeline(document, now));
}
