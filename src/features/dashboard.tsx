import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Clock3, Flame, Gift, GraduationCap, Heart, House,
  LocateFixed, MapPin, Menu, Navigation, Search, Star, Users, type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerCarousel } from '@/components/BannerCarousel';
import {
  Button, center, ChoiceRow, Copy, fill, Header, IconButton, Page, Pile, ProgressBar, Row,
  ScalePressable, SectionHeading, spread, Tile,
} from '@/components/ui';
import { fetchPoints, myBookings, pending, type PointsSummary } from '@/data/api';
import { formatDate } from '@/data/format';
import { useLoad } from '@/data/useLoad';
import { AccountSwitch } from '@/features/accountSwitch';
import { useAuth } from '@/features/authSession';
import { NotificationBell, useLiveUpdates } from '@/features/liveUpdates';
import { useLocationPref } from '@/features/locationState';
import { HoldCard, PlanCard } from '@/features/pendingCard';
import { SideMenu } from '@/features/sideMenu';
import { TripCard } from '@/features/tripCard';
import { color, shadow } from '@/theme';

export function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { pickup, campus, streetNote, openAddressSheet } = useLocationPref();
  const { appNow, refreshLive } = useLiveUpdates();
  const { data, code: ridesError, reload } = useLoad(() => myBookings(), []);
  const pend = useLoad(() => pending(), []);
  const pts = useLoad(() => fetchPoints(), []);

  const reloadPoints = pts.reload;
  const reloadPending = pend.reload;
  useFocusEffect(useCallback(() => {
    reload();
    reloadPending();
    reloadPoints();
    refreshLive();
  }, [reload, reloadPending, reloadPoints, refreshLive]));

  const active = data?.active[0] ?? null;
  const upcomingList = data?.upcoming ?? [];
  const next = active ?? upcomingList[0] ?? null;
  const pointsBalance = pts.data?.balance ?? profile?.pointsBalance ?? 0;
  const firstName = profile?.fullName?.split(' ')[0];
  const planRide = () => router.push({ pathname: '/plan', params: { campusId: campus?.id, pickupAreaId: pickup?.id } });
  const [menuOpen, setMenuOpen] = useState(false);
  const pickupIcon = pickup?.location_kind === 'current_gps' ? LocateFixed : pickup?.is_custom ? House : MapPin;

  return (
    <Page>
      <Row style={spread}>
        <IconButton icon={Menu} label="Open menu" onPress={() => setMenuOpen(true)} />
        <Row gap={6}>
          <Copy size={22} weight={800} tint={color.brand} style={{ letterSpacing: -0.5 }}>juni</Copy>
          <Copy size={11} weight={700} tint={color.muted} style={{ marginTop: 6 }}>by jeeny</Copy>
        </Row>
        <NotificationBell />
      </Row>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <ScalePressable
        accessibilityLabel={`You have ${pointsBalance} points. Fill the last seat in a group to earn 30 more`}
        onPress={() => router.navigate('/points')}
        style={styles.promoStrip}
      >
        <View style={styles.promoTag}>
          <Star size={12} color={color.white} fill={color.white} />
          <Copy size={12} weight={800} tint={color.white}>{`${pointsBalance}`}</Copy>
        </View>
        <Copy size={14} weight={700} tint={color.navy} style={fill} numberOfLines={1}>Fill the last seat, earn +30</Copy>
        <ArrowRight size={18} color={color.navy} />
      </ScalePressable>

      <Row gap={8} style={styles.serviceRow}>
        <ServiceTile icon={GraduationCap} label="To campus" onPress={planRide} />
        <ServiceTile icon={MapPin} label="Pickup gate" onPress={() => openAddressSheet('gates')} />
        <ServiceTile icon={CalendarDays} label="My trips" onPress={() => router.navigate('/rides')} />
        <ServiceTile icon={Gift} label="+30 pts" onPress={() => router.navigate('/points')} />
      </Row>

      <ScalePressable
        accessibilityLabel={`Where to${firstName ? `, ${firstName}` : ''}? Plan a ride to ${campus?.code ?? 'campus'}`}
        onPress={planRide}
        style={styles.searchBar}
      >
        <Search size={20} color={color.muted} />
        <Copy size={16} weight={600} tint={color.navy} style={fill} numberOfLines={1}>
          {firstName ? `Where to, ${firstName}?` : 'Where to?'}
        </Copy>
        <View style={styles.searchDivider} />
        <Copy size={13} weight={700} tint={color.muted}>{campus?.code ?? 'Campus'}</Copy>
      </ScalePressable>

      <PlaceRow
        icon={pickupIcon}
        title={pickup?.name ?? 'Set your pickup'}
        subtitle={streetNote || pickup?.gate_landmark_en || pickup?.detail || 'Current location, home pin or a gate'}
        onPress={() => openAddressSheet('pin')}
      />
      <PlaceRow
        icon={GraduationCap}
        title={campus?.label ?? "Choose your university"}
        subtitle="Your campus"
        onPress={planRide}
      />
      <PlaceRow icon={Heart} title="Choose a saved place" onPress={() => openAddressSheet('gates')} last />

      <BannerCarousel
        banners={[
          { id: 'last-seat', label: 'Take the last seat and earn 30 points', image: require('../../assets/banners/last-seat.jpg'), onPress: planRide },
          { id: 'girls-only', label: 'Girls-only cars for verified students', image: require('../../assets/banners/girls-only.jpg'), onPress: planRide },
          { id: 'ai-leave', label: 'AI picks the minute you leave', image: require('../../assets/banners/ai-leave.jpg'), onPress: planRide },
          { id: 'split-fare', label: 'Seats from 1.12 JD, pay only for your distance', image: require('../../assets/banners/split-fare.jpg'), onPress: planRide },
        ]}
      />

      <SectionHeading
        title="Upcoming ride"
        note={upcomingList.length > 1 ? `View all (${upcomingList.length})` : undefined}
        onPress={() => router.navigate('/rides')}
      />
      {!data && !ridesError && <View style={styles.skeleton} />}
      {!data && !!ridesError && (
        <ScalePressable accessibilityLabel="Could not load your rides. Retry" onPress={reload} style={styles.emptyUpcoming}>
          <Copy size={14} weight={700} tint={color.navy} style={fill}>Couldn’t load your rides</Copy>
          <Copy size={13} weight={800} tint={color.brand}>Retry</Copy>
        </ScalePressable>
      )}
      {!!data && (
        <Pile gap={12}>
          {pend.data?.hold && (
            <HoldCard
              hold={pend.data.hold}
              appNow={pend.data.app_now}
              onExpire={reloadPending}
              onPress={() => router.push({
                pathname: '/payment',
                params: { holdId: pend.data!.hold!.hold_id, requestId: pend.data!.hold!.request_id ?? '' },
              })}
            />
          )}
          {!pend.data?.hold && !next && pend.data?.plan && (
            <PlanCard
              plan={pend.data.plan}
              onPress={() => router.push({ pathname: '/matching', params: { requestId: pend.data!.plan!.request_id } })}
            />
          )}
          {next && (
            <TripCard
              b={next}
              appNow={appNow ?? data.app_now}
              onPress={() => router.push({
                pathname: next.status === 'confirmed' || next.status === 'in_progress' ? '/trip' : '/status',
                params: { bookingId: next.id },
              })}
            />
          )}
          {!next && !pend.data?.hold && !pend.data?.plan && (
            <ScalePressable
              accessibilityLabel="No ride scheduled. Plan your first campus ride"
              onPress={planRide}
              style={styles.emptyUpcoming}
            >
              <Copy size={14} weight={700} tint={color.navy} style={fill}>No ride scheduled yet</Copy>
              <Copy size={13} weight={800} tint={color.brand}>Plan one</Copy>
              <ChevronRight size={16} color={color.brand} />
            </ScalePressable>
          )}
        </Pile>
      )}
    </Page>
  );
}

