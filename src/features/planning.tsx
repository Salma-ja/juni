import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight, BadgeCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Info, LockKeyhole,
  MapPin, Navigation, Route, ShieldCheck, Sparkles, Star, TrendingUp, UserPlus, Users, CircleUserRound, X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Avatar, Badge, BottomSheet, Button, Card, center, Copy, Eyebrow, Field, fill, Header, IconButton,
  InfoRow, Notice, Page, Pile, RouteCard, Row, SectionHeading, spread, Tile,
} from '@/components/ui';
import { color, shadow } from '@/theme';
import { parseSchedule, tomorrow } from '@/features/rideSchedule';
import {
  createGroup, createRequest, groupDetail, recommendDeparture, searchGroups,
  type Candidate, type Departure, type GroupDetail as GroupDetailData, type Pref, type SearchResult,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { ammanInstant, formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { useAuth } from '@/features/authSession';

type PlanParams = { campusId?: string; pickupAreaId?: string; date?: string; classTime?: string };

export function PlanRide() {
  const router = useRouter();
  const params = useLocalSearchParams<PlanParams>();
  const ref = useRefData();
  const [campusId, setCampusId] = useState(params.campusId ?? 'just');
  const [pickupId, setPickupId] = useState<string | null>(params.pickupAreaId ?? null);
  const [date, setDate] = useState(params.date ?? tomorrow());
  const [classTime, setClassTime] = useState(params.classTime ?? '08:00');
  const [editing, setEditing] = useState<'date' | 'classTime' | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'campus' | 'pickup' | null>(null);
  const [busy, setBusy] = useState(false);
  const campus = ref.campus(campusId);
  const pickup = ref.pickup(pickupId);
  const classDate = parseSchedule(date, '12:00');

  function edit(field: 'date' | 'classTime') {
    setDraft(field === 'date' ? date : classTime);
    setError('');
    setEditing(field);
  }

  function save() {
    if (!editing) return;
    const next = draft.trim();
    const candidate = editing === 'date' ? parseSchedule(next, classTime) : parseSchedule(date, next);
    if (!candidate) {
      setError(editing === 'date' ? 'Enter a valid date as YYYY-MM-DD.' : 'Enter a valid time as HH:MM (24-hour clock).');
      return;
    }
    if (editing === 'date') setDate(next); else setClassTime(next);
    setEditing(null);
  }

  async function submit() {
    if (busy) return;
    if (!pickup) {
      setError('Choose your pickup area.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await createRequest({ campusId, pickupAreaId: pickup.id, classStartAt: ammanInstant(date, classTime).toISOString() });
    setBusy(false);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    router.push({ pathname: '/suggestion', params: { requestId: res.data.request_id } });
  }

  return (
    <Page>
      <Header title="Plan a ride" eyebrow="RIDE DETAILS" onBack={() => router.dismissTo('/home')} />
      <RouteCard
        start={{ label: 'PICKUP', title: pickup?.name ?? 'Choose pickup area', detail: pickup?.detail ?? 'Tap to choose where we pick you up' }}
        end={{ label: 'DESTINATION', title: campus?.label ?? '…', detail: 'Tap to change university' }}
        onEndPress={() => setSheet('campus')}
      />
      <Card style={styles.inputCard}>
        <InfoRow icon={MapPin} label="Pickup area" value={pickup?.name ?? 'Choose'} style={styles.divider} onPress={() => setSheet('pickup')} />
        <InfoRow icon={CalendarDays} label="Ride date" value={classDate ? formatDate(classDate) : date} style={styles.divider} onPress={() => edit('date')} />
        <InfoRow icon={Clock3} label="Class starts" value={formatTime(ammanInstant(date, classTime))} onPress={() => edit('classTime')} />
      </Card>
      <View style={styles.map}>
        <Svg viewBox="0 0 350 176" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Path d="M-25 18L370 167 M145 185L210 -20" stroke="#FFFFFF90" strokeWidth={12} />
          <Path d="M20 136L292 9 M115 36L217 220" stroke="#D6E1DA" strokeWidth={13} />
          <Path d="M20 136L292 9 M115 36L217 220" stroke="#FFFFFF" strokeWidth={11} />
        </Svg>
        <View style={styles.pickupPin}><MapPin size={20} color={color.brand} fill={color.brand} /></View>
        <View style={styles.campusPin}><Copy size={11} tint={color.white} weight={800}>{campus?.code[0] ?? ''}</Copy></View>
        <Copy size={8} weight={800} style={styles.mapLabel}>{pickup?.name ?? 'Pickup'}</Copy>
        <Copy size={8} weight={800} style={styles.campusLabel}>{campus?.code ?? ''}</Copy>
        <Pressable accessibilityRole="button" style={styles.recenter}>
          <Navigation size={16} color={color.navy} /><Copy size={8} weight={700}>Recenter</Copy>
        </Pressable>
      </View>
      <Notice icon={ShieldCheck} tint="#44665D" style={styles.softNote}>Destinations are limited to verified university campuses.</Notice>
      {!!error && !editing && <Copy accessibilityRole="alert" tint={color.danger}>{error}</Copy>}
      <Button icon={Sparkles} disabled={busy || !ref.ready} onPress={submit} style={styles.action}>{busy ? 'Finding…' : 'Find my group'}</Button>
      {sheet === 'campus' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <Copy accessibilityRole="header" size={20} weight={800}>Choose a university</Copy>
          <Card style={styles.inputCard}>
            {ref.campuses.map((item, index) => {
              const selected = item.id === campusId;
              return (
                <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                  onPress={() => { setCampusId(item.id); setSheet(null); }}
                  style={[styles.campusOption, index < ref.campuses.length - 1 && styles.divider, selected && styles.activeCampus]}>
                  <Tile icon={MapPin} size={34} iconSize={17} />
                  <Pile gap={4} style={fill}>
                    <Copy size={12} weight={800}>{item.name}</Copy>
                    <Copy size={10} tint={color.muted}>{item.code}</Copy>
                  </Pile>
                  {selected && <Check size={18} color={color.brand} />}
                </Pressable>
              );
            })}
          </Card>
          <Button tone="secondary" onPress={() => setSheet(null)}>Cancel</Button>
        </BottomSheet>
      )}
      {sheet === 'pickup' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <Copy accessibilityRole="header" size={20} weight={800}>Choose your pickup area</Copy>
          <Card style={styles.inputCard}>
            {ref.pickupAreas.map((item, index) => {
              const selected = item.id === pickupId;
              return (
                <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                  onPress={() => { setPickupId(item.id); setError(''); setSheet(null); }}
                  style={[styles.campusOption, index < ref.pickupAreas.length - 1 && styles.divider, selected && styles.activeCampus]}>
                  <Tile icon={MapPin} size={34} iconSize={17} />
                  <Pile gap={4} style={fill}>
                    <Copy size={12} weight={800}>{item.name}</Copy>
                    <Copy size={10} tint={color.muted}>{item.detail}</Copy>
                  </Pile>
                  {selected && <Check size={18} color={color.brand} />}
                </Pressable>
              );
            })}
          </Card>
          <Button tone="secondary" onPress={() => setSheet(null)}>Cancel</Button>
        </BottomSheet>
      )}
      {editing && (
        <BottomSheet onClose={() => { setEditing(null); setError(''); }}>
          <Copy accessibilityRole="header" size={20} weight={800}>{editing === 'date' ? 'Edit ride date' : 'Edit class time'}</Copy>
          {editing === 'date'
            ? <DateGrid selected={draft} onSelect={(value) => { setDraft(value); setError(''); }} />
            : <TimeGrid selected={draft} onSelect={(value) => { setDraft(value); setError(''); }} onSubmit={save} />}
          {!!error && <Copy accessibilityRole="alert" tint={color.danger}>{error}</Copy>}
          <Button onPress={save}>Save</Button>
          <Button tone="secondary" onPress={() => { setEditing(null); setError(''); }}>Cancel</Button>
        </BottomSheet>
      )}
    </Page>
  );
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const gridDateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });

function DateGrid({ selected, onSelect }: { selected: string; onSelect: (value: string) => void }) {
  const [month, setMonth] = useState(() => {
    const date = parseSchedule(selected, '12:00') ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = month.getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const goMonth = (offset: number) => setMonth(new Date(year, monthIndex + offset, 1));

  return (
    <Pile gap={6}>
      <Row style={spread}>
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => goMonth(-1)} />
        <Copy size={15} weight={800}>{monthLabel.format(month)}</Copy>
        <IconButton icon={ChevronRight} label="Next month" onPress={() => goMonth(1)} />
      </Row>
      <Row gap={2}>
        {weekdays.map((day) => <Copy key={day} size={10} weight={700} tint={color.muted} style={[fill, center]}>{day}</Copy>)}
      </Row>
      {Array.from({ length: Math.ceil((first + count) / 7) }, (_, week) => (
        <Row key={week} gap={2}>
          {weekdays.map((weekday, column) => {
            const day = week * 7 + column - first + 1;
            if (day < 1 || day > count) return <View key={weekday} style={fill} />;
            const date = new Date(year, monthIndex, day);
            const value = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return <ScheduleCell key={weekday} label={String(day)} accessibilityLabel={gridDateLabel.format(date)}
              selected={value === selected} disabled={date < today} onPress={() => onSelect(value)} />;
          })}
        </Row>
      ))}
    </Pile>
  );
}

const timeBlocks = [
  { label: 'Morning', start: 360, end: 720 },
  { label: 'Afternoon', start: 720, end: 1080 },
  { label: 'Evening', start: 1080, end: 1440 },
];

function TimeGrid({ selected, onSelect, onSubmit }: {
  selected: string; onSelect: (value: string) => void; onSubmit: () => void;
}) {
  const [initialHour] = selected.split(':').map(Number);
  const [blockIndex, setBlockIndex] = useState(initialHour >= 18 ? 2 : initialHour >= 12 ? 1 : 0);
  const block = timeBlocks[blockIndex];
  const slots = Array.from({ length: (block.end - block.start) / 30 }, (_, index) => {
    const minutes = block.start + index * 30;
    const hour = Math.floor(minutes / 60);
    const minute = String(minutes % 60).padStart(2, '0');
    return {
      value: `${String(hour).padStart(2, '0')}:${minute}`,
      label: `${hour % 12 || 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`,
    };
  });
  return (
    <Pile gap={7}>
      <Row gap={5}>
        {timeBlocks.map(({ label }, index) => (
          <ScheduleCell key={label} label={label} selected={blockIndex === index} onPress={() => setBlockIndex(index)} />
        ))}
      </Row>
      {[0, 4, 8].map((start) => (
        <Row key={start} gap={5}>
          {slots.slice(start, start + 4).map(({ value, label }) => (
            <ScheduleCell key={value} label={label} selected={value === selected} onPress={() => onSelect(value)} />
          ))}
        </Row>
      ))}
      <Field label="Custom time (HH:MM, 24-hour)" value={selected} onChangeText={onSelect} autoCorrect={false}
        maxLength={5} returnKeyType="done" onSubmitEditing={onSubmit} />
    </Pile>
  );
}

function ScheduleCell({ label, accessibilityLabel, selected, disabled = false, onPress }: {
  label: string; accessibilityLabel?: string; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.scheduleCell, selected && styles.selectedCell]}>
      <Copy size={10} weight={700} tint={disabled ? '#AAA5B0' : selected ? color.white : color.navy} style={center}>{label}</Copy>
    </Pressable>
  );
}

