import type { ViewStyle } from 'react-native';

export const color = {
  brand: '#EC007A',
  ink: '#122333',
  navy: '#2B2142',
  muted: '#756D86',
  line: '#EBE5F0',
  white: '#FFFFFF',
  pink: '#FFF0F7',
  soft: '#F7F3F9',
  sage: '#F3F7F6',
  danger: '#D94444',
  amber: '#8F6516',
} as const;

export const font = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  650: 'PlusJakartaSans_700Bold',
  700: 'PlusJakartaSans_700Bold',
  750: 'PlusJakartaSans_800ExtraBold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

export type Weight = keyof typeof font;

export const radius = { field: 14, button: 15, card: 18, sheet: 23, pill: 999 };
export const spacing = { page: 20, button: 54, tabBar: 79 };

export function shadow(y: number, blur: number, tint: string): ViewStyle {
  return { boxShadow: `0px ${y}px ${blur}px ${tint}` };
}
