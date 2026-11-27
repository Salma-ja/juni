import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Flame, Gift, House, Info, LocateFixed, Lock, MapPin,
  Plus, Route, ShieldCheck, Sparkles, UserPlus,
} from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { RideMap, type MapPoint } from '@/components/RideMap';
import {
  Avatar, Badge, BottomSheet, Button, Card, center, Copy, fill, Header, IconButton, Notice, Page, Pile,
  PulseDot, RouteCard, Row, ScalePressable, SectionHeading, spread,
} from '@/components/ui';
import {
  createGroup, createRequest, demandStats, fetchIsolatedPools, groupDetail, recommendDeparture,
  searchGroups, type Candidate, type DemandStat, type Departure, type GroupDetail as GroupDetailData,
  type IsolatedPoolItem, type Pref, type SearchResult,
} from '@/data/api';
import { errorCopy } from '@/data/errors';
import { roadKm } from '@/data/fareStrip.mjs';
import { ammanInstant, formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { useLoad } from '@/data/useLoad';
import { useAuth } from '@/features/authSession';
import { AddressPickerSheet, CampusPickerSheet, useLocationPref } from '@/features/locationState';
import { classTimeChoices, isHotspot } from '@/features/places';
import { nextClassDay, parseSchedule } from '@/features/rideSchedule';
import { color, shadow } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

type PlanParams = { campusId?: string; pickupAreaId?: string; date?: string; classTime?: string };

function planMapPoints(
  pickup: { id: string; name: string; lat: number; lng: number; is_custom?: boolean; location_kind?: string } | undefined,
  campus: { code: string; lat: number; lng: number } | undefined,
): MapPoint[] {
  if (!pickup || !campus) return [];
  const kind: MapPoint['kind'] = pickup.location_kind === 'current_gps'
    ? 'gps'
    : pickup.is_custom
      ? 'home'
      : isHotspot(pickup.id)
        ? 'hotspot'
        : 'you';
  return [
    {
      lat: pickup.lat,
      lng: pickup.lng,
      label: pickup.name,
      kind,
      caption: pickup.is_custom ? 'Home' : isHotspot(pickup.id) ? 'Hotspot' : 'Pickup',
    },
    { lat: campus.lat, lng: campus.lng, label: campus.code, kind: 'campus' },
  ];
}

/** Generate upcoming Jordan university teaching days (Sun–Thu). */
function upcomingTeachingDays(count = 7): { iso: string; dayShort: string; dayNum: string; monthShort: string }[] {
  const out: { iso: string; dayShort: string; dayNum: string; monthShort: string }[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const pad = (v: number) => String(v).padStart(2, '0');
  const wdFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const moFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 5 && d.getDay() !== 6) {
      out.push({
        iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        dayShort: wdFmt.format(d),
        dayNum: String(d.getDate()),
        monthShort: moFmt.format(d),
      });
    }
  }
  return out;
}

