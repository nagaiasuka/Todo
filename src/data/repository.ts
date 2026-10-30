import { type Document, initialDocument, parseDocument } from '../domain/tasks';

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
  constructor(private storage: Storage) {}
  async load(): Promise<Document> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    this.document = raw === null ? { ...initialDocument, tasks: [], settings: { ...initialDocument.settings } } : parseDocument(raw);
    return this.document;
  }
  update(change: (document: Document) => Document): Promise<Document> {
    const work = this.queue.then(async () => {
      const next = change(this.document);
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.document = next;
      return next;
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
}
