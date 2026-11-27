import { Platform, type ViewStyle } from 'react-native';

export const color = {
  brand: '#E90076',
  brandDark: '#C20062',
  ink: '#1A1528',
  navy: '#271C3A',
  plum: '#34234D',
  muted: '#665E78',
  line: '#EAE4F2',
  white: '#FFFFFF',
  pink: '#FFF0F7',
  pinkBorder: '#F9C6E0',
  soft: '#F7F4FA',
  sage: '#F3F6F8',
  emerald: '#0D9462',
  emeraldSoft: '#E8FBF3',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  amber: '#B45309',
  amberSoft: '#FFFBEB',
  violet: '#6D28D9',
  violetSoft: '#F3E8FF',
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

export const radius = {
  field: 16,
  button: 999,
  card: 22,
  sheet: 28,
  pill: 999,
} as const;

export const spacing = {
  page: 20,
  touch: 48,
  button: 54,
  tabBar: 72,
} as const;

export function shadow(y: number, blur: number, tint: string): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: Math.max(2, Math.round(y / 2)) };
  }
  return { boxShadow: `0px ${y}px ${blur}px ${tint}` };
}
