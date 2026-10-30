import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { ReminderScheduler } from '../domain/reminders';
import { type Task } from '../domain/tasks';

Notifications.setNotificationHandler({ handleNotification: async () => ({
  shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
}) });

const isAllowed = (p: Notifications.NotificationPermissionsStatus) => p.granted ||
  p.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
  p.ios?.status === IosAuthorizationStatus.EPHEMERAL;

export async function requestReminderPermission(): Promise<void> {
  let permission = await Notifications.getPermissionsAsync();
  if (!isAllowed(permission) && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (!isAllowed(permission)) throw new Error('通知が許可されていません。iPhoneの設定からTodoの通知を許可してください。');
}

const scheduler = new ReminderScheduler({
  allowed: async () => isAllowed(await Notifications.getPermissionsAsync()),
  list: async () => (await Notifications.getAllScheduledNotificationsAsync()).map(r => ({
    identifier: r.identifier, title: r.content.body ?? '',
    taskId: String(r.content.data?.taskId ?? ''), at: String(r.content.data?.reminderAt ?? ''),
  })),
  cancel: id => Notifications.cancelScheduledNotificationAsync(id),
  schedule: async r => { await Notifications.scheduleNotificationAsync({
    identifier: r.identifier,
    content: { title: 'Todo リマインダー', body: r.title, sound: 'default',
      data: { taskId: r.taskId, reminderAt: r.at } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
  }); },
});
export const syncReminders = (tasks: Task[]) => scheduler.sync(tasks);

export function observeReminderTaps(open: (id: string) => void): () => void {
  let active = true;
  let last = '';
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response) return;
    const request = response.notification.request;
    const responseKey = `${request.identifier}:${response.notification.date}`;
    const id = request.content.data?.taskId;
    if (typeof id !== 'string' || !request.identifier.startsWith('todo-reminder:') || last === responseKey) return;
    last = responseKey;
    open(id);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
  return () => { active = false; subscription.remove(); };
}
