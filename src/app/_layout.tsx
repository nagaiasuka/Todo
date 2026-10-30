import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { observeReminderTaps } from '../notifications/reminders';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../data/Store';
import { ThemeProvider, useTheme } from '../ui/theme';
import { Action } from '../ui/components';

function ReminderNavigation() {
  useEffect(() => observeReminderTaps(id => router.push({ pathname: '/task', params: { id } })), []);
  return null;
}

function Navigator() {
  const c = useTheme();
  const store = useStore();
  if (!store.ready) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
    <StatusBar style={c.isDark ? 'light' : 'dark'} />
    {store.loadError ? <><Text style={{ color: c.text }}>{store.loadError}</Text><Action onPress={() => void store.reload()}>再読み込み</Action></> : <ActivityIndicator color={c.muted} accessibilityLabel="タスクを読み込み中" />}
  </View>;
  return <>
    <StatusBar style={c.isDark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="task" options={{ title: 'タスク', presentation: 'card', animation: 'none', gestureEnabled: false, headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: '設定' }} />
    </Stack>
    <ReminderNavigation />
  </>;
}
export default function RootLayout() {
  return <SafeAreaProvider><StoreProvider><ThemeProvider><Navigator /></ThemeProvider></StoreProvider></SafeAreaProvider>;
}