function ServiceTile({ icon: Icon, label, onPress }: {
  icon: LucideIcon; label: string; onPress: () => void;
}) {
  return (
    <ScalePressable accessibilityLabel={label} onPress={onPress} style={styles.serviceTile} scaleTo={0.94}>
      <Icon size={30} color={color.brand} strokeWidth={1.8} />
      <Copy size={12} weight={700} tint={color.navy} numberOfLines={1} style={center}>{label}</Copy>
    </ScalePressable>
  );
}

function PlaceRow({ icon: Icon, title, subtitle, onPress, last = false }: {
  icon: LucideIcon; title: string; subtitle?: string; onPress: () => void; last?: boolean;
}) {
  return (
    <ScalePressable accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} onPress={onPress} style={styles.placeRow} scaleTo={0.98}>
      <View style={styles.placeIcon}>
        <Icon size={20} color={color.navy} />
      </View>
      <View style={[styles.placeText, !last && styles.placeDivider]}>
        <Copy size={15} weight={600} tint={color.navy} numberOfLines={1}>{title}</Copy>
        {!!subtitle && <Copy size={13} tint={color.muted} numberOfLines={1}>{subtitle}</Copy>}
      </View>
    </ScalePressable>
  );
}

export function Profile() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { pickup, campus, streetNote, openAddressSheet, openCampusSheet } = useLocationPref();
  const name = profile?.fullName ?? 'Student';
  const [signingOut, setSigningOut] = useState(false);

  async function logOut() {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/login');
  }

  const prefLabel = profile?.gender === 'female' ? 'Girls-only' : 'Boys-only';

  return (
    <Page>
      <Row gap={14} style={{ marginTop: 6 }}>
        <View style={styles.avatar}>
          <Copy size={24} weight={800} tint={color.white}>{name.slice(0, 1)}</Copy>
        </View>
        <Pile gap={2} style={fill}>
          <Copy accessibilityRole="header" size={22} weight={800} tint={color.navy}>{name}</Copy>
          <Row gap={6}>
            <CheckCircle2 size={14} color={color.emerald} />
            <Copy size={13} weight={600} tint={color.muted}>{`Verified · ${prefLabel}`}</Copy>
          </Row>
        </Pile>
      </Row>

      <SectionHeading title="Commute" />
      <ChoiceRow
        icon={pickup?.is_custom ? House : MapPin}
        title={pickup?.name ?? 'Set pickup'}
        detail={streetNote || pickup?.gate_landmark_en || 'Pickup'}
        onPress={() => openAddressSheet('pin')}
      />
      <ChoiceRow
        icon={GraduationCap}
        title={campus?.label ?? 'Choose university'}
        detail="University"
        onPress={openCampusSheet}
        last
      />

      <SectionHeading title="Activity" />
      <ChoiceRow
        icon={Star}
        title="Points"
        detail="Fill a last seat for +30"
        value={`${profile?.pointsBalance ?? 0}`}
        onPress={() => router.navigate('/points')}
      />
      <ChoiceRow
        icon={CalendarDays}
        title="My trips"
        onPress={() => router.navigate('/rides')}
        last
      />

      <View style={{ marginTop: 18 }}>
        <AccountSwitch />
      </View>

      <Button tone="secondary" style={{ marginTop: 18 }} onPress={logOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </Page>
  );
}

