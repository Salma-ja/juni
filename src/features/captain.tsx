import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight, BadgeCheck, BellRing, CheckCircle2, Clock3, Lock, MapPin, Navigation,
  RefreshCw, ShieldCheck, Users, Wallet, XCircle,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { RideMap, type MapPoint } from '@/components/RideMap';
import {
  Badge, Button, Card, center, Copy, Eyebrow, fill, GradientCard, Header, InfoRow,
  Notice, Page, Pile, ProgressBar, PulseDot, Row, SectionHeading, spread, Tile,
} from '@/components/ui';
import {
  captainComplete, captainConfirm, captainDecline, captainEarnings, captainPickup, captainStart,
  captainTrips, claimCaptain, type CaptainTrip,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { useLoad } from '@/data/useLoad';
import { AccountSwitch } from '@/features/accountSwitch';
import { useAuth } from '@/features/authSession';
import { isHotspot } from '@/features/places';
import { color } from '@/theme';

const statusInfo: Record<CaptainTrip['status'], { label: string; tone: 'amber' | 'green' | 'slate' | 'violet' | 'brand' }> = {
  full: { label: 'New offer · Respond', tone: 'brand' },
  awaiting_captain: { label: 'New offer · Respond', tone: 'brand' },
  confirmed: { label: 'Accepted · Riders notified', tone: 'green' },
  in_progress: { label: 'Live pickup run', tone: 'violet' },
  completed: { label: 'Completed', tone: 'slate' },
};

function useTrips() {
  const state = useLoad(() => captainTrips(), []);
  const { reload } = state;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => {
    const timer = setInterval(reload, 6000);
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

  const keyExtractor = useCallback((t: CaptainTrip) => t.group_id, []);
  const renderOpen = useCallback(({ item }: { item: CaptainTrip }) => (
    <CaptainTripCard
      t={item}
      onPress={() => router.push({ pathname: '/driver-trip', params: { groupId: item.group_id } })}
    />
  ), [router]);

  return (
    <Page>
      <Header
        title="Captain runs"
        subtitle={profile?.fullName ?? 'Jeeny Licensed Captain'}
      />

      <GradientCard colors={['#271C3A', '#3B235A']} style={{ borderRadius: 22, padding: 18, marginBottom: 16 }}>
        <Row style={spread}>
          <Row gap={8}>
            <PulseDot tint="#34D399" size={7} />
            <Copy size={12} weight={800} tint="#FFD1E8">ONLINE · CAMPUS DISPATCH</Copy>
          </Row>
          <Badge tone="dark">80% Payout Share</Badge>
        </Row>
        <Copy size={17} weight={800} tint={color.white} style={{ marginTop: 8 }}>
          {open.length > 0
            ? `${open.length} assigned campus ${open.length === 1 ? 'run' : 'runs'} ready`
            : 'Standing by for 4/4 campus groups'}
        </Copy>
        <Copy size={12} tint="#D8CDE9" style={{ marginTop: 4 }}>
          Accepting a run notifies all 4 students immediately. Marking pickups broadcasts live ETA updates.
        </Copy>
      </GradientCard>

      {!!code && <Copy tint={color.danger}>{errorCopy(code)}</Copy>}

      <FlatList
        data={open}
        keyExtractor={keyExtractor}
        renderItem={renderOpen}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          data ? (
            <Card style={styles.emptyCard}>
              <Tile icon={Navigation} size={48} iconSize={22} />
              <Copy size={16} weight={800} tint={color.navy}>No pending runs right now</Copy>
              <Copy size={13} tint={color.muted} style={center}>
                When a girls-only or boys-only group fills 4/4 seats, your offer card appears here automatically.
              </Copy>
            </Card>
          ) : null
        }
      />

      {done.length > 0 && (
        <>
          <SectionHeading title="Completed runs" note={`${done.length} done`} />
          <Pile gap={10}>
            {done.map((t) => (
              <CaptainTripCard
                key={t.group_id}
                t={t}
                onPress={() => router.push({ pathname: '/driver-trip', params: { groupId: t.group_id } })}
              />
            ))}
          </Pile>
        </>
      )}
    </Page>
  );
}

const CaptainTripCard = memo(function CaptainTripCard({ t, onPress }: { t: CaptainTrip; onPress: () => void }) {
  const info = statusInfo[t.status];
  const awaiting = t.status === 'awaiting_captain' || t.status === 'full';
  return (
    <Card style={[styles.tripCard, awaiting && styles.awaitingCard]}>
      <Row style={spread}>
        <Badge tone={info.tone}>{info.label}</Badge>
        <Badge tone={t.pref === 'girls_only' ? 'rose' : 'violet'} icon={Lock}>
          {t.pref === 'girls_only' ? 'Girls-only' : 'Boys-only'}
        </Badge>
      </Row>

      <Copy size={16} weight={800} tint={color.navy} style={{ marginTop: 10 }}>
        {`${t.stops.map((s) => s.name).join(' → ')} → ${t.campus.code}`}
      </Copy>
      <Copy size={12} tint={color.muted}>
        {`${formatDate(t.departure_at)} · Depart ${formatTime(t.departure_at)} · Arrive ${formatTime(t.arrival_at)}`}
      </Copy>

      <Row style={[spread, styles.metricsRow]}>
        <Row gap={6}>
          <Users size={16} color={color.muted} />
          <Copy size={13} weight={700} tint={color.navy}>{`${t.seats_taken}/${t.capacity} riders`}</Copy>
        </Row>
        <Row gap={6}>
          <Clock3 size={16} color={color.muted} />
          <Copy size={13} weight={700} tint={color.navy}>{`${t.route_minutes} min`}</Copy>
        </Row>
        <Row gap={6}>
          <Wallet size={16} color={color.brand} />
          <Copy size={14} weight={800} tint={color.brand}>{formatFils(t.payout_fils)}</Copy>
        </Row>
      </Row>

      <Button tone={awaiting ? 'primary' : 'dark'} onPress={onPress} trailingArrow>
        {awaiting ? `Review & accept (${formatFils(t.payout_fils)})` : 'Open live manifest'}
      </Button>
    </Card>
  );
});

export function DriverTrip() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { signInWithToken } = useAuth();
  const { data, code, reload } = useLoad(() => captainTrips(), [groupId]);
  const ref = useRefData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [liveToast, setLiveToast] = useState('');
  const [declinedInfo, setDeclinedInfo] = useState<{ nextId: string | null; nextName: string | null } | null>(null);

  const trip = data?.find((t) => t.group_id === groupId);
  const goToTrips = useCallback(() => {
    router.navigate('/driver');
  }, [router]);

  async function handleAccept() {
    if (!trip || busy) return;
    setBusy('confirm');
    setError('');
    const res = await captainConfirm(trip.group_id);
    setBusy(null);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    setLiveToast(`Accepted! Confirmation alert sent to all ${trip.seats_taken} riders in this group.`);
    reload();
  }

  async function handleDecline() {
    if (!trip || busy) return;
    setBusy('decline');
    setError('');
    const res = await captainDecline(trip.group_id);
    setBusy(null);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    setDeclinedInfo({
      nextId: res.data.reassigned_to,
      nextName: res.data.reassigned_name ?? res.data.reassigned_to,
    });
    reload();
  }

  async function switchToReassignedCaptain(captainId: string) {
    setBusy('switch');
    const res = await claimCaptain(captainId);
    setBusy(null);
    if (res.ok) {
      await signInWithToken(res.data.token, res.data.profile);
      setDeclinedInfo(null);
      reload();
    }
  }

  async function handleStart() {
    if (!trip || busy) return;
    setBusy('start');
    setError('');
    const res = await captainStart(trip.group_id);
    setBusy(null);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    setLiveToast('Route started! All riders now see live driver ETA & pickup telemetry.');
    reload();
  }

  async function handlePickup(bookingId: string, riderName: string) {
    if (!trip || busy) return;
    setBusy(`p-${bookingId}`);
    setError('');
    const res = await captainPickup(trip.group_id, bookingId);
    setBusy(null);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    const cnt = res.data.picked_up_count ?? 1;
    const tot = res.data.total_riders ?? trip.seats_taken;
    setLiveToast(`${riderName} marked on board (${cnt}/${tot} picked up) · Live notification sent to group!`);
    reload();
  }

  async function handleComplete() {
    if (!trip || busy) return;
    setBusy('complete');
    setError('');
    const res = await captainComplete(trip.group_id);
    setBusy(null);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    setLiveToast('Trip completed! Riders credited +10 JUNI Points and payout recorded.');
    reload();
  }

  // Clean Reassignment Screen after Declining (NEVER crashes or leaves dead-end state!)
  if (declinedInfo || (!trip && data)) {
    return (
      <Page>
        <Header title="Run reassigned" onBack={goToTrips} />
        <Card style={styles.reassignedCard}>
          <Tile icon={RefreshCw} size={54} iconSize={26} background={color.emeraldSoft} tint={color.emerald} />
          <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy} style={center}>
            Passed cleanly to next licensed captain
          </Copy>
          <Copy size={13} tint={color.muted} style={[center, { lineHeight: 20 }]}>
            {declinedInfo?.nextName
              ? `Offered to licensed Captain ${declinedInfo.nextName}. All riders kept their locked seats & fares, and received an automatic update.`
              : 'This run has been reassigned to another licensed captain. Riders kept their locked seats.'}
          </Copy>
          {declinedInfo?.nextId && (
            <Button
              icon={ArrowRight}
              disabled={busy !== null}
              onPress={() => switchToReassignedCaptain(declinedInfo.nextId as string)}
              style={{ alignSelf: 'stretch' }}
            >
              {busy === 'switch' ? 'Switching…' : `Switch to Captain ${declinedInfo.nextName}`}
            </Button>
          )}
          <Button tone="secondary" onPress={goToTrips} style={{ alignSelf: 'stretch' }}>
            Back to my runs
          </Button>
        </Card>
      </Page>
    );
  }

  if (!trip) {
    return (
      <Page>
        <Header title="Run details" onBack={goToTrips} />
        <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <PulseDot tint={color.brand} size={8} />
          <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Loading run manifest…'}</Copy>
        </Card>
      </Page>
    );
  }

  const info = statusInfo[trip.status];
  const awaiting = trip.status === 'awaiting_captain' || trip.status === 'full';
  const riders = trip.stops.flatMap((s) => s.riders);
  const pickedCount = riders.filter((r) => r.picked_up).length;
  const allPicked = riders.length > 0 && riders.every((r) => r.picked_up);
  const campus = ref.campus(trip.campus.id);

  const mapPoints: MapPoint[] = trip.stops.flatMap((stop) => {
    const area = ref.pickupAreas.find((item) => item.name === stop.name);
    if (!area) return [];
    return [{
      lat: area.lat,
      lng: area.lng,
      label: area.name,
      kind: isHotspot(area.id) ? 'hotspot' as const : 'stop' as const,
    }];
  });
  if (campus) mapPoints.push({ lat: campus.lat, lng: campus.lng, label: campus.code, kind: 'campus' });

  return (
    <Page
      footer={
        awaiting ? (
          <Pile gap={8}>
            <Button icon={ShieldCheck} disabled={busy !== null} onPress={handleAccept}>
              {busy === 'confirm' ? 'Confirming & notifying group…' : `Accept run · ${formatFils(trip.payout_fils)} payout`}
            </Button>
            <Button tone="secondary" icon={XCircle} disabled={busy !== null} onPress={handleDecline}>
              {busy === 'decline' ? 'Reassigning…' : 'Decline & pass to next captain'}
            </Button>
          </Pile>
        ) : trip.status === 'confirmed' ? (
          <Button icon={Navigation} disabled={busy !== null} onPress={handleStart} trailingArrow>
            {busy === 'start' ? 'Starting…' : 'Start pickup route'}
          </Button>
        ) : trip.status === 'in_progress' ? (
          <Button icon={CheckCircle2} disabled={busy !== null || !allPicked} onPress={handleComplete}>
            {allPicked
              ? `Complete run at ${trip.campus.code} (${formatFils(trip.payout_fils)})`
              : `Pick up all riders (${pickedCount}/${riders.length}) to complete`}
          </Button>
        ) : undefined
      }
    >
      <Header
        title="Run manifest"
        subtitle={`${trip.campus.code} · ${formatDate(trip.departure_at)}`}
        onBack={goToTrips}
      />

      {!!liveToast && (
        <Card style={styles.broadcastBanner}>
          <Row gap={10}>
            <BellRing size={18} color={color.emerald} />
            <Copy size={13} weight={700} tint={color.navy} style={fill}>{liveToast}</Copy>
          </Row>
        </Card>
      )}

      {/* Dark Route Summary Card */}
      <View style={styles.hero}>
        <Row style={spread}>
          <Badge tone={info.tone}>{info.label}</Badge>
          <Badge tone="dark">{`${trip.seats_taken}/${trip.capacity} seats`}</Badge>
        </Row>
        <Copy size={18} weight={800} tint={color.white} style={{ marginTop: 10 }}>
          {`${trip.stops.map((s) => s.name).join(' → ')} → ${trip.campus.code}`}
        </Copy>
        <Copy size={12} tint="#D4C8E8">
          {`Depart ${formatTime(trip.departure_at)} · Gate arrival ${formatTime(trip.arrival_at)} (${trip.route_minutes} min · ${trip.route_km} km)`}
        </Copy>
        {trip.status === 'in_progress' && (
          <View style={{ marginTop: 10, gap: 6 }}>
            <Row style={spread}>
              <Copy size={12} weight={700} tint="#34D399">LIVE BOARDING PROGRESS</Copy>
              <Copy size={12} weight={800} tint={color.white}>{`${pickedCount}/${riders.length} picked up`}</Copy>
            </Row>
            <ProgressBar value={(pickedCount / Math.max(riders.length, 1)) * 100} height={7} track="#43325E" fillTint="#34D399" />
          </View>
        )}
      </View>

      <Row gap={10} style={{ marginTop: 14 }}>
        <StatBox label="GUARANTEED PAYOUT (80%)" value={formatFils(trip.payout_fils)} accent />
        <StatBox label="TOTAL CAR FARES" value={formatFils(trip.collected_fils)} />
      </Row>

      {mapPoints.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <RideMap points={mapPoints} polyline={campus?.corridor_polyline} height={185} numbered />
        </View>
      )}

      <SectionHeading title="Ordered pickup gates" note="Farthest gate first" />
      <Pile gap={10}>
        {trip.stops.map((s) => (
          <Card key={s.seq} style={{ gap: 10 }}>
            <Row style={spread}>
              <Row gap={8}>
                <View style={styles.seqBadge}>
                  <Copy size={12} weight={800} tint={color.white}>{String(s.seq)}</Copy>
                </View>
                <Pile gap={1}>
                  <Copy size={15} weight={800} tint={color.navy}>{s.name}</Copy>
                  <Copy size={12} tint={color.muted}>{s.detail}</Copy>
                </Pile>
              </Row>
              <Badge tone="slate">{formatTime(s.eta_at)}</Badge>
            </Row>

            {s.riders.map((r) => (
              <Row key={r.booking_id} gap={10} style={[styles.riderRow, r.picked_up && styles.riderPicked]}>
                <Tile
                  icon={r.picked_up ? CheckCircle2 : Users}
                  size={38}
                  iconSize={18}
                  background={r.picked_up ? color.emerald : color.pink}
                  tint={r.picked_up ? color.white : color.brand}
                />
                <Pile gap={1} style={fill}>
                  <Copy size={14} weight={800} tint={color.navy}>{r.first_name}</Copy>
                  <Copy size={12} tint={color.muted}>
                    {r.picked_up ? 'On board · Group notified' : 'Waiting at shared gate'}
                  </Copy>
                </Pile>
                {trip.status === 'in_progress' && (
                  r.picked_up ? (
                    <Badge tone="green" icon={BadgeCheck}>Picked up</Badge>
                  ) : (
                    <Button
                      size={13}
                      disabled={busy !== null}
                      style={styles.pickupBtn}
                      onPress={() => handlePickup(r.booking_id, r.first_name)}
                    >
                      {busy === `p-${r.booking_id}` ? 'Updating…' : 'Mark picked up'}
                    </Button>
                  )
                )}
                {trip.status === 'completed' && <Badge tone="green" icon={BadgeCheck}>Dropped off</Badge>}
              </Row>
            ))}
          </Card>
        ))}
      </Pile>

      {!!error && (
        <Notice icon={XCircle} tint={color.danger} style={{ backgroundColor: color.dangerSoft, marginTop: 12 }}>
          {error}
        </Notice>
      )}

      {trip.status === 'completed' && (
        <Card style={[styles.broadcastBanner, { marginTop: 14 }]}>
          <Pile gap={4}>
            <Copy size={15} weight={800} tint={color.navy}>Run completed!</Copy>
            <Copy size={13} tint={color.muted}>
              {`You earned ${formatFils(trip.payout_fils)} (80% of ${formatFils(trip.collected_fils)} collected).`}
            </Copy>
          </Pile>
        </Card>
      )}
    </Page>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card style={[styles.statBox, accent && { backgroundColor: color.pink, borderColor: color.pinkBorder }]}>
      <Copy size={12} weight={700} tint={color.muted}>{label}</Copy>
      <Copy size={18} weight={800} tint={accent ? color.brand : color.navy}>{value}</Copy>
    </Card>
  );
}

