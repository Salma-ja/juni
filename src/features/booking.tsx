import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Check, CheckCircle2, Clock3, CreditCard, Info, LockKeyhole, X, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge, Button, Card, center, CheckDot, Copy, Eyebrow, fill, Header, IconButton,
  Notice, Page, Pile, Row, spread,
} from '@/components/ui';
import { RouteTitle } from '@/features/planning';
import { useAuth } from '@/features/authSession';
import {
  booking as loadBooking, hold as loadHold, pay, startCheckout, type BookingDetail, type Checkout, type Hold, type PayResult,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { formatCountdown, formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { color } from '@/theme';

/** Seconds left on a hold, counted from the server's clock so a demo clock offset does not skew it. */
function useCountdown(expiresAt?: string, appNow?: string) {
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
        <Notice icon={AlertTriangle} tint="#A63737" style={{ backgroundColor: '#FFEFEE' }}>{errorCopy(code)}</Notice>
        <Button onPress={() => router.dismissTo({ pathname: '/matching', params: { requestId } })}>See other groups</Button>
      </Page>
    );
  }
  if (!checkout) {
    return (
      <Page>
        <Header title="Review booking" onBack={back} />
        <Copy tint={color.muted}>Holding your seat…</Copy>
      </Page>
    );
  }
  const checks = [
    ['Student verified', 'Verification confirmed'],
    ['Seat held for you', `Held for 5 minutes`],
    ['Preference matched', 'This group accepts your profile'],
    ['Fare locked', `${formatFils(checkout.fare_fils)} · fixed for this booking`],
  ] as const;
  return (
    <Page>
      <Header title="Review booking" onBack={back} />
      <View style={styles.summaryRoute}>
        <Copy size={9} weight={700} tint="#F2A3CC">{formatDate(checkout.departure_at)}</Copy>
        <RouteTitle light pickup={ref.pickup(checkout.pickup_area_id)?.name ?? ''} destination={ref.campus(checkout.campus_id)?.code ?? ''} />
        <Copy size={10} tint="#CFC5DA">{`Departs ${formatTime(checkout.departure_at)} · Your pickup ${formatTime(checkout.pickup_at)}`}</Copy>
      </View>
      <Card style={styles.ruleChecks}>
        <Eyebrow>AUTOMATIC RULE CHECK</Eyebrow>
        {checks.map(([label, detail]) => (
          <Row key={label} gap={10}>
            <View style={styles.ruleIcon}><Check size={11} color={color.white} /></View>
            <Pile gap={4} style={fill}>
              <Copy size={11} weight={800}>{label}</Copy>
              <Copy size={8} tint={color.muted}>{detail}</Copy>
            </Pile>
          </Row>
        ))}
      </Card>
      <Card style={styles.price}>
        <Copy size={13} weight={800}>Payment summary</Copy>
        <SummaryLine label="Seat fare" value={formatFils(checkout.fare_fils)} />
        <SummaryLine label="Service fee" value="0.00 JD" />
        <View style={styles.priceDivider} />
        <SummaryLine label="Total prepaid" value={formatFils(checkout.fare_fils)} total />
      </Card>
      {checkout.inside_12h && (
        <Notice icon={AlertTriangle} tint="#735C23" style={{ backgroundColor: '#FFF7E4' }}>
          No refund if cancelled. Pickup is in less than 12 hours.
        </Notice>
      )}
      <Notice icon={LockKeyhole} tint="#557068" style={styles.secureNote}>
        {expired ? errorCopy('HOLD_EXPIRED') : `Your seat is held for ${formatCountdown(remaining ?? 300)}`}
      </Notice>
      {expired
        ? <Button style={styles.sticky} onPress={back}>Start again</Button>
        : <Button icon={CreditCard} style={styles.sticky}
            onPress={() => router.push({ pathname: '/payment', params: { holdId: checkout.hold_id, requestId } })}>Confirm payment</Button>}
    </Page>
  );
}

function SummaryLine({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <Row style={spread}>
      <Copy size={total ? 13 : 10} tint={total ? color.ink : color.muted}>{label}</Copy>
      <Copy size={total ? 13 : 10} weight={800}>{value}</Copy>
    </Row>
  );
}

