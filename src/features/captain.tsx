import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, CheckCircle2, Clock3, MapPin, Navigation, ShieldCheck, Users, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Copy, Eyebrow, fill, Header, InfoRow, Page, Pile, Row, SectionHeading, spread, TextLink, Tile } from '@/components/ui';
import {
  captainComplete, captainConfirm, captainDecline, captainEarnings, captainPickup, captainStart, captainTrips,
  type CaptainTrip,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { formatDate, formatFils, formatTime } from '@/data/format';
import { useLoad } from '@/data/useLoad';
import { useAuth } from '@/features/authSession';
import { color } from '@/theme';

const statusInfo: Record<CaptainTrip['status'], { label: string; tone: 'amber' | 'green' | 'slate' | 'violet' }> = {
  full: { label: 'Needs your response', tone: 'amber' },
  awaiting_captain: { label: 'Needs your response', tone: 'amber' },
  confirmed: { label: 'Ready to start', tone: 'green' },
  in_progress: { label: 'In progress', tone: 'violet' },
  completed: { label: 'Completed', tone: 'slate' },
};

/** Reload on focus and every 8 s so new assignments show up without a manual refresh. */
function useTrips() {
  const state = useLoad(() => captainTrips(), []);
  const { reload } = state;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => {
    const timer = setInterval(reload, 8000);
    return () => clearInterval(timer);
  }, [reload]);
  return state;
}

export function DriverTrips() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, code } = useTrips();
  const open = (data ?? []).filter((t) => t.status !== 'completed');
  const done = (data ?? []).filter((t) => t.status === 'completed');
  return (
    <Page>
      <Header title="My trips" eyebrow={`CAPTAIN ${profile?.fullName.split(' ')[0].toUpperCase() ?? ''}`} />
      {!!code && <Copy tint={color.danger}>{errorCopy(code)}</Copy>}
      {data && open.length === 0 && (
        <Card style={styles.empty}>
          <Copy size={14} weight={800}>No trips assigned yet</Copy>
          <Copy size={10} tint={color.muted} style={{ textAlign: 'center' }}>
            Trips appear here when a group is full and you are assigned. This list refreshes by itself.
          </Copy>
        </Card>
      )}
      <Pile gap={12}>{open.map((t) => <TripCard key={t.group_id} t={t} onPress={() => router.push({ pathname: '/driver-trip', params: { groupId: t.group_id } })} />)}</Pile>
      {done.length > 0 && <SectionHeading title="Completed" />}
      <Pile gap={12}>{done.map((t) => <TripCard key={t.group_id} t={t} onPress={() => router.push({ pathname: '/driver-trip', params: { groupId: t.group_id } })} />)}</Pile>
    </Page>
  );
}

function TripCard({ t, onPress }: { t: CaptainTrip; onPress: () => void }) {
  const info = statusInfo[t.status];
  return (
    <Card style={styles.card}>
      <Row style={spread}>
        <Eyebrow tint={color.muted} size={9}>{`${formatDate(t.departure_at).toUpperCase()} · ${formatTime(t.departure_at)}`}</Eyebrow>
        <Badge tone={info.tone}>{info.label}</Badge>
      </Row>
      <Copy size={15} weight={800}>{t.stops.map((s) => s.name).join(' → ')} → {t.campus.code}</Copy>
      <Row gap={14}>
        <Row gap={5}><Users size={15} color={color.muted} /><Copy size={10} tint={color.muted}>{`${t.seats_taken}/${t.capacity} riders`}</Copy></Row>
        <Row gap={5}><Clock3 size={15} color={color.muted} /><Copy size={10} tint={color.muted}>{`${t.route_minutes} min`}</Copy></Row>
        <Row gap={5}><Wallet size={15} color={color.muted} /><Copy size={10} tint={color.muted}>{formatFils(t.payout_fils)}</Copy></Row>
      </Row>
      <Button size={12} onPress={onPress}>{t.status === 'awaiting_captain' || t.status === 'full' ? 'Review trip' : 'Open trip'}</Button>
    </Card>
  );
}

