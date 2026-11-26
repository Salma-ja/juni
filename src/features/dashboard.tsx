import { useRouter } from 'expo-router';
import {
  ArrowRight, BadgeCheck, Car, CheckCircle2, ChevronRight, Clock3, Coins, Info, LockKeyhole,
  MapPin, ShieldCheck, Sparkles, Star, UserPlus, Users,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { Badge, center, Copy, Eyebrow, fill, GradientCard, Header, InfoRow, Page, Pile, ProgressBar, Row, SectionHeading, spread, TextLink, Tile } from '@/components/ui';
import { color, shadow } from '@/theme';
import { authClient, studentName, useAuth } from '@/features/authSession';

export function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <Page>
      <Row style={styles.homeHeader}>
        <Pile gap={7} style={fill}>
          <Eyebrow tint={color.muted} size={9}>MONDAY, 14 APRIL</Eyebrow>
          <Copy accessibilityRole="header" size={28} weight={800} style={{ letterSpacing: -1.4 }}>{`Hi, ${studentName(user).split(/\s+/)[0]}`}</Copy>
          <Badge icon={BadgeCheck} iconSize={14}>Verified student</Badge>
        </Pile>
        <Pressable accessibilityRole="button" accessibilityLabel="240 points" onPress={() => router.navigate('/points')} style={styles.pointsPill}>
          <Coins size={17} color="#BD861D" />
          <Copy size={16} weight={800} tint="#BD861D">240</Copy>
        </Pressable>
      </Row>
      <GradientCard colors={['#37294F', '#241A39']} style={styles.planCard}>
        <View pointerEvents="none" style={styles.planOrbit} />
        <Row style={spread}>
          <Eyebrow tint="#F2A3CC" size={9}>YOUR NEXT CAMPUS DAY</Eyebrow>
          <Tile icon={Sparkles} size={37} iconSize={19} tint="#FF9BCE" background="#FFFFFF14" />
        </Row>
        <Copy size={25} weight={800} tint={color.white} style={styles.planTitle}>Heading to class?</Copy>
        <Copy size={12} tint="#CFC5DA" style={{ lineHeight: 18, marginBottom: 19 }}>Find verified students nearby and split your ride.</Copy>
        <Pressable accessibilityRole="button" onPress={() => router.push('/plan')} style={styles.planButton}>
          <MapPin size={19} color={color.white} />
          <Copy size={14} weight={800} tint={color.white} style={fill}>Plan a ride</Copy>
          <ArrowRight size={19} color={color.white} />
        </Pressable>
      </GradientCard>
      <SectionHeading title="Upcoming ride" note="View all" onPress={() => router.navigate('/rides')} />
      <Pressable accessibilityRole="button" onPress={() => router.push('/status')} style={styles.upcoming}>
        <Pile gap={4} style={styles.dateTile}>
          <Copy size={18} weight={800} tint={color.brand}>15</Copy>
          <Copy size={8} weight={800} tint={color.brand}>APR</Copy>
        </Pile>
        <Pile gap={8} style={fill}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Copy weight={800}>JUST Campus</Copy>
            <Badge tone="amber">Awaiting captain</Badge>
          </Row>
          <Row gap={5}>
            <Clock3 size={15} color={color.muted} />
            <Copy size={10} tint={color.muted}>7:20 AM · Student Area</Copy>
          </Row>
        </Pile>
        <ChevronRight size={19} color={color.ink} />
      </Pressable>
      <Row gap={11} style={styles.demand}>
        <Tile icon={Users} size={39} iconSize={22} background={color.white} />
        <Pile gap={4} style={fill}>
          <Eyebrow>LIVE DEMAND</Eyebrow>
          <Copy size={12} weight={800}>12 students are heading to JUST</Copy>
          <Copy size={9} tint={color.muted}>Between 7:00–8:00 AM from nearby areas</Copy>
        </Pile>
        <Row gap={0} style={styles.avatarStack}>
          {['S', 'L', 'R', '+9'].map((letter, index) => (
            <View key={letter} style={[styles.avatarDot, index === 3 && { backgroundColor: '#20363C' }]}>
              <Copy size={8} weight={700} tint={index === 3 ? color.white : color.ink}>{letter}</Copy>
            </View>
          ))}
        </Row>
      </Row>
      <Pressable accessibilityRole="button" onPress={() => router.push('/rules')} style={styles.rules}>
        <Info size={18} color="#68777C" />
        <Copy size={10} tint="#68777C" style={fill}>Explore system rules & edge cases</Copy>
        <ChevronRight size={18} color="#68777C" />
      </Pressable>
    </Page>
  );
}

