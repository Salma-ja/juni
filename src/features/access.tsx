import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle2, ChevronDown, LockKeyhole, ShieldCheck, Upload } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, center, Copy, Eyebrow, Field, fill, Header, Logo, Notice, Page, Pile, Row, spread, TextLink, Tile } from '@/components/ui';
import { color } from '@/theme';

const demoEmail = 'salma@just.edu.jo';
const demoPassword = process.env.EXPO_PUBLIC_JUNI_DEMO_PASSWORD;

export function Splash() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/login'), 3200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <LinearGradient colors={['#3A2758', '#2B2142', '#201731']} locations={[0, 0.58, 1]}
      start={{ x: 0.24, y: 0 }} end={{ x: 0.85, y: 1 }} style={fill}>
      <StatusBar style="light" />
      <SafeAreaView style={fill}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tap to continue"
          onPress={() => router.replace('/login')} style={styles.splash}>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  function logIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!demoPassword) {
      setFeedback({ text: 'Demo sign-in is not configured on this device.', error: true });
      return;
    }
    if (!normalizedEmail || !password) {
      setFeedback({ text: 'Enter your university email and password.', error: true });
      return;
    }
    if (normalizedEmail !== demoEmail || password !== demoPassword) {
      setFeedback({ text: 'The email or password is incorrect. Use the JUNI demo account to sign in.', error: true });
      return;
    }
    setFeedback(null);
    Keyboard.dismiss();
    router.push('/verification');
  }

  return (
    <Page mode="auth">
      <Logo />
      <Pile gap={8} style={styles.authHeading}>
        <Eyebrow>WELCOME BACK</Eyebrow>
        <Copy accessibilityRole="header" size={28} weight={800} style={styles.title}>Ready for your next ride?</Copy>
        <Copy size={14} tint={color.muted} style={styles.subtitle}>Log in with your university account.</Copy>
      </Pile>
      <Pile gap={15}>
        <Field label="University email" placeholder={demoEmail} keyboardType="email-address" autoCapitalize="none"
          autoComplete="email" value={email} onChangeText={(value) => { setEmail(value); setFeedback(null); }} />
        <Field label="Password" placeholder="Enter your password" secureTextEntry autoComplete="current-password"
          value={password} onChangeText={(value) => { setPassword(value); setFeedback(null); }}
          returnKeyType="go" onSubmitEditing={logIn} />
        <TextLink style={{ alignSelf: 'flex-end', marginTop: -5 }} onPress={() => setFeedback({
          text: demoPassword ? `Demo sign-in: ${demoEmail} / ${demoPassword}` : 'Demo sign-in is not configured on this device.',
          error: false,
        })}>Forgot password?</TextLink>
        {feedback && <Copy accessibilityRole="alert" accessibilityLiveRegion="polite"
          tint={feedback.error ? color.danger : color.muted}>{feedback.text}</Copy>}
        <Button onPress={logIn}>Log in</Button>
      </Pile>
      <Row gap={5} style={styles.authSwitch}>
        <Copy size={13} tint={color.muted}>New to JUNI?</Copy>
        <TextLink onPress={() => router.push('/register')} size={13}>Create account</TextLink>
      </Row>
    </Page>
  );
}

export function Register() {
  const router = useRouter();
  return (
    <Page>
      <Header title="Create account" eyebrow="JOIN JUNI" onBack={() => router.dismissTo('/login')} />
      <Pile gap={8} style={{ marginBottom: 25 }}>
        <Copy accessibilityRole="header" size={28} weight={800} style={styles.title}>Your campus rides, organized.</Copy>
        <Copy size={14} tint={color.muted} style={styles.subtitle}>Use your university email so we can keep the community trusted.</Copy>
      </Pile>
      <Pile gap={15}>
        <Field label="Full name" placeholder="Salma Ahmad" autoComplete="name" />
        <Field label="University email" placeholder="salma@just.edu.jo" keyboardType="email-address" autoCapitalize="none"
          autoComplete="email" />
        <Field label="Password" placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" />
        <Pile gap={7}>
          <Copy size={12} tint="#344952" weight={700}>University</Copy>
          <Row style={styles.select}>
            <Copy size={12} tint={color.navy} style={fill}>JUST — Jordan University of Science and Technology</Copy>
            <ChevronDown size={18} color={color.navy} />
          </Row>
        </Pile>
        <Button onPress={() => router.push('/verification')}>Create account</Button>
      </Pile>
      <Copy size={10} tint="#8B979B" style={[center, styles.legal]}>
        By continuing, you agree to JUNI’s Terms and Privacy Policy.
      </Copy>
    </Page>
  );
}

export function Verification() {
  const [uploaded, setUploaded] = useState(false);
  const router = useRouter();
  const UploadIcon = uploaded ? CheckCircle2 : Upload;
  return (
    <Page>
      <Header title="Student verification" onBack={() => router.dismissTo('/login')} />
      <Pile gap={8} style={styles.verificationHero}>
        <Tile icon={ShieldCheck} size={65} iconSize={32} style={{ marginBottom: 8 }} />
        <Copy accessibilityRole="header" size={24} weight={800} style={[center, { letterSpacing: -0.96 }]}>Keep every ride student-only</Copy>
        <Copy size={13} tint={color.muted} style={[center, { lineHeight: 20 }]}>Upload a valid university ID. Your details stay private.</Copy>
      </Pile>
      <Notice icon={LockKeyhole}>Only verified students can join ride groups.</Notice>
      <Pressable accessibilityRole="button" onPress={() => setUploaded(true)} style={[styles.upload, uploaded && styles.uploaded]}>
        <UploadIcon size={28} color={color.brand} />
        <Copy size={14} weight={800} tint={color.navy}>{uploaded ? 'University ID uploaded' : 'Upload university ID'}</Copy>
        <Copy size={11} tint={color.muted}>{uploaded ? 'student-id-salma.jpg · 1.2 MB' : 'JPG, PNG or PDF · up to 5 MB'}</Copy>
      </Pressable>
      <Row style={[spread, { paddingVertical: 10, paddingHorizontal: 3 }]}>
        <Copy>Verification status</Copy>
        <Badge tone={uploaded ? 'green' : 'amber'}>{uploaded ? 'Verified' : 'Pending'}</Badge>
      </Row>
      <Button disabled={!uploaded} style={{ marginTop: 24 }} onPress={() => router.dismissTo('/home')}>
        {uploaded ? 'Continue to JUNI' : 'Upload proof to continue'}
      </Button>
    </Page>
  );
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
  select: { minHeight: 54, borderWidth: 1, borderColor: color.line, borderRadius: 14, backgroundColor: '#F9FBFA', paddingHorizontal: 15 },
  legal: { lineHeight: 15, marginTop: 20, marginHorizontal: 30 },
  verificationHero: { alignItems: 'center', paddingTop: 16, paddingBottom: 21, paddingHorizontal: 8 },
  upload: {
    minHeight: 170, marginVertical: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B8C8C3',
    backgroundColor: '#F8FBFA', borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  uploaded: { backgroundColor: color.pink, borderColor: '#7ECDB7', borderStyle: 'solid' },
});
