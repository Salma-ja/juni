import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Car, CheckCircle2, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, center, Copy, Eyebrow, fill, Logo, Page, Pile, PulseDot, Row, ScalePressable, spread, Tile } from '@/components/ui';
import { DRIVER, RIDER } from '@/features/accounts';
import { useAuth } from '@/features/authSession';
import { useLocationPref } from '@/features/locationState';
import { color, shadow } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Jeeny App Host Frame + Figma 00a-00d Animated Concentric Ring Entry.
 * Shows how JUNI lives natively inside Jeeny's service tray — never a standalone marketing website.
 */
export function Splash() {
  const router = useRouter();
  const { ready, canEnter, profile } = useAuth();
  const { pickup, campus } = useLocationPref();
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(ringAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ringAnim]);

  const destination = canEnter ? (profile?.role === 'captain' ? '/driver' : '/home') : '/login';
  function openJuni() {
    if (ready) router.replace(destination);
  }

  return (
    <LinearGradient
      colors={['#2E1F47', '#271C3A', '#1B122B']}
      locations={[0, 0.55, 1]}
      style={fill}
    >
      <StatusBar style="light" />
      <SafeAreaView style={fill}>
        <View style={styles.splashTop}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ringOuter,
              {
                opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.5] }),
                transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] }) }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ringInner,
              {
                opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] }),
                transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1.04, 0.95] }) }],
              },
            ]}
          />

          <Row gap={8} style={styles.jeenyHostBadge}>
            <PulseDot tint="#FF5BB5" size={7} />
            <Copy size={12} weight={700} tint="#FFD1E8">Jeeny App · Campus Services</Copy>
          </Row>

          <View style={{ marginVertical: 20 }}>
            <Logo light splash />
          </View>
          <Copy size={15} weight={600} tint="#E0D5F2" style={center}>
            Book your university seat like a flight
          </Copy>
        </View>

        <View style={styles.serviceTray}>
          <View style={styles.trayHandle} />
          <Row style={spread}>
            <Pile gap={2}>
              <Copy size={12} weight={700} tint={color.muted}>JEENY RIDE OPTIONS</Copy>
              <Copy size={16} weight={800} tint={color.navy}>
                {`${pickup?.name ?? 'Hawara'} → ${campus?.code ?? 'JUST'}`}
              </Copy>
            </Pile>
            <Badge tone="brand">5 Universities</Badge>
          </Row>

          <Row style={styles.mutedService}>
            <Tile icon={Car} size={40} iconSize={18} background={color.soft} tint={color.muted} />
            <Pile gap={2} style={fill}>
              <Copy size={14} weight={700} tint={color.muted}>Economy</Copy>
              <Copy size={12} tint={color.muted}>On-demand · Solo car</Copy>
            </Pile>
            <Copy size={14} weight={700} tint={color.muted}>~3.70 JD</Copy>
          </Row>

          <ScalePressable accessibilityLabel="Select JUNI Campus Pool" onPress={openJuni} style={styles.juniService}>
            <Tile icon={GraduationCap} size={46} iconSize={22} background={color.brand} tint={color.white} />
            <Pile gap={3} style={fill}>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <Copy size={15} weight={800} tint={color.navy}>JUNI Campus</Copy>
                <Badge tone="brand">NEW</Badge>
              </Row>
              <Copy size={12} tint={color.muted}>Girls-only & Boys-only · +30 pts last seat</Copy>
            </Pile>
            <Pile gap={2} style={{ alignItems: 'flex-end' }}>
              <Copy size={15} weight={800} tint={color.brand}>From 1.12 JD</Copy>
              <Copy size={12} tint={color.emerald} weight={700}>Scheduled</Copy>
            </Pile>
          </ScalePressable>

          <Button onPress={openJuni} trailingArrow style={{ marginTop: 4 }}>
            Open JUNI Campus
          </Button>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Login() {
  return (
    <Page mode="auth">
      <Logo />
      <Pile gap={8} style={styles.authHeading}>
        <Eyebrow>VERIFIED CAMPUS ACCESS</Eyebrow>
        <Copy accessibilityRole="header" size={28} weight={800} tint={color.navy} style={styles.title}>
          Sign in with your Jeeny campus profile
        </Copy>
        <Copy size={14} tint={color.muted} style={styles.subtitle}>
          Verified .edu.jo students across JUST, YU, INU, UJ & AAU ride in gender-isolated groups.
        </Copy>
      </Pile>

      <DemoAccess />

      <Card style={styles.trustCard}>
        <Row gap={10}>
          <ShieldCheck size={20} color={color.brand} />
          <Copy size={12} tint={color.muted} style={fill}>
            Verified via university .edu.jo mailbox + Jeeny phone OTP. Select a role above to continue.
          </Copy>
        </Row>
      </Card>
    </Page>
  );
}

export function DemoAccess() {
  const router = useRouter();
  const { switchAccount } = useAuth();
  const [busy, setBusy] = useState<'rider' | 'driver' | null>(null);
  const [error, setError] = useState('');

  async function choose(slot: 'rider' | 'driver') {
    if (busy) return;
    setBusy(slot);
    setError('');
    try {
      await switchAccount(slot);
      router.replace(slot === 'driver' ? '/driver' : '/home');
    } catch {
      setError('Could not connect. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Pile gap={12}>
      <Button icon={Sparkles} disabled={busy !== null} onPress={() => choose('rider')} trailingArrow>
        {busy === 'rider' ? 'Signing in…' : `Continue as ${RIDER.name} (Student)`}
      </Button>
      <Button tone="dark" icon={CheckCircle2} disabled={busy !== null} onPress={() => choose('driver')}>
        {busy === 'driver' ? 'Signing in…' : `Continue as ${DRIVER.name} (Captain)`}
      </Button>
      {!!error && <Copy accessibilityRole="alert" tint={color.danger} style={center}>{error}</Copy>}
    </Pile>
  );
}

export function Verification() {
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  splashTop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ringOuter: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    borderWidth: 1.5,
    borderColor: '#E9007666',
  },
  ringInner: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1.5,
    borderColor: '#FF77BC80',
  },
  jeenyHostBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#3B2959',
    borderWidth: 1,
    borderColor: '#563D7D',
  },
  serviceTray: {
    backgroundColor: color.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 12,
    ...shadow(0, 30, '#00000040'),
  },
  trayHandle: {
    width: 42,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#DDD6E8',
    alignSelf: 'center',
    marginBottom: 4,
  },
  mutedService: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: color.soft,
    opacity: 0.72,
    gap: 12,
  },
  juniService: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFF5FA',
    borderWidth: 2,
    borderColor: color.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authHeading: { marginTop: 36, marginBottom: 26 },
  title: { lineHeight: 34, letterSpacing: -0.9 },
  subtitle: { lineHeight: 22 },
  trustCard: { marginTop: 24, backgroundColor: color.soft, borderWidth: 0 },
});