export function PlanRide() {
  const router = useRouter();
  const params = useLocalSearchParams<PlanParams>();
  const ref = useRefData();
  const { profile } = useAuth();
  const loc = useLocationPref();

  const [campusId, setCampusId] = useState(params.campusId ?? loc.campusId ?? 'just');
  const [pickupId, setPickupId] = useState<string>(params.pickupAreaId ?? loc.pickupId ?? 'hawara');
  const [date, setDate] = useState(params.date ?? nextClassDay());
  const [classTime, setClassTime] = useState(params.classTime ?? '08:00');
  const [sheet, setSheet] = useState<'campus' | 'pickupPin' | 'pickupGates' | 'calendar' | 'moreTimes' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const campus = ref.campus(campusId) ?? loc.campus;
  const pickup = ref.pickup(pickupId) ?? loc.pickup;
  const pref: Pref = profile?.gender === 'male' ? 'boys_only' : 'girls_only';
  const demand = useLoad(() => demandStats(), []);
  const teachingDays = useMemo(() => upcomingTeachingDays(7), []);

  useEffect(() => {
    if (params.campusId) setCampusId(params.campusId);
  }, [params.campusId]);

  useEffect(() => {
    if (params.pickupAreaId) setPickupId(params.pickupAreaId);
  }, [params.pickupAreaId]);

  function handleSelectCampus(nextId: string) {
    setCampusId(nextId);
    loc.setCampusId(nextId);
    const nextC = ref.campus(nextId);
    const curP = ref.pickup(pickupId);
    if (nextC?.corridor && curP?.corridor && nextC.corridor !== curP.corridor) {
      const defGate = nextC.corridor === 'amman' ? 'sweileh' : 'hawara';
      if (ref.pickup(defGate)) {
        setPickupId(defGate);
        loc.setPickupId(defGate);
      }
    }
    setSheet(null);
  }

  function handleSelectPickup(nextId: string) {
    setPickupId(nextId);
    loc.setPickupId(nextId);
    setError('');
    setSheet(null);
  }

  async function submit() {
    if (busy) return;
    if (!pickup) {
      setError('Select your pickup gate.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await createRequest({
      campusId: campus?.id ?? campusId,
      pickupAreaId: pickup.id,
      classStartAt: ammanInstant(date, classTime).toISOString(),
      pref,
    });
    setBusy(false);
    if (!res.ok) {
      setError(errorCopy(res.code));
      return;
    }
    // Directly open the unified AI Commute Analysis + Groups screen!
    router.push({ pathname: '/matching', params: { requestId: res.data.request_id } });
  }

  const classInstant = ammanInstant(date, classTime);
  const targetArrival = new Date(classInstant.getTime() - 10 * 60000);
  const estKm = pickup && campus ? roadKm(pickup, campus) : null;

  return (
    <Page
      footer={
        <Button icon={Sparkles} disabled={busy || !ref.ready} onPress={submit} trailingArrow>
          {busy ? 'Analyzing corridor & groups…' : 'Find my group'}
        </Button>
      }
    >
      <Header
        title="Plan a ride"
        subtitle="Schedule your verified campus seat"
        onBack={() => router.dismissTo('/home')}
      />

      {/* 1-Tap Home & Current GPS Source Selector */}
      <Row gap={8} style={{ marginBottom: 10 }}>
        <ScalePressable
          accessibilityLabel="Use my current GPS location"
          disabled={loc.locatingGps}
          onPress={async () => {
            const saved = await loc.detectCurrentLocation();
            if (saved) {
              setPickupId(saved.id);
              setError('');
            }
          }}
          style={[styles.sourceChip, pickup?.location_kind === 'current_gps' && styles.sourceChipActive]}
        >
          {loc.locatingGps ? <PulseDot tint={color.brand} size={6} /> : <LocateFixed size={15} color={color.brand} />}
          <Copy size={12} weight={800} tint={color.navy}>
            {loc.locatingGps ? 'Locating…' : 'Current GPS'}
          </Copy>
        </ScalePressable>

        <ScalePressable
          accessibilityLabel="Pin custom home location on map"
          onPress={() => setSheet('pickupPin')}
          style={[styles.sourceChip, pickup?.location_kind === 'custom_home' && styles.sourceChipActive]}
        >
          <House size={15} color={color.brand} />
          <Copy size={12} weight={800} tint={color.navy}>Pin my home</Copy>
        </ScalePressable>

        <ScalePressable
          accessibilityLabel="Choose corridor assembly gate"
          onPress={() => setSheet('pickupGates')}
          style={[styles.sourceChip, !pickup?.is_custom && styles.sourceChipActive]}
        >
          <MapPin size={15} color={color.brand} />
          <Copy size={12} weight={800} tint={color.navy}>Gates</Copy>
        </ScalePressable>
      </Row>

      {/* SINGLE Clean Unified Route Card (No duplicate middle card!) */}
      <RouteCard
        start={{
          label: pickup?.location_kind === 'current_gps'
            ? 'CURRENT GPS PICKUP'
            : pickup?.is_custom
              ? 'CUSTOM HOME PICKUP'
              : 'PICKUP LOCATION',
          title: pickup ? (pickup.name_ar ? `${pickup.name} · ${pickup.name_ar}` : pickup.name) : 'Set home or gate',
          detail: loc.streetNote || pickup?.gate_landmark_en || pickup?.detail || 'Tap to set your home pickup',
        }}
        end={{
          label: 'DESTINATION UNIVERSITY',
          title: campus ? `${campus.code} · ${campus.name}` : 'Choose university',
          detail: campus?.name_ar ? `${campus.name_ar}${estKm ? ` · ${estKm.toFixed(1)} km` : ''}` : 'Tap to switch university',
        }}
        onStartPress={() => setSheet('pickupPin')}
        onEndPress={() => setSheet('campus')}
      />

      {/* Teaching Day Picker Strip (Sun–Thu) */}
      <SectionHeading
        title="Teaching day"
        note="Calendar"
        onPress={() => setSheet('calendar')}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
        {teachingDays.map((d) => {
          const selected = d.iso === date;
          return (
            <ScalePressable
              key={d.iso}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${d.dayShort} ${d.dayNum} ${d.monthShort}`}
              onPress={() => { setDate(d.iso); setError(''); }}
              style={[styles.dayPill, selected && styles.dayPillSelected]}
            >
              <Copy size={12} weight={700} tint={selected ? '#FFD1E8' : color.muted}>{d.dayShort}</Copy>
              <Copy size={18} weight={800} tint={selected ? color.white : color.navy}>{d.dayNum}</Copy>
              <Copy size={12} weight={600} tint={selected ? '#FFD1E8' : color.muted}>{d.monthShort}</Copy>
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* Lecture Bell Picker (Figma 05b · "When does your class start?") */}
      <SectionHeading
        title="When does your class start?"
        note="More times"
        onPress={() => setSheet('moreTimes')}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeStrip}>
        {classTimeChoices.map((choice) => {
          const selected = classTime === choice.time;
          const slot = slotStat(demand.data, choice.time);
          const tag = slot?.is_highlighted
            ? `Hot · ${slot.rider_count}`
            : choice.tag;
          return (
            <ScalePressable
              key={choice.time}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Class at ${formatTime(ammanInstant(date, choice.time))}`}
              onPress={() => { setClassTime(choice.time); setError(''); }}
              style={[styles.timeChip, selected && styles.timeChipOn]}
            >
              <Copy size={14} weight={800} tint={selected ? color.white : color.navy}>
                {formatTime(ammanInstant(date, choice.time))}
              </Copy>
              {!!tag && (
                <Copy size={12} weight={700} tint={selected ? '#FFE0F0' : color.brand}>{tag}</Copy>
              )}
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* Arrival & Pool Lock Summary Card (Figma 05b big arrival preview) */}
      <Card style={styles.arrivalPreviewCard}>
        <Pile gap={2}>
          <Copy size={12} weight={700} tint={color.muted}>ARRIVE AT GATE</Copy>
          <Copy size={28} weight={800} tint={color.navy} style={{ letterSpacing: -1 }}>
            {formatTime(targetArrival)}
          </Copy>
          <Copy size={12} tint={color.muted}>
            {`${formatDate(classInstant)} · 10 min before ${formatTime(classInstant)} lecture`}
          </Copy>
        </Pile>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 10 }}>
          <Badge tone={pref === 'girls_only' ? 'rose' : 'violet'} icon={Lock}>
            {pref === 'girls_only' ? 'Girls-only' : 'Boys-only'}
          </Badge>
          <Badge tone="brand" icon={Gift}>+30 pts on 4th seat</Badge>
        </Row>
      </Card>

      {/* Corridor Map Preview */}
      <View style={{ marginTop: 14 }}>
        <RideMap
          height={185}
          points={planMapPoints(pickup, campus)}
          polyline={campus?.corridor_polyline}
        />
      </View>

      {!!error && (
        <Notice icon={Info} tint={color.danger} style={{ backgroundColor: color.dangerSoft, marginTop: 12 }}>
          {error}
        </Notice>
      )}

      {/* Clean Mobile Pickers */}
      {sheet === 'campus' && (
        <CampusPickerSheet
          selectedId={campus?.id ?? campusId}
          onSelect={handleSelectCampus}
          onClose={() => setSheet(null)}
        />
      )}

      {(sheet === 'pickupPin' || sheet === 'pickupGates') && (
        <AddressPickerSheet
          initialMode={sheet === 'pickupPin' ? 'pin' : 'gates'}
          selectedId={pickup?.id ?? pickupId}
          currentPickup={pickup}
          campus={campus}
          streetNote={loc.streetNote}
          onChangeStreetNote={loc.setStreetNote}
          locatingGps={loc.locatingGps}
          onDetectGps={async (note) => {
            const saved = await loc.detectCurrentLocation(note);
            if (saved) {
              setPickupId(saved.id);
              setError('');
              setSheet(null);
            }
          }}
          onSaveCustomPin={async (opts) => {
            const saved = await loc.saveHomePin(opts);
            if (saved) {
              setPickupId(saved.id);
              setError('');
              setSheet(null);
            }
          }}
          onSelect={handleSelectPickup}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'calendar' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy}>Choose teaching date</Copy>
          <Copy size={12} tint={color.muted}>Jordan university week runs Sunday–Thursday (Fri/Sat weekend)</Copy>
          <MobileCalendarGrid
            selected={date}
            onSelect={(val) => {
              setDate(val);
              setError('');
              setSheet(null);
            }}
          />
          <Button tone="secondary" onPress={() => setSheet(null)}>Close</Button>
        </BottomSheet>
      )}

      {sheet === 'moreTimes' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy}>Select lecture start time</Copy>
          <Copy size={12} tint={color.muted}>Your group targets campus gate arrival 10 minutes before class</Copy>
          <MobileLectureSlots
            selected={classTime}
            date={date}
            onSelect={(val) => {
              setClassTime(val);
              setError('');
              setSheet(null);
            }}
          />
          <Button tone="secondary" onPress={() => setSheet(null)}>Close</Button>
        </BottomSheet>
      )}
    </Page>
  );
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const gridDateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });

