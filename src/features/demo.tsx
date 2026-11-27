import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Badge, Button, Card, Copy, Eyebrow, Header, Page, Pile, Row, spread } from '@/components/ui';
import {
  demoAssignCaptain, demoCompleteTrip, demoConfirmCaptain, demoExpireHold, demoLastSeatGroups, demoReleaseHold,
  demoReset, demoSeedCheckout, demoSet, demoSettings, demoStartTrip, myBookings, startCheckout,
  type BookingData, type DemoSettings, type LastSeatGroup, type MyBookings,
} from '@/data/api';
import { formatOffset, setClockOffset } from '@/data/clock';
import { errorCopy } from '@/data/errors';
import { formatDate, formatTime } from '@/data/format';
import { useAuth } from '@/features/authSession';
import { statusBadge } from '@/features/rides';
import { color } from '@/theme';

type Outcome = { tone: 'ok' | 'error'; text: string };
type Raced = { who: string; ok: boolean; text: string; holdId?: string };

export function DemoPanel() {
  const router = useRouter();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<MyBookings | null>(null);
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [groups, setGroups] = useState<LastSeatGroup[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [race, setRace] = useState<Raced[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(async () => {
    const [b, s, g] = await Promise.all([myBookings(), demoSettings(), demoLastSeatGroups()]);
    if (b.ok) setBookings(b.data);
    if (s.ok) { setSettings(s.data); setClockOffset(s.data.clockOffsetMinutes); }
    if (g.ok) setGroups(g.data);
  }, []);
  useEffect(() => { if (profile?.isDemo) refresh(); }, [profile?.isDemo, refresh]);

  if (!profile?.isDemo) {
    return (
      <Page>
        <Header title="Demo controls" onBack={() => router.back()} />
        <Copy tint={color.muted}>{errorCopy('DEMO_ONLY')}</Copy>
      </Page>
    );
  }

  const live = [...(bookings?.upcoming ?? []), ...(bookings?.active ?? [])];
  const current: BookingData | undefined = live.find((b) => b.id === selected) ?? live[0];

  /** Run one action, show its result or error copy inline, then refresh the panel. */
  async function run(key: string, action: () => Promise<{ ok: boolean; code?: string }>, okText: string) {
    if (busy) return;
    setBusy(key);
    const res = await action();
    setOutcome((o) => ({ ...o, [key]: res.ok ? { tone: 'ok', text: okText } : { tone: 'error', text: errorCopy(res.code ?? '') } }));
    setBusy(null);
    await refresh();
  }
  const Result = ({ k }: { k: string }) => outcome[k]
    ? <Copy size={10} weight={700} tint={outcome[k].tone === 'ok' ? '#1D7A55' : color.danger}>{outcome[k].text}</Copy> : null;

  async function setClock(label: string, hoursBefore: number | null) {
    if (!current || !settings) return;
    const realNow = new Date(settings.realNow).getTime();
    const target = hoursBefore === null ? realNow : new Date(current.pickup_at).getTime() - hoursBefore * 3_600_000;
    const minutes = Math.round((target - realNow) / 60_000);
    await run('clock', () => demoSet({ clockOffsetMinutes: minutes }), `Clock set: ${label} (${formatOffset(minutes)})`);
  }

  async function raceLastSeat(g: LastSeatGroup) {
    if (busy) return;
    setBusy('race');
    setRace(null);
    const [mine, seed] = await Promise.all([
      startCheckout({ groupId: g.group_id, pickupAreaId: g.pickup_area_id, routeVersion: g.route_version, idempotencyKey: globalThis.crypto.randomUUID() }),
      demoSeedCheckout(g.group_id),
    ]);
    const rows: Raced[] = [
      { who: 'You', ok: mine.ok, text: mine.ok ? 'Seat held' : errorCopy(mine.code), holdId: mine.ok ? mine.data.hold_id : undefined },
      { who: seed.ok ? `${seed.data.seed_rider} (seed rider)` : 'Seed rider', ok: seed.ok, text: seed.ok ? 'Seat held' : errorCopy(seed.code),
        holdId: seed.ok ? seed.data.hold_id : undefined },
    ];
    setRace(rows);
    // the winner's hold is released so the group stays at its seat count for the next demo
    await Promise.all(rows.filter((r) => r.holdId).map((r) => demoReleaseHold(r.holdId as string)));
    setBusy(null);
    await refresh();
  }

  const preset = (label: string, hours: number | null) => (
    <Button key={label} tone="secondary" size={11} disabled={!current && hours !== null} onPress={() => setClock(label, hours)}>{label}</Button>
  );

  return (
    <Page>
      <Header title="Demo controls" eyebrow="JUDGES ONLY" onBack={() => router.back()} />
      <Copy size={10} tint={color.muted}>
        {`Clock: ${settings ? `${formatDate(settings.appNow)} ${formatTime(settings.appNow)}` : '…'}${settings && settings.clockOffsetMinutes !== 0 ? ` (${formatOffset(settings.clockOffsetMinutes)})` : ''}`}
      </Copy>

      <Section title="MY BOOKINGS">
        {live.length === 0 && <Copy size={11} tint={color.muted}>No upcoming rides. Book one first.</Copy>}
        {live.map((b) => {
          const picked = current?.id === b.id;
          const st = statusBadge[b.status];
          const waiting = b.status === 'seat_booked' || b.status === 'awaiting_captain';
          return (
            <Card key={b.id} style={[styles.booking, picked && styles.picked]}>
              <Row style={spread}>
                <Pile gap={3}>
                  <Copy size={11} weight={800}>{`${b.code} · ${b.pickup_area.name} → ${b.campus.code}`}</Copy>
                  <Copy size={9} tint={color.muted}>{`${formatDate(b.pickup_at)} · ${formatTime(b.pickup_at)} · ${b.seats_taken}/${b.capacity} seats`}</Copy>
                </Pile>
                <Badge tone={st.tone}>{st.label}</Badge>
              </Row>
              <Row gap={6} style={styles.wrap}>
                <Button size={10} tone="secondary" onPress={() => setSelected(b.id)}>{picked ? 'Selected' : 'Select for clock'}</Button>
              </Row>
              <Button size={11} disabled={!waiting} onPress={() => run(`confirm-${b.id}`, () => demoConfirmCaptain(b.id), 'Captain confirmed.')}>Confirm captain</Button>
              <Result k={`confirm-${b.id}`} />
              <Button size={11} tone="secondary" disabled={!waiting} onPress={() => run(`assign-${b.id}`, () => demoAssignCaptain(b.id, 'cap-6'), 'Assigned.')}>Try unlicensed captain</Button>
              <Result k={`assign-${b.id}`} />
              <Row gap={8}>
                <View style={styles.half}><Button size={11} tone="secondary" disabled={b.status !== 'confirmed'} onPress={() => run(`start-${b.id}`, () => demoStartTrip(b.id), 'Trip started.')}>Start trip</Button></View>
                <View style={styles.half}><Button size={11} tone="secondary" disabled={b.status !== 'in_progress'} onPress={() => run(`done-${b.id}`, () => demoCompleteTrip(b.id), 'Trip completed.')}>Complete trip</Button></View>
              </Row>
              <Result k={`start-${b.id}`} /><Result k={`done-${b.id}`} />
            </Card>
          );
        })}
      </Section>

      <Section title="CLOCK">
        <Copy size={10} tint={color.muted}>
          {current ? `Presets are relative to pickup ${formatDate(current.pickup_at)} ${formatTime(current.pickup_at)}.` : 'Select a booking to use the pickup presets.'}
        </Copy>
        {preset('13 h before', 13)}{preset('12 h before', 12)}{preset('10 h before', 10)}{preset('Now', null)}
        <Result k="clock" />
      </Section>

      <Section title="TOGGLES">
        <Button tone={settings?.forceTravelOutage ? 'danger' : 'secondary'} size={11}
          onPress={() => run('outage', () => demoSet({ forceTravelOutage: !settings?.forceTravelOutage }),
            settings?.forceTravelOutage ? 'Travel data restored.' : 'Travel data outage on: plans use the 45 min estimate.')}>
          {`Travel data outage: ${settings?.forceTravelOutage ? 'ON' : 'off'}`}
        </Button>
        <Result k="outage" />
        <Button tone={settings?.forcePaymentFailure ? 'danger' : 'secondary'} size={11}
          onPress={() => run('failpay', () => demoSet({ forcePaymentFailure: !settings?.forcePaymentFailure }),
            settings?.forcePaymentFailure ? 'Next payment will succeed.' : 'Next payment will fail.')}>
          {`Fail next payment: ${settings?.forcePaymentFailure ? 'ON' : 'off'}`}
        </Button>
        <Result k="failpay" />
      </Section>

      <Section title="HOLDS">
        <Button tone="secondary" size={11} disabled={!settings?.activeHoldId}
          onPress={() => run('expire', () => demoExpireHold(settings?.activeHoldId ?? ''), 'Hold expired. Paying now shows the hold-ended message.')}>
          Expire my active hold
        </Button>
        {!settings?.activeHoldId && <Copy size={10} tint={color.muted}>You have no active hold.</Copy>}
        <Result k="expire" />
      </Section>

      <Section title="RACE LAST SEAT">
        {groups.length === 0 && <Copy size={10} tint={color.muted}>No group with exactly one seat left that you can join.</Copy>}
        {groups.map((g) => (
          <Button key={g.group_id} tone="secondary" size={11} disabled={busy === 'race'} onPress={() => raceLastSeat(g)}>
            {`${g.campus_code} · ${formatDate(g.departure_at)} ${formatTime(g.departure_at)} · ${g.pref === 'any' ? 'Any' : g.pref === 'girls_only' ? 'Girls-only' : 'Boys-only'} · ${g.seats_taken}/${g.capacity}`}
          </Button>
        ))}
        {race && (
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            {race.map((r) => (
              <Card key={r.who} style={[styles.half, styles.raceCard]}>
                <Eyebrow size={8} tint={color.muted}>{r.who.toUpperCase()}</Eyebrow>
                <Copy size={11} weight={800} tint={r.ok ? '#1D7A55' : color.danger}>{r.ok ? 'Success' : 'Blocked'}</Copy>
                <Copy size={9} tint={color.muted}>{r.text}</Copy>
              </Card>
            ))}
          </Row>
        )}
      </Section>

      <Section title="RESET">
        <Button tone="danger" size={11} onPress={() => setConfirmReset(true)}>Reset demo</Button>
        <Result k="reset" />
      </Section>

      {confirmReset && (
        <BottomSheet onClose={() => setConfirmReset(false)}>
          <Copy accessibilityRole="header" size={20} weight={800}>Reset demo?</Copy>
          <Copy size={12} tint={color.muted}>This removes your bookings, holds and requests, restores the clock, and reloads the seed groups.</Copy>
          <Button tone="danger" onPress={async () => {
            setConfirmReset(false);
            await run('reset', () => demoReset(), 'Demo reset. Seed groups reloaded.');
          }}>Yes, reset</Button>
          <Button tone="secondary" onPress={() => setConfirmReset(false)}>Cancel</Button>
        </BottomSheet>
      )}
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Pile gap={9} style={styles.section}><Eyebrow>{title}</Eyebrow>{children}</Pile>;
}

const styles = StyleSheet.create({
  section: { marginTop: 18 },
  booking: { gap: 9, padding: 13, borderRadius: 14 },
  picked: { borderColor: color.brand },
  wrap: { flexWrap: 'wrap' },
  half: { flex: 1 },
  raceCard: { gap: 4, padding: 11 },
});