export function DriverEarnings() {
  const { data, code } = useLoad(() => captainEarnings(), []);
  const router = useRouter();
  return (
    <Page>
      <Header title="Earnings" subtitle="80% guaranteed captain share" />
      {!!code && <Copy tint={color.danger}>{errorCopy(code)}</Copy>}
      <GradientCard colors={['#271C3A', '#3B235A']} style={{ borderRadius: 24, padding: 20 }}>
        <Eyebrow tint="#FF9AD0">TOTAL PAYOUT</Eyebrow>
        <Copy size={38} weight={800} tint={color.white} style={{ letterSpacing: -1.5, marginTop: 6 }}>
          {formatFils(data?.total_payout_fils ?? 0)}
        </Copy>
        <Copy size={13} tint="#DDD2EE" style={{ marginTop: 4 }}>
          {`${data?.completed_trips ?? 0} completed campus runs · 80% of rider fares`}
        </Copy>
      </GradientCard>

      <SectionHeading title="Completed runs" />
      {data && data.trips.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
          <Copy size={14} weight={700} tint={color.muted}>Complete a run to see your payout ledger here.</Copy>
          <Button tone="secondary" onPress={() => router.navigate('/driver')}>Go to runs</Button>
        </Card>
      )}
      <Pile gap={10}>
        {(data?.trips ?? []).map((t) => (
          <Card key={t.group_id}>
            <Row style={spread}>
              <Pile gap={2}>
                <Copy size={15} weight={800} tint={color.navy}>{`${formatDate(t.departure_at)} · ${t.campus_code}`}</Copy>
                <Copy size={12} tint={color.muted}>{`${t.riders} verified students`}</Copy>
              </Pile>
              <Copy size={16} weight={800} tint={color.brand}>{formatFils(t.payout_fils)}</Copy>
            </Row>
          </Card>
        ))}
      </Pile>
    </Page>
  );
}

