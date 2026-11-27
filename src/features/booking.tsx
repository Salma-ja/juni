import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle, Banknote, Check, Clock3, CreditCard, Gift, LockKeyhole, ShieldCheck, Wallet, X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import {
  Badge, Button, Card, center, Copy, Eyebrow, fill, Header, IconButton, Notice, Page, Pile, PulseDot, Row,
  ScalePressable, spread, Tile,
} from '@/components/ui';
import {
  booking as loadBooking, hold as loadHold, pay, startCheckout, type BookingDetail, type Checkout,
  type Hold, type PayResult,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { formatCountdown, formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { LivePickupWidget, NotificationBell, useLiveUpdates } from '@/features/liveUpdates';
import { payMethodLabel, readPayMethod, rememberPayMethod, type PayMethod } from '@/features/payMethod';
import { color } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

/** Seconds left on a hold, counted from the server's clock so a demo clock offset does not skew it. */
export function useCountdown(expiresAt?: string, appNow?: string) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt || !appNow) return;
    const total = (new Date(expiresAt).getTime() - new Date(appNow).getTime()) / 1000;
    const startedAt = Date.now();
    const tick = () => setRemaining(Math.max(0, total - (Date.now() - startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [expiresAt, appNow]);
  return remaining;
}

export function BookingSummary() {
  const router = useRouter();
  const { groupId, requestId, routeVersion, pickupAreaId } =
    useLocalSearchParams<{ groupId: string; requestId: string; routeVersion: string; pickupAreaId: string }>();
  const ref = useRefData();
  const key = useRef(globalThis.crypto.randomUUID());
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [code, setCode] = useState('');
  const remaining = useCountdown(checkout?.expires_at, checkout?.app_now);
  const expired = remaining !== null && remaining <= 0;

  useEffect(() => {
    let live = true;
    startCheckout({ groupId, pickupAreaId, routeVersion: Number(routeVersion), idempotencyKey: key.current }).then((res) => {
      if (!live) return;
      if (res.ok) setCheckout(res.data); else setCode(res.code);
    });
    return () => { live = false; };
  }, [groupId, pickupAreaId, routeVersion]);

  const back = () => router.dismissTo({ pathname: '/group', params: { groupId, requestId } });
  if (code) {
    return (
      <Page>
        <Header title="Review booking" onBack={back} />
        <Notice icon={AlertTriangle} tint={color.danger} style={{ backgroundColor: color.dangerSoft }}>
          {errorCopy(code)}
        </Notice>
        <Button style={{ marginTop: 16 }} onPress={() => router.dismissTo({ pathname: '/matching', params: { requestId } })}>
          See other groups
        </Button>
      </Page>
    );
  }
  if (!checkout) {
    return (
      <Page>
        <Header title="Review booking" onBack={back} />
        <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <PulseDot tint={color.brand} size={8} />
          <Copy tint={color.muted}>Locking your seat for 5 minutes…</Copy>
        </Card>
      </Page>
    );
  }

  const pickupName = ref.pickup(checkout.pickup_area_id)?.name ?? 'Pickup';
  const campusCode = ref.campus(checkout.campus_id)?.code ?? 'Campus';
  const timerTint = expired ? color.danger : remaining !== null && remaining < 60 ? color.amber : color.muted;

  return (
    <Page
      footer={
        <Pile gap={10}>
          <Row gap={6} style={{ justifyContent: 'center' }}>
            <Clock3 size={14} color={timerTint} />
            <Copy size={13} weight={600} tint={timerTint}>
              {expired ? 'Hold expired' : `Seat held for ${formatCountdown(remaining ?? 300)}`}
            </Copy>
          </Row>
          {expired ? (
            <Button onPress={back}>Start again</Button>
          ) : (
            <Button
              trailingArrow
              onPress={() => router.push({ pathname: '/payment', params: { holdId: checkout.hold_id, requestId } })}
            >
              {`Pay ${formatFils(checkout.fare_fils)}`}
            </Button>
          )}
        </Pile>
      }
    >
      <Header title="Review booking" subtitle={formatDate(checkout.departure_at)} onBack={back} />

      <View style={styles.tripCard}>
        <Row gap={12}>
          <View style={styles.tripRail}>
            <View style={styles.tripDotFrom} />
            <View style={styles.tripLine} />
            <View style={styles.tripDotTo} />
          </View>
          <Pile gap={18} style={fill}>
            <Row style={spread}>
              <Copy size={16} weight={800} tint={color.navy} style={fill} numberOfLines={1}>{pickupName}</Copy>
              <Copy size={18} weight={800} tint={color.navy}>{formatTime(checkout.pickup_at)}</Copy>
            </Row>
            <Row style={spread}>
              <Copy size={16} weight={800} tint={color.navy} style={fill}>{campusCode}</Copy>
              <Copy size={13} weight={600} tint={color.muted}>Campus gate</Copy>
            </Row>
          </Pile>
        </Row>
      </View>

      <View style={styles.priceBlock}>
        <Row style={spread}>
          <Copy size={14} tint={color.muted}>Your seat</Copy>
          <Copy size={14} weight={700} tint={color.navy}>{formatFils(checkout.fare_fils)}</Copy>
        </Row>
        <Row style={spread}>
          <Copy size={14} tint={color.muted}>Fees</Copy>
          <Copy size={14} weight={700} tint={color.navy}>0.00 JD</Copy>
        </Row>
        <View style={styles.priceDivider} />
        <Row style={spread}>
          <Copy size={16} weight={800} tint={color.navy}>Total</Copy>
          <Copy size={22} weight={800} tint={color.navy}>{formatFils(checkout.fare_fils)}</Copy>
        </Row>
      </View>

      <Row gap={6} style={{ marginTop: 14 }}>
        <ShieldCheck size={14} color={color.muted} />
        <Copy size={12} tint={color.muted} style={fill}>
          {checkout.inside_12h
            ? 'Under 12h to pickup — no refund if you cancel'
            : 'Price locked · Free cancel up to 12h before pickup'}
        </Copy>
      </Row>
    </Page>
  );
}

export function Payment() {
  const router = useRouter();
  const { holdId, requestId } = useLocalSearchParams<{ holdId: string; requestId: string }>();
  const ref = useRefData();
  const { refreshLive } = useLiveUpdates();
  const keys = useRef({ success: globalThis.crypto.randomUUID(), failed: globalThis.crypto.randomUUID() });
  const [data, setData] = useState<Hold | null>(null);
  const [loadCode, setLoadCode] = useState('');
  const [result, setResult] = useState<PayResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [method] = useState<PayMethod>('cash');
  const remaining = useCountdown(data?.expires_at, data?.app_now);
  const expired = !!data && (!data.active || (remaining !== null && remaining <= 0));

  useEffect(() => {
    let live = true;
    loadHold(holdId).then((res) => {
      if (!live) return;
      if (res.ok) setData(res.data); else setLoadCode(res.code);
    });
    return () => { live = false; };
  }, [holdId]);

  async function submit(outcome: 'success' | 'failed') {
    if (busy || expired || !data) return;
    setBusy(true);
    setCode('');
    const res = await pay(holdId, outcome, keys.current[outcome], method === 'cash' ? 'cash' : 'cash');
    setBusy(false);
    if (!res.ok) { setCode(res.code); return; }
    setResult(res.data);
    if (res.data.outcome === 'success' && res.data.booking_id) {
      await rememberPayMethod(res.data.booking_id, 'cash');
      await refreshLive();
      router.replace({
        pathname: '/status',
        params: { bookingId: res.data.booking_id, bonusPts: String(res.data.points_awarded ?? 0) },
      });
    } else {
      setFailed(true);
    }
  }

  const startAgain = () => router.dismissTo({ pathname: '/group', params: { groupId: data?.group_id ?? '', requestId } });
  return (
    <Page
      footer={
        failed || expired ? (
          <Button onPress={startAgain}>Return to group</Button>
        ) : (
          <Button icon={Banknote} disabled={busy || !data} onPress={() => submit('success')} trailingArrow>
            {busy ? 'Confirming seat…' : `Confirm seat · ${data ? formatFils(data.fare_fils) : ''} Cash`}
          </Button>
        )
      }
    >
      <Header title="Confirm seat" subtitle="Jeeny Campus Pilot Checkout" onBack={() => router.back()} />

      {!!loadCode && (
        <Notice icon={AlertTriangle} tint={color.danger} style={{ backgroundColor: color.dangerSoft }}>
          {errorCopy(loadCode)}
        </Notice>
      )}

      {data && (
        <Card style={styles.amountHero}>
          <Eyebrow tint={color.muted}>EXACT GATE FARE</Eyebrow>
          <Row gap={6} style={{ alignItems: 'baseline', marginTop: 6 }}>
            <Copy size={42} weight={800} tint={color.navy} style={{ letterSpacing: -1.8 }}>
              {formatFils(data.fare_fils, false)}
            </Copy>
            <Copy size={16} weight={800} tint={color.brand}>JD</Copy>
          </Row>
          <Copy size={13} tint={color.muted}>
            {`${ref.campus(data.campus_id)?.code ?? ''} · ${formatDate(data.departure_at)} at ${formatTime(data.departure_at)}`}
          </Copy>
          {!expired && !failed && !result && (
            <Badge tone="brand" icon={LockKeyhole} style={{ marginTop: 8 }}>
              {`Seat held for ${formatCountdown(remaining ?? 0)}`}
            </Badge>
          )}
        </Card>
      )}

      {(expired || !!code) && (
        <Card style={styles.errorCard}>
          <Row gap={10}>
            <AlertTriangle size={20} color={color.danger} />
            <Copy size={13} weight={700} tint={color.danger} style={fill}>
              {errorCopy(code || 'HOLD_EXPIRED')}
            </Copy>
          </Row>
        </Card>
      )}

      {failed && (
        <Card style={styles.errorCard}>
          <Row gap={10}>
            <AlertTriangle size={20} color={color.danger} />
            <Pile gap={3} style={fill}>
              <Copy size={14} weight={800} tint={color.danger}>Payment was not completed</Copy>
              <Copy size={12} tint={color.danger}>
                {`Your seat hold was released and you were not charged (${result?.payment_code ?? ''}).`}
              </Copy>
            </Pile>
            <IconButton icon={X} label="Dismiss payment error" size={18} tint={color.danger} onPress={() => setFailed(false)} />
          </Row>
        </Card>
      )}

      {!failed && !expired && (
        <Pile gap={10} style={{ marginTop: 16 }}>
          <Copy size={14} weight={800} tint={color.navy}>Payment method</Copy>
          <PayChoice
            icon={Banknote}
            title="Cash at Pickup Gate"
            badge="Active Pilot"
            detail="Seat locks immediately on your campus account. Pay exact JOD to your assigned captain at boarding."
            selected
            onPress={() => {}}
          />
          <PayChoice
            icon={Wallet}
            title="Jeeny Wallet"
            badge="Host SDK · Phase 2"
            detail="Connects to native Jeeny Wallet balance in production host integration."
            selected={false}
            muted
            onPress={() => {}}
          />
          <PayChoice
            icon={CreditCard}
            title="Card / CliQ"
            badge="Phase 2"
            detail="Saved cards and Jordan CliQ instant transfer."
            selected={false}
            muted
            onPress={() => {}}
          />
        </Pile>
      )}
    </Page>
  );
}

function PayChoice({ icon: Icon, title, badge, detail, selected, muted = false, onPress }: {
  icon: typeof Wallet; title: string; badge: string; detail: string; selected: boolean; muted?: boolean; onPress: () => void;
}) {
  return (
    <ScalePressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: muted }}
      accessibilityLabel={`${title}, ${badge}`}
      disabled={muted}
      onPress={onPress}
      style={[styles.payChoice, selected && styles.payChoiceOn, muted && { opacity: 0.62 }]}
    >
      <Tile
        icon={Icon}
        size={42}
        iconSize={20}
        background={selected ? color.brand : color.soft}
        tint={selected ? color.white : color.muted}
      />
      <Pile gap={3} style={fill}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Copy size={14} weight={800} tint={color.navy}>{title}</Copy>
          <Badge tone={selected ? 'brand' : 'slate'}>{badge}</Badge>
        </Row>
        <Copy size={12} tint={color.muted} style={{ lineHeight: 18 }}>{detail}</Copy>
      </Pile>
      <View style={[styles.radio, selected && styles.radioOn]} />
    </ScalePressable>
  );
}

