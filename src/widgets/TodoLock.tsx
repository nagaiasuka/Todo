import { AccessoryWidgetBackground, HStack, Image, Rectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { accessibilityElement, accessibilityLabel, containerBackground, font, foregroundStyle, frame, layoutPriority, lineLimit, minimumScaleFactor, monospacedDigit, multilineTextAlignment, opacity, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { LockProps } from './model';

const TodoLock = (props: LockProps, environment: WidgetEnvironment) => {
  'widget';
  // Everything used by this layout stays inside the isolated widget runtime.
  const count = typeof props.today === 'number';
  const next = typeof props.next === 'string';
  const empty = props.nextEmpty === true;
  const countText = count && props.today! > 999 ? '999+' : String(props.today ?? 0);
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const root = [widgetURL('todo-performance:///'), containerBackground('#00000000', 'widget')];

  if (environment.widgetFamily === 'accessoryInline') {
    const summary = [count ? `今日 ${props.today}件` : '', next ? empty ? 'タスクなし' : props.next : ''].filter(Boolean).join(' · ') || 'Todo';
    return <HStack spacing={4} modifiers={[...root, accessibilityElement('ignore'), accessibilityLabel(summary)]}>
      <Image systemName="checklist" modifiers={[font({ size: 12 }), accessibilityLabel('Todo')]} />
      <Text modifiers={[lineLimit(1)]}>{summary}</Text>
    </HStack>;
  }

  if (environment.widgetFamily === 'accessoryCircular') {
    const label = count ? `今日が期限の未完了タスク ${props.today}件` : next ? empty ? '未完了タスクはありません' : `次のタスク ${props.next}` : 'Todoを開く';
    return <ZStack modifiers={[...root, accessibilityElement('ignore'), accessibilityLabel(label)]}>
      <AccessoryWidgetBackground />
      {count ? <VStack spacing={0} modifiers={[padding({ horizontal: 5, vertical: 4 })]}>
        <Text modifiers={[font({ size: 10, weight: 'medium' }), lineLimit(1)]}>今日</Text>
        <Text modifiers={[font({ size: 27, weight: 'bold', design: 'rounded' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.6)]}>{countText}</Text>
        <Text modifiers={[font({ size: 9 }), lineLimit(1), secondary]}>件</Text>
      </VStack> : <VStack spacing={3} modifiers={[padding({ all: 6 })]}>
        <Image systemName={next && !empty ? 'arrow.right' : 'checklist'} modifiers={[font({ size: 12, weight: 'semibold' })]} />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), lineLimit(2), multilineTextAlignment('center')]}>{next ? empty ? 'タスクなし' : props.next : 'Todo'}</Text>
      </VStack>}
    </ZStack>;
  }

  if (!count && !next) {
    return <HStack spacing={7} modifiers={[...root, accessibilityElement('ignore'), accessibilityLabel('Todoを開く')]}>
      <Image systemName="checklist" modifiers={[font({ size: 18 })]} />
      <Text modifiers={[font({ size: 16, weight: 'semibold' })]}>Todo</Text>
    </HStack>;
  }

  return <HStack alignment="center" spacing={6} modifiers={root}>
    {count && <VStack alignment={next ? 'center' : 'leading'} spacing={0} modifiers={[
      ...(next ? [frame({ width: 32 })] : []), accessibilityElement('ignore'), accessibilityLabel(`今日が期限の未完了タスク ${props.today}件`),
    ]}>
      <Text modifiers={[font({ size: 10, weight: 'medium' }), lineLimit(1), secondary]}>今日</Text>
      <HStack alignment="firstTextBaseline" spacing={2}>
        <Text modifiers={[font({ size: next ? props.today! > 999 ? 22 : 28 : 34, weight: 'bold', design: 'rounded' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.6)]}>{countText}</Text>
        {!next && <Text modifiers={[font({ size: 12 }), secondary]}>件</Text>}
      </HStack>
      {next && <Text modifiers={[font({ size: 9 }), lineLimit(1), secondary]}>件</Text>}
    </VStack>}
    {count && next && <Rectangle modifiers={[frame({ width: 1, height: 40 }), opacity(0.25)]} />}
    {next && <VStack alignment="leading" spacing={2} modifiers={[layoutPriority(1), accessibilityElement('ignore'), accessibilityLabel(empty ? '未完了タスクはありません' : `次のタスク ${props.next}${props.nextDeadline ? `、期限 ${props.nextDeadline}` : ''}`)]}>
      <HStack spacing={4}>
        <Image systemName={empty ? 'checkmark.circle' : 'arrow.right'} modifiers={[font({ size: 9, weight: 'semibold' }), secondary]} />
        <Text modifiers={[font({ size: 10, weight: 'medium' }), lineLimit(1), secondary]}>{empty ? '未完了タスク' : '次のタスク'}</Text>
      </HStack>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), lineLimit(2), multilineTextAlignment('leading')]}>{empty ? 'タスクなし' : props.next}</Text>
      {!empty && props.nextDeadline && <Text modifiers={[font({ size: 10, weight: 'medium' }), monospacedDigit(), lineLimit(1), secondary]}>{props.nextDeadline}</Text>}
    </VStack>}
  </HStack>;
};
export default createWidget<LockProps>('TodoLock', TodoLock, {});
