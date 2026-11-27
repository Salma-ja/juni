import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Building2, Check, Flame, GraduationCap, House, LocateFixed, MapPin, Navigation, Search, Sparkles, X,
} from 'lucide-react-native';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { RideMap } from '@/components/RideMap';
import {
  Badge, BottomSheet, Button, Card, Copy, fill, Notice, Pile, PulseDot, Row, ScalePressable, spread, Tile,
} from '@/components/ui';
import {
  demandStats, saveCustomLocation, setDefaultPickup,
  type Campus, type Corridor, type DemandStat, type PickupArea,
} from '@/data/api';
import { roadKm } from '@/data/fareStrip.mjs';
import { upsertCachedPickupArea, useRefData } from '@/data/refdata';
import { useLoad } from '@/data/useLoad';
import { useAuth } from '@/features/authSession';
import { isHotspot } from '@/features/places';
import { color, radius } from '@/theme';

const STORAGE_KEY = 'juni.location.v3';

type StoredLoc = {
  pickupId: string;
  campusId: string;
  streetNote: string;
};

type SheetMode = 'pin' | 'gates';

type LocationContextValue = {
  pickupId: string;
  campusId: string;
  streetNote: string;
  pickup: PickupArea | undefined;
  campus: Campus | undefined;
  locatingGps: boolean;
  gpsStatus: string;
  setPickupId: (id: string) => void;
  setCampusId: (id: string) => void;
  setStreetNote: (note: string) => void;
  detectCurrentLocation: (customDetail?: string) => Promise<PickupArea | null>;
  saveHomePin: (opts: { lat: number; lng: number; name: string; detail: string; kind: 'current_gps' | 'custom_home' }) => Promise<PickupArea | null>;
  openAddressSheet: (mode?: SheetMode) => void;
  openCampusSheet: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

/** Realistic residential coordinates inside Jordan corridors when simulator/browser GPS is unavailable or outside Jordan. */
function defaultHomeCoordsForCorridor(corridor?: Corridor) {
  if (corridor === 'amman') {
    return { lat: 32.0236, lng: 35.8568, areaHint: 'Al-Jubaiha Residential St' };
  }
  return { lat: 32.5486, lng: 35.8642, areaHint: 'Al-Rabieh Home Neighborhood' };
}

function readDeviceGps(): Promise<{ lat: number; lng: number; exact: boolean }> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      resolve({ lat: NaN, lng: NaN, exact: false });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ lat: NaN, lng: NaN, exact: false });
      }
    }, 3200);

    geo.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          exact: true,
        });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ lat: NaN, lng: NaN, exact: false });
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 },
    );
  });
}

