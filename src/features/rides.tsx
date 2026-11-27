import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, Copy as CopyIcon, LockKeyhole,
  Navigation, Phone, Route, ShieldCheck,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, FlatList, Platform, Pressable, StyleSheet, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RideMap, type MapPoint } from '@/components/RideMap';
import {
  Avatar, Badge, BottomSheet, Button, CaptainMini, CaptainPhoto, Card, center, Copy, Eyebrow, fill, Header,
  IconButton, InfoRow, Page, Pile, ProgressBar, PulseDot, Row, ScalePressable, SectionHeading,
  SheetHeading, spread, Tile,
} from '@/components/ui';
import {
  booking as loadBooking, cancelBooking, logSos, myBookings, type BookingData, type BookingStatus,
  type CancelResult,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { useLoad } from '@/data/useLoad';
import { useAuth } from '@/features/authSession';
import { driverEtaMinutes, LivePickupWidget, NotificationBell, useLiveUpdates } from '@/features/liveUpdates';
import { isHotspot } from '@/features/places';
import { TripCard, tripCardFrame, TripRoute } from '@/features/tripCard';
import { color, shadow } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

const rideTabs = ['Upcoming', 'Active', 'Past'] as const;
type RideTab = (typeof rideTabs)[number];

export const statusBadge: Record<BookingStatus, { label: string; tone: 'green' | 'amber' | 'slate' | 'red' | 'brand' }> = {
  seat_booked: { label: 'Filling group', tone: 'brand' },
  awaiting_captain: { label: 'Awaiting captain', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  in_progress: { label: 'Live pickup', tone: 'green' },
  completed: { label: 'Completed', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

const refundLine = (b: BookingData) =>
  !b.refund
    ? formatFils(b.fare_fils)
    : b.refund.amount_fils > 0
      ? `Full refund · ${formatFils(b.refund.amount_fils)}`
      : 'Late cancel (<12h) · No refund';

export function MyRides() {
  const router = useRouter();
  const [tab, setTab] = useState<RideTab>('Upcoming');
  const [target, setTarget] = useState<BookingData | null>(null);
  const { data, code, reload } = useLoad(() => myBookings(), []);
  const { refreshLive } = useLiveUpdates();

  useFocusEffect(useCallback(() => {
    reload();
    refreshLive();
  }, [reload, refreshLive]));

  useEffect(() => {
    if (data && data.active.length > 0 && data.upcoming.length === 0 && tab === 'Upcoming') {
      setTab('Active');
    }
  }, [data, tab]);

  const lists: Record<RideTab, BookingData[]> = {
    Upcoming: data?.upcoming ?? [],
    Active: data?.active ?? [],
    Past: data?.past ?? [],
  };
  const items = lists[tab];

  const keyExtractor = useCallback((item: BookingData) => item.id, []);
  const renderItem = useCallback(({ item }: { item: BookingData }) => (
    tab === 'Past' ? (
      <PastRideCard b={item} onPress={() => router.push({ pathname: '/status', params: { bookingId: item.id } })} />
    ) : (
      <MobileRideTicket
        b={item}
        appNow={data?.app_now}
        onOpen={() => router.push({
          pathname: item.status === 'confirmed' || item.status === 'in_progress' ? '/trip' : '/status',
          params: { bookingId: item.id },
        })}
        onCancel={() => setTarget(item)}
      />
    )
  ), [data?.app_now, router, tab]);

  return (
    <Page>
      <Header
        title="My trips"
        action={<NotificationBell />}
      />

      {/* Mobile Segmented Tab Bar with Live Counts */}
      <Row gap={6} style={styles.tabs}>
        {rideTabs.map((item) => {
          const count = lists[item].length;
          const active = tab === item;
          return (
            <ScalePressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item} (${count})`}
              onPress={() => setTab(item)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Copy size={13} weight={800} tint={active ? color.white : color.navy}>
                {count > 0 ? `${item} (${count})` : item}
              </Copy>
            </ScalePressable>
          );
        })}
      </Row>

      {!!code && <Copy tint={color.danger}>{errorCopy(code)}</Copy>}

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          data ? (
            <Card style={styles.emptyCard}>
              <Tile icon={CalendarDays} size={50} iconSize={24} />
              <Copy size={17} weight={800} tint={color.navy}>{`No ${tab.toLowerCase()} trips`}</Copy>
              {tab === 'Upcoming' && (
                <Button onPress={() => router.push('/plan')} trailingArrow style={{ alignSelf: 'stretch' }}>
                  Plan a ride
                </Button>
              )}
            </Card>
          ) : null
        }
      />

      {target && data && (
        <CancelSheet
          b={target}
          appNow={data.app_now}
          onClose={() => { setTarget(null); reload(); refreshLive(); }}
        />
      )}
    </Page>
  );
}

const MobileRideTicket = memo(function MobileRideTicket({
  b, appNow, onOpen, onCancel,
}: {
  b: BookingData; appNow?: string; onOpen: () => void; onCancel: () => void;
}) {
  return (
    <View>
      <TripCard b={b} appNow={appNow} onPress={onOpen} />
      {b.status !== 'in_progress' && (
        <ScalePressable accessibilityLabel="Cancel booking" onPress={onCancel} style={styles.rtCancel}>
          <Copy size={13} weight={700} tint={color.muted}>Cancel booking</Copy>
        </ScalePressable>
      )}
    </View>
  );
});

function CancelSheet({ b, appNow, onClose }: { b: BookingData; appNow: string; onClose: () => void }) {
  const hours = (new Date(b.pickup_at).getTime() - new Date(appNow).getTime()) / 3_600_000;
  const full = hours >= 12;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CancelResult | null>(null);
  const [code, setCode] = useState('');

  async function confirm() {
    if (busy) return;
    setBusy(true);
    const res = await cancelBooking(b.id);
    setBusy(false);
    if (res.ok) setDone(res.data); else setCode(res.code);
  }

  return (
    <BottomSheet onClose={onClose}>
      {done ? (
        <>
          <SheetHeading
            icon={CheckCircle2}
            title={done.refund_fils > 0 ? 'Booking cancelled' : 'Cancelled (<12h window)'}
            detail={done.refund_fils > 0
              ? `100% refund recorded (${formatFils(done.refund_fils)}) and your seat reopened for other students.`
              : 'Seat stayed covered inside the 12-hour lock window so groupmates keep their exact fare.'}
          />
          <Button onPress={onClose}>Done</Button>
        </>
      ) : (
        <>
          <SheetHeading
            icon={Clock3}
            tone="amber"
            title="Cancel your campus seat?"
            detail={full
              ? 'More than 12 hours before pickup — 100% free cancellation & seat reopens.'
              : 'Less than 12 hours before pickup — late-cancel rule applies.'}
          />
          <Row style={[spread, styles.refundBox]}>
            <Pile gap={3}>
              <Copy size={12} tint={color.muted}>Refund amount</Copy>
              <Copy size={18} weight={800} tint={color.navy}>
                {full ? formatFils(b.fare_fils) : formatFils(0)}
              </Copy>
            </Pile>
            <Badge tone={full ? 'green' : 'red'}>
              {full ? '100% Free Cancel' : 'Locked (<12h)'}
            </Badge>
          </Row>
          {!!code && <Copy accessibilityRole="alert" tint={color.danger}>{errorCopy(code)}</Copy>}
          <Button tone="danger" disabled={busy} onPress={confirm}>
            {busy ? 'Cancelling…' : 'Confirm cancellation'}
          </Button>
          <Button tone="secondary" onPress={onClose}>Keep my seat</Button>
        </>
      )}
    </BottomSheet>
  );
}

const PastRideCard = memo(function PastRideCard({ b, onPress }: { b: BookingData; onPress: () => void }) {
  const cancelled = b.status === 'cancelled';
  return (
    <ScalePressable
      accessibilityLabel={`${b.pickup_area.name} to ${b.campus.code}, ${cancelled ? 'cancelled' : 'completed'}`}
      onPress={onPress}
      scaleTo={0.98}
      style={tripCardFrame}
    >
      <Row style={spread}>
        <Copy size={16} weight={800} tint={color.navy} style={fill} numberOfLines={1}>
          {`${b.pickup_area.name} → ${b.campus.code}`}
        </Copy>
        <Copy size={15} weight={800} tint={cancelled ? color.muted : color.navy}>{formatFils(b.fare_fils)}</Copy>
      </Row>
      <Row style={[spread, { marginTop: 4 }]}>
        <Copy size={13} tint={color.muted}>{`${formatDate(b.pickup_at)} · ${formatTime(b.pickup_at)}`}</Copy>
        <Copy size={13} weight={700} tint={cancelled ? color.danger : color.emerald}>
          {cancelled ? 'Cancelled' : 'Completed · +10 pts'}
        </Copy>
      </Row>
    </ScalePressable>
  );
});

export function TripDetails() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data, code, reload } = useLoad(() => loadBooking(bookingId), [bookingId]);
  const { refreshLive } = useLiveUpdates();

  // Live poll every 4s so pickups and ETA update automatically in real time!
  useEffect(() => {
    const timer = setInterval(() => {
      reload();
      refreshLive();
    }, 4000);
    return () => clearInterval(timer);
  }, [reload, refreshLive]);

  if (!data) {
    return (
      <Page>
        <Header title="Your trip" onBack={() => router.dismissTo('/rides')} action={<NotificationBell />} />
        <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <PulseDot tint={color.brand} size={8} />
          <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Loading trip telemetry…'}</Copy>
        </Card>
      </Page>
    );
  }

  const first = data.captain?.name.split(' ')[0] ?? 'Captain';
  const pickedCount = data.picked_up_count ?? data.members.filter((m) => m.picked_up).length;
  const totalRiders = data.total_riders ?? data.members.length;

  return (
    <Page
      footer={
        <Row gap={10}>
          <Button
            icon={Navigation}
            style={fill}
            onPress={() => router.push({ pathname: '/tracking', params: { bookingId } })}
          >
            Live map
          </Button>
          <Button
            tone="danger"
            icon={ShieldCheck}
            style={fill}
            onPress={() => router.push({ pathname: '/safety', params: { bookingId } })}
          >
            SOS
          </Button>
        </Row>
      }
    >
      <Header
        title="Your trip"
        subtitle={`${formatDate(data.departure_at)} · Arrive ${formatTime(data.arrival_at)}`}
        onBack={() => router.dismissTo('/rides')}
        action={<NotificationBell />}
      />

      {/* Live Remaining Time & Picked-Up Counter Widget */}
      <LivePickupWidget
        booking={data}
        appNow={data.app_now}
        members={data.members}
        onPress={() => router.push({ pathname: '/tracking', params: { bookingId } })}
      />

      {/* Captain: photo, name, car, plate, call */}
      {data.captain && data.vehicle ? (
        <Card style={styles.captainCard}>
          <Row gap={14}>
            <CaptainPhoto style={styles.captainPhotoLarge} />
            <Pile gap={4} style={fill}>
              <Row gap={6}>
                <Copy size={17} weight={800} tint={color.navy} numberOfLines={1}>{data.captain.name}</Copy>
                <ShieldCheck size={15} color={color.emerald} />
              </Row>
              <Copy size={13} tint={color.muted}>{`${data.vehicle.make_model} · ${data.vehicle.color}`}</Copy>
              <View style={[styles.plateBox, { alignSelf: 'flex-start', marginTop: 4 }]}>
                <Copy size={14} weight={800} tint={color.navy}>{data.vehicle.plate}</Copy>
              </View>
            </Pile>
            <IconButton icon={Phone} label={`Call Captain ${first}`} tint={color.brand} style={styles.callBtn} />
          </Row>
        </Card>
      ) : (
        <Copy size={14} tint={color.muted} style={{ marginTop: 16 }}>Your captain is assigned once all 4 seats fill.</Copy>
      )}

      {/* Riders */}
      <SectionHeading title="Riding with you" note={`${pickedCount}/${totalRiders} picked up`} />
      <View>
        {data.members.map((m, index) => (
          <Row key={`${m.first_name}-${index}`} gap={12} style={[styles.riderRow, index < data.members.length - 1 && styles.riderDivider]}>
            <Avatar name={m.first_name[0]} index={index} size={38} />
            <Pile gap={1} style={fill}>
              <Copy size={15} weight={700} tint={color.navy}>{m.is_you ? `${m.first_name} (You)` : m.first_name}</Copy>
              <Copy size={12} tint={color.muted}>
                {m.pickup_name ? `${m.pickup_name}${m.pickup_at ? ` · ${formatTime(m.pickup_at)}` : ''}` : 'Verified student'}
              </Copy>
            </Pile>
            {m.picked_up && (
              <Row gap={4}>
                <Check size={15} color={color.emerald} />
                <Copy size={13} weight={700} tint={color.emerald}>On board</Copy>
              </Row>
            )}
          </Row>
        ))}
      </View>

      {/* Route + ride length and fare */}
      <View style={styles.tripBlock}>
        <TripRoute from={data.pickup_area.name} fromTime={formatTime(data.pickup_at)} to={data.campus.code} toTime={formatTime(data.arrival_at)} />
        <View style={styles.tripBlockDivider} />
        <Row style={spread}>
          <Copy size={13} tint={color.muted}>{`${data.route_minutes} min ride`}</Copy>
          <Copy size={15} weight={800} tint={color.navy}>{formatFils(data.fare_fils)}</Copy>
        </Row>
      </View>
    </Page>
  );
}

export function Tracking() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data, reload } = useLoad(() => loadBooking(bookingId), [bookingId]);
  const { refreshLive } = useLiveUpdates();
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const ref = useRefData();

  useEffect(() => {
    const timer = setInterval(() => {
      reload();
      refreshLive();
    }, 3500);
    return () => clearInterval(timer);
  }, [reload, refreshLive]);

  const back = () => router.dismissTo({ pathname: '/trip', params: { bookingId } });
  const nowMs = data ? new Date(data.app_now).getTime() : Date.now();
  const pickedCount = data?.picked_up_count ?? 0;
  const totalRiders = Math.max(data?.total_riders ?? data?.seats_taken ?? 1, 1);

  const live = data?.status === 'in_progress';
  // A countdown only means something while the trip is running; before that show the pickup time instead.
  const headline = !data
    ? '…'
    : live
      ? `~${driverEtaMinutes(data, data.app_now)} min`
      : formatTime(data.pickup_at);
  const headlineLabel = !data
    ? ''
    : live
      ? (data.picked_up ? 'Remaining to campus' : 'Driver arrives in')
      : `Pickup · ${formatDate(data.pickup_at)}`;

  const progressPct = data
    ? data.status === 'in_progress'
      ? Math.max(18, Math.min(95, (pickedCount / totalRiders) * 85 + 10))
      : Math.max(0, Math.min(100, ((nowMs - new Date(data.departure_at).getTime()) / 60000 / Math.max(data.route_minutes, 1)) * 100))
    : 0;

  const campus = data ? ref.campus(data.campus.id) : undefined;
  const mapPoints: MapPoint[] = [];
  if (data) {
    for (const s of data.stops) {
      const area = ref.pickupAreas.find((a) => a.name === s.name);
      if (area) {
        mapPoints.push({
          lat: area.lat,
          lng: area.lng,
          label: area.name,
          kind: isHotspot(area.id) ? 'hotspot' : 'stop',
        });
      }
    }
  }
  if (campus) mapPoints.push({ lat: campus.lat, lng: campus.lng, label: campus.code, kind: 'campus' });

  return (
    <Page mode="edge" style={styles.trackingPage}>
      <View style={{ height: height * 0.38 }}>
        <RideMap
          points={mapPoints}
          polyline={campus?.corridor_polyline}
          height={height * 0.38}
          progress={progressPct / 100}
          numbered
          showBadge={false}
        />
        <IconButton
          icon={ArrowLeft}
          label="Go back"
          size={20}
          onPress={back}
          style={[styles.mapBack, { top: top + 14 }]}
        />
        <View style={[styles.liveMapPill, { top: top + 20 }]}>
          <PulseDot tint={color.emerald} size={7} />
          <Copy size={12} weight={800} tint={color.navy}>
            {`${pickedCount}/${totalRiders} riders picked up`}
          </Copy>
        </View>
      </View>

      <View style={[styles.trackingSheet, { paddingBottom: 24 + bottom }]}>
        <View style={styles.sheetGrabber} />
        <Row style={spread}>
          <Pile gap={2}>
            <Copy size={13} weight={700} tint={color.muted}>{headlineLabel}</Copy>
            <Copy size={32} weight={800} tint={color.navy} style={{ letterSpacing: -1 }}>{headline}</Copy>
          </Pile>
          {data && <Badge tone={statusBadge[data.status].tone}>{statusBadge[data.status].label}</Badge>}
        </Row>

        {live && (
          <View style={{ marginVertical: 12 }}>
            <ProgressBar value={progressPct} height={8} />
          </View>
        )}

        {/* Live Boarding Chips */}
        {data && data.members.length > 0 && (
          <Row gap={6} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {data.members.map((m, idx) => (
              <Badge key={`${m.first_name}-${idx}`} tone={m.picked_up ? 'green' : 'slate'} icon={m.picked_up ? Check : Clock3}>
                {`${m.is_you ? 'You' : m.first_name}: ${m.picked_up ? 'Picked up' : 'Waiting'}`}
              </Badge>
            ))}
          </Row>
        )}

        {data && (
          <CaptainMini
            label={data.captain && data.vehicle ? `${data.captain.name} · Plate ${data.vehicle.plate}` : 'CAPTAIN'}
            title={live ? `En route to ${data.campus.code}` : data.status === 'confirmed' ? 'Captain confirmed' : 'Waiting for captain'}
            subtitle={live ? `${pickedCount} of ${totalRiders} students on board` : `${data.seats_taken}/${data.capacity} seats filled`}
            accessory={<IconButton icon={Phone} label="Call captain" tint={color.brand} style={styles.callBtn} size={18} />}
          />
        )}

        <Button
          tone="danger"
          icon={ShieldCheck}
          style={{ marginTop: 12 }}
          onPress={() => router.push({ pathname: '/safety', params: { bookingId } })}
        >
          SOS
        </Button>
      </View>
    </Page>
  );
}

/**
 * Figma 07a–07c: Interactive SOS Hold-for-3s Ring + Accessible Confirm Alternative + Trip Share!
 */
export function Safety() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const { data } = useLoad(() => loadBooking(bookingId), [bookingId]);
  const [copied, setCopied] = useState(false);
  const [sosState, setSosState] = useState<'idle' | 'holding' | 'confirm' | 'sent'>('idle');
  const [holdSec, setHoldSec] = useState(3);
  const [sosCode, setSosCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ringScale = useRef(new Animated.Value(1)).current;
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const firstName = profile?.fullName.split(' ')[0] ?? 'Student';

  const sendSos = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await logSos(bookingId);
    setBusy(false);
    if (res.ok) {
      setSosCode(res.data.code);
      setSosState('sent');
    } else {
      setError(errorCopy(res.code));
      setSosState('confirm');
    }
  }, [bookingId, busy]);

  function startHold() {
    if (sosState === 'sent' || busy) return;
    setSosState('holding');
    setHoldSec(3);
    Animated.timing(ringScale, { toValue: 1.24, duration: 2400, useNativeDriver: NATIVE_DRIVER }).start();
    let count = 3;
    holdTimer.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        holdTimer.current = null;
        ringScale.setValue(1);
        sendSos();
      } else {
        setHoldSec(count);
      }
    }, 800);
  }

  function stopHold() {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    ringScale.stopAnimation();
    ringScale.setValue(1);
    if (sosState === 'holding') setSosState('idle');
  }

  useEffect(() => () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
  }, []);

  return (
    <Page>
      <Header
        title="Safety & verification"
        subtitle="Jeeny 24/7 Campus Trust Architecture"
        onBack={() => router.dismissTo({ pathname: '/trip', params: { bookingId } })}
      />

      {/* Share Live Trip Card */}
      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <Tile icon={Route} size={46} iconSize={22} />
          <Pile gap={2} style={fill}>
            <Copy size={15} weight={800} tint={color.navy}>Share live trip link</Copy>
            <Copy size={12} tint={color.muted}>Family WhatsApp link · expires automatically at arrival</Copy>
          </Pile>
        </Row>
        <View style={styles.sharePreview}>
          <Copy size={13} weight={800} tint={color.navy}>
            {`${firstName}’s JUNI ride to ${data?.campus.code ?? 'Campus'}`}
          </Copy>
          <Copy size={12} tint={color.muted}>
            {data?.captain && data.vehicle
              ? `Captain ${data.captain.name} · ${data.vehicle.make_model} (${data.vehicle.plate}) · ETA ${formatTime(data.arrival_at)}`
              : `Booking ${data?.code ?? ''} · Verified gender-isolated car`}
          </Copy>
        </View>
        <Button tone="secondary" icon={copied ? Check : CopyIcon} onPress={() => setCopied(true)}>
          {copied ? 'Trip summary link copied!' : 'Copy live trip link'}
        </Button>
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <LockKeyhole size={14} color={color.muted} />
          <Copy size={12} tint={color.muted}>Co-riders’ personal contact info stays private.</Copy>
        </Row>
      </Card>

      {/* Figma 07a–07c Emergency SOS Hold + Accessible Button */}
      <Card style={styles.sosCard}>
        <Eyebrow tint={color.danger}>EMERGENCY ESCALATION</Eyebrow>
        {sosState === 'sent' ? (
          <Pile gap={10} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Tile icon={CheckCircle2} size={56} iconSize={28} background={color.emeraldSoft} tint={color.emerald} />
            <Copy size={20} weight={800} tint={color.navy}>Safety Alert Logged</Copy>
            <Copy size={13} tint={color.muted} style={center}>
              {`Audit code ${sosCode} recorded for trip ${data?.code ?? ''}. Connects to Jeeny's 24/7 Safety Desk in host production.`}
            </Copy>
            <Pile gap={6} style={styles.sosChecklist}>
              <Row gap={8}><Check size={16} color={color.emerald} /><Copy size={13} weight={700} tint={color.navy}>Trip & vehicle details attached</Copy></Row>
              <Row gap={8}><Check size={16} color={color.emerald} /><Copy size={13} weight={700} tint={color.navy}>Corridor telemetry recorded</Copy></Row>
              <Row gap={8}><Check size={16} color={color.emerald} /><Copy size={13} weight={700} tint={color.navy}>Jeeny Safety Desk audit created</Copy></Row>
            </Pile>
            <Button tone="secondary" onPress={() => setSosState('idle')} style={{ alignSelf: 'stretch' }}>
              I’m safe — dismiss alert view
            </Button>
          </Pile>
        ) : (
          <>
            <Copy size={18} weight={800} tint={color.navy} style={[center, { marginTop: 4 }]}>
              {sosState === 'holding' ? `Sending SOS in ${holdSec}…` : 'Hold 3 seconds for SOS'}
            </Copy>
            <Copy size={12} tint={color.muted} style={center}>
              Logs an immediate safety incident with your captain, plate & gate telemetry.
            </Copy>

            <View style={styles.sosHoldArea}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sosPulseRing,
                  { transform: [{ scale: ringScale }] },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hold for 3 seconds to send SOS alert"
                onPressIn={startHold}
                onPressOut={stopHold}
                style={styles.sosButton}
              >
                <AlertTriangle size={28} color={color.white} />
                <Copy size={22} weight={800} tint={color.white}>
                  {sosState === 'holding' ? String(holdSec) : 'HOLD'}
                </Copy>
                <Copy size={12} weight={700} tint="#FFE4E6">SOS</Copy>
              </Pressable>
            </View>

            {/* Accessible single-tap alternative per mobile-design touch accessibility rules */}
            <Button tone="secondary" onPress={() => setSosState('confirm')} style={{ alignSelf: 'stretch' }}>
              Or tap to confirm safety alert
            </Button>
          </>
        )}
      </Card>

      <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <InfoRow icon={Phone} label="24/7 Non-emergency support" value="Contact Jeeny Campus Desk" onPress={() => {}} />
      </Card>

      {sosState === 'confirm' && (
        <BottomSheet onClose={() => { setSosState('idle'); setError(''); }}>
          <SheetHeading
            icon={AlertTriangle}
            title="Log safety alert now?"
            tone="red"
            detail="Records a priority safety incident on this trip (connects to Jeeny 24/7 Safety Desk in host production)."
          />
          {!!error && <Copy accessibilityRole="alert" tint={color.danger}>{error}</Copy>}
          <Button tone="danger" disabled={busy} onPress={sendSos}>
            {busy ? 'Logging alert…' : 'Confirm safety alert'}
          </Button>
          <Button tone="secondary" onPress={() => setSosState('idle')}>Cancel</Button>
        </BottomSheet>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  rtCancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  tabs: {
    marginBottom: 16,
    padding: 5,
    borderRadius: 999,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabActive: {
    backgroundColor: color.brand,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  refundBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
  },
  captainCard: {
    marginTop: 14,
    padding: 16,
    backgroundColor: color.white,
    borderColor: color.line,
  },
  captainPhotoLarge: {
    width: 68,
    height: 78,
    borderRadius: 18,
  },
  plateBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: color.soft,
    borderWidth: 1.5,
    borderColor: color.navy,
    alignItems: 'center',
  },
  callBtn: {
    backgroundColor: color.pink,
    borderColor: color.pinkBorder,
  },
  riderRow: { minHeight: 62, paddingVertical: 10 },
  riderDivider: { borderBottomWidth: 1, borderBottomColor: color.line },
  tripBlock: {
    marginTop: 18, padding: 18, borderRadius: 22, backgroundColor: color.white, borderWidth: 1, borderColor: color.line,
  },
  tripBlockDivider: { height: 1, backgroundColor: color.line, marginVertical: 14 },
  trackingPage: { backgroundColor: '#E6EEF2' },
  mapBack: {
    position: 'absolute',
    left: 16,
    backgroundColor: color.white,
    ...shadow(6, 16, '#1A152826'),
  },
  liveMapPill: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: color.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.line,
    ...shadow(4, 12, '#1A15281F'),
  },
  trackingSheet: {
    marginTop: -24,
    paddingTop: 10,
    paddingHorizontal: 20,
    backgroundColor: color.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...shadow(0, 24, '#1A152826'),
  },
  sheetGrabber: {
    width: 42,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#DDD6E8',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sosCard: {
    marginTop: 14,
    alignItems: 'center',
    backgroundColor: '#FFF9F9',
    borderColor: '#FECACA',
    gap: 10,
    padding: 18,
  },
  sosHoldArea: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  sosPulseRing: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: '#FCA5A559',
  },
  sosButton: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: color.danger,
    borderWidth: 6,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...shadow(8, 22, '#DC262645'),
  },
  sosChecklist: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: 16,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.line,
  },
  sharePreview: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: color.soft,
    gap: 4,
  },
});
