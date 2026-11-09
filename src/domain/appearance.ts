export const themeColors = {
  green: { label: 'グリーン', accent: '#D7E9AC', accentText: '#293B17', control: '#527D1D', darkControl: '#A4C972' },
  blue: { label: 'ブルー', accent: '#C9E2F8', accentText: '#183B59', control: '#326C9B', darkControl: '#8FC2EB' },
  lavender: { label: 'ラベンダー', accent: '#E0D5F4', accentText: '#46305F', control: '#79569E', darkControl: '#C1A4E5' },
  rose: { label: 'ローズ', accent: '#F4D4DF', accentText: '#633044', control: '#A14F6B', darkControl: '#E6A4BD' },
  orange: { label: 'オレンジ', accent: '#F6DEB9', accentText: '#593A17', control: '#926019', darkControl: '#E3BB7B' },
  gray: { label: 'グレー', accent: '#DFE2E3', accentText: '#343C40', control: '#59666D', darkControl: '#B4BFC5' },
} as const;
export type ThemeColor = keyof typeof themeColors;
export function isThemeColor(value: unknown): value is ThemeColor {
  return typeof value === 'string' && Object.hasOwn(themeColors, value);
}
