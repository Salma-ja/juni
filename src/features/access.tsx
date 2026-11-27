import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, center, Copy, Eyebrow, fill, Logo, Page, Pile, Row, TextLink } from '@/components/ui';
import { color } from '@/theme';
import { claimPersona, config, type Gender } from '@/data/api';
import { useAuth } from '@/features/authSession';

export function Splash() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { ready, canEnter } = useAuth();
  const destination = canEnter ? '/home' : '/login';
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => router.replace(destination), canEnter ? 0 : 3200);
    return () => clearTimeout(timer);
  }, [canEnter, destination, ready, router]);

  return (
    <LinearGradient colors={['#3A2758', '#2B2142', '#201731']} locations={[0, 0.58, 1]}
      start={{ x: 0.24, y: 0 }} end={{ x: 0.85, y: 1 }} style={fill}>
      <StatusBar style="light" />
      <SafeAreaView style={fill}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tap to continue"
          onPress={() => { if (ready) router.replace(destination); }} style={styles.splash}>
          <View pointerEvents="none" style={[styles.orbit, styles.orbitLarge]} />
          <View pointerEvents="none" style={[styles.orbit, styles.orbitSmall]} />
          <View style={styles.splashLogo}><Logo light splash /></View>
          <Pile gap={13}>
            <Copy accessibilityRole="header" size={Math.max(34, Math.min(width / 10, 46))}
              weight={800} tint={color.white} style={styles.splashTitle}>Smart university carpooling.</Copy>
            <Copy size={15} tint="#FFFFFFB8" style={{ lineHeight: 24 }}>Safer rides. Better matches. Campus on time.</Copy>
          </Pile>
          <Copy size={11} tint="#FFFFFF8C" style={{ letterSpacing: 1.65 }}>TAP TO CONTINUE</Copy>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Login() {
  const router = useRouter();
  return (
    <Page mode="auth">
      <Logo />
      <Pile gap={8} style={styles.authHeading}>
        <Eyebrow>WELCOME BACK</Eyebrow>
        <Copy accessibilityRole="header" size={28} weight={800} style={styles.title}>
          Ready for your next ride?
        </Copy>
        <Copy size={14} tint={color.muted} style={styles.subtitle}>
          Try JUNI with a demo student. No account or verification code needed.
        </Copy>
      </Pile>
      <Pile gap={15}>
        <DemoAccess />
      </Pile>
      <Row gap={5} style={styles.authSwitch}>
        <Copy size={13} tint={color.muted}>New to JUNI?</Copy>
        <TextLink onPress={() => router.push('/register')} size={13}>Create account</TextLink>
      </Row>
    </Page>
  );
}

const personas: { gender: Gender; name: string; label: string }[] = [
  { gender: 'female', name: 'Salma', label: 'Salma · Girls-only rides' },
  { gender: 'male', name: 'Omar', label: 'Omar · Boys-only rides' },
];

/** "Continue as demo student": opens a sheet with two personas, claims a server session, enters the app. */
export function DemoAccess() {
  const router = useRouter();
  const { signInWithToken } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Gender | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    config().then((res) => { if (live && res.ok) setEnabled(res.data.demoLoginEnabled); });
    return () => { live = false; };
  }, []);

  async function choose(persona: (typeof personas)[number]) {
    if (busy) return;
    setBusy(persona.gender);
    setError('');
    const res = await claimPersona(persona.gender, persona.name);
    if (!res.ok) {
      setBusy(null);
      setError(res.code === 'DEMO_DISABLED' ? 'Demo login is turned off.' : 'Something went wrong. Try again.');
      return;
    }
    await signInWithToken(res.data.token, res.data.profile);
    setBusy(null);
    setOpen(false);
    router.replace('/home');
  }

  if (!enabled) return null;
  return (
    <Pile gap={6}>
      <Button onPress={() => setOpen(true)}>Continue as demo student</Button>
      <Copy size={11} tint={color.muted} style={center}>Demo mode · simulated verification</Copy>
      {open && (
        <BottomSheet onClose={() => { if (!busy) setOpen(false); }}>
          <Copy accessibilityRole="header" size={20} weight={800}>Choose a demo student</Copy>
          <Copy size={13} tint={color.muted}>Each tap starts a fresh demo profile, so your bookings are yours alone.</Copy>
          {personas.map((persona) => (
            <Button key={persona.gender} tone="secondary" disabled={busy !== null} onPress={() => choose(persona)}>
              {busy === persona.gender ? 'Starting…' : persona.label}
            </Button>
          ))}
          {!!error && <Copy accessibilityRole="alert" tint={color.danger}>{error}</Copy>}
        </BottomSheet>
      )}
    </Pile>
  );
}

/** The real OTP verification flow is out of scope for this build (handoff §6, §13). */
export function Verification() {
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 30, paddingTop: 60, paddingBottom: 32 },
  splashLogo: { alignSelf: 'center' },
  splashTitle: { letterSpacing: -1.9, maxWidth: 360, lineHeight: 44 },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: '#FFFFFF26', borderRadius: 999 },
  orbitLarge: { width: 420, height: 420, right: -230, top: 85 },
  orbitSmall: { width: 230, height: 230, right: -40, top: 180 },
  authHeading: { marginTop: 54, marginBottom: 28 },
  authSwitch: { justifyContent: 'center', marginTop: 'auto', paddingTop: 32 },
  title: { lineHeight: 33, letterSpacing: -1.12 },
  subtitle: { lineHeight: 22 },
});