function isInsideJordan(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 29.0 && lat <= 33.5 && lng >= 34.8 && lng <= 39.5;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const ref = useRefData();
  const [pickupId, setPickupState] = useState<string>('hawara');
  const [campusId, setCampusState] = useState<string>('just');
  const [streetNote, setStreetNoteState] = useState<string>('');
  const [activeSheet, setActiveSheet] = useState<'address' | 'campus' | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>('pin');
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!live) return;
      if (profile?.defaultPickupId) {
        setPickupState(profile.defaultPickupId);
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<StoredLoc>;
          if (parsed.pickupId && !profile?.defaultPickupId) setPickupState(parsed.pickupId);
          if (parsed.campusId) setCampusState(parsed.campusId);
          if (typeof parsed.streetNote === 'string') setStreetNoteState(parsed.streetNote);
        } catch {
          /* ignore corrupt local pref */
        }
      }
    });
    return () => { live = false; };
  }, [profile?.defaultPickupId]);

  const persist = useCallback((next: Partial<StoredLoc>) => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      let prev: Partial<StoredLoc> = {};
      try { prev = raw ? JSON.parse(raw) : {}; } catch { prev = {}; }
      const merged = { pickupId, campusId, streetNote, ...prev, ...next };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
    }).catch(() => {});
  }, [pickupId, campusId, streetNote]);

  const setPickupId = useCallback((id: string) => {
    setPickupState(id);
    persist({ pickupId: id });
    if (profile) {
      setDefaultPickup(id).catch(() => {});
    }
  }, [persist, profile]);

  const setCampusId = useCallback((id: string) => {
    setCampusState(id);
    const nextCampus = ref.campus(id);
    const curPickup = ref.pickup(pickupId);
    if (nextCampus?.corridor && curPickup?.corridor && !curPickup.is_custom && nextCampus.corridor !== curPickup.corridor) {
      const matchingGate = nextCampus.corridor === 'amman' ? 'sweileh' : 'hawara';
      if (ref.pickup(matchingGate)) {
        setPickupState(matchingGate);
        persist({ campusId: id, pickupId: matchingGate });
        if (profile) setDefaultPickup(matchingGate).catch(() => {});
        return;
      }
    }
    persist({ campusId: id });
  }, [persist, pickupId, profile, ref]);

  const setStreetNote = useCallback((note: string) => {
    setStreetNoteState(note);
    persist({ streetNote: note });
  }, [persist]);

  const campus = ref.campus(campusId) ?? ref.campuses[0];
  const pickup = ref.pickup(pickupId) ?? ref.pickupAreas[0];

  const saveHomePin = useCallback(async (opts: {
    lat: number; lng: number; name: string; detail: string; kind: 'current_gps' | 'custom_home';
  }): Promise<PickupArea | null> => {
    const res = await saveCustomLocation(opts);
    if (!res.ok) {
      setGpsStatus(res.message);
      return null;
    }
    upsertCachedPickupArea(res.data);
    setPickupState(res.data.id);
    if (opts.detail) setStreetNoteState(opts.detail);
    persist({ pickupId: res.data.id, streetNote: opts.detail });
    return res.data;
  }, [persist]);

  const detectCurrentLocation = useCallback(async (customDetail?: string): Promise<PickupArea | null> => {
    if (locatingGps) return null;
    setLocatingGps(true);
    setGpsStatus('Locking onto your current GPS location…');
    try {
      const raw = await readDeviceGps();
      const fallback = defaultHomeCoordsForCorridor(campus?.corridor);
      const useReal = raw.exact && isInsideJordan(raw.lat, raw.lng);
      const lat = useReal ? raw.lat : fallback.lat;
      const lng = useReal ? raw.lng : fallback.lng;
      const detailText = customDetail?.trim()
        || streetNote.trim()
        || (useReal ? 'Live GPS doorstep pickup' : fallback.areaHint);

      const saved = await saveHomePin({
        lat,
        lng,
        name: 'My Current Location',
        detail: detailText,
        kind: 'current_gps',
      });
      if (saved) {
        setGpsStatus(
          useReal
            ? `GPS locked · ${saved.detail}`
            : `Home GPS ready (${saved.detail}) · Tap map anytime to adjust pin`,
        );
      }
      return saved;
    } finally {
      setLocatingGps(false);
    }
  }, [campus?.corridor, locatingGps, saveHomePin, streetNote]);

  const openAddressSheet = useCallback((mode: SheetMode = 'pin') => {
    setSheetMode(mode);
    setActiveSheet('address');
  }, []);

  const value = useMemo<LocationContextValue>(() => ({
    pickupId: pickup?.id ?? pickupId,
    campusId: campus?.id ?? campusId,
    streetNote,
    pickup,
    campus,
    locatingGps,
    gpsStatus,
    setPickupId,
    setCampusId,
    setStreetNote,
    detectCurrentLocation,
    saveHomePin,
    openAddressSheet,
    openCampusSheet: () => setActiveSheet('campus'),
  }), [
    pickup, pickupId, campus, campusId, streetNote, locatingGps, gpsStatus,
    setPickupId, setCampusId, setStreetNote, detectCurrentLocation, saveHomePin, openAddressSheet,
  ]);

  return (
    <LocationContext.Provider value={value}>
      {children}
      {activeSheet === 'address' && (
        <AddressPickerSheet
          initialMode={sheetMode}
          selectedId={value.pickupId}
          currentPickup={pickup}
          campus={campus}
          streetNote={streetNote}
          onChangeStreetNote={setStreetNote}
          onDetectGps={async (note) => {
            const saved = await detectCurrentLocation(note);
            if (saved) setActiveSheet(null);
          }}
          onSaveCustomPin={async (opts) => {
            const saved = await saveHomePin(opts);
            if (saved) setActiveSheet(null);
          }}
          locatingGps={locatingGps}
          onSelect={(id) => {
            setPickupId(id);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'campus' && (
        <CampusPickerSheet
          selectedId={value.campusId}
          onSelect={(id) => {
            setCampusId(id);
            setActiveSheet(null);
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
    </LocationContext.Provider>
  );
}

export function useLocationPref() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('LocationProvider is required');
  return ctx;
}

const HOME_NEIGHBORHOOD_PRESETS: Record<Corridor, { label: string; lat: number; lng: number; detail: string }[]> = {
  irbid: [
    { label: 'Al-Rabieh Home', lat: 32.5486, lng: 35.8642, detail: 'Al-Rabieh residential st' },
    { label: 'Eastern District', lat: 32.5562, lng: 35.8785, detail: 'Al-Hay Al-Sharqi home block' },
    { label: 'South Yarmouk Homes', lat: 32.5295, lng: 35.8590, detail: 'Shafiq Irshaidat st' },
    { label: 'Aidoun Villas', lat: 32.5155, lng: 35.8625, detail: 'Aidoun residential lane' },
  ],
  amman: [
    { label: 'Jubaiha Homes', lat: 32.0236, lng: 35.8568, detail: 'Al-Jubaiha residential st' },
    { label: 'Tla’ Al-Ali', lat: 31.9995, lng: 35.8565, detail: 'Tla’ Al-Ali home block' },
    { label: 'Sweileh West', lat: 32.0312, lng: 35.8320, detail: 'Sweileh Al-Kamaliya st' },
    { label: 'Abu Nsair', lat: 32.0540, lng: 35.8690, detail: 'Abu Nsair phase 2 homes' },
  ],
};

const LABEL_PRESETS = ['My Home', 'My Current Location', 'Student Dorm', 'Family House'] as const;

const GateRow = memo(function GateRow({
  item, selected, km, demandCount, highlighted, onPress,
}: {
  item: PickupArea; selected: boolean; km: number | null; demandCount: number; highlighted: boolean; onPress: () => void;
}) {
  const isCustom = Boolean(item.is_custom);
  const Icon = item.location_kind === 'current_gps'
    ? LocateFixed
    : isCustom
      ? House
      : highlighted
        ? Flame
        : MapPin;

  return (
    <ScalePressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${item.name}, ${item.detail}`}
      onPress={onPress}
      style={[styles.optionCard, selected && styles.optionSelected]}
    >
      <Tile
        icon={Icon}
        size={44}
        iconSize={20}
        background={selected ? color.brand : isCustom ? '#EDE9FE' : color.pink}
        tint={selected ? color.white : isCustom ? color.violet : color.brand}
      />
      <Pile gap={3} style={fill}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Copy size={15} weight={800} tint={color.navy}>
            {item.name_ar ? `${item.name} · ${item.name_ar}` : item.name}
          </Copy>
          {isCustom ? (
            <Badge tone="violet">{item.location_kind === 'current_gps' ? 'Live GPS' : 'Home Pin'}</Badge>
          ) : highlighted ? (
            <Badge tone="brand">{demandCount > 0 ? `Hotspot · ${demandCount}` : 'Hotspot'}</Badge>
          ) : null}
        </Row>
        <Copy size={12} tint={color.muted}>
          {item.gate_landmark_en || item.detail}
          {km != null ? ` · ${km.toFixed(1)} km` : ''}
        </Copy>
      </Pile>
      {selected ? (
        <View style={styles.checkCircle}><Check size={16} color={color.white} /></View>
      ) : (
        <Badge tone="slate">{item.corridor === 'amman' ? 'Amman' : 'Irbid'}</Badge>
      )}
    </ScalePressable>
  );
});

export function AddressPickerSheet({
  initialMode = 'pin',
  selectedId,
  currentPickup,
  campus,
  streetNote = '',
  onChangeStreetNote,
  onDetectGps,
  onSaveCustomPin,
  locatingGps = false,
  onSelect,
  onClose,
}: {
  initialMode?: SheetMode;
  selectedId: string | null;
  currentPickup?: PickupArea;
  campus?: Campus;
  streetNote?: string;
  onChangeStreetNote?: (v: string) => void;
  onDetectGps?: (note?: string) => Promise<void>;
  onSaveCustomPin?: (opts: { lat: number; lng: number; name: string; detail: string; kind: 'current_gps' | 'custom_home' }) => Promise<void>;
  locatingGps?: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRefData();
  const demand = useLoad(() => demandStats(), []);
  const activeCorridor: Corridor = campus?.corridor ?? 'irbid';
  const defHome = defaultHomeCoordsForCorridor(activeCorridor);

  const [mode, setMode] = useState<SheetMode>(initialMode);
  const [pinLat, setPinLat] = useState<number>(currentPickup?.lat ?? defHome.lat);
  const [pinLng, setPinLng] = useState<number>(currentPickup?.lng ?? defHome.lng);
  const [pinLabel, setPinLabel] = useState<string>(
    currentPickup?.is_custom ? currentPickup.name : 'My Home',
  );
  const [noteDraft, setNoteDraft] = useState<string>(streetNote);
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  const [query, setQuery] = useState('');
  const [corridorFilter, setCorridorFilter] = useState<'all' | Corridor>(campus?.corridor ?? 'all');

  const liveKm = campus ? roadKm({ lat: pinLat, lng: pinLng }, campus) : null;
  const estSeatJd = liveKm != null
    ? ((Math.min(6000, Math.round((3000 + 200 * liveKm) / 10) * 10) / 4) / 1000).toFixed(2)
    : null;

  async function handleSavePin() {
    if (!onSaveCustomPin || savingPin) return;
    setSavingPin(true);
    setPinError('');
    try {
      await onSaveCustomPin({
        lat: pinLat,
        lng: pinLng,
        name: pinLabel.trim() || 'My Home',
        detail: noteDraft.trim() || 'Doorstep home pickup',
        kind: pinLabel === 'My Current Location' ? 'current_gps' : 'custom_home',
      });
    } catch {
      setPinError('Could not save location. Try again.');
    } finally {
      setSavingPin(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ref.pickupAreas.filter((area) => {
      if (corridorFilter !== 'all' && !area.is_custom && area.corridor && area.corridor !== corridorFilter) return false;
      if (!q) return true;
      return (
        area.name.toLowerCase().includes(q) ||
        area.detail.toLowerCase().includes(q) ||
        (area.name_ar ?? '').includes(q) ||
        (area.gate_landmark_en ?? '').toLowerCase().includes(q)
      );
    });
  }, [ref.pickupAreas, corridorFilter, query]);

  const keyExtractor = useCallback((item: PickupArea) => item.id, []);
  const renderItem = useCallback(({ item }: { item: PickupArea }) => {
    const stat = demand.data?.find((s: DemandStat) => s.stat_type === 'pickup_area' && s.entity_key === item.id);
    const highlighted = Boolean(!item.is_custom && (stat?.is_highlighted || isHotspot(item.id)));
    const km = campus ? roadKm(item, campus) : null;
    return (
      <GateRow
        item={item}
        selected={item.id === selectedId}
        km={km}
        demandCount={stat?.rider_count ?? 0}
        highlighted={highlighted}
        onPress={() => {
          onChangeStreetNote?.(noteDraft.trim());
          onSelect(item.id);
        }}
      />
    );
  }, [campus, demand.data, noteDraft, onChangeStreetNote, onSelect, selectedId]);

  return (
    <BottomSheet onClose={onClose}>
      <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy}>Pickup location</Copy>

      {/* Top Mode Switcher: Home / Current GPS vs Shared Gates */}
      <Row gap={6} style={styles.modeTabs}>
        <ScalePressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'pin' }}
          onPress={() => setMode('pin')}
          style={[styles.modeTab, mode === 'pin' && styles.modeTabActive]}
        >
          <Row gap={6}>
            <House size={15} color={mode === 'pin' ? color.white : color.navy} />
            <Copy size={13} weight={800} tint={mode === 'pin' ? color.white : color.navy}>
              Home pin
            </Copy>
          </Row>
        </ScalePressable>
        <ScalePressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'gates' }}
          onPress={() => setMode('gates')}
          style={[styles.modeTab, mode === 'gates' && styles.modeTabActive]}
        >
          <Row gap={6}>
            <MapPin size={15} color={mode === 'gates' ? color.white : color.navy} />
            <Copy size={13} weight={800} tint={mode === 'gates' ? color.white : color.navy}>
              Corridor Gates
            </Copy>
          </Row>
        </ScalePressable>
      </Row>

      {mode === 'pin' ? (
        <Pile gap={12}>
          {/* 1-Tap Live Current GPS Card */}
          {onDetectGps && (
            <ScalePressable
              accessibilityLabel="Use my current GPS location now"
              disabled={locatingGps}
              onPress={() => onDetectGps(noteDraft)}
              style={styles.gpsActionCard}
            >
              <View style={styles.gpsIconWrap}>
                <LocateFixed size={22} color={color.white} />
              </View>
              <Pile gap={2} style={fill}>
                <Row gap={6}>
                  {locatingGps && <PulseDot tint={color.brand} size={7} />}
                  <Copy size={15} weight={800} tint={color.navy}>
                    {locatingGps ? 'Detecting live GPS signal…' : 'Use my current location'}
                  </Copy>
                </Row>
              </Pile>
            </ScalePressable>
          )}

          {/* Interactive Tap-to-Pin Street Map */}
          <RideMap
            height={195}
            points={[{
              lat: pinLat,
              lng: pinLng,
              label: pinLabel || 'My Home',
              kind: pinLabel === 'My Current Location' ? 'gps' : 'home',
            }]}
            onPickCoordinate={({ lat, lng }) => {
              setPinLat(lat);
              setPinLng(lng);
            }}
          />

          {/* Quick Residential Neighborhood Jump Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {HOME_NEIGHBORHOOD_PRESETS[activeCorridor].map((preset) => (
              <ScalePressable
                key={preset.label}
                accessibilityLabel={`Jump map to ${preset.label}`}
                onPress={() => {
                  setPinLat(preset.lat);
                  setPinLng(preset.lng);
                  if (!noteDraft) setNoteDraft(preset.detail);
                }}
                style={styles.neighborhoodChip}
              >
                <MapPin size={13} color={color.brand} />
                <Copy size={12} weight={700} tint={color.navy}>{preset.label}</Copy>
              </ScalePressable>
            ))}
          </ScrollView>

          {/* Live Distance & Estimated Group Seat Fare Strip */}
          <Card style={styles.liveQuoteBar}>
            <Row style={spread}>
              <Row gap={8}>
                <Sparkles size={16} color={color.brand} />
                <Copy size={13} weight={800} tint={color.navy}>
                  {liveKm != null ? `${liveKm.toFixed(1)} km to ${campus?.code ?? 'Campus'}` : 'Custom pin selected'}
                </Copy>
              </Row>
              {estSeatJd && (
                <Badge tone="green">{`Est. ~${estSeatJd} JD / seat`}</Badge>
              )}
            </Row>
          </Card>

          {/* Label Preset Chips + Custom Name & Building/Street Input */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {LABEL_PRESETS.map((lbl) => {
              const active = pinLabel === lbl;
              return (
                <ScalePressable
                  key={lbl}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setPinLabel(lbl)}
                  style={[styles.labelChip, active && styles.labelChipActive]}
                >
                  <Copy size={12} weight={700} tint={active ? color.white : color.navy}>{lbl}</Copy>
                </ScalePressable>
              );
            })}
          </ScrollView>

          <Row gap={8} style={styles.searchBar}>
            <House size={17} color={color.brand} />
            <TextInput
              allowFontScaling
              value={pinLabel}
              onChangeText={setPinLabel}
              placeholder="Location name (e.g. My Home, Villa 8)"
              placeholderTextColor="#958DA6"
              style={styles.searchInput}
            />
          </Row>

          <Row gap={8} style={styles.noteInputWrap}>
            <Building2 size={17} color={color.brand} />
            <TextInput
              allowFontScaling
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Street, building, or landmark for your captain…"
              placeholderTextColor="#958DA6"
              style={styles.searchInput}
            />
          </Row>

          {!!pinError && (
            <Notice icon={Navigation} tint={color.danger} style={{ backgroundColor: color.dangerSoft }}>
              {pinError}
            </Notice>
          )}

          <Button icon={Check} disabled={savingPin} onPress={handleSavePin} trailingArrow>
            {savingPin ? 'Saving home location…' : `Confirm ${pinLabel || 'Home'} pickup`}
          </Button>
        </Pile>
      ) : (
        <Pile gap={10}>
          <Row gap={8} style={styles.searchBar}>
            <Search size={18} color={color.muted} />
            <TextInput
              allowFontScaling
              value={query}
              onChangeText={setQuery}
              placeholder="Search gate, area, or saved home…"
              placeholderTextColor="#958DA6"
              style={styles.searchInput}
            />
            {!!query && (
              <ScalePressable accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearBtn}>
                <X size={16} color={color.muted} />
              </ScalePressable>
            )}
          </Row>

          <Row gap={8}>
            {([
              ['all', 'All'],
              ['irbid', 'Irbid'],
              ['amman', 'Amman'],
            ] as const).map(([key, label]) => {
              const active = corridorFilter === key;
              return (
                <ScalePressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCorridorFilter(key)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Copy size={12} weight={700} tint={active ? color.white : color.navy}>{label}</Copy>
                </ScalePressable>
              );
            })}
          </Row>

          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <Copy size={13} tint={color.muted} style={{ textAlign: 'center', paddingVertical: 18 }}>
                No locations match that search.
              </Copy>
            }
          />
        </Pile>
      )}

      <Button tone="secondary" onPress={onClose}>Close</Button>
    </BottomSheet>
  );
}

const CampusRow = memo(function CampusRow({
  item, selected, onPress,
}: {
  item: Campus; selected: boolean; onPress: () => void;
}) {
  return (
    <ScalePressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${item.code}, ${item.name}`}
      onPress={onPress}
      style={[styles.optionCard, selected && styles.optionSelected]}
    >
      <Tile
        icon={GraduationCap}
        size={44}
        iconSize={20}
        background={selected ? color.navy : color.soft}
        tint={selected ? color.white : color.navy}
      />
      <Pile gap={3} style={fill}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Copy size={15} weight={800} tint={color.navy}>{item.code}</Copy>
          <Badge tone={item.corridor === 'amman' ? 'violet' : 'brand'}>
            {item.corridor === 'amman' ? 'Amman' : 'Irbid'}
          </Badge>
        </Row>
        <Copy size={13} weight={600} tint={color.ink}>{item.name}</Copy>
        {!!item.name_ar && <Copy size={12} tint={color.muted}>{item.name_ar}</Copy>}
      </Pile>
      {selected && <View style={styles.checkCircle}><Check size={16} color={color.white} /></View>}
    </ScalePressable>
  );
});

export function CampusPickerSheet({
  selectedId, onSelect, onClose,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRefData();
  const keyExtractor = useCallback((item: Campus) => item.id, []);
  const renderItem = useCallback(({ item }: { item: Campus }) => (
    <CampusRow item={item} selected={item.id === selectedId} onPress={() => onSelect(item.id)} />
  ), [onSelect, selectedId]);

  return (
    <BottomSheet onClose={onClose}>
      <Pile gap={2}>
        <Copy accessibilityRole="header" size={20} weight={800} tint={color.navy}>Choose university</Copy>
        <Copy size={12} tint={color.muted}>Group from your home to JUST, YU, INU, UJ, or AAU</Copy>
      </Pile>
      <FlatList
        data={ref.campuses}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
      <Button tone="secondary" onPress={onClose}>Cancel</Button>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  modeTabs: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
  },
  modeTab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: color.navy,
  },
  gpsActionCard: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#FFF5FA',
    borderWidth: 1.5,
    borderColor: color.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
  },
  gpsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveQuoteBar: {
    padding: 12,
    gap: 4,
    backgroundColor: '#FAF7FC',
  },
  labelChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: color.soft,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelChipActive: {
    backgroundColor: color.brand,
    borderColor: color.brand,
  },
  searchBar: {
    minHeight: 48, borderRadius: radius.field, backgroundColor: color.soft,
    paddingHorizontal: 14, borderWidth: 1, borderColor: color.line,
  },
  noteInputWrap: {
    minHeight: 48, borderRadius: radius.field, backgroundColor: color.pink,
    paddingHorizontal: 14, borderWidth: 1, borderColor: color.pinkBorder,
  },
  searchInput: { flex: 1, fontSize: 14, color: color.navy, paddingVertical: 10 },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterPill: {
    flex: 1, minHeight: 46, borderRadius: 999, backgroundColor: color.soft,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  filterPillActive: { backgroundColor: color.navy },
  optionCard: {
    minHeight: 68, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: color.line,
    backgroundColor: color.white, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  optionSelected: { borderColor: color.brand, backgroundColor: '#FFF7FB' },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: color.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
