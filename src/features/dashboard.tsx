import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowRight, BadgeCheck, Car, CheckCircle2, ChevronRight, Clock3, Coins, Info, LockKeyhole,
  MapPin, ShieldCheck, Sparkles, Users, Zap,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCallback, useState } from 'react';
import { Badge, center, Copy, Eyebrow, fill, GradientCard, Header, InfoRow, Page, Pile, ProgressBar, Row, SectionHeading, spread, TextLink, Tile } from '@/components/ui';
import { color, shadow } from '@/theme';
import { useAuth } from '@/features/authSession';
import { myBookings } from '@/data/api';
import { formatDate, formatTime } from '@/data/format';
import { useLoad } from '@/data/useLoad';
import { statusBadge } from '@/features/rides';

export function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, reload } = useLoad(() => myBookings(), []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const next = data?.upcoming[0] ?? data?.active[0];
  const badge = next ? statusBadge[next.status] : null;
  return (
    <Page>
      <Row style={styles.homeHeader}>
        <Pile gap={7} style={fill}>
          <Eyebrow tint={color.muted} size={9}>{data ? formatDate(data.app_now).toUpperCase() : ' '}</Eyebrow>
          <Copy accessibilityRole="header" size={28} weight={800} style={{ letterSpacing: -1.4 }}>{`Hi, ${profile?.fullName.split(/\s+/)[0] ?? 'there'}`}</Copy>
          <Badge icon={BadgeCheck} iconSize={14}>{profile?.isDemo ? 'Demo mode · simulated verification' : 'Verified student'}</Badge>
        </Pile>
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
      {next && badge ? (
        <Pressable accessibilityRole="button"
          onPress={() => router.push({ pathname: next.status === 'confirmed' || next.status === 'in_progress' ? '/trip' : '/status', params: { bookingId: next.id } })}
          style={styles.upcoming}>
          <Pile gap={4} style={styles.dateTile}>
            <Copy size={18} weight={800} tint={color.brand}>{formatDate(next.pickup_at).split(' ')[1]}</Copy>
            <Copy size={8} weight={800} tint={color.brand}>{formatDate(next.pickup_at).split(' ')[2]?.toUpperCase()}</Copy>
          </Pile>
          <Pile gap={8} style={fill}>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Copy weight={800}>{next.campus.label}</Copy>
              <Badge tone={badge.tone}>{badge.label}</Badge>
            </Row>
            <Row gap={5}>
              <Clock3 size={15} color={color.muted} />
              <Copy size={10} tint={color.muted}>{`${formatTime(next.pickup_at)} · ${next.pickup_area.name}`}</Copy>
            </Row>
          </Pile>
          <ChevronRight size={19} color={color.ink} />
        </Pressable>
      ) : (
        <Copy size={11} tint={color.muted} style={{ paddingVertical: 8 }}>No upcoming rides yet. Plan one above.</Copy>
      )}
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
  const { profile, signOut } = useAuth();
  const name = profile?.fullName ?? 'Student';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const [signingOut, setSigningOut] = useState(false);
  const inactive = () => {};

  async function logOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/login');
  }

  return (
    <Page>
      <Header title="Profile" action={<TextLink>Edit</TextLink>} />
      <Pile gap={7} style={styles.profile}>
        <GradientCard colors={['#CCEAE1', '#8DCEBB']} style={styles.profileAvatar}>
          <Copy size={20} weight={800} tint="#146750">{initials}</Copy>
        </GradientCard>
        <Copy accessibilityRole="header" size={20} weight={800} style={center}>{name}</Copy>
        <Copy size={9} tint={color.muted}>{profile?.gender === 'female' ? 'Female' : 'Male'}</Copy>
        <Badge icon={BadgeCheck} iconSize={14} style={{ alignSelf: 'center' }}>{profile?.isDemo ? 'Demo mode · simulated verification' : 'Verified student'}</Badge>
      </Pile>
      <Pile gap={7} style={styles.profileSection}>
        <Eyebrow>ACCOUNT</Eyebrow>
        <View style={styles.profileRows}>
          <InfoRow icon={Users} label="Gender" value={profile?.gender === 'female' ? 'Female' : 'Male'} style={styles.divider} />
          <InfoRow icon={ShieldCheck} label="Verification" value={profile?.isDemo ? 'Demo · simulated' : 'Verified'} />
        </View>
      </Pile>
      <Pile gap={7} style={styles.profileSection}>
        <Eyebrow>ACTIVITY</Eyebrow>
        <View style={styles.profileRows}>
          <InfoRow icon={Car} label="Ride history" value="View" onPress={() => router.navigate('/rides')} style={profile?.isDemo ? styles.divider : undefined} />
          {profile?.isDemo && <InfoRow icon={Zap} label="Demo controls" value="Open" onPress={() => router.push('/demo')} />}
        </View>
      </Pile>
      <TextLink tint="#BC4242" size={11} style={styles.signout}
        onPress={logOut}>{signingOut ? 'Logging out…' : 'Log out'}</TextLink>
    </Page>
  );
}

export function Points() {
  return (
    <Page>
      <Header title="Points & rewards" />
      <GradientCard colors={['#382A52', '#241A39']} style={{ borderRadius: 21 }}>
        <Eyebrow size={8} tint="#F2A3CC">JUNI POINTS</Eyebrow>
        <Copy size={26} weight={800} tint={color.white} style={{ marginTop: 8, marginBottom: 8, letterSpacing: -1 }}>Coming soon</Copy>
        <Copy size={11} tint="#CFC5DA" style={{ lineHeight: 17 }}>Earn points for completed rides and redeem them for free rides. Not part of this build yet.</Copy>
      </GradientCard>
    </Page>
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