export function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const name = studentName(user);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const inactive = () => {};

  async function logOut() {
    if (!authClient || signingOut) return;
    setSigningOut(true);
    setLogoutError('');
    try {
      const { error } = await authClient.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : 'Could not log out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Page>
      <Header title="Profile" action={<TextLink>Edit</TextLink>} />
      <Pile gap={7} style={styles.profile}>
        <GradientCard colors={['#CCEAE1', '#8DCEBB']} style={styles.profileAvatar}>
          <Copy size={20} weight={800} tint="#146750">{initials}</Copy>
        </GradientCard>
        <Copy accessibilityRole="header" size={20} weight={800} style={center}>{name}</Copy>
        <Copy size={9} tint={color.muted}>{user?.email}</Copy>
        <Badge icon={BadgeCheck} iconSize={14} style={{ alignSelf: 'center' }}>Verified student</Badge>
      </Pile>
      <Pile gap={7} style={styles.profileSection}>
        <Eyebrow>UNIVERSITY</Eyebrow>
        <View style={styles.profileRows}><InfoRow icon={ShieldCheck} label="Verified university email" value={user?.email ?? ''} /></View>
      </Pile>
      <Pile gap={7} style={styles.profileSection}>
        <Eyebrow>RIDE PREFERENCES</Eyebrow>
        <View style={styles.profileRows}>
          <InfoRow icon={MapPin} label="Home location" value="Student Area, Irbid" onPress={inactive} style={styles.divider} />
          <InfoRow icon={Users} label="Group preference" value="Girls-only" onPress={inactive} />
        </View>
      </Pile>
      <Pile gap={7} style={styles.profileSection}>
        <Eyebrow>ACTIVITY</Eyebrow>
        <View style={styles.profileRows}>
          <InfoRow icon={Car} label="Ride history" value="12 completed rides" onPress={() => router.navigate('/rides')} style={styles.divider} />
          <InfoRow icon={Coins} label="JUNI Points" value="240 points" onPress={() => router.navigate('/points')} />
        </View>
      </Pile>
      {logoutError && <Copy accessibilityRole="alert" tint={color.danger}>{logoutError}</Copy>}
      <TextLink tint="#BC4242" size={11} style={styles.signout}
        onPress={logOut}>{signingOut ? 'Logging out…' : 'Log out'}</TextLink>
    </Page>
  );
}

const earningRules = [
  [Car, 'Complete a ride', '+30 pts'],
  [Star, '5 rides without cancellation', '+15 pts'],
  [UserPlus, 'Fill the last group seat', '+50 pts'],
  [Users, 'Invite a classmate', '+50 pts'],
] as const;

