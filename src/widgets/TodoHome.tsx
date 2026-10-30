import { Text, VStack } from '@expo/ui/swift-ui';
import { font, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { HomeProps } from './model';

// The config plugin replaces the home entry's view with the native adaptive
// layout. Expo still owns its App Group, timeline, widget kind and reloads.
// This pure initial layout also registers the widget with Expo's JS registry.
const TodoHome = (props: HomeProps) => {
  'widget';
  return <VStack modifiers={[widgetURL('todo-performance:///')]}>
    <Text modifiers={[font({ weight: 'bold', size: 18 })]}>Todo</Text>
    <Text>{props.total}件の未完了タスク</Text>
  </VStack>;
};
export default createWidget<HomeProps>('TodoHome', TodoHome, { rows: [], total: 0, theme: 'light' });
