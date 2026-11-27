import { Stack } from 'expo-router';
import { color } from '@/theme';

export const unstable_settings = { anchor: 'rides' };

export default function RidesStack() {
  return <Stack initialRouteName="rides" screenOptions={{
    headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: color.white },
  }} />;
}
