import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, center, Copy, Eyebrow, Field, fill, Header, Logo, Notice, Page, Pile, Row, TextLink, Tile } from '@/components/ui';
import { color } from '@/theme';

import { authClient, displayStudentDomains, isVerifiedStudent, normalizeDigits, normalizePhone, universityEmail, useAuth } from '@/features/authSession';

const unavailable = 'Verification is unavailable until messaging is configured.';

export function Splash() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { ready, user, signedOut } = useAuth();
  const destination = isVerifiedStudent(user) ? '/home' : user?.phone_confirmed_at ? '/verification' : '/login';
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => router.replace(destination), user || signedOut ? 0 : 3200);
    return () => clearTimeout(timer);
  }, [destination, ready, router, signedOut, user]);

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
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!authClient) {
      setError(unavailable);
      return;
    }

    const number = sentTo || normalizePhone(phone);
    if (!number) {
      setError('Enter a valid mobile number, including the country code for international numbers.');
      return;
    }
    if (sentTo && !/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit SMS code.');
      return;
    }

    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      if (!sentTo) {
        const { error: authError } = await authClient.auth.signInWithOtp({
          phone: number,
          options: { shouldCreateUser: false, channel: 'sms' },
        });
        if (authError) throw authError;
        setSentTo(number);
      } else {
        const { error: authError } = await authClient.auth.verifyOtp({ phone: number, token, type: 'sms' });
        if (authError) throw authError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify your phone. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (user?.phone_confirmed_at && !isVerifiedStudent(user)) return <Redirect href="/verification" />;

  return (
    <Page mode="auth">
      <Logo />
      <Pile gap={8} style={styles.authHeading}>
        <Eyebrow>WELCOME BACK</Eyebrow>
        <Copy accessibilityRole="header" size={28} weight={800} style={styles.title}>
          Ready for your next ride?
        </Copy>
        <Copy size={14} tint={color.muted} style={styles.subtitle}>
          {sentTo ? `Enter the code sent to ${sentTo}.` : 'Log in with the SMS code sent to your mobile number.'}
        </Copy>
      </Pile>
      <Pile gap={15}>
        {sentTo ? (
          <>
            <CodeField label="SMS code" token={token} onChange={(value) => { setToken(value); setError(''); }} onSubmit={submit} />
            <TextLink onPress={() => { if (!busy) { setSentTo(''); setToken(''); setError(''); } }}>
              Change number or request a new code
            </TextLink>
          </>
        ) : (
          <Field label="Mobile number" placeholder="07XXXXXXXX" keyboardType="phone-pad" autoComplete="tel"
            value={phone} onChangeText={(value) => { setPhone(value); setError(''); }} returnKeyType="go" onSubmitEditing={submit} />
        )}
        <AuthFeedback error={error} />
        <Button disabled={busy} onPress={submit}>{busy ? 'Please wait…' : sentTo ? 'Verify SMS code' : 'Send SMS code'}</Button>
      </Pile>
      <Row gap={5} style={styles.authSwitch}>
        <Copy size={13} tint={color.muted}>New to JUNI?</Copy>
        <TextLink onPress={() => { if (!busy) router.push('/register'); }} size={13}>Create account</TextLink>
      </Row>
    </Page>
  );
}

export function Verification() {
  const router = useRouter();
  const { ready, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!authClient || busy) return;
    setBusy(true);
    try {
      const { error: authError } = await authClient.auth.signOut({ scope: 'local' });
      if (authError) throw authError;
      router.dismissTo('/login');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not end this session. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy || !authClient || !user?.phone_confirmed_at) return;
    const address = sentTo || universityEmail(email);
    if (!name.trim() || !address) {
      setError(!name.trim() ? 'Enter your full name.' : `Enter a supported student email (${displayStudentDomains()}).`);
      return;
    }
    if (sentTo && !/^\d{6}$/.test(token)) {
      setError('Enter the 6-digit code from your university inbox.');
      return;
    }

    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      if (!sentTo) {
        const { error: authError } = await authClient.auth.updateUser({
          email: address,
          data: { full_name: name.trim() },
        });
        if (authError) throw authError;
        setSentTo(address);
      } else {
        const { error: authError } = await authClient.auth.verifyOtp({ email: address, token, type: 'email_change' });
        if (authError) throw authError;
        const { data, error: userError } = await authClient.auth.getUser();
        if (userError) throw userError;
        if (data.user?.id !== user.id || data.user.email !== address || !isVerifiedStudent(data.user)) {
          setError('This email has not been confirmed. Check your inbox and try again.');
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify your university email. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!user?.phone_confirmed_at) return <Redirect href="/register" />;

  return (
    <Page>
      <Header title="Create account" eyebrow="STUDENT VERIFICATION" onBack={cancel} />
      <Pile gap={8} style={styles.verificationHero}>
        <Tile icon={ShieldCheck} size={65} iconSize={32} style={{ marginBottom: 8 }} />
        <Copy accessibilityRole="header" size={24} weight={800} style={center}>Verify your student email</Copy>
        <Copy size={13} tint={color.muted} style={[center, { lineHeight: 20 }]}>
          {sentTo ? `Enter the verification code sent to ${sentTo}.` : 'Use the email address issued to you by your university.'}
        </Copy>
      </Pile>
      <Notice icon={LockKeyhole}>Your phone is verified. Confirm your student email to continue.</Notice>
      <Pile gap={15} style={{ marginTop: 17 }}>
        {sentTo ? (
          <>
            <CodeField label="University email code" token={token} onChange={(value) => { setToken(value); setError(''); }} onSubmit={submit} />
            <TextLink onPress={() => { if (!busy) { setSentTo(''); setToken(''); setError(''); } }}>
              Change email or request a new code
            </TextLink>
          </>
        ) : (
          <>
            <Field label="Full name" placeholder="Full name" autoComplete="name" value={name}
              onChangeText={(value) => { setName(value); setError(''); }} />
            <Field label="University email" placeholder="student@university.edu.jo" keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} />
            <Copy size={10} tint={color.muted}>{`Supported student email domains: ${displayStudentDomains()}.`}</Copy>
          </>
        )}
        <AuthFeedback error={error} />
        <Button disabled={busy} onPress={submit}>{busy ? 'Please wait…' : sentTo ? 'Verify student email' : 'Send email code'}</Button>
      </Pile>
    </Page>
  );
}

function CodeField({ label, token, onChange, onSubmit }: {
  label: string; token: string; onChange: (value: string) => void; onSubmit: () => void;
}) {
  return <Field label={label} placeholder="6-digit code" value={token} keyboardType="number-pad"
    autoComplete="one-time-code" maxLength={6} onChangeText={(value) => onChange(normalizeDigits(value).replace(/\D/g, ''))}
    returnKeyType="go" onSubmitEditing={onSubmit} />;
}

function AuthFeedback({ error }: { error: string }) {
  if (!error) return null;
  return <Copy accessibilityRole="alert" accessibilityLiveRegion="polite" tint={color.danger}>{error}</Copy>;
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
  verificationHero: { alignItems: 'center', paddingTop: 16, paddingBottom: 21, paddingHorizontal: 8 },
});