export function BookingStatus() {
  const router = useRouter();
  const { bookingId, bonusPts } = useLocalSearchParams<{ bookingId: string; bonusPts?: string }>();
  const { refreshLive } = useLiveUpdates();
  const [data, setData] = useState<BookingDetail | null>(null);
  const [code, setCode] = useState('');
  const [paidWith, setPaidWith] = useState<string | null>(null);
  const status = data?.status;
  const celebrationScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(celebrationScale, {
      toValue: 1,
      damping: 12,
      stiffness: 180,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [celebrationScale]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await loadBooking(bookingId);
      if (!live) return;
      if (res.ok) {
        setData(res.data);
        const recorded = (res.data as { payment_method?: string }).payment_method;
        if (recorded === 'cash') setPaidWith('Cash at pickup gate');
      } else {
        setCode(res.code);
      }
    };
    load();
    readPayMethod(bookingId).then((method) => { if (live && method) setPaidWith(payMethodLabel[method]); });
    const timer = setInterval(() => {
      load();
      refreshLive();
    }, 4000);
    return () => { live = false; clearInterval(timer); };
  }, [bookingId, status, refreshLive]);

  if (!data) {
    return (
      <Page>
        <Header title="Booking status" onBack={() => router.dismissTo('/home')} action={<NotificationBell />} />
        <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <PulseDot tint={color.brand} size={8} />
          <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Loading live booking status…'}</Copy>
        </Card>
      </Page>
    );
  }

  const confirmed = data.status === 'confirmed' || data.status === 'in_progress' || data.status === 'completed';
  const cancelled = data.status === 'cancelled';
  const driverChosen = Boolean(data.captain);
  const full = data.seats_taken >= data.capacity;
  const earnedBonus = Number(bonusPts ?? 0) > 0 || (full && !cancelled);

  const open = Math.max(0, data.capacity - data.seats_taken);
  const steps = [
    { label: 'Seat reserved', done: true },
    { label: 'Car full', done: full },
    { label: driverChosen && data.captain ? `Captain ${data.captain.name.split(' ')[0]}` : 'Captain assigned', done: driverChosen },
    { label: 'Confirmed', done: confirmed },
  ];

  const tone = cancelled ? color.danger : confirmed ? color.emerald : color.brand;
  const statusLabel = cancelled ? 'Cancelled' : confirmed ? 'Confirmed' : driverChosen ? 'Awaiting captain' : full ? 'Car full' : 'Seat reserved';
  const headline = cancelled
    ? 'Booking cancelled'
    : confirmed
      ? 'You’re all set'
      : driverChosen
        ? 'Captain is reviewing'
        : full
          ? 'Finding your captain'
          : `${open} more ${open === 1 ? 'rider' : 'riders'} to go`;
  const detail = cancelled
    ? (data.refund && data.refund.amount_fils > 0 ? `Refund ${formatFils(data.refund.amount_fils)}` : 'No refund inside 12h')
    : confirmed && data.vehicle
      ? `${data.vehicle.make_model} · ${data.vehicle.plate}`
      : driverChosen && data.captain
        ? `${data.captain.name}${data.vehicle ? ` · ${data.vehicle.make_model}` : ''}`
        : full
          ? 'Usually takes a minute'
          : 'Your seat and price are locked';

  return (
    <Page
      footer={
        <Button trailingArrow onPress={() => router.push({ pathname: '/trip', params: { bookingId } })}>
          {confirmed ? 'Open live trip' : 'View trip'}
        </Button>
      }
    >
      <Header
        title="Booking"
        subtitle={`${formatDate(data.pickup_at)} · ${data.code}`}
        onBack={() => router.dismissTo('/home')}
        action={<NotificationBell />}
      />

      {/* Status */}
      <Animated.View style={{ transform: [{ scale: celebrationScale }] }}>
        <Row gap={6}>
          <PulseDot tint={tone} size={7} />
          <Copy size={13} weight={700} tint={tone}>{statusLabel}</Copy>
        </Row>
        <Copy accessibilityRole="header" size={26} weight={800} tint={color.navy} style={{ marginTop: 6, letterSpacing: -0.6 }}>
          {headline}
        </Copy>
        <Copy size={14} tint={color.muted} style={{ marginTop: 2 }}>{detail}</Copy>
      </Animated.View>

      {earnedBonus && !cancelled && (
        <Row gap={6} style={styles.bonusStrip}>
          <Gift size={15} color={color.brand} />
          <Copy size={13} weight={800} tint={color.brand}>+30 pts added for the last seat</Copy>
        </Row>
      )}

      {confirmed && !cancelled && (
        <View style={{ marginTop: 16 }}>
          <LivePickupWidget
            booking={data}
            appNow={data.app_now}
            members={data.members}
            onPress={() => router.push({ pathname: '/trip', params: { bookingId } })}
          />
        </View>
      )}

      {/* Trip */}
      <View style={[styles.tripCard, { marginTop: 18 }]}>
        <Row gap={12}>
          <View style={styles.tripRail}>
            <View style={styles.tripDotFrom} />
            <View style={styles.tripLine} />
            <View style={styles.tripDotTo} />
          </View>
          <Pile gap={18} style={fill}>
            <Row style={spread}>
              <Copy size={16} weight={800} tint={color.navy} style={fill} numberOfLines={1}>{data.pickup_area.name}</Copy>
              <Copy size={18} weight={800} tint={color.navy}>{formatTime(data.pickup_at)}</Copy>
            </Row>
            <Row style={spread}>
              <Copy size={16} weight={800} tint={color.navy} style={fill}>{data.campus.code}</Copy>
              <Copy size={14} weight={700} tint={color.muted}>{formatTime(data.arrival_at)}</Copy>
            </Row>
          </Pile>
        </Row>
        <View style={styles.tripDivider} />
        <Row style={spread}>
          <Row gap={6}>
            {Array.from({ length: data.capacity }, (_, i) => (
              <View key={i} style={[styles.seatPip, i < data.seats_taken && styles.seatPipOn]} />
            ))}
          </Row>
          <Copy size={14} weight={800} tint={color.navy}>{formatFils(data.fare_fils)}</Copy>
        </Row>
      </View>

      {/* Steps */}
      {!cancelled && (
        <View style={{ marginTop: 22 }}>
          {steps.map((step, i) => (
            <Row key={step.label} gap={12} style={styles.stepRow}>
              <View style={[styles.stepDot, step.done && styles.stepDotOn]}>
                {step.done && <Check size={12} color={color.white} />}
              </View>
              <Copy size={15} weight={step.done ? 700 : 500} tint={step.done ? color.navy : color.muted} style={fill}>
                {step.label}
              </Copy>
              {i === 0 && !!paidWith && <Copy size={12} tint={color.muted}>{paidWith}</Copy>}
              {i === 1 && !full && <Copy size={12} tint={color.muted}>{`${data.seats_taken}/${data.capacity}`}</Copy>}
            </Row>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  priceDivider: { height: 1, backgroundColor: color.line, marginVertical: 2 },
  tripCard: {
    marginTop: 6, padding: 18, borderRadius: 22, backgroundColor: color.white, borderWidth: 1, borderColor: color.line,
  },
  tripRail: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 5 },
  tripDotFrom: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: color.brand, backgroundColor: color.white },
  tripLine: { width: 2, flex: 1, backgroundColor: color.line, marginVertical: 4 },
  tripDotTo: { width: 12, height: 12, borderRadius: 3, backgroundColor: color.navy },
  priceBlock: { marginTop: 22, gap: 12 },
  tripDivider: { height: 1, backgroundColor: color.line, marginVertical: 14 },
  seatPip: { width: 22, height: 8, borderRadius: 4, backgroundColor: color.line },
  seatPipOn: { backgroundColor: color.brand },
  bonusStrip: { marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: color.pink },
  stepRow: { minHeight: 40 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotOn: { borderColor: color.brand, backgroundColor: color.brand },
  amountHero: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FAF7FC',
  },
  errorCard: {
    marginTop: 12,
    backgroundColor: color.dangerSoft,
    borderColor: '#FCA5A5',
  },
  payChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: 20,
    padding: 14,
    minHeight: 72,
    backgroundColor: color.white,
  },
  payChoiceOn: {
    borderColor: color.brand,
    backgroundColor: '#FFF7FB',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C5BBD4',
  },
  radioOn: {
    borderColor: color.brand,
    backgroundColor: color.brand,
  },
});