export function Payment() {
  const router = useRouter();
  const { holdId, requestId } = useLocalSearchParams<{ holdId: string; requestId: string }>();
  const ref = useRefData();
  const keys = useRef({ success: globalThis.crypto.randomUUID(), failed: globalThis.crypto.randomUUID() });
  const [data, setData] = useState<Hold | null>(null);
  const [loadCode, setLoadCode] = useState('');
  const [result, setResult] = useState<PayResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
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
    const res = await pay(holdId, outcome, keys.current[outcome]);
    setBusy(false);
    if (!res.ok) { setCode(res.code); return; }
    setResult(res.data);
    if (res.data.outcome === 'success' && res.data.booking_id) {
      router.replace({ pathname: '/status', params: { bookingId: res.data.booking_id } });
    } else {
      setFailed(true);
    }
  }

  const startAgain = () => router.dismissTo({ pathname: '/group', params: { groupId: data?.group_id ?? '', requestId } });
  return (
    <Page>
      <Header title="Payment simulation" onBack={() => router.back()} />
      <DemoBanner icon={Zap} title="MVP demo mode" detail="No real money will be charged." />
      {!!loadCode && <Copy tint={color.danger}>{errorCopy(loadCode)}</Copy>}
      {data && (
        <>
          <Pile gap={8} style={styles.paymentAmount}>
            <Eyebrow size={9} tint={color.muted}>AMOUNT TO PAY</Eyebrow>
            <Copy size={42} weight={800} style={{ letterSpacing: -2.1 }}>
              {formatFils(data.fare_fils, false)} <Copy size={14} weight={800}>JD</Copy>
            </Copy>
            <Copy size={10} tint={color.muted}>{`One seat · ${formatDate(data.departure_at)} at ${formatTime(data.departure_at)}`}</Copy>
            <Copy size={10} tint={color.muted}>{ref.campus(data.campus_id)?.label ?? ''}</Copy>
            {!expired && !failed && !result && <Copy size={10} tint={color.muted}>{`Seat held for ${formatCountdown(remaining ?? 0)}`}</Copy>}
          </Pile>
          <Card style={styles.identifiers}>
            <Identifier label="Payment ID" value={result?.payment_code ?? '—'} />
            <Identifier label="Booking ID" value={result?.booking_code ?? '—'} />
          </Card>
        </>
      )}
      {(expired || !!code) && (
        <Row gap={9} style={styles.error}>
          <AlertTriangle size={20} color="#A63737" />
          <Pile gap={5} style={fill}>
            <Copy size={10} weight={800} tint="#A63737">{errorCopy(code || 'HOLD_EXPIRED')}</Copy>
          </Pile>
        </Row>
      )}
      {failed && (
        <Row gap={9} style={styles.error}>
          <AlertTriangle size={20} color="#A63737" />
          <Pile gap={5} style={fill}>
            <Copy size={10} weight={800} tint="#A63737">Payment wasn’t completed</Copy>
            <Copy size={8} tint="#A63737" style={{ lineHeight: 12 }}>
              Your seat was not locked and you were not charged. Payment ID {result?.payment_code}.
            </Copy>
          </Pile>
          <IconButton icon={X} label="Dismiss payment error" size={16} tint="#BD3D3D"
            style={styles.errorClose} onPress={() => setFailed(false)} />
        </Row>
      )}
      {failed || expired ? (
        <Button style={{ marginTop: 24 }} onPress={startAgain}>Start again</Button>
      ) : (
        <Pile gap={10} style={styles.simulation}>
          <Eyebrow>CHOOSE A TEST OUTCOME</Eyebrow>
          <Button icon={CheckCircle2} disabled={busy || !data} onPress={() => submit('success')}>Simulate payment success</Button>
          <Button icon={AlertTriangle} tone="secondary" disabled={busy || !data} onPress={() => submit('failed')}>Simulate payment failure</Button>
        </Pile>
      )}
      <Copy size={8} tint="#929E9B" style={[center, { marginTop: 8 }]}>This payment screen is for product testing only.</Copy>
    </Page>
  );
}

function Identifier({ label, value }: { label: string; value: string }) {
  return <Row style={spread}>
    <Copy size={9} tint={color.muted}>{label}</Copy><Copy size={10} weight={700} tint={color.navy}>{value}</Copy>
  </Row>;
}

function DemoBanner({ icon: Icon, title, detail, subtle = false }: {
  icon: LucideIcon; title: string; detail: string; subtle?: boolean;
}) {
  const tint = subtle ? '#576D68' : '#634EB5';
  return <Row gap={11} style={[styles.demo, subtle && styles.subtle]}>
    <Icon size={18} color={tint} />
    <Pile gap={4} style={fill}>
      <Copy size={11} weight={800} tint={tint}>{title}</Copy>
      <Copy size={8} tint={tint} style={{ opacity: 0.8 }}>{detail}</Copy>
    </Pile>
  </Row>;
}

