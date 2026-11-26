import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { color } from '@/theme';
import { AuthProvider, useAuth } from '@/features/authSession';

function AppStack() {
  const { canEnter, ready } = useAuth();
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: styles.screen }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!canEnter}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verification" />
      </Stack.Protected>
      <Stack.Protected guard={canEnter}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });

  return (
    <View style={[styles.frame, Platform.OS === 'web' && styles.webFrame]}>
      <StatusBar style="dark" />
      {(loaded || error) && (
        <AuthProvider><AppStack /></AuthProvider>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', backgroundColor: color.white },
  webFrame: { maxWidth: 430, alignSelf: 'center', boxShadow: '0px 0px 50px #2B21421A' },
  screen: { backgroundColor: color.white },
});
