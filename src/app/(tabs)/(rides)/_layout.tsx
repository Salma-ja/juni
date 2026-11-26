import { Stack } from 'expo-router';
import { color } from '@/theme';

export const unstable_settings = { anchor: 'rides' };

export default function RidesStack() {
  return <Stack initialRouteName="rides" screenOptions={{
    headerShown: false, animation: 'none', contentStyle: { backgroundColor: color.white },
  }} />;
}
