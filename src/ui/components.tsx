import { Pressable, Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './theme';
import type { ReactNode } from 'react';

export function Action({ children, onPress, secondary = false, disabled = false, label, style }: {
  children: ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, { backgroundColor: secondary ? c.field : c.accent, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}>
    <Text style={[styles.actionText, { color: secondary ? c.text : c.accentText }]}>{children}</Text>
  </Pressable>;
}
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 760, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  action: { minHeight: 48, minWidth: 48, maxWidth: '100%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontWeight: '700', fontSize: 15, textAlign: 'center' },
  field: { borderRadius: 12, padding: 14, fontSize: 17, minHeight: 50, borderWidth: 1 },
});