function MobileCalendarGrid({ selected, onSelect }: { selected: string; onSelect: (value: string) => void }) {
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
    <Pile gap={8}>
      <Row style={spread}>
        <IconButton icon={ChevronLeft} label="Previous month" onPress={() => goMonth(-1)} />
        <Copy size={16} weight={800} tint={color.navy}>{monthLabel.format(month)}</Copy>
        <IconButton icon={ChevronRight} label="Next month" onPress={() => goMonth(1)} />
      </Row>
      <Row gap={4}>
        {weekdays.map((day, idx) => (
          <Copy key={day} size={12} weight={700} tint={idx >= 5 ? color.brand : color.muted} style={[fill, center]}>
            {day}
          </Copy>
        ))}
      </Row>
      {Array.from({ length: Math.ceil((first + count) / 7) }, (_, week) => (
        <Row key={week} gap={4}>
          {weekdays.map((weekday, column) => {
            const day = week * 7 + column - first + 1;
            if (day < 1 || day > count) return <View key={weekday} style={fill} />;
            const cellDate = new Date(year, monthIndex, day);
            const isWeekend = column === 5 || column === 6;
            const isPast = cellDate <= today;
            const disabled = isPast || isWeekend;
            const value = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = value === selected;
            return (
              <ScalePressable
                key={weekday}
                accessibilityLabel={gridDateLabel.format(cellDate)}
                accessibilityState={{ selected: isSelected, disabled }}
                disabled={disabled}
                onPress={() => onSelect(value)}
                style={[
                  styles.calCell,
                  isWeekend && styles.calWeekend,
                  isSelected && styles.calSelected,
                ]}
              >
                <Copy
                  size={13}
                  weight={700}
                  tint={isSelected ? color.white : disabled ? '#B6AFC4' : color.navy}
                >
                  {String(day)}
                </Copy>
              </ScalePressable>
            );
          })}
        </Row>
      ))}
    </Pile>
  );
}