export function BookingStatus() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const [data, setData] = useState<BookingDetail | null>(null);
  const [code, setCode] = useState('');
  const status = data?.status;

  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await loadBooking(bookingId);
      if (!live) return;
      if (res.ok) setData(res.data); else setCode(res.code);
    };
    load();
    // poll every 5 s while the ride is still waiting on a captain
    const timer = setInterval(() => {
      if (!status || status === 'seat_booked' || status === 'awaiting_captain') load();
    }, 5000);
    return () => { live = false; clearInterval(timer); };
  }, [bookingId, status]);

  if (!data) {
    return (
      <Page>
        <Header title="Booking status" onBack={() => router.dismissTo('/home')} />
        <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Loading booking…'}</Copy>
      </Page>
    );
  }
  const confirmed = data.status === 'confirmed' || data.status === 'in_progress' || data.status === 'completed';
  const cancelled = data.status === 'cancelled';
  const full = data.seats_taken >= data.capacity;
  const steps = [
    { label: 'Seat booked', done: true },
    { label: `Group full · ${data.seats_taken}/${data.capacity}`, done: full, note: 'Group complete does not mean trip confirmed' },
    { label: 'Awaiting captain confirmation', done: full },
    { label: 'Confirmed', done: confirmed },
  ];
  const Icon = confirmed ? CheckCircle2 : Clock3;
  return (
    <Page>
      <Header title="Booking status" onBack={() => router.dismissTo('/home')} />
      <Pile gap={9} style={[styles.statusHero, confirmed && styles.confirmed]}>
        <Icon size={31} color={confirmed ? color.brand : color.amber} />
        <Badge tone={cancelled ? 'slate' : confirmed ? 'green' : 'amber'} style={styles.centered}>
          {cancelled ? 'CANCELLED' : confirmed ? 'CONFIRMED' : full ? 'AWAITING CAPTAIN' : 'SEAT BOOKED'}
        </Badge>
        <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy} style={center}>
          {cancelled ? 'This booking was cancelled' : confirmed ? 'Your ride is confirmed' : full ? 'Your group is ready' : 'Your seat is booked'}
        </Copy>
        <Copy size={10} tint={color.muted} style={[center, { lineHeight: 15 }]}>
          {cancelled
            ? (data.refund ? `${data.refund.amount_fils > 0 ? `Full refund issued · ${formatFils(data.refund.amount_fils)}` : 'No refund'}` : '')
            : confirmed && data.captain
              ? `Captain ${data.captain.name} · ${data.vehicle?.make_model} · ${data.vehicle?.plate}`
              : full ? 'We’re assigning a licensed captain to your full group.' : 'We’ll confirm a captain once the group is full.'}
        </Copy>
        <Copy size={9} tint={color.muted}>{`${data.code} · ${formatDate(data.pickup_at)} · Pickup ${formatTime(data.pickup_at)} · ${data.pickup_area.name}`}</Copy>
      </Pile>
      <View style={styles.steps}>
        <Row style={spread}><Copy size={13} weight={800}>Group status</Copy><Badge>{full ? 'Complete' : 'Filling'}</Badge></Row>
        <View>
          <View style={styles.stepTrack} />
          {steps.map((step, index) => (
            <Row key={step.label} gap={11} style={styles.step}>
              <CheckDot active={step.done} index={index + 1} />
              <Pile gap={4} style={fill}>
                <Copy size={10} weight={800} style={{ marginTop: 4 }}>{step.label}</Copy>
                {index === 1 && full && !confirmed && <Copy size={8} tint="#B07725">{step.note}</Copy>}
              </Pile>
            </Row>
          ))}
        </View>
      </View>
      {profile?.isDemo && !confirmed && !cancelled && (
        <DemoBanner icon={Info} title="Captain assignment is simulated" detail="Captain confirmation happens in Demo controls" subtle />
      )}
      {confirmed && <Button style={{ marginTop: 13 }} onPress={() => router.push({ pathname: '/trip', params: { bookingId } })}>View trip details</Button>}
    </Page>
  );
}

const styles = StyleSheet.create({
  summaryRoute: { padding: 20, borderRadius: 18, backgroundColor: color.navy },
  ruleChecks: { marginVertical: 16, gap: 13, borderRadius: 17, padding: 17 },
  ruleIcon: { width: 17, height: 17, borderRadius: 9, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  price: { gap: 11, borderRadius: 16, padding: 16, borderWidth: 0, backgroundColor: '#F4F7F6' },
  priceDivider: { height: 1, backgroundColor: '#D9E3DF', marginVertical: 2 },
  secureNote: { backgroundColor: color.pink, marginTop: 13 },
  sticky: { marginTop: 24 },
  demo: { padding: 13, borderRadius: 14, backgroundColor: '#F1EDFF' },
  subtle: { backgroundColor: '#F1F5F4' },
  paymentAmount: { alignItems: 'center', paddingTop: 36, paddingBottom: 27 },
  identifiers: { gap: 24, paddingVertical: 19, paddingHorizontal: 14, borderRadius: 14 },
  error: { borderRadius: 13, marginTop: 13, backgroundColor: '#FFEFEE', padding: 13, alignItems: 'flex-start' },
  errorClose: { width: 27, height: 27, borderWidth: 0, backgroundColor: 'transparent' },
  simulation: { marginTop: 24, padding: 17, backgroundColor: '#F7F9F8', borderRadius: 16 },
  statusHero: { paddingVertical: 25, paddingHorizontal: 18, alignItems: 'center', borderRadius: 20, backgroundColor: '#FFF7E4' },
  confirmed: { backgroundColor: color.pink },
  centered: { alignSelf: 'center' },
  steps: { paddingVertical: 20, paddingHorizontal: 6, gap: 13 },
  step: { minHeight: 45, alignItems: 'flex-start' },
  stepTrack: { position: 'absolute', top: 20, bottom: 42, width: 1, left: 11, backgroundColor: '#DCE4E2' },
});
