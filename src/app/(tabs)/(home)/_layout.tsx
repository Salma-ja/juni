import { Stack } from 'expo-router';
import { color } from '@/theme';

export const unstable_settings = { anchor: 'home' };

export default function HomeStack() {
  return <Stack initialRouteName="home" screenOptions={{
    headerShown: false, animation: 'none', contentStyle: { backgroundColor: color.white },
  }} />;
}