export function Points() {
  return (
    <Page>
      <Header title="Points & rewards" action={<Info size={20} color={color.ink} />} />
      <GradientCard colors={['#382A52', '#241A39']} style={{ borderRadius: 21 }}>
        <Eyebrow size={8} tint="#F2A3CC">YOUR BALANCE</Eyebrow>
        <Row gap={3} style={{ alignItems: 'baseline', marginTop: 7, marginBottom: 16 }}>
          <Copy size={39} weight={800} tint={color.white} style={{ letterSpacing: -2.34 }}>240</Copy>
          <Copy size={12} weight={700} tint="#CFC5DA">points</Copy>
        </Row>
        <ProgressBar value={80} height={7} track="#FFFFFF1F" />
        <Row style={[spread, { marginVertical: 8 }]}>
          <Copy size={8} weight={700} tint={color.white}>60 points to go</Copy>
          <Copy size={8} tint="#CFC5DA">until your next free ride</Copy>
        </Row>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={styles.redeem}>
          <LockKeyhole size={17} color="#A99EB5" />
          <Copy size={9} weight={700} tint="#A99EB5">Redeem 300 points for a free ride</Copy>
        </Pressable>
      </GradientCard>
      <Row gap={10} style={styles.rewardBanner}>
        <Tile icon={Star} size={37} iconSize={23} tint="#BC8217" background="#FFE9A8" />
        <Pile gap={3}>
          <Copy size={10} weight={800}>1 free ride = 300 points</Copy>
          <Copy size={8} tint={color.muted}>Up to 1.50 JD value</Copy>
        </Pile>
      </Row>
      <SectionHeading title="Ways to earn" note="Earn more, ride more" />
      <View style={styles.earnList}>
        {earningRules.map(([Icon, title, points], index) => (
          <Row gap={10} key={title} style={[styles.earnRow, index < earningRules.length - 1 && styles.divider]}>
            <Tile icon={Icon} size={34} iconSize={20} />
            <Copy size={9} weight={800} style={fill}>{title}</Copy>
            <Copy size={9} weight={800} tint={color.brand}>{points}</Copy>
          </Row>
        ))}
      </View>
      <SectionHeading title="Recent activity" />
      <LedgerRow icon={CheckCircle2} title="Ride completed · 8 Apr" value="+30" />
      <LedgerRow icon={UserPlus} title="Invited Lina · 2 Apr" value="+50" />
    </Page>
  );
}

function LedgerRow({ icon: Icon, title, value }: { icon: typeof UserPlus; title: string; value: string }) {
  return (
    <Row gap={7} style={[styles.divider, { paddingVertical: 10, paddingHorizontal: 3 }]}>
      <Icon size={18} color={color.brand} />
      <Copy size={9} tint={color.muted} style={fill}>{title}</Copy>
      <Copy size={9} weight={800} tint={color.brand}>{value}</Copy>
    </Row>
  );
}

const styles = StyleSheet.create({
  homeHeader: { alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 8, paddingHorizontal: 1, paddingBottom: 23 },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E1EAE7', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 12 },
  planCard: { overflow: 'hidden', ...shadow(18, 35, '#2B214233') },
  planOrbit: { position: 'absolute', width: 150, height: 150, borderWidth: 25, borderColor: '#36C09D17', borderRadius: 75, right: -55, top: -28 },
  planTitle: { marginTop: 18, marginBottom: 5, letterSpacing: -1 },
  planButton: { flexDirection: 'row', gap: 9, alignItems: 'center', minHeight: 49, borderRadius: 13, paddingHorizontal: 14, backgroundColor: color.brand },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: color.line, borderRadius: 17, padding: 13 },
  dateTile: { width: 48, height: 51, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.pink },
  demand: { backgroundColor: color.sage, padding: 16, marginTop: 13, borderRadius: 17, alignItems: 'flex-start', minHeight: 82 },
  avatarStack: { position: 'absolute', right: 13, bottom: 11 },
  avatarDot: { width: 25, height: 25, borderWidth: 2, borderColor: color.sage, borderRadius: 13, backgroundColor: '#D9C8BA', marginLeft: -6, alignItems: 'center', justifyContent: 'center' },
  rules: { flexDirection: 'row', alignItems: 'center', paddingTop: 17, paddingHorizontal: 3, gap: 9 },
  profile: { alignItems: 'center', paddingTop: 6, paddingBottom: 19 },
  profileAvatar: { width: 75, height: 75, padding: 0, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  profileSection: { marginTop: 18 },
  profileRows: { borderWidth: 1, borderColor: color.line, borderRadius: 13, overflow: 'hidden' },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
  signout: { marginTop: 22, padding: 14, alignItems: 'center' },
  redeem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF17' },
  rewardBanner: { marginTop: 13, marginBottom: 4, padding: 13, borderRadius: 15, backgroundColor: '#FFF7DF' },
  earnList: { borderRadius: 16, borderWidth: 1, borderColor: color.line, overflow: 'hidden' },
  earnRow: { padding: 11 },
});
