import { type Document, initialDocument, parseDocument } from '../domain/tasks';
import { applyWidgetCompletions, type WidgetActionSource } from '../domain/widgetActions';

export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export const STORAGE_KEY = 'todo.document.v1';

// One atomic document and a serial write queue prevent edits/settings/drafts
// from overwriting each other. Failed writes do not advance in-memory state.
export class Repository {
  private document: Document = initialDocument;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: Storage, private widgetActions?: WidgetActionSource) {}
  hasWidgetActions(): boolean { return !!this.widgetActions?.read().length; }
  async load(): Promise<Document> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    this.document = raw === null ? { ...initialDocument, tasks: [], settings: { ...initialDocument.settings } } : parseDocument(raw);
    if (this.hasWidgetActions()) return this.update(value => value);
    return this.document;
  }
  update(change: (document: Document) => Document): Promise<Document> {
    const work = this.queue.then(async () => {
      const actions = this.widgetActions?.read() ?? [];
      const next = change(applyWidgetCompletions(this.document, actions));
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.document = next;
      // A failed acknowledgement can be replayed safely after a restart.
      try {
        if (actions.length) this.widgetActions?.acknowledge(actions.map(action => action.id), next.tasks.filter(task => task.completedAt).map(task => task.id));
      } catch { /* Retry on next sync. */ }
      return next;
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
}