export function DriverTrip() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data, code, reload } = useLoad(() => captainTrips(), [groupId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const trip = data?.find((t) => t.group_id === groupId);

  async function act(key: string, action: () => Promise<{ ok: boolean; code?: string }>, after?: () => void) {
    if (busy) return;
    setBusy(key);
    setError('');
    const res = await action();
    setBusy(null);
    if (!res.ok) setError(errorCopy(res.code ?? ''));
    else after?.();
    reload();
  }
  const back = () => router.dismissTo('/driver');

  if (!trip) {
    return (
      <Page>
        <Header title="Trip" onBack={back} />
        <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : data ? 'This trip is no longer assigned to you.' : 'Loading trip…'}</Copy>
      </Page>
    );
  }
  const info = statusInfo[trip.status];
  const awaiting = trip.status === 'awaiting_captain' || trip.status === 'full';
  const riders = trip.stops.flatMap((s) => s.riders);
  const allPicked = riders.length > 0 && riders.every((r) => r.picked_up);
  return (
    <Page>
      <Header title="Trip details" onBack={back} />
      <View style={styles.hero}>
        <Badge tone={info.tone}>{info.label}</Badge>
        <Copy size={17} weight={800} tint={color.white} style={{ marginTop: 10 }}>{`${trip.stops.map((s) => s.name).join(' → ')} → ${trip.campus.code}`}</Copy>
        <Copy size={10} tint="#CFC5DA">{`${formatDate(trip.departure_at)} · Depart ${formatTime(trip.departure_at)} · Arrive ${formatTime(trip.arrival_at)}`}</Copy>
        <Copy size={10} tint="#CFC5DA">{`${trip.route_minutes} min · ${trip.route_km} km · ${trip.vehicle?.make_model ?? ''} ${trip.vehicle?.plate ?? ''}`}</Copy>
      </View>
      <Row gap={10} style={{ marginTop: 14 }}>
        <Stat label="RIDERS" value={`${trip.seats_taken}/${trip.capacity}`} />
        <Stat label="YOUR PAYOUT" value={formatFils(trip.payout_fils)} />
      </Row>
      <SectionHeading title="Pickup order" note="Farthest first" />
      <View style={styles.stops}>
        {trip.stops.map((s, i) => (
          <View key={s.seq} style={[styles.stop, i < trip.stops.length - 1 && styles.divider]}>
            <Row style={spread}>
              <Row gap={8}><MapPin size={16} color={color.brand} /><Copy size={12} weight={800}>{s.name}</Copy></Row>
              <Copy size={10} tint={color.muted}>{formatTime(s.eta_at)}</Copy>
            </Row>
            <Copy size={9} tint={color.muted}>{s.detail}</Copy>
            {s.riders.map((r) => (
              <Row key={r.booking_id} gap={8} style={styles.rider}>
                <Tile icon={r.picked_up ? CheckCircle2 : Users} size={28} iconSize={15} />
                <Copy size={11} weight={700} style={fill}>{r.first_name}</Copy>
                {trip.status === 'in_progress' && (r.picked_up
                  ? <Badge icon={BadgeCheck}>Picked up</Badge>
                  : <Button size={10} disabled={busy !== null} style={styles.small}
                      onPress={() => act(`p-${r.booking_id}`, () => captainPickup(trip.group_id, r.booking_id))}>Mark picked up</Button>)}
                {trip.status === 'completed' && <Badge icon={BadgeCheck}>Dropped at campus</Badge>}
              </Row>
            ))}
          </View>
        ))}
      </View>
      {!!error && <Copy accessibilityRole="alert" tint={color.danger} style={{ marginTop: 12 }}>{error}</Copy>}
      <Pile gap={9} style={{ marginTop: 18 }}>
        {awaiting && (
          <>
            <Button icon={ShieldCheck} disabled={busy !== null} onPress={() => act('confirm', () => captainConfirm(trip.group_id))}>Accept trip</Button>
            <Button tone="secondary" disabled={busy !== null} onPress={() => act('decline', () => captainDecline(trip.group_id), back)}>Decline trip</Button>
          </>
        )}
        {trip.status === 'confirmed' && (
          <Button icon={Navigation} disabled={busy !== null} onPress={() => act('start', () => captainStart(trip.group_id))}>Start trip</Button>
        )}
        {trip.status === 'in_progress' && (
          <Button icon={CheckCircle2} disabled={busy !== null || !allPicked} onPress={() => act('complete', () => captainComplete(trip.group_id))}>
            {allPicked ? 'Complete trip' : 'Pick up every rider to complete'}
          </Button>
        )}
        {trip.status === 'completed' && (
          <Card style={styles.done}>
            <Copy size={13} weight={800}>Trip complete</Copy>
            <Copy size={10} tint={color.muted}>{`You earned ${formatFils(trip.payout_fils)} (80% of ${formatFils(trip.collected_fils)} collected).`}</Copy>
          </Card>
        )}
      </Pile>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Pile gap={4} style={styles.stat}>
      <Copy size={7} tint={color.muted}>{label}</Copy><Copy size={14} weight={800} tint={color.navy}>{value}</Copy>
    </Pile>
  );
}

