import { useColorScheme } from 'react-native';
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useStore } from '../data/Store';

export const palettes = {
  light: { isDark: false, bg: '#F7F5EF', card: '#FFFEFB', text: '#292E28', muted: '#656B61', line: '#DEDFD5', accent: '#D7E9AC', accentText: '#293B17', field: '#EFEEE7', danger: '#B63832' },
  dark: { isDark: true, bg: '#191B18', card: '#232620', text: '#F4F3EC', muted: '#B4BBAB', line: '#41463C', accent: '#D0E6A5', accentText: '#293B17', field: '#30362B', danger: '#FF9A8F' },
};
const ThemeContext = createContext(palettes.light);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { document } = useStore();
  const system = useColorScheme();
  const preference = document.settings.theme ?? 'light';
  const dark = preference === 'dark' || preference === 'system' && system === 'dark';
  return createElement(ThemeContext.Provider, { value: palettes[dark ? 'dark' : 'light'] }, children);
}
export const useTheme = () => useContext(ThemeContext);