export function DriverProfile() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const c = profile?.captain;
  return (
    <Page>
      <Header title="Captain profile" subtitle="Jeeny Campus Fleet" />
      <Card style={styles.profileCard}>
        <Tile icon={ShieldCheck} size={62} iconSize={30} />
        <Pile gap={4} style={fill}>
          <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy}>{profile?.fullName}</Copy>
          <Badge tone="green" icon={BadgeCheck}>Licensed Jeeny Captain</Badge>
        </Pile>
      </Card>

      <View style={{ marginTop: 14 }}>
        <AccountSwitch />
      </View>

      <Card style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
        <InfoRow icon={Navigation} label="Assigned vehicle" value={c ? `${c.make_model} · ${c.color}` : '—'} style={styles.divider} />
        <InfoRow icon={ShieldCheck} label="Jordan registration plate" value={c?.plate ?? '—'} style={styles.divider} />
        <InfoRow icon={BadgeCheck} label="License valid through" value={c?.license_expires_on?.slice(0, 10) ?? '—'} />
      </Card>

      <Button
        tone="secondary"
        style={{ marginTop: 22 }}
        onPress={async () => { await signOut(); router.replace('/login'); }}
      >
        Sign out
      </Button>
    </Page>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 18 },
  tripCard: { gap: 10, borderRadius: 22 },
  awaitingCard: { borderColor: color.brand, borderWidth: 2, backgroundColor: '#FFFBFD' },
  metricsRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.line,
  },
  hero: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: color.navy,
    gap: 4,
  },
  broadcastBanner: {
    marginBottom: 14,
    backgroundColor: color.emeraldSoft,
    borderColor: '#A7F3D0',
  },
  reassignedCard: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  statBox: {
    flex: 1,
    gap: 4,
    padding: 14,
  },
  seqBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: color.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderRow: {
    minHeight: 56,
    padding: 10,
    borderRadius: 16,
    backgroundColor: color.soft,
  },
  riderPicked: {
    backgroundColor: color.emeraldSoft,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pickupBtn: {
    minHeight: 48,
    paddingHorizontal: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
});