/** Load one async result keyed by deps. */
function useLoad<T>(load: () => Promise<{ ok: true; data: T } | { ok: false; code: string }>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; code?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load().then((res) => { if (live) setState(res.ok ? { data: res.data, loading: false } : { code: res.code, loading: false }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function Suggestion() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const ref = useRefData();
  const { data, code, loading } = useLoad<Departure>(() => recommendDeparture(requestId), [requestId]);
  if (loading || !data) {
    return (
      <Page>
        <Header title="Departure plan" onBack={() => router.dismissTo('/plan')} />
        <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Working out your departure…'}</Copy>
        {!!code && <Button tone="secondary" onPress={() => router.dismissTo('/plan')}>Choose another time</Button>}
      </Page>
    );
  }
  const fallback = data.travel_source === 'fallback';
  const departure = formatTime(data.departure_at);
  const campus = ref.campus(data.campus_id);
  return (
    <Page>
      <Header title="Departure plan" onBack={() => router.dismissTo('/plan')} />
      <Pile gap={9} style={styles.aiHero}>
        <Tile icon={Sparkles} size={65} iconSize={30} tint="#7157D2" background="#E9E2FF" style={styles.aiOrb} />
        <Badge tone={fallback ? 'amber' : 'violet'} style={styles.centered}>{fallback ? 'ESTIMATE' : 'RECOMMENDED'}</Badge>
        <Copy accessibilityRole="header" size={28} weight={800} style={[center, { letterSpacing: -1.12, marginTop: 8 }]}>
          Leave at <Copy size={28} weight={800} tint="#6B50C7">{departure}</Copy>
        </Copy>
        <Copy tint={color.muted}>{`${formatDate(data.class_start_at)} · For your ${formatTime(data.class_start_at)} class at ${campus?.code ?? ''}`}</Copy>
      </Pile>
      <Card style={styles.timing}>
        <Timing time={departure} label="DEPART" /><View style={styles.timingLine} />
        <Timing time={`${data.route_minutes} min`} label="EST. TRAVEL" /><View style={styles.timingLine} />
        <Timing time={formatTime(data.arrival_at)} label="ARRIVE" />
      </Card>
      <Pile gap={7} style={styles.facts}>
        <Fact icon={Clock3} text={`Arrives ${data.minutes_before_class} min before class`} />
        {data.peak_factor > 1 && <Fact icon={TrendingUp} text="Includes peak-hour traffic factor" />}
        {data.alternative && <Fact icon={Route} text={`Another group leaves at ${formatTime(data.alternative.departure_at)}`} />}
      </Pile>
      {fallback && <Notice icon={Info} tint="#735C23">Estimate. Live travel data unavailable.</Notice>}
      <Pile gap={9} style={styles.action}>
        <Button onPress={() => router.push({ pathname: '/matching', params: { requestId } })}>{`Accept ${departure} & search`}</Button>
        <Button tone="secondary" onPress={() => router.dismissTo('/plan')}>Choose another time</Button>
      </Pile>
    </Page>
  );
}

function Fact({ icon: Icon, text }: { icon: typeof Route; text: string }) {
  return <Row gap={8}><Icon size={16} color={color.muted} /><Copy size={11} tint={color.muted} style={fill}>{text}</Copy></Row>;
}

function Timing({ time, label }: { time: string; label: string }) {
  return <Pile gap={4} style={{ alignItems: 'center' }}>
    <Copy size={14} weight={800}>{time}</Copy><Eyebrow tint={color.muted} size={7}>{label}</Eyebrow>
  </Pile>;
}

const filterOptions: { label: string; pref: Pref }[] = [
  { label: 'Girls-only', pref: 'girls_only' },
  { label: 'Boys-only', pref: 'boys_only' },
  { label: 'Any', pref: 'any' },
];
const prefBadge: Record<Pref, { label: string; tone: 'rose' | 'slate' | 'violet' }> = {
  girls_only: { label: 'Girls-only', tone: 'rose' },
  boys_only: { label: 'Boys-only', tone: 'violet' },
  any: { label: 'Any', tone: 'slate' },
};

export function Matching() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { profile } = useAuth();
  const ref = useRefData();
  const [pref, setPref] = useState<Pref>(profile?.gender === 'male' ? 'boys_only' : 'girls_only');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dep = useLoad<Departure>(() => recommendDeparture(requestId), [requestId]);

  useEffect(() => {
    let live = true;
    setError('');
    searchGroups(requestId, pref).then((res) => {
      if (!live) return;
      if (res.ok) setResult(res.data); else setError(errorCopy(res.code));
    });
    return () => { live = false; };
  }, [requestId, pref]);

  const request = dep.data;
  const planParams = request ? {
    campusId: request.campus_id, pickupAreaId: request.pickup_area_id,
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(new Date(request.class_start_at)),
    classTime: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit' }).format(new Date(request.class_start_at)),
  } : {};

  async function startNewGroup() {
    if (busy) return;
    setBusy(true);
    const res = await createGroup(requestId);
    setBusy(false);
    if (!res.ok) { setError(errorCopy(res.code)); return; }
    router.push({ pathname: '/group', params: { groupId: res.data.group_id, requestId } });
  }
  const open = (c: Candidate) => router.push({ pathname: '/group', params: { groupId: c.group_id, requestId } });
  const candidates = result?.candidates ?? [];

  return (
    <Page>
      <Header title="Suggested groups" onBack={() => router.dismissTo({ pathname: '/suggestion', params: { requestId } })} />
      <Row style={[spread, styles.routeSummary]}>
        <Row gap={8}><MapPin size={18} color={color.brand} /><TimingStop title={ref.pickup(request?.pickup_area_id)?.name ?? '…'} detail="Pickup" /></Row>
        <ArrowRight size={18} color={color.muted} />
        <Row gap={8}><View style={styles.campusDot}><Copy size={11} weight={800} tint={color.white}>{ref.campus(request?.campus_id)?.code[0] ?? ''}</Copy></View>
          <TimingStop title={ref.campus(request?.campus_id)?.code ?? '…'}
            detail={request ? `${formatDate(request.arrival_at)} · arrive ${formatTime(request.arrival_at)}` : ''} /></Row>
      </Row>
      <Row gap={7} style={styles.filters}>
        {filterOptions.map((item) => (
          <Pressable key={item.pref} accessibilityRole="button" accessibilityState={{ selected: pref === item.pref }}
            onPress={() => { setResult(null); setPref(item.pref); }} style={[styles.filter, pref === item.pref && styles.filterSelected]}>
            <Copy size={9} weight={700} tint={pref === item.pref ? color.brand : color.muted}>{item.label}</Copy>
          </Pressable>
        ))}
      </Row>
      {!!error && <Copy accessibilityRole="alert" tint={color.danger}>{error}</Copy>}
      {!result && !error && <Copy tint={color.muted}>Searching groups…</Copy>}
      {result && candidates.length === 0 && (
        <Pile gap={9} style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Users size={35} color="#92A19D" />
            <Copy weight={800} tint="#92A19D" style={styles.questionMark}>?</Copy>
          </View>
          <Copy accessibilityRole="header" size={21} weight={800} style={center}>No match found yet</Copy>
          <Copy size={11} tint={color.muted} style={[center, { lineHeight: 18, marginBottom: 13 }]}>
            {errorCopy(result.reason ?? 'NO_GROUPS_AT_TIME')}
          </Copy>
          <Button disabled={busy} onPress={startNewGroup}>Start a new group</Button>
          <Button tone="secondary" onPress={() => router.dismissTo({ pathname: '/plan', params: planParams })}>Change class time</Button>
          <Button tone="secondary" onPress={() => router.dismissTo({ pathname: '/plan', params: planParams })}>Change pickup</Button>
        </Pile>
      )}
      {candidates.length > 0 && (
        <Pile gap={11}>
          <Copy size={10} weight={700}>{`${candidates.length} ${candidates.length === 1 ? 'group' : 'groups'} for your time`}</Copy>
          {candidates.map((c, index) => <GroupCard key={c.group_id} c={c} best={index === 0} onPress={() => open(c)} />)}
          <Row gap={6} style={{ padding: 4 }}><Info size={15} color={color.muted} />
            <Copy size={9} tint={color.muted} style={fill}>JUNI suggests groups. You always choose before booking.</Copy>
          </Row>
        </Pile>
      )}
    </Page>
  );
}

function GroupCard({ c, best, onPress }: { c: Candidate; best: boolean; onPress: () => void }) {
  const badge = prefBadge[c.pref];
  const left = c.capacity - c.seats_taken;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${best ? 'Best match, ' : 'Group, '}${formatTime(c.departure_at)}`}
      onPress={onPress} style={[styles.groupCard, best && styles.featured]}>
      {best && (
        <Row gap={4} style={styles.bestMatch}>
          <Star size={14} color={color.brand} fill={color.brand} />
          <Copy size={8} weight={800} tint={color.brand}>BEST MATCH</Copy>
        </Row>
      )}
      <Row style={[spread, { alignItems: 'flex-start' }]}>
        <Pile gap={7}><GroupTime time={formatTime(c.departure_at)} /><Badge tone={badge.tone}>{badge.label}</Badge></Pile>
        <Copy size={17} weight={800}>{formatFils(c.fare_fils, false)} <Copy size={8} tint={color.muted}>JD / seat</Copy></Copy>
      </Row>
      <Row gap={4} style={styles.seats}>
        {Array.from({ length: c.capacity }, (_, i) => i + 1).map((number) => (
          <View key={number} style={[styles.seat, number <= c.seats_taken && { backgroundColor: color.pink, borderWidth: 0 }]}>
            <CircleUserRound size={19} color={number <= c.seats_taken ? color.brand : '#9BA8A5'} />
          </View>
        ))}
        <Pile gap={3} style={{ marginLeft: 7 }}>
          <Copy size={10} weight={800}>{`${c.seats_taken}/${c.capacity} seats filled`}</Copy>
          <Copy size={8} tint={left === 1 ? '#B64F44' : color.muted}>{`${left} ${left === 1 ? 'seat' : 'seats'} left`}</Copy>
        </Pile>
      </Row>
      <Row gap={14} style={styles.matchFacts}>
        <MatchFact icon={Clock3} title={`Your pickup ${formatTime(c.pickup_at)}`} />
        {c.added_minutes > 0 && <MatchFact icon={Route} title={`+${c.added_minutes} min`} />}
        {c.travel_source === 'fallback' && <MatchFact icon={Info} title="Estimate" />}
      </Row>
    </Pressable>
  );
}

function TimingStop({ title, detail }: { title: string; detail: string }) {
  return <Pile gap={4}><Copy size={11} weight={800}>{title}</Copy><Copy size={8} tint={color.muted}>{detail}</Copy></Pile>;
}

function GroupTime({ time }: { time: string }) {
  const [clock, period] = time.split(/\s+/);
  return <Copy size={23} weight={800} tint={color.navy} style={{ letterSpacing: -0.92 }}>{clock}<Copy size={10} weight={700}>{` ${period}`}</Copy></Copy>;
}

function MatchFact({ icon: Icon, title }: { icon: typeof Route; title: string }) {
  return <Row gap={5}><Icon size={16} color={color.muted} /><Copy size={9} tint={color.muted}>{title}</Copy></Row>;
}

export function GroupDetails() {
  const router = useRouter();
  const { groupId, requestId } = useLocalSearchParams<{ groupId: string; requestId: string }>();
  const ref = useRefData();
  const { data, code, loading } = useLoad<GroupDetailData>(() => groupDetail(groupId, requestId), [groupId, requestId]);
  const back = () => router.dismissTo({ pathname: '/matching', params: { requestId } });
  if (loading || !data) {
    return (
      <Page>
        <Header title="Group details" onBack={back} />
        <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Loading group…'}</Copy>
      </Page>
    );
  }
  const badge = prefBadge[data.pref];
  const pickupName = ref.pickup(data.pickup_area_id)?.name ?? 'Pickup';
  const left = data.capacity - data.seats_taken;
  return (
    <Page>
      <Header title="Group details" onBack={back} />
      <View style={{ padding: 18, borderRadius: 18, backgroundColor: color.navy }}>
        <Row gap={5}><Badge tone={badge.tone}>{badge.label}</Badge>{data.travel_source === 'fallback' && <Badge tone="amber">Estimate</Badge>}</Row>
        <RouteTitle light marginTop={18} pickup={pickupName} destination={ref.campus(data.campus_id)?.code ?? ''} />
        <Copy size={10} tint="#CFC5DA">{`${formatDate(data.departure_at)} · Departs ${formatTime(data.departure_at)} · Your pickup ${formatTime(data.pickup_at)}`}</Copy>
        <Copy size={10} tint="#CFC5DA">{`Stops: ${data.stops.join(' → ')}`}</Copy>
      </View>
      <Row gap={5} style={styles.seatSummary}>
        <SeatStat number={String(data.seats_taken)} label="reserved" /><View style={styles.seatDivider} />
        <SeatStat number={String(left)} label={left === 1 ? 'seat left' : 'seats left'} /><View style={styles.seatDivider} />
        <SeatStat number={String(data.capacity)} label="max seats" />
      </Row>
      <SectionHeading title="Your ride group" note="Verified only" />
      <View style={styles.memberList}>
        {data.members.map((member, index) => (
          <Row key={`${member.first_name}-${index}`} style={styles.member}>
            <Avatar name={member.first_name[0]} index={index} size={34} />
            <Copy size={11} weight={800} style={fill}>{member.first_name}</Copy>
            {member.verified && <Badge icon={BadgeCheck}>Verified</Badge>}
          </Row>
        ))}
        {left > 0 && (
          <Row style={[styles.member, styles.openSeat]}>
            <Tile icon={UserPlus} size={34} iconSize={18} background="transparent" style={styles.emptyAvatar} />
            <Copy size={11} weight={800} tint={color.brand}>This seat could be yours</Copy>
          </Row>
        )}
      </View>
      <Row gap={0} style={styles.fare}>
        <Fare label="Your fare" value={formatFils(data.fare_fils)} />
        <Fare label="Total car fare cap" value={formatFils(data.fare_cap_fils)} />
      </Row>
      <Card style={styles.policy}>
        <Row gap={8} style={{ marginBottom: 3 }}><ShieldCheck size={19} color="#5F552F" /><Copy weight={800} tint="#5F552F">Cancellation policy</Copy></Row>
        <PolicyRow icon={Check} label="12+ hours before: " outcome="full refund" />
        <PolicyRow icon={X} label="Less than 12 hours: " outcome="no refund" />
        <PolicyRow icon={LockKeyhole} label="After trip starts: cancellation unavailable" />
      </Card>
      <Button onPress={() => router.push({ pathname: '/summary', params: {
        groupId: data.group_id, requestId, routeVersion: String(data.route_version), pickupAreaId: data.pickup_area_id,
      } })} disabled={data.full || data.over_cap} style={styles.action}>{`Book & prepay · ${formatFils(data.fare_fils)}`}</Button>
    </Page>
  );
}

export function RouteTitle({ light = false, marginTop = 10, pickup, destination }: {
  light?: boolean; marginTop?: number; pickup: string; destination: string;
}) {
  const tint = light ? color.white : color.navy;
  return <Row gap={8} style={{ marginTop, marginBottom: 6, flexWrap: 'wrap' }}>
    <Copy size={17} weight={800} tint={tint}>{pickup}</Copy><ArrowRight size={19} color={tint} /><Copy size={17} weight={800} tint={tint}>{destination}</Copy>
  </Row>;
}

function SeatStat({ number, label }: { number: string; label: string }) {
  return <Pile gap={3} style={styles.stat}><Copy size={18} weight={800}>{number}</Copy><Copy size={8} tint={color.muted}>{label}</Copy></Pile>;
}

function Fare({ label, value }: { label: string; value: string }) {
  return <Pile gap={5} style={[styles.farePart, label === 'Your fare' && styles.fareDivider]}>
    <Copy size={8} tint={color.muted}>{label}</Copy><Copy size={13} weight={800}>{value}</Copy>
  </Pile>;
}

function PolicyRow({ icon: Icon, label, outcome }: { icon: typeof Check; label: string; outcome?: string }) {
  return <Row gap={8}><Icon size={16} color="#5F552F" /><Copy size={9} tint="#5F552F" style={fill}>
    {label}{outcome && <Copy size={9} weight={800} tint="#5F552F">{outcome}</Copy>}
  </Copy></Row>;
}

const styles = StyleSheet.create({
  campusOption: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeCampus: { backgroundColor: color.pink },
  scheduleCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, backgroundColor: color.soft, borderRadius: 9 },
  selectedCell: { backgroundColor: color.brand },
  inputCard: { padding: 0, borderRadius: 17, marginVertical: 15 },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
  map: { height: 176, borderRadius: 18, overflow: 'hidden', backgroundColor: '#E8EFEA' },
  pickupPin: { position: 'absolute', left: '18%', top: 101 },
  campusPin: { position: 'absolute', right: '18%', top: 32, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: color.navy, borderWidth: 3, borderColor: color.white, borderRadius: 9, ...shadow(4, 10, '#837A91') },
  mapLabel: { position: 'absolute', left: 34, top: 130, backgroundColor: color.white, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 5 },
  campusLabel: { position: 'absolute', right: 58, top: 67, backgroundColor: color.white, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 5 },
  recenter: { position: 'absolute', right: 9, bottom: 9, backgroundColor: color.white, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5, ...shadow(3, 10, '#14322D1F') },
  softNote: { backgroundColor: color.pink, marginTop: 12 },
  action: { marginTop: 24 },
  aiHero: { alignItems: 'center', paddingTop: 22, paddingBottom: 25 },
  aiOrb: { marginBottom: 8, borderRadius: 22, boxShadow: '0px 0px 0px 9px #E9E2FF73' },
  centered: { alignSelf: 'center' },
  timing: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: '#ECE7FA', paddingVertical: 17, paddingHorizontal: 15, borderRadius: 16 },
  timingLine: { width: '10%', height: 1, backgroundColor: '#DCD5EE' },
  facts: { marginVertical: 14, padding: 15, borderRadius: 16, backgroundColor: '#F4F9F7' },
  probability: { marginVertical: 14, padding: 15, borderRadius: 16, backgroundColor: '#F4F9F7' },
  ring: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  routeSummary: { padding: 13, borderRadius: 14, backgroundColor: color.sage },
  campusDot: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#163A42', alignItems: 'center', justifyContent: 'center' },
  filters: { marginTop: 15, marginBottom: 15 },
  filter: { flex: 1, alignItems: 'center', paddingHorizontal: 5, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: color.line },
  filterSelected: { backgroundColor: color.pink, borderColor: color.brand },
  empty: { paddingVertical: 44, paddingHorizontal: 12 },
  emptyIcon: { alignSelf: 'center', width: 85, height: 85, borderRadius: 29, backgroundColor: '#F0F4F3', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  questionMark: { position: 'absolute', right: 15, top: 12 },
  groupCard: { borderWidth: 1, borderColor: color.line, borderRadius: 19, padding: 16, backgroundColor: color.white },
  featured: { paddingTop: 32, overflow: 'hidden', borderColor: '#EF8FBE', ...shadow(12, 28, '#5F27651A') },
  bestMatch: { position: 'absolute', right: 0, top: 0, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: color.pink },
  seats: { marginTop: 18, marginBottom: 13 },
  seat: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#AAB7B4' },
  matchFacts: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 12 },
  onTime: { padding: 10, marginTop: 12, borderRadius: 10, backgroundColor: '#F3EFFF' },
  compactGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seatSummary: { paddingVertical: 17 },
  stat: { flex: 1, alignItems: 'center' },
  seatDivider: { height: 29, width: 1, backgroundColor: color.line },
  memberList: { borderWidth: 1, borderColor: color.line, borderRadius: 16, overflow: 'hidden' },
  member: { minHeight: 52, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.line },
  openSeat: { backgroundColor: '#F8FAF9', borderBottomWidth: 0 },
  emptyAvatar: { borderRadius: 17, borderWidth: 1, borderStyle: 'dashed', borderColor: color.brand },
  fare: { marginVertical: 13, borderWidth: 1, borderColor: color.line, borderRadius: 14 },
  farePart: { flex: 1, paddingVertical: 13, paddingHorizontal: 15 },
  fareDivider: { borderRightWidth: 1, borderRightColor: color.line },
  policy: { gap: 8, padding: 15, borderWidth: 0, borderRadius: 15, backgroundColor: '#FFF9E8' },
});