const ALL_LECTURE_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '14:00', '15:00', '16:00',
];

function MobileLectureSlots({ selected, date, onSelect }: {
  selected: string; date: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.slotGrid}>
      {ALL_LECTURE_SLOTS.map((slot) => {
        const active = slot === selected;
        const instant = ammanInstant(date, slot);
        const arrive = new Date(instant.getTime() - 10 * 60000);
        return (
          <ScalePressable
            key={slot}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`Class ${formatTime(instant)}, arrives ${formatTime(arrive)}`}
            onPress={() => onSelect(slot)}
            style={[styles.slotCard, active && styles.slotCardActive]}
          >
            <Copy size={15} weight={800} tint={active ? color.white : color.navy}>
              {formatTime(instant)}
            </Copy>
            <Copy size={12} tint={active ? '#FFD1E8' : color.muted}>
              {`Gate ${formatTime(arrive)}`}
            </Copy>
          </ScalePressable>
        );
      })}
    </View>
  );
}

/** Legacy /suggestion route seamlessly redirects to the merged AI + Groups screen! */
export function Suggestion() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <Redirect href={{ pathname: '/matching', params: { requestId } }} />;
}

const prefBadge: Record<Pref, { label: string; tone: 'rose' | 'slate' | 'violet' }> = {
  girls_only: { label: 'Girls-only', tone: 'rose' },
  boys_only: { label: 'Boys-only', tone: 'violet' },
  any: { label: 'Mixed', tone: 'slate' },
};