export function DriverEarnings() {
  const { data, code } = useLoad(() => captainEarnings(), []);
  const router = useRouter();
  return (
    <Page>
      <Header title="Earnings" />
      {!!code && <Copy tint={color.danger}>{errorCopy(code)}</Copy>}
      <View style={styles.hero}>
        <Eyebrow size={8} tint="#F2A3CC">TOTAL PAYOUT</Eyebrow>
        <Copy size={34} weight={800} tint={color.white} style={{ letterSpacing: -1.5 }}>{formatFils(data?.total_payout_fils ?? 0)}</Copy>
        <Copy size={10} tint="#CFC5DA">{`${data?.completed_trips ?? 0} completed trips · captain share is 80% of fares collected`}</Copy>
      </View>
      <SectionHeading title="Completed trips" />
      {data && data.trips.length === 0 && <Copy size={11} tint={color.muted}>Complete a trip to see earnings here.</Copy>}
      <Pile gap={8}>
        {(data?.trips ?? []).map((t) => (
          <Card key={t.group_id} style={styles.card}>
            <Row style={spread}>
              <Copy size={12} weight={800}>{`${formatDate(t.departure_at)} · ${t.campus_code}`}</Copy>
              <Copy size={12} weight={800} tint={color.brand}>{formatFils(t.payout_fils)}</Copy>
            </Row>
            <Copy size={9} tint={color.muted}>{`${t.riders} riders`}</Copy>
          </Card>
        ))}
      </Pile>
      <TextLink size={11} onPress={() => router.navigate('/driver')}>Back to trips</TextLink>
    </Page>
  );
}

export function DriverProfile() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const c = profile?.captain;
  return (
    <Page>
      <Header title="Captain profile" />
      <Pile gap={7} style={styles.profile}>
        <Tile icon={ShieldCheck} size={70} iconSize={34} />
        <Copy accessibilityRole="header" size={20} weight={800}>{profile?.fullName}</Copy>
        <Badge icon={BadgeCheck}>Licensed captain · demo</Badge>
      </Pile>
      <View style={styles.stops}>
        <InfoRow icon={Navigation} label="Vehicle" value={c ? `${c.make_model} · ${c.color}` : ''} style={styles.divider} />
        <InfoRow icon={ShieldCheck} label="Plate" value={c?.plate ?? ''} style={styles.divider} />
        <InfoRow icon={BadgeCheck} label="Licence valid until" value={c?.license_expires_on?.slice(0, 10) ?? ''} />
      </View>
      <TextLink tint="#BC4242" size={11} style={styles.signout} onPress={async () => { await signOut(); router.replace('/login'); }}>Log out</TextLink>
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  card: { gap: 10 },
  hero: { padding: 18, borderRadius: 18, backgroundColor: color.navy, gap: 4 },
  stat: { flex: 1, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: color.line },
  stops: { borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden' },
  stop: { padding: 13, gap: 6 },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
  rider: { alignItems: 'center', marginTop: 4 },
  small: { paddingHorizontal: 10, minHeight: 34 },
  done: { gap: 4, backgroundColor: color.pink },
  profile: { alignItems: 'center', paddingVertical: 14 },
  signout: { marginTop: 22, padding: 14, alignItems: 'center' },
});
