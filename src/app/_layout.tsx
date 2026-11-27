import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ui';
import { AuthProvider, useAuth } from '@/features/authSession';
import { LiveUpdatesProvider } from '@/features/liveUpdates';
import { LocationProvider } from '@/features/locationState';
import { RehearsalBar } from '@/features/rehearsalBar';
import { color } from '@/theme';

function AppStack() {
  const { canEnter, ready, profile } = useAuth();
  const captain = canEnter && profile?.role === 'captain';
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: styles.screen }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!canEnter}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verification" />
      </Stack.Protected>
      <Stack.Protected guard={canEnter && !captain}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={captain}>
        <Stack.Screen name="(captain)" />
      </Stack.Protected>
    </Stack>
  );
}

function Shell() {
  // The rehearsal strip (account switcher + seed reset) is a developer tool: hidden unless EXPO_PUBLIC_SHOW_DEMO_BAR=true.
  const [rehearsal, setRehearsal] = useState(false);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_SHOW_DEMO_BAR !== 'true') return;
    fetch('/api/config').then((r) => r.json()).then((j) => setRehearsal(Boolean(j.rehearsalMode))).catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1 }}>
      {rehearsal ? <RehearsalBar /> : null}
      <View style={[styles.frame, Platform.OS === 'web' && styles.webFrame]}>
        <LocationProvider>
          <LiveUpdatesProvider>
            <AppStack />
          </LiveUpdatesProvider>
        </LocationProvider>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <View style={[styles.outer, scheme === 'dark' && { backgroundColor: '#121212' }]}>
        <StatusBar style="dark" />
        {(loaded || error) && (
          <ErrorBoundary>
            <AuthProvider>
              <Shell />
            </AuthProvider>
          </ErrorBoundary>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#120D1D' },
  frame: { flex: 1, width: '100%', backgroundColor: color.white, overflow: 'hidden' },
  webFrame: { maxWidth: 430, alignSelf: 'center', boxShadow: '0px 0px 50px #00000040' },
  screen: { backgroundColor: color.white },
});