function AnimatedAiCommuteHeader({ dep }: { dep: Departure | undefined }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dep) return;
    reveal.setValue(0);
    bar.setValue(0);
    Animated.sequence([
      Animated.timing(reveal, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(bar, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [dep?.request_id, reveal, bar]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const label = (
    <Row gap={6}>
      <Animated.View style={{ opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }}>
        <Sparkles size={14} color="#FF8AC4" />
      </Animated.View>
      <Copy size={12} weight={700} tint="#BFB2D6">AI departure</Copy>
    </Row>
  );

  if (!dep) {
    return (
      <View style={styles.aiCard}>
        {label}
        <Copy size={14} weight={600} tint="#E9E0F7" style={{ marginTop: 18 }}>Reading traffic on your route…</Copy>
        <View style={[styles.aiTrack, { marginTop: 14 }]}><View style={[styles.aiTrackFill, { width: '35%' }]} /></View>
      </View>
    );
  }

  const fallback = dep.travel_source === 'fallback';
  const confidence = fallback ? 84 : dep.peak_factor > 1 ? 92 : 95;
  const [clock, meridiem] = formatTime(dep.departure_at).split(' ');

  return (
    <View style={styles.aiCard}>
      <Row style={spread}>
        {label}
        <Row gap={6}>
          <PulseDot tint={fallback ? '#FBBF24' : '#34D399'} size={6} />
          <Copy size={12} weight={700} tint="#BFB2D6">{fallback ? 'Estimate' : `${confidence}% on time`}</Copy>
        </Row>
      </Row>
      <Animated.View style={{
        opacity: reveal,
        transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}>
        <Copy size={12} weight={700} tint="#BFB2D6" style={{ marginTop: 16 }}>LEAVE AT</Copy>
        <Row gap={6} style={{ alignItems: 'baseline' }}>
          <Copy size={56} weight={800} tint={color.white} style={styles.aiLeaveTime}>{clock}</Copy>
          <Copy size={20} weight={800} tint="#FF8AC4">{meridiem ?? ''}</Copy>
        </Row>
        <View style={[styles.aiTrack, { marginTop: 14 }]}>
          <Animated.View style={[styles.aiTrackFill, {
            width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <Row style={[spread, { marginTop: 10 }]}>
          <Copy size={12} tint="#BFB2D6">{`${dep.route_minutes} min ride`}</Copy>
          <Pile gap={0} style={{ alignItems: 'center' }}>
            <Copy size={14} weight={800} tint={color.white}>{formatTime(dep.arrival_at)}</Copy>
            <Copy size={12} tint="#BFB2D6">Gate</Copy>
          </Pile>
          <Pile gap={0} style={{ alignItems: 'flex-end' }}>
            <Copy size={14} weight={800} tint={color.white}>{formatTime(dep.class_start_at)}</Copy>
            <Copy size={12} tint="#BFB2D6">Lecture</Copy>
          </Pile>
        </Row>
      </Animated.View>
    </View>
  );
}

/**
 * Unified AI Expected Time + Gender-Isolated Groups Screen!
 * Shows multiple groups, clear Girls-only / Boys-only isolation tabs, and +30 pts Last-Seat Offer.
 */
export function Matching() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { profile } = useAuth();
  const ref = useRefData();
  const ownPref: Pref = profile?.gender === 'male' ? 'boys_only' : 'girls_only';

  const [result, setResult] = useState<SearchResult | null>(null);
  const [pools, setPools] = useState<IsolatedPoolItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dep = useLoad<Departure>(() => recommendDeparture(requestId), [requestId]);

  useEffect(() => {
    let live = true;
    setError('');
    Promise.all([searchGroups(requestId, ownPref), fetchIsolatedPools(requestId)]).then(([sRes, pRes]) => {
      if (!live) return;
      if (sRes.ok) setResult(sRes.data);
      else setError(errorCopy(sRes.code));
      if (pRes.ok) setPools(pRes.data.pools);
    });
    return () => { live = false; };
  }, [requestId, ownPref]);

  const request = dep.data;
  const campus = ref.campus(request?.campus_id);
  const pickup = ref.pickup(request?.pickup_area_id);

  const planParams = request ? {
    campusId: request.campus_id,
    pickupAreaId: request.pickup_area_id,
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(new Date(request.class_start_at)),
    classTime: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(request.class_start_at)),
  } : {};

  async function startNewGroup() {
    if (busy) return;
    setBusy(true);
    const res = await createGroup(requestId);
    setBusy(false);
    if (!res.ok) { setError(errorCopy(res.code)); return; }
    router.push({ pathname: '/group', params: { groupId: res.data.group_id, requestId } });
  }

  const openCandidate = useCallback((c: Candidate) => {
    router.push({ pathname: '/group', params: { groupId: c.group_id, requestId } });
  }, [requestId, router]);

  const candidates = useMemo(
    () => (result?.candidates ?? []).filter((c) => c.pref === ownPref),
    [result?.candidates, ownPref],
  );

  const candidateIds = useMemo(() => new Set(candidates.map((c) => c.group_id)), [candidates]);

  const otherSameGenderSlots = useMemo(
    () => pools.filter((p) => p.pref === ownPref && !candidateIds.has(p.group_id)),
    [pools, ownPref, candidateIds],
  );

  const prefLabel = ownPref === 'girls_only' ? 'Girls-only' : 'Boys-only';

  const switchToTime = (arrivalAt: string) => {
    const classDate = new Date(new Date(arrivalAt).getTime() + 10 * 60000);
    const hhmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(classDate);
    router.dismissTo({ pathname: '/plan', params: { ...planParams, classTime: hhmm } });
  };
  const [best, ...more] = candidates;

  return (
    <Page>
      <Header
        title="Groups"
        subtitle={pickup && campus ? `${pickup.name} → ${campus.code} · ${prefLabel}` : prefLabel}
        onBack={() => router.dismissTo({ pathname: '/plan', params: planParams })}
      />

      <AnimatedAiCommuteHeader dep={request} />

      {!!error && (
        <Notice icon={Info} tint={color.danger} style={{ backgroundColor: color.dangerSoft, marginTop: 14 }}>
          {error}
        </Notice>
      )}

      {!result && !error && (
        <Row gap={8} style={{ marginTop: 28 }}>
          <PulseDot tint={color.brand} size={8} />
          <Copy size={14} weight={600} tint={color.muted}>Finding groups…</Copy>
        </Row>
      )}

      {best && (
        <>
          <SectionLabel>Best match</SectionLabel>
          <FadeIn index={0}>
            <GroupTile
              time={formatTime(best.pickup_at)}
              caption={`Gate ${formatTime(best.arrival_at)}`}
              price={formatFils(best.fare_fils)}
              taken={best.seats_taken}
              capacity={best.capacity}
              highlight
              onPress={() => openCandidate(best)}
            />
          </FadeIn>
        </>
      )}

      {more.length > 0 && (
        <>
          <SectionLabel>More groups</SectionLabel>
          <Pile gap={10}>
            {more.map((c, i) => (
              <FadeIn key={c.group_id} index={i + 1}>
                <GroupTile
                  time={formatTime(c.pickup_at)}
                  caption={`Gate ${formatTime(c.arrival_at)}`}
                  price={formatFils(c.fare_fils)}
                  taken={c.seats_taken}
                  capacity={c.capacity}
                  onPress={() => openCandidate(c)}
                />
              </FadeIn>
            ))}
          </Pile>
        </>
      )}

      {result && (
        <ScalePressable
          accessibilityLabel="Start a new group"
          onPress={startNewGroup}
          disabled={busy}
          style={styles.newGroupTile}
        >
          <Plus size={18} color={color.brand} />
          <Copy size={15} weight={800} tint={color.brand}>{busy ? 'Starting…' : 'Start a new group'}</Copy>
        </ScalePressable>
      )}

      {otherSameGenderSlots.length > 0 && (
        <>
          <SectionLabel>Other times</SectionLabel>
          <Pile gap={10}>
            {otherSameGenderSlots.slice(0, 4).map((item) => (
              <GroupTile
                key={item.group_id}
                time={`Gate ${formatTime(item.arrival_at)}`}
                caption={`Leaves ${formatTime(item.departure_at)}`}
                taken={item.seats_taken}
                capacity={item.capacity}
                onPress={() => switchToTime(item.arrival_at)}
              />
            ))}
          </Pile>
        </>
      )}
    </Page>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Copy accessibilityRole="header" size={12} weight={800} tint={color.muted} style={styles.sectionLabel}>
      {children.toUpperCase()}
    </Copy>
  );
}

/** One group, same layout everywhere: time + price on top, seats underneath, last-seat strip if it applies. */
function GroupTile({ time, caption, price, taken, capacity, highlight = false, onPress }: {
  time: string; caption: string; price?: string; taken: number; capacity: number;
  highlight?: boolean; onPress: () => void;
}) {
  const open = capacity - taken;
  const lastSeat = open === 1;
  return (
    <ScalePressable
      accessibilityLabel={`${time}, ${caption}, ${taken} of ${capacity} seats${price ? `, ${price}` : ''}${lastSeat ? ', last seat, plus 30 points' : ''}`}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.groupTile, highlight && styles.groupTileOn]}
    >
      <View style={styles.groupTileBody}>
        <Row style={spread}>
          <Pile gap={1}>
            <Copy size={22} weight={800} tint={color.navy} style={{ letterSpacing: -0.6 }}>{time}</Copy>
            <Copy size={13} tint={color.muted}>{caption}</Copy>
          </Pile>
          {price ? (
            <Copy size={20} weight={800} tint={highlight ? color.brand : color.navy}>{price}</Copy>
          ) : (
            <ChevronRight size={20} color={color.muted} />
          )}
        </Row>
        <Row style={[spread, { marginTop: 14 }]}>
          <Row gap={6}>
            {Array.from({ length: capacity }, (_, i) => (
              <View key={i} style={[styles.seatPip, i < taken && styles.seatPipOn]} />
            ))}
          </Row>
          <Copy size={13} weight={700} tint={color.muted}>
            {open === capacity ? 'Empty' : `${taken}/${capacity} seats`}
          </Copy>
        </Row>
      </View>
      {lastSeat && (
        <Row gap={6} style={styles.groupTileStrip}>
          <Flame size={14} color={color.brand} />
          <Copy size={13} weight={800} tint={color.brand}>Last seat · +30 pts</Copy>
        </Row>
      )}
    </ScalePressable>
  );
}

/** Staggered fade-and-rise for list rows. */
function FadeIn({ index, children }: { index: number; children: ReactNode }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 300, delay: 120 + index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter, index]);
  return (
    <Animated.View style={{
      opacity: enter,
      transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
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
        <Header title="Your group" onBack={back} />
        <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <PulseDot tint={color.brand} size={8} />
          <Copy tint={code ? color.danger : color.muted}>{code ? errorCopy(code) : 'Loading group & fare breakdown…'}</Copy>
        </Card>
      </Page>
    );
  }

  if (data.pref === 'any') {
    return (
      <Page>
        <Header title="Your group" onBack={back} />
        <Notice icon={Info} tint={color.danger} style={{ backgroundColor: color.dangerSoft }}>
          Mixed groups are disabled. Only gender-isolated cars are offered.
        </Notice>
        <Button tone="secondary" onPress={back}>Back to groups</Button>
      </Page>
    );
  }

  const badge = prefBadge[data.pref];
  const pickupName = ref.pickup(data.pickup_area_id)?.name ?? 'Pickup';
  const left = data.capacity - data.seats_taken;
  const isLastSeat = left === 1;
  const campus = ref.campus(data.campus_id);

  const mapPoints: MapPoint[] = [];
  for (const stop of data.stops) {
    const area = ref.pickupAreas.find((item) => item.name === stop);
    if (!area) continue;
    mapPoints.push({
      lat: area.lat,
      lng: area.lng,
      label: area.name,
      kind: isHotspot(area.id) ? 'hotspot' : 'stop',
    });
  }
  if (campus) mapPoints.push({ lat: campus.lat, lng: campus.lng, label: campus.code, kind: 'campus' });

  const locked = data.locked_seats ?? [];
  const lockedSum = locked.reduce((sum, seat) => sum + Number(seat.fare_fils), 0);
  const youFare = Number(data.fare_fils);
  const openRemainder = data.group_fare_fils - lockedSum - youFare;
  const youKm = data.your_gate ? Number(data.your_gate.km) : null;
  const cutoff = new Date(new Date(data.pickup_at).getTime() - 12 * 60 * 60 * 1000);
  const freeCancel = cutoff.getTime() > Date.now();
  const confidence = data.travel_source === 'fallback' ? 84 : 92;

  return (
    <Page
      footer={
        <Row gap={14}>
          <Pile gap={0}>
            <Copy size={22} weight={800} tint={color.navy}>{formatFils(data.fare_fils)}</Copy>
            <Copy size={12} tint={isLastSeat ? color.brand : color.muted} weight={isLastSeat ? 700 : 400}>
              {isLastSeat ? '+30 pts' : 'your seat'}
            </Copy>
          </Pile>
          <Button
            onPress={() => router.push({
              pathname: '/summary',
              params: {
                groupId: data.group_id,
                requestId,
                routeVersion: String(data.route_version),
                pickupAreaId: data.pickup_area_id,
              },
            })}
            disabled={data.full || data.over_cap}
            trailingArrow
            style={fill}
          >
            {isLastSeat ? 'Take the last seat' : 'Book seat'}
          </Button>
        </Row>
      }
    >
      <Header
        title="Your group"
        subtitle={`${formatDate(data.departure_at)} · ${badge.label}`}
        onBack={back}
      />

      {/* Trip: pickup → campus gate */}
      <View style={styles.tripCard}>
        <Row style={spread}>
          <Copy size={12} weight={700} tint={color.muted}>{`${data.route_minutes ?? ''}${data.route_minutes ? ' min ride' : 'Trip'}`}</Copy>
          <Row gap={6}>
            <PulseDot tint={color.emerald} size={6} />
            <Copy size={12} weight={700} tint={color.navy}>{`${confidence}% on time`}</Copy>
          </Row>
        </Row>
        <Row gap={12} style={{ marginTop: 14 }}>
          <View style={styles.tripRail}>
            <View style={styles.tripDotFrom} />
            <View style={styles.tripLine} />
            <View style={styles.tripDotTo} />
          </View>
          <Pile gap={18} style={fill}>
            <Row style={spread}>
              <Pile gap={0} style={fill}>
                <Copy size={16} weight={800} tint={color.navy} numberOfLines={1}>{pickupName}</Copy>
                <Copy size={12} tint={color.muted}>Pickup</Copy>
              </Pile>
              <Copy size={20} weight={800} tint={color.navy}>{formatTime(data.pickup_at)}</Copy>
            </Row>
            <Row style={spread}>
              <Pile gap={0} style={fill}>
                <Copy size={16} weight={800} tint={color.navy} numberOfLines={1}>{campus?.code ?? 'Campus'}</Copy>
                <Copy size={12} tint={color.muted}>Gate</Copy>
              </Pile>
              <Copy size={20} weight={800} tint={color.muted}>{formatTime(data.arrival_at)}</Copy>
            </Row>
          </Pile>
        </Row>
      </View>

      {/* Seats */}
      <Row style={[spread, { marginTop: 22 }]}>
        <Copy accessibilityRole="header" size={16} weight={800} tint={color.navy}>Riders</Copy>
        <Copy size={13} weight={700} tint={color.muted}>{`${data.seats_taken}/${data.capacity}`}</Copy>
      </Row>
      <Row style={styles.seatRow}>
        {Array.from({ length: data.capacity }, (_, i) => {
          const member = data.members[i];
          const isYou = !member && i === data.members.length && left > 0;
          return (
            <Pile key={i} gap={6} style={styles.seat}>
              {member ? (
                <View>
                  <Avatar name={member.first_name[0]} index={i} size={48} />
                  {member.verified && (
                    <View style={styles.seatCheck}><BadgeCheck size={14} color={color.emerald} /></View>
                  )}
                </View>
              ) : (
                <View style={[styles.emptySeat, isYou && styles.youSeat]}>
                  {isYou ? <UserPlus size={20} color={color.brand} /> : null}
                </View>
              )}
              <Copy size={12} weight={isYou ? 800 : 600} tint={isYou ? color.brand : member ? color.navy : color.muted} numberOfLines={1}>
                {member ? member.first_name : isYou ? 'You' : 'Open'}
              </Copy>
            </Pile>
          );
        })}
      </Row>
      {isLastSeat && (
        <Row gap={6} style={styles.lastSeatNote}>
          <Flame size={14} color={color.brand} />
          <Copy size={12} weight={700} tint={color.brand}>Last seat sends the car and earns you +30 pts</Copy>
        </Row>
      )}

      {mapPoints.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <RideMap points={mapPoints} polyline={campus?.corridor_polyline} height={170} numbered />
        </View>
      )}

      {/* Fare split by distance */}
      <Row style={[spread, { marginTop: 22 }]}>
        <Copy accessibilityRole="header" size={16} weight={800} tint={color.navy}>Fare split</Copy>
        <Copy size={13} weight={700} tint={color.muted}>by distance</Copy>
      </Row>
      <View style={styles.fareList}>
        {locked.map((seat, idx) => (
          <Row key={`${seat.first_name}-${idx}`} style={[spread, styles.fareRow]}>
            <Copy size={14} tint={color.navy} style={fill} numberOfLines={1}>{seat.first_name}</Copy>
            <Copy size={12} tint={color.muted} style={{ marginRight: 12 }}>{`${Number(seat.km).toFixed(1)} km`}</Copy>
            <Copy size={14} weight={700} tint={color.navy}>{formatFils(Number(seat.fare_fils))}</Copy>
          </Row>
        ))}
        <Row style={[spread, styles.fareRow, styles.fareYou]}>
          <Copy size={14} weight={800} tint={color.brand} style={fill}>You</Copy>
          {youKm != null && <Copy size={12} tint={color.brand} style={{ marginRight: 12 }}>{`${youKm.toFixed(1)} km`}</Copy>}
          <Copy size={14} weight={800} tint={color.brand}>{formatFils(youFare)}</Copy>
        </Row>
        {openRemainder > 0 && (
          <Row style={[spread, styles.fareRow]}>
            <Copy size={14} tint={color.muted} style={fill}>Open seats</Copy>
            <Copy size={14} tint={color.muted}>{formatFils(openRemainder)}</Copy>
          </Row>
        )}
        <Row style={[spread, styles.fareRow, { borderBottomWidth: 0 }]}>
          <Copy size={14} weight={700} tint={color.navy} style={fill}>Car total</Copy>
          <Copy size={14} weight={800} tint={color.navy}>{formatFils(data.group_fare_fils)}</Copy>
        </Row>
      </View>

      <Row gap={8} style={{ marginTop: 16 }}>
        <ShieldCheck size={16} color={freeCancel ? color.emerald : color.amber} />
        <Copy size={13} tint={color.muted} style={fill}>
          {freeCancel
            ? `Free cancel until ${formatDate(cutoff)}, ${formatTime(cutoff)}`
            : 'Seat locked — under 12h to pickup'}
        </Copy>
      </Row>
    </Page>
  );
}

function slotStat(stats: DemandStat[] | null | undefined, classTime: string) {
  if (!stats) return undefined;
  const [hour, minute] = classTime.split(':').map(Number);
  const total = hour * 60 + minute - 10;
  const key = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return stats.find((stat) => stat.stat_type === 'class_slot' && stat.entity_key === key);
}

export function RouteTitle({ light = false, marginTop = 10, pickup, destination }: {
  light?: boolean; marginTop?: number; pickup: string; destination: string;
}) {
  const tint = light ? color.white : color.navy;
  return (
    <Row gap={8} style={{ marginTop, marginBottom: 4, flexWrap: 'wrap' }}>
      <Copy size={17} weight={800} tint={tint}>{pickup}</Copy>
      <ArrowRight size={18} color={light ? '#FF8AC4' : color.brand} />
      <Copy size={17} weight={800} tint={tint}>{destination}</Copy>
    </Row>
  );
}

const styles = StyleSheet.create({
  tripCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.line,
    ...shadow(6, 18, '#271C3A10'),
  },
  tripRail: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 11 },
  tripDotFrom: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: color.brand, backgroundColor: color.white },
  tripLine: { width: 2, flex: 1, backgroundColor: color.line, marginVertical: 4 },
  tripDotTo: { width: 12, height: 12, borderRadius: 3, backgroundColor: color.navy },
  seatRow: { marginTop: 12, justifyContent: 'space-between' },
  seat: { flex: 1, alignItems: 'center' },
  seatCheck: {
    position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10,
    backgroundColor: color.white, alignItems: 'center', justifyContent: 'center',
  },
  emptySeat: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: color.line, alignItems: 'center', justifyContent: 'center',
  },
  youSeat: { borderColor: color.brand, backgroundColor: color.pink },
  lastSeatNote: {
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: color.pink,
  },
  fareList: {
    marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: color.line, paddingHorizontal: 14,
    backgroundColor: color.white,
  },
  fareRow: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: color.line },
  fareYou: { },
  sourceChip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  sourceChipActive: {
    borderColor: color.brand,
    backgroundColor: '#FFF5FA',
  },
  dayStrip: { gap: 8, paddingVertical: 4 },
  dayPill: {
    width: 66,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayPillSelected: {
    backgroundColor: color.navy,
    borderColor: color.navy,
  },
  timeStrip: { gap: 8, paddingVertical: 4 },
  timeChip: {
    minWidth: 102,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: color.pink,
    borderWidth: 1,
    borderColor: color.pinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  timeChipOn: {
    backgroundColor: color.brand,
    borderColor: color.brand,
  },
  arrivalPreviewCard: {
    marginTop: 14,
    backgroundColor: '#FAF7FC',
    borderColor: color.line,
  },
  calCell: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calWeekend: {
    backgroundColor: '#F4EFF7',
    opacity: 0.55,
  },
  calSelected: {
    backgroundColor: color.brand,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotCard: {
    width: '31%',
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  slotCardActive: {
    backgroundColor: color.brand,
    borderColor: color.brand,
  },
  aiCard: {
    backgroundColor: color.navy,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#3E2D59',
    ...shadow(10, 24, '#271C3A29'),
  },
  sectionLabel: { marginTop: 26, marginBottom: 10, letterSpacing: 0.8 },
  groupTile: {
    borderRadius: 20, backgroundColor: color.white, borderWidth: 1, borderColor: color.line, overflow: 'hidden',
  },
  groupTileOn: { borderWidth: 2, borderColor: color.brand, ...shadow(8, 20, '#E9007618') },
  groupTileBody: { padding: 16 },
  groupTileStrip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: color.pink },
  seatPip: { width: 22, height: 8, borderRadius: 4, backgroundColor: color.line },
  seatPipOn: { backgroundColor: color.brand },
  newGroupTile: {
    marginTop: 12, minHeight: 56, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: color.pinkBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  aiLeaveTime: { letterSpacing: -2.5, lineHeight: 62 },
  aiTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#43325E',
    overflow: 'hidden',
  },
  aiTrackFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: color.brand,
  },
});