export function Points() {
  const router = useRouter();
  const { campus, pickup } = useLocationPref();
  const { data, reload } = useLoad<PointsSummary>(() => fetchPoints(), []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const balance = data?.balance ?? 120;
  const target = data?.target ?? 300;
  const remaining = Math.max(0, target - balance);
  const pct = Math.min(100, Math.round((balance / target) * 100));

  return (
    <Page>
      <Header title="Points" />

      <Copy size={13} weight={700} tint={color.muted} style={{ marginTop: 8 }}>Balance</Copy>
      <Row gap={6} style={{ alignItems: 'baseline' }}>
        <Copy size={64} weight={800} tint={color.navy} style={{ letterSpacing: -2.5, lineHeight: 70 }}>{String(balance)}</Copy>
        <Copy size={20} weight={800} tint={color.brand}>pts</Copy>
      </Row>
      <View style={{ marginTop: 8 }}>
        <ProgressBar value={pct} height={6} />
      </View>
      <Copy size={13} tint={color.muted} style={{ marginTop: 8 }}>
        {remaining === 0 ? 'Free ride unlocked' : `${remaining} pts to a free ride`}
      </Copy>

      <SectionHeading title="Earn" />
      <ChoiceRow
        icon={Flame}
        title="Fill a last seat"
        detail="Book seat 4 of 4"
        value="+30"
        highlight
        onPress={() => router.push({ pathname: '/plan', params: { campusId: campus?.id, pickupAreaId: pickup?.id } })}
      />
      <ChoiceRow icon={Navigation} title="Finish a ride" value="+10" />
      <ChoiceRow icon={Clock3} title="On time at pickup" value="+15" />
      <ChoiceRow icon={Users} title="Invite a classmate" value="+50" last />

      {data && data.ledger.length > 0 && (
        <>
          <SectionHeading title="History" />
          {data.ledger.map((entry, i) => (
            <ChoiceRow
              key={entry.id}
              title={entry.label}
              detail={formatDate(entry.created_at)}
              value={`+${entry.delta}`}
              last={i === data.ledger.length - 1}
            />
          ))}
        </>
      )}
    </Page>
  );
}

function RewardRow({ icon: Icon, title, detail, pts }: {
  icon: typeof Star; title: string; detail: string; pts: string;
}) {
  return (
    <Row gap={12} style={styles.reward}>
      <Tile icon={Icon} size={42} iconSize={20} />
      <Pile gap={2} style={fill}>
        <Copy size={14} weight={800} tint={color.navy}>{title}</Copy>
        <Copy size={12} tint={color.muted}>{detail}</Copy>
      </Pile>
      <Copy size={15} weight={800} tint={color.brand}>{pts}</Copy>
    </Row>
  );
}

const styles = StyleSheet.create({
  promoStrip: {
    marginTop: 14,
    minHeight: 48,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  promoTag: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: color.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceRow: { marginTop: 16 },
  serviceTile: {
    flex: 1,
    aspectRatio: 0.92,
    borderRadius: 18,
    backgroundColor: color.pink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  searchBar: {
    marginTop: 18,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadow(3, 10, '#271C3A12'),
  },
  searchDivider: { width: 1, height: 26, backgroundColor: color.line },
  placeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { flex: 1, minHeight: 64, justifyContent: 'center', gap: 2 },
  placeDivider: { borderBottomWidth: 1, borderBottomColor: color.line },
  skeleton: { height: 74, borderRadius: 22, backgroundColor: color.soft },
  emptyUpcoming: {
    minHeight: 74,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color.pinkBorder,
    backgroundColor: '#FFF9FC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brand,
  },
  reward: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 18,
    padding: 14,
    backgroundColor: color.white,
  },
});
