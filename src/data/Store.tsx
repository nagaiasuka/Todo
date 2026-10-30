import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { Repository } from './repository';
import { type Document, type TaskInput, type Draft, type Settings, initialDocument, reorder, validInput, sameLocalDay } from '../domain/tasks';
import { syncWidgets } from '../widgets/sync';
import { requestReminderPermission, syncReminders } from '../notifications/reminders';
import { plannedReminders, REMINDER_LIMIT } from '../domain/reminders';

type Store = {
  document: Document; now: Date; ready: boolean; loadError: string | null; widgetError: boolean; reminderError: string | null; saving: boolean;
  reload: () => Promise<void>; retryWidgets: () => void;
  saveTask: (input: TaskInput, id: string | null) => Promise<void>;
  toggle: (id: string) => Promise<void>; remove: (id: string) => Promise<void>;
  move: (id: string, direction: -1 | 1) => Promise<void>;
  settings: (settings: Settings) => Promise<void>;
  draft: (draft: Draft | null) => Promise<void>;
};
const Context = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new Repository(AsyncStorage));
  const [document, setDocument] = useState(initialDocument);
  const latest = useRef(document);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [widgetError, setWidgetError] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const refreshReminders = useCallback((value: Document) => {
    void syncReminders(value.tasks).then(() => setReminderError(null), error =>
      setReminderError(error instanceof Error ? error.message : '通知の予約を更新できませんでした。'));
  }, []);
  const [pending, setPending] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const clock = useRef(now);
  const refresh = useCallback(() => {
    const time = new Date(); clock.current = time; setNow(time);
    refreshReminders(latest.current);
    try { syncWidgets(latest.current); setWidgetError(false); }
    catch { setWidgetError(true); }
  }, [refreshReminders]);
  const acceptLoaded = useCallback((value: Document) => {
    setLoadError(null);
    latest.current = value; setDocument(value); setReady(true);
    refreshReminders(value);
    try { syncWidgets(value); setWidgetError(false); } catch { setWidgetError(true); }
  }, [refreshReminders]);
  const reportLoadError = () => setLoadError('端末の保存データを読み込めませんでした。データを保護するため、編集を停止しています。');
  const reload = async () => { await repository.load().then(acceptLoaded, reportLoadError); };
  useEffect(() => {
    void repository.load().then(acceptLoaded, reportLoadError);
  }, [repository, acceptLoaded]);
  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    // Refresh date labels/counts while foregrounded, including across midnight.
    const timer = setInterval(() => {
      const time = new Date();
      if (!sameLocalDay(clock.current, time)) refresh();
      else { clock.current = time; setNow(time); }
    }, 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [ready, refresh]);

  const update = async (change: (value: Document) => Document, widgets = true) => {
    if (!ready) throw new Error('読み込みが完了していません。');
    setPending(p => p + 1);
    try {
      const value = await repository.update(change);
      latest.current = value; setDocument(value);
      if (widgets) {
        refreshReminders(value);
        try { syncWidgets(value); setWidgetError(false); } catch { setWidgetError(true); }
      }
    } finally { setPending(p => p - 1); }
  };
  const store: Store = {
    document, now, ready, loadError, widgetError, reminderError, saving: pending > 0, reload, retryWidgets: refresh,
    saveTask: async (input, id) => {
      if (!validInput(input)) throw new Error('タスク名と期限を確認してください。');
      const original = latest.current.tasks.find(t => t.id === id);
      if (input.reminderAt && !original?.completedAt) {
        if (input.reminderAt !== original?.reminderAt && Date.parse(input.reminderAt) <= Date.now())
          throw new Error('通知日時は現在より後に設定してください。');
        if (Date.parse(input.reminderAt) > Date.now()) await requestReminderPermission();
      }
      await update(value => {
        const normalized: TaskInput = {
          title: input.title.trim(), note: input.note.trim(),
          urgent: input.urgent, important: input.important, dueAt: input.dueAt, reminderAt: input.reminderAt ?? null,
        };
        if (id && !value.tasks.some(t => t.id === id)) throw new Error('タスクが見つかりません。');
        const now = new Date().toISOString();
        const tasks = id ? value.tasks.map(t => t.id === id ? { ...t, ...normalized } : t) : [...value.tasks, {
          ...normalized, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, createdAt: now,
          order: Math.max(-1, ...value.tasks.map(t => t.order)) + 1, completedAt: null,
        }];
        if (plannedReminders(tasks).length > REMINDER_LIMIT) throw new Error('リマインダーは未通知の60件まで設定できます。');
        return { ...value, tasks, draft: null };
      });
    },
    toggle: id => update(v => {
      const tasks = v.tasks.map(t => t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date().toISOString() } : t);
      if (plannedReminders(tasks).length > REMINDER_LIMIT) throw new Error('リマインダーは未通知の60件まで設定できます。');
      return { ...v, tasks };
    }),
    remove: id => update(v => ({ ...v, tasks: v.tasks.filter(t => t.id !== id), draft: v.draft?.taskId === id ? null : v.draft })),
    move: (id, direction) => update(v => ({ ...v, tasks: reorder(v.tasks, id, direction) })),
    settings: settings => update(v => ({ ...v, settings })),
    draft: draft => update(v => ({ ...v, draft }), false),
  };
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error('StoreProvider is missing');
  return value;
}
