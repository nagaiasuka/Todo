import { requireOptionalNativeModule } from 'expo';
import type { WidgetActionSource, WidgetCompletion } from '../domain/widgetActions';

const native = requireOptionalNativeModule<{
  readActions(): string;
  acknowledgeActions(ids: string[], completedTaskIds: string[]): void;
}>('TodoWidgetActions');

export const widgetActions: WidgetActionSource = {
  read: () => {
    if (!native) return [];
    const actions: WidgetCompletion[] = JSON.parse(native.readActions());
    if (!Array.isArray(actions) || actions.some(action => !action || typeof action.id !== 'string' ||
      typeof action.taskId !== 'string' || typeof action.completedAt !== 'string' || !Number.isFinite(Date.parse(action.completedAt)))) {
      throw new Error('ウィジェットの完了操作を読み込めませんでした。');
    }
    return actions;
  },
  acknowledge: (ids, completedTaskIds) => native?.acknowledgeActions(ids, completedTaskIds),
};
