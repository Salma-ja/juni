import { useRouter } from 'expo-router';
import { ArrowLeft, Check, CircleCheck, Eye, EyeOff, GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { BottomSheet, Button, Copy, Pile, Row, TextLink } from '@/components/ui';
import { authClient, displayStudentDomains, isVerifiedStudent, normalizeDigits, normalizePhone, universityEmail, useAuth } from '@/features/authSession';
import { DemoAccess } from '@/features/access';
import { font, shadow } from '@/theme';

const pink = '#E90076';
const ink = '#272039';
const muted = '#817C8D';
const green = '#229B67';
const purple = '#773B92';

const passwordRules = [
  { label: '8+ characters', test: (password: string) => password.length >= 8 },
  { label: '1 number', test: (password: string) => /[0-9]/.test(password) },
  { label: '1 uppercase', test: (password: string) => /[A-Z]/.test(password) },
];

type Step = 'details' | 'sms' | 'send-email' | 'email';
type Gender = 'female' | 'male';

export default function Register() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [step, setStep] = useState<Step>('details');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const address = universityEmail(email);
  const number = normalizePhone(`+962${phone}`);
  const detailsValid = Boolean(address && number && /^7\d{8}$/.test(phone)
    && accepted && passwordRules.every(({ test }) => test(password)));
  const login = () => { if (!busy) router.dismissTo('/login'); };

  async function submit() {
    if (busy) return;
    if (!address || !number || (step !== 'email' && !detailsValid)) {
      setError(!address ? `Use an eligible university email (${displayStudentDomains()}).`
        : !/^7\d{8}$/.test(phone) ? 'Enter your mobile number after +962.'
        : !passwordRules.every(({ test }) => test(password)) ? 'Your password must meet all three requirements.'
        : 'Accept the Terms and Privacy Policy to continue.');
      return;
    }
    const client = authClient;
    if (!client) {
      setError('Verification is unavailable until messaging is configured.');
      return;
    }
    if ((step === 'sms' || step === 'email') && !/^\d{6}$/.test(token)) {
      setError('Enter the six-digit verification code.');
      return;
    }
    setError('');
    setBusy(true);
    Keyboard.dismiss();
    try {
      if (step === 'details') {
        const { error: sendError } = await client.auth.signInWithOtp({
          phone: number,
          options: { channel: 'sms', shouldCreateUser: true },
        });
        if (sendError) throw sendError;
        setStep('sms');
        return;
      }
      if (step === 'email') {
        const { error: verifyError } = await client.auth.verifyOtp({ email: address, token, type: 'email_change' });
        if (verifyError) throw verifyError;
        const { data, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (data.user?.email?.toLowerCase() !== address || !data.user.email_confirmed_at) {
          setError('Your university email is still pending confirmation.');
        }
        return;
      }
      if (step === 'sms') {
        const { data, error: verifyError } = await client.auth.verifyOtp({ phone: number, token, type: 'sms' });
        if (verifyError) throw verifyError;
        if (isVerifiedStudent(data.user)) return;
        setStep('send-email');
        setToken('');
      }
      const { error: updateError } = await client.auth.updateUser({
        email: address,
        password,
        data: { gender },
      });
      if (updateError) throw updateError;
      setPassword('');
      setVisible(false);
      setStep('email');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete verification. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function abandonVerification() {
    if (busy) return;
    if (step === 'sms') {
      setStep('details');
      setToken('');
      setError('');
      return;
    }
    if (authClient && user) {
      setBusy(true);
      try {
        const { error: signOutError } = await authClient.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not end this session.');
        return;
      } finally {
        setBusy(false);
      }
    }
    router.dismissTo('/login');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={styles.orbit} />
      <View pointerEvents="none" style={styles.dot} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={step === 'details' ? login : abandonVerification}
          style={styles.back}><ArrowLeft size={20} color={ink} /></Pressable>
        <Copy accessibilityRole="header" size={28} weight={800} tint={ink} style={styles.title}>Create your account</Copy>
        <Row gap={6} style={styles.subtitle}>
          <GraduationCap size={16} color={purple} />
          <Copy size={13} weight={600} tint={purple}>Only for verified university students</Copy>
        </Row>
        {step === 'details' ? (
          <>
            <Pile gap={14}>
              <Pile gap={7}>
                <Label>University email</Label>
                <Row style={[styles.inputBox, address && styles.validEmail]}>
                  <Input accessibilityLabel="University email" value={email} keyboardType="email-address" autoComplete="email"
                    placeholder="rama.k21@just.edu.jo" onChangeText={(value) => { setEmail(value); setError(''); }} />
                  {address && <CircleCheck size={20} color={green} />}
                </Row>
                {!!address && <Copy size={11} tint={green}>University email recognized ✓ — we’ll send you a confirmation code</Copy>}
              </Pile>
              <Pile gap={7}>
                <Label>Phone number</Label>
                <Row gap={10} style={styles.inputBox}>
                  <JordanFlag />
                  <Copy size={14} weight={800} tint={ink}>+962</Copy>
                  <View style={styles.phoneDivider} />
                  <Input accessibilityLabel="Jordanian mobile number" value={phone} placeholder="7X XXX XXXX" keyboardType="phone-pad"
                    autoComplete="tel-national" onChangeText={(value) => {
                      setPhone(normalizeDigits(value).replace(/\D/g, '').replace(/^(?:00962|962|0)/, '').slice(0, 9));
                      setError('');
                    }} />
                </Row>
              </Pile>
              <Pile gap={7}>
                <Label>Gender</Label>
                <Row gap={4} style={styles.segments}>
                  {(['female', 'male'] as const).map((value) => (
                    <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: gender === value }}
                      onPress={() => setGender(value)} style={[styles.segment, gender === value && styles.selectedSegment]}>
                      <View style={[styles.radio, gender === value && styles.selectedRadio]} />
                      <Copy size={14} weight={gender === value ? 800 : 500} tint={gender === value ? ink : muted}>
                        {value === 'female' ? 'Female' : 'Male'}
                      </Copy>
                    </Pressable>
                  ))}
                </Row>
                <Copy size={11} tint={muted}>Used to match you with girls-only or boys-only ride groups</Copy>
              </Pile>
              <Pile gap={7}>
                <Label>Password</Label>
                <Row style={[styles.inputBox, styles.passwordBox]}>
                  <Input accessibilityLabel="Password" value={password} placeholder="••••••••" autoComplete="new-password"
                    secureTextEntry={!visible} onChangeText={(value) => { setPassword(value); setError(''); }} />
                  <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                    hitSlop={10} onPress={() => setVisible(!visible)}>
                    {visible ? <EyeOff size={19} color={muted} /> : <Eye size={19} color={muted} />}
                  </Pressable>
                </Row>
                <Row gap={12} style={styles.rules}>
                  {passwordRules.map(({ label, test }) => {
                    const met = test(password);
                    return <Row key={label} gap={4}>
                      <CircleCheck size={13} color={met ? pink : muted} strokeWidth={2.8} />
                      <Copy size={10} weight={met ? 700 : 400} tint={met ? ink : muted}>{label}</Copy>
                    </Row>;
                  })}
                </Row>
              </Pile>
            </Pile>
            <Pile gap={13} style={styles.footer}>
              <Row gap={9} style={styles.consent}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel="I agree to the Terms and Privacy Policy"
                  accessibilityState={{ checked: accepted }} hitSlop={7} onPress={() => setAccepted(!accepted)}
                  style={[styles.checkbox, accepted && styles.checked]}>
                  {accepted && <Check size={15} strokeWidth={3} color="#FFF" />}
                </Pressable>
                <Row gap={4} style={styles.consent}>
                  <Copy size={12} tint={muted}>I agree to the</Copy>
                  <TextLink onPress={() => setPolicyOpen(true)} tint={pink} size={12}>Terms & Privacy Policy</TextLink>
                </Row>
              </Row>
              {!!error && <Copy accessibilityRole="alert" tint="#A72A47">{error}</Copy>}
              <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }}
                onPress={submit} style={({ pressed }) => [styles.submit, (pressed || busy) && styles.dim]}>
                <Copy size={15} weight={800} tint="#FFF">{busy ? 'Please wait…' : 'Create account'}</Copy>
              </Pressable>
              <Row gap={4} style={styles.login}>
                <Copy size={13} tint={muted}>Already have an account?</Copy><TextLink tint={pink} onPress={login} size={13}>Log in</TextLink>
              </Row>
              <DemoAccess />
            </Pile>
          </>
        ) : (
          <Pile gap={14} style={{ marginTop: 8 }}>
            <Copy accessibilityRole="header" tint={ink} size={20} weight={800}>
              {step === 'sms' ? 'Verify your phone' : 'Verify your university email'}
            </Copy>
            <Copy tint={muted} size={13}>
              {step === 'sms' ? `Enter the code sent to ${number}.` : step === 'email'
                ? `Enter the code sent to ${address}.` : `Send a verification code to ${address}.`}
            </Copy>
            {step !== 'send-email' && (
              <Row style={styles.inputBox}>
                <Input accessibilityLabel="Verification code" placeholder="6-digit code" keyboardType="number-pad" autoComplete="one-time-code"
                  value={token} onChangeText={(value) => setToken(normalizeDigits(value).replace(/\D/g, '').slice(0, 6))}
                  returnKeyType="go" onSubmitEditing={submit} />
              </Row>
            )}
            {!!error && <Copy accessibilityRole="alert" tint="#A72A47">{error}</Copy>}
            <Button disabled={busy} onPress={submit}>{busy ? 'Please wait…' : step === 'send-email' ? 'Send email code' : 'Verify code'}</Button>
          </Pile>
        )}
      </ScrollView>
      {policyOpen && (
        <BottomSheet onClose={() => setPolicyOpen(false)}>
          <Copy accessibilityRole="header" tint={ink} size={20} weight={800}>Terms & Privacy Policy</Copy>
          <Copy tint={muted} size={13}>JUNI has not published its terms or privacy policy yet.</Copy>
          <Button tone="secondary" onPress={() => setPolicyOpen(false)}>Close</Button>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

function JordanFlag() {
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={22} height={15} viewBox="0 0 22 15">
        <Rect width={22} height={15} fill="#FFF" />
        <Rect width={22} height={5} fill="#171717" />
        <Rect y={10} width={22} height={5} fill="#007A3D" />
        <Polygon points="0,0 11,7.5 0,15" fill="#CE1126" />
        <Polygon points="4,5.2 4.5,6.5 5.9,6 5.2,7.3 6.1,8.3 4.8,8.1 4,9.4 3.5,8.1 2.1,8.3 3,7.3 2.3,6 3.6,6.5" fill="#FFF" />
      </Svg>
    </View>
  );
}

function Input(props: TextInputProps) {
  return <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={muted} {...props} style={styles.inputText} />;
}

function Label({ children }: { children: string }) {
  return <Copy tint={ink} size={13} weight={700}>{children}</Copy>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F5FA', overflow: 'hidden' },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 9 },
  orbit: { position: 'absolute', top: -141, right: -120, width: 258, height: 285, borderRadius: 180, backgroundColor: '#F0EAF4' },
  dot: { position: 'absolute', top: 128, right: -25, width: 60, height: 60, borderRadius: 30, backgroundColor: pink },
  back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#E2DDE6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  title: { marginTop: 17, letterSpacing: -1.05 },
  subtitle: { marginTop: 7, marginBottom: 22 },
  inputBox: { minHeight: 54, borderRadius: 15, backgroundColor: '#F0EAF4', borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 15 },
  inputText: { flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: font[500], fontSize: 14, color: ink },
  validEmail: { borderColor: green },
  phoneDivider: { width: 1, height: 21, backgroundColor: '#DED7E4' },
  segments: { minHeight: 54, padding: 4, borderRadius: 15, backgroundColor: '#F0EAF4' },
  segment: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11 },
  selectedSegment: { borderWidth: 1.5, borderColor: pink, backgroundColor: '#FFF', ...shadow(2, 4, '#D8007026') },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#DAD3E1', backgroundColor: '#FFF' },
  selectedRadio: { borderWidth: 5, borderColor: pink },
  passwordBox: { backgroundColor: '#FFF', borderColor: pink, borderWidth: 1.5, ...shadow(0, 4, '#E9007644') },
  rules: { flexWrap: 'wrap', marginTop: 3 },
  footer: { marginTop: 'auto', paddingTop: 24 },
  consent: { flexWrap: 'wrap' },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: pink, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: pink },
  submit: { minHeight: 54, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: pink, ...shadow(8, 18, '#E9007650') },
  dim: { opacity: 0.76 },
  login: { justifyContent: 'center', marginBottom: 3 },
});
