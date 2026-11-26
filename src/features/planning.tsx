import { useRouter } from 'expo-router';
import {
  ArrowRight, BadgeCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Info, LockKeyhole,
  MapPin, Navigation, Route, ShieldCheck, Sparkles, Star, UserPlus, Users, CircleUserRound, X, Zap,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Avatar, Badge, BottomSheet, Button, Card, center, Copy, Eyebrow, Field, fill, Header, IconButton,
  InfoRow, Notice, Page, Pile, RouteCard, Row, SectionHeading, spread, Tile,
} from '@/components/ui';
import { color, shadow } from '@/theme';
import { campuses, getSchedule, parseSchedule, useRideSchedule, type Schedule } from '@/features/rideSchedule';

export function PlanRide() {
  const router = useRouter();
  const initialSchedule = useRideSchedule();
  const [schedule, setSchedule] = useState(initialSchedule.params);
  const [editing, setEditing] = useState<keyof Schedule | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [selectingCampus, setSelectingCampus] = useState(false);
  const display = getSchedule(schedule);

  function edit(field: keyof Schedule) {
    setDraft(schedule[field]);
    setError('');
    setEditing(field);
  }

  function save() {
    if (!editing) return;
    const candidate = { ...schedule, [editing]: draft.trim() };
    const date = parseSchedule(candidate.date, candidate.classTime);
    if (!date) {
      setError(editing === 'date' ? 'Enter a valid date as YYYY-MM-DD.' : 'Enter a valid time as HH:MM (24-hour clock).');
      return;
    }
    setSchedule(candidate);
    setEditing(null);
  }
  return (
    <Page>
      <Header title="Plan a ride" eyebrow="RIDE DETAILS" onBack={() => router.dismissTo('/home')} />
      <RouteCard
        start={{ label: 'PICKUP', title: 'Student Area, Irbid', detail: 'Al-Husn Road · current location' }}
        end={{ label: 'DESTINATION', title: display.campus.label, detail: 'Tap to change university' }}
        onEndPress={() => setSelectingCampus(true)}
      />
      <Card style={styles.inputCard}>
        <InfoRow icon={CalendarDays} label="Ride date" value={display.classDate} style={styles.divider} onPress={() => edit('date')} />
        <InfoRow icon={Clock3} label="Class starts" value={display.classTime} onPress={() => edit('classTime')} />
      </Card>
      <View style={styles.map}>
        <Svg viewBox="0 0 350 176" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Path d="M-25 18L370 167 M145 185L210 -20" stroke="#FFFFFF90" strokeWidth={12} />
          <Path d="M20 136L292 9 M115 36L217 220" stroke="#D6E1DA" strokeWidth={13} />
          <Path d="M20 136L292 9 M115 36L217 220" stroke="#FFFFFF" strokeWidth={11} />
        </Svg>
        <View style={styles.pickupPin}><MapPin size={20} color={color.brand} fill={color.brand} /></View>
        <View style={styles.campusPin}><Copy size={11} tint={color.white} weight={800}>{display.campus.code[0]}</Copy></View>
        <Copy size={8} weight={800} style={styles.mapLabel}>Student Area</Copy>
        <Copy size={8} weight={800} style={styles.campusLabel}>{display.campus.code}</Copy>
        <Pressable accessibilityRole="button" style={styles.recenter}>
          <Navigation size={16} color={color.navy} /><Copy size={8} weight={700}>Recenter</Copy>
        </Pressable>
      </View>
      <Notice icon={ShieldCheck} tint="#44665D" style={styles.softNote}>Destinations are limited to verified university campuses.</Notice>
      {!!error && !editing && <Copy accessibilityRole="alert" tint={color.danger}>{error}</Copy>}
      <Button icon={Sparkles} onPress={() => {
        const start = parseSchedule(schedule.date, schedule.classTime);
        if (!start || start.getTime() - 40 * 60_000 <= Date.now()) {
          setError('Choose a date and class time at least 40 minutes from now.');
          return;
        }
        router.push({ pathname: '/suggestion', params: schedule });
      }} style={styles.action}>Find my group</Button>
      {selectingCampus && (
        <BottomSheet onClose={() => setSelectingCampus(false)}>
          <Copy accessibilityRole="header" size={20} weight={800}>Choose a university</Copy>
          <Card style={styles.inputCard}>
            {campuses.map((campus, index) => {
              const selected = campus.id === schedule.campus;
              return (
                <Pressable key={campus.id} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                  onPress={() => { setSchedule((current) => ({ ...current, campus: campus.id })); setSelectingCampus(false); }}
                  style={[styles.campusOption, index < campuses.length - 1 && styles.divider, selected && styles.activeCampus]}>
                  <Tile icon={MapPin} size={34} iconSize={17} />
                  <Pile gap={4} style={fill}>
                    <Copy size={12} weight={800}>{campus.name}</Copy>
                    <Copy size={10} tint={color.muted}>{campus.code}</Copy>
                  </Pile>
                  {selected && <Check size={18} color={color.brand} />}
                </Pressable>
              );
            })}
          </Card>
          <Button tone="secondary" onPress={() => setSelectingCampus(false)}>Cancel</Button>
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

export function Suggestion() {
  const router = useRouter();
  const schedule = useRideSchedule();
  return (
    <Page>
      <Header title="Departure plan" onBack={() => router.dismissTo('/plan')} />
      <Pile gap={9} style={styles.aiHero}>
        <Tile icon={Sparkles} size={65} iconSize={30} tint="#7157D2" background="#E9E2FF" style={styles.aiOrb} />
        <Badge tone="violet" style={styles.centered}>AI RECOMMENDATION</Badge>
        <Copy accessibilityRole="header" size={28} weight={800} style={[center, { letterSpacing: -1.12, marginTop: 8 }]}>
          Leave at <Copy size={28} weight={800} tint="#6B50C7">{schedule.departure}</Copy>
        </Copy>
        <Copy tint={color.muted}>{`${schedule.classDate} · For your ${schedule.classTime} class at ${schedule.campus.code}`}</Copy>
      </Pile>
      <Card style={styles.timing}>
        <Timing time={schedule.departure} label="DEPART" /><View style={styles.timingLine} />
        <Timing time="32 min" label="EST. TRAVEL" /><View style={styles.timingLine} />
        <Timing time={schedule.arrival} label="ARRIVE" />
      </Card>
      <Row gap={13} style={styles.probability}>
        <View style={styles.ring}>
          <Svg width={58} height={58} style={StyleSheet.absoluteFill}>
            <Circle cx={29} cy={29} r={26.5} fill={color.white} stroke="#D5E5E0" strokeWidth={5} />
            <Path d="M29 2.5 A26.5 26.5 0 1 1 29 55.5 A26.5 26.5 0 1 1 29 2.5"
              fill="none" stroke={color.brand} strokeWidth={5} strokeDasharray={[153.18, 166.5]} />
          </Svg>
          <Copy size={14} weight={800} tint={color.brand}>92<Copy size={7} weight={800} tint={color.brand}>%</Copy></Copy>
        </View>
        <Pile gap={5} style={fill}>
          <Copy weight={800}>High chance you’ll be on time</Copy>
          <Copy size={9} tint={color.muted} style={{ lineHeight: 13.5 }}>Includes traffic patterns and an 8-minute safety buffer.</Copy>
        </Pile>
      </Row>
      <Notice icon={Info} tint="#615A72" style={{ backgroundColor: '#F6F3FF', alignItems: 'flex-start' }}>This is an AI estimate, not a guarantee. Live conditions may change.</Notice>
      <Pile gap={9} style={styles.action}>
        <Button onPress={() => router.push({ pathname: '/matching', params: schedule.params })}>{`Accept ${schedule.departure} & search`}</Button>
        <Button tone="secondary" onPress={() => router.dismissTo('/plan')}>Choose another time</Button>
      </Pile>
    </Page>
  );
}

function Timing({ time, label }: { time: string; label: string }) {
  return <Pile gap={4} style={{ alignItems: 'center' }}>
    <Copy size={14} weight={800}>{time}</Copy><Eyebrow tint={color.muted} size={7}>{label}</Eyebrow>
  </Pile>;
}

const groupFilters = ['Girls-only', 'Boys-only', 'Any'] as const;
type GroupFilter = (typeof groupFilters)[number];

export function Matching() {
  const router = useRouter();
  const schedule = useRideSchedule();
  const [filter, setFilter] = useState<GroupFilter>('Girls-only');
  const [empty, setEmpty] = useState(false);
  const selectFilter = (value: GroupFilter) => {
    setFilter(value);
    setEmpty(value === 'Boys-only');
  };
  const openGroup = () => router.push({ pathname: '/group', params: schedule.params });
  return (
    <Page>
      <Header title="Suggested groups" onBack={() => router.dismissTo('/suggestion')}
        action={<IconButton icon={Zap} label="Toggle match results" onPress={() => setEmpty((value) => !value)} />} />
      <Row style={[spread, styles.routeSummary]}>
        <Row gap={8}><MapPin size={18} color={color.brand} /><TimingStop title="Student Area" detail="Pickup" /></Row>
        <ArrowRight size={18} color={color.muted} />
        <Row gap={8}><View style={styles.campusDot}><Copy size={11} weight={800} tint={color.white}>{schedule.campus.code[0]}</Copy></View>
          <TimingStop title={schedule.campus.code} detail={`${schedule.departureDate} · ${schedule.departure}`} /></Row>
      </Row>
      <Row gap={7} style={styles.filters}>
        {groupFilters.map((item) => (
          <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }}
            onPress={() => selectFilter(item)} style={[styles.filter, filter === item && styles.filterSelected]}>
            <Copy size={9} weight={700} tint={filter === item ? color.brand : color.muted}>{item}</Copy>
          </Pressable>
        ))}
      </Row>
      {empty ? (
        <Pile gap={9} style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Users size={35} color="#92A19D" />
            <Copy weight={800} tint="#92A19D" style={styles.questionMark}>?</Copy>
          </View>
          <Copy accessibilityRole="header" size={21} weight={800} style={center}>No match found yet</Copy>
          <Copy size={11} tint={color.muted} style={[center, { lineHeight: 18, marginBottom: 13 }]}>
            We couldn’t find a suitable group for this time and preference.
          </Copy>
          <Button onPress={() => selectFilter('Any')}>Keep request active</Button>
          <Button tone="secondary" onPress={() => router.dismissTo('/plan')}>Adjust departure time</Button>
        </Pile>
      ) : (
        <Pile gap={11}>
          <Row style={spread}><Copy size={10} weight={700}>3 matches near you</Copy><Badge tone="violet" icon={Sparkles}>AI ranked</Badge></Row>
          <Pressable accessibilityRole="button" accessibilityLabel={`Best match, ${schedule.departure}`} onPress={openGroup} style={[styles.groupCard, styles.featured]}>
            <Row gap={4} style={styles.bestMatch}>
              <Star size={14} color={color.brand} fill={color.brand} />
              <Copy size={8} weight={800} tint={color.brand}>BEST MATCH</Copy>
            </Row>
            <Row style={[spread, { alignItems: 'flex-start' }]}>
              <Pile gap={7}><GroupTime time={schedule.departure} /><Badge tone="rose">Girls-only</Badge></Pile>
              <Copy size={17} weight={800}>1.50 <Copy size={8} tint={color.muted}>JD / seat</Copy></Copy>
            </Row>
            <Row gap={4} style={styles.seats}>
              {[1, 2, 3, 4].map((number) => (
                <View key={number} style={[styles.seat, number < 4 && { backgroundColor: color.pink, borderWidth: 0 }]}>
                  <CircleUserRound size={19} color={number < 4 ? color.brand : '#9BA8A5'} />
                </View>
              ))}
              <Pile gap={3} style={{ marginLeft: 7 }}><Copy size={10} weight={800}>3/4 seats filled</Copy><Copy size={8} tint="#B64F44">1 seat left</Copy></Pile>
            </Row>
            <Row gap={14} style={styles.matchFacts}>
              <MatchFact icon={Route} title="94% route match" /><MatchFact icon={Clock3} title="Leaves on time" />
            </Row>
            <Row gap={7} style={styles.onTime}><Sparkles size={17} color="#654EBA" />
              <Copy size={9} weight={800} tint="#654EBA" style={fill}>92% chance you’re on time</Copy><Info size={15} color="#654EBA" />
            </Row>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Group, ${schedule.alternate}`} onPress={openGroup} style={[styles.groupCard, styles.compactGroup]}>
            <Pile gap={4}><GroupTime time={schedule.alternate} /><Badge tone="slate">Any</Badge></Pile>
            <Copy size={9} tint={color.muted} style={{ flex: 1, textAlign: 'right' }}>2/4 seats · 1.50 JD</Copy>
            <ChevronRight size={18} color={color.muted} />
          </Pressable>
          <Row gap={6} style={{ padding: 4 }}><Info size={15} color={color.muted} />
            <Copy size={9} tint={color.muted} style={fill}>JUNI suggests groups. You always choose before booking.</Copy>
          </Row>
        </Pile>
      )}
    </Page>
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
  const schedule = useRideSchedule();
  return (
    <Page>
      <Header title="Group details" onBack={() => router.dismissTo('/matching')} />
      <View style={{ padding: 18, borderRadius: 18, backgroundColor: color.navy }}>
        <Row gap={5}><Badge tone="rose">Girls-only</Badge><Badge tone="violet" icon={Sparkles}>92% on time</Badge></Row>
        <RouteTitle light marginTop={18} destination={schedule.campus.code} />
        <Copy size={10} tint="#CFC5DA">{`${schedule.departureDate} · Departure at ${schedule.departure}`}</Copy>
      </View>
      <Row gap={5} style={styles.seatSummary}>
        <SeatStat number="3" label="reserved" /><View style={styles.seatDivider} />
        <SeatStat number="1" label="seat left" /><View style={styles.seatDivider} />
        <SeatStat number="4" label="max seats" />
      </Row>
      <SectionHeading title="Your ride group" note="Verified only" />
      <View style={styles.memberList}>
        {['Lina A.', 'Rama K.', 'Noor M.'].map((name, index) => (
          <Row key={name} style={styles.member}>
            <Avatar name={name[0]} index={index} size={34} /><Copy size={11} weight={800} style={fill}>{name}</Copy><Badge icon={BadgeCheck}>Verified</Badge>
          </Row>
        ))}
        <Row style={[styles.member, styles.openSeat]}>
          <Tile icon={UserPlus} size={34} iconSize={18} background="transparent" style={styles.emptyAvatar} />
          <Copy size={11} weight={800} tint={color.brand}>This seat could be yours</Copy>
        </Row>
      </View>
      <Row gap={0} style={styles.fare}>
        <Fare label="Your fare" value="1.50 JD" />
        <Fare label="Total car fare cap" value="6.00 JD" />
      </Row>
      <Card style={styles.policy}>
        <Row gap={8} style={{ marginBottom: 3 }}><ShieldCheck size={19} color="#5F552F" /><Copy weight={800} tint="#5F552F">Cancellation policy</Copy></Row>
        <PolicyRow icon={Check} label="12+ hours before: " outcome="full refund" />
        <PolicyRow icon={X} label="Less than 12 hours: " outcome="no refund" />
        <PolicyRow icon={LockKeyhole} label="After trip starts: cancellation unavailable" />
      </Card>
      <Button onPress={() => router.push({ pathname: '/summary', params: schedule.params })} style={styles.action}>Book & prepay · 1.50 JD</Button>
    </Page>
  );
}

export function RouteTitle({ light = false, marginTop = 10, destination }: {
  light?: boolean; marginTop?: number; destination: string;
}) {
  const tint = light ? color.white : color.navy;
  return <Row gap={8} style={{ marginTop, marginBottom: 6, flexWrap: 'wrap' }}>
    <Copy size={17} weight={800} tint={tint}>Student Area</Copy><ArrowRight size={19} color={tint} /><Copy size={17} weight={800} tint={tint}>{destination}</Copy>
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
