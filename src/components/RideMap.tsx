import { House, LocateFixed, Minus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Copy, PulseDot, Row, ScalePressable } from '@/components/ui';
import { color, shadow } from '@/theme';

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
  kind: 'you' | 'campus' | 'hotspot' | 'stop' | 'home' | 'gps';
  caption?: string;
};

const TILE = 256;
// Tile source is configurable so a provider key can live in .env (EXPO_PUBLIC_* values are inlined at build time).
// Default: OpenStreetMap's public tiles, which need no key but are for light/demo traffic only.
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_CREDIT = process.env.EXPO_PUBLIC_MAP_CREDIT || '© OpenStreetMap';
const tileUri = (z: number, x: number, y: number) =>
  TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

function world(lat: number, lng: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unworld(worldX: number, worldY: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const lng = (worldX / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * worldY) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function fitZoom(points: MapPoint[], width: number, height: number) {
  if (points.length <= 1) return 14;
  for (let zoom = 14; zoom >= 9; zoom -= 1) {
    const placed = points.map((p) => world(p.lat, p.lng, zoom));
    const dx = Math.max(...placed.map((p) => p.x)) - Math.min(...placed.map((p) => p.x));
    const dy = Math.max(...placed.map((p) => p.y)) - Math.min(...placed.map((p) => p.y));
    if (dx < width - 76 && dy < height - 68) return zoom;
  }
  return 9;
}

export function RideMap({
  points,
  polyline,
  height = 200,
  progress,
  numbered = false,
  showBadge = true,
  onPickCoordinate,
}: {
  points: MapPoint[];
  polyline?: [number, number][];
  height?: number;
  progress?: number;
  numbered?: boolean;
  /** The small "Corridor route" / "Tap street" caption in the corner. */
  showBadge?: boolean;
  onPickCoordinate?: (coord: { lat: number; lng: number }) => void;
}) {
  const [box, setBox] = useState({ w: 340, h: height });
  const [manualZoom, setManualZoom] = useState<number | null>(onPickCoordinate ? 14 : null);

  const scene = useMemo(() => {
    const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (usable.length === 0 || box.w < 20) return null;
    const zoom = manualZoom ?? fitZoom(usable, box.w, box.h);
    const placed = usable.map((p) => ({ ...p, ...world(p.lat, p.lng, zoom) }));
    // When picking a home pin interactively, center on the first point (the user's pin)
    const cx = onPickCoordinate
      ? placed[0].x
      : placed.reduce((sum, p) => sum + p.x, 0) / placed.length;
    const cy = onPickCoordinate
      ? placed[0].y
      : placed.reduce((sum, p) => sum + p.y, 0) / placed.length;
    const left = cx - box.w / 2;
    const top = cy - box.h / 2;
    const x0 = Math.floor(left / TILE);
    const y0 = Math.floor(top / TILE);
    const x1 = Math.floor((left + box.w) / TILE);
    const y1 = Math.floor((top + box.h) / TILE);
    const tiles = [];
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const wrapped = ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
        tiles.push({
          key: `${zoom}-${x}-${y}`,
          left: x * TILE - left,
          top: y * TILE - top,
          uri: tileUri(zoom, wrapped, y),
        });
      }
    }
    const markers = placed.map((p) => ({ ...p, left: p.x - left, top: p.y - top }));
    const polyPlaced = polyline && polyline.length >= 2
      ? polyline.map(([lat, lng]) => {
          const w = world(lat, lng, zoom);
          return { left: w.x - left, top: w.y - top };
        })
      : markers;

    let driver: { left: number; top: number } | null = null;
    if (progress != null && polyPlaced.length >= 2) {
      const t = Math.min(1, Math.max(0, progress));
      const scaled = t * (polyPlaced.length - 1);
      const idx = Math.min(polyPlaced.length - 2, Math.floor(scaled));
      const localT = scaled - idx;
      const a = polyPlaced[idx];
      const b = polyPlaced[idx + 1];
      driver = { left: a.left + (b.left - a.left) * localT, top: a.top + (b.top - a.top) * localT };
    }
    return { tiles, markers, polyPlaced, driver, left, top, zoom };
  }, [points, polyline, box, progress, manualZoom, onPickCoordinate]);

  function handleMapPress(e: GestureResponderEvent) {
    if (!onPickCoordinate || !scene) return;
    const native = e.nativeEvent as unknown as {
      locationX?: number;
      locationY?: number;
      offsetX?: number;
      offsetY?: number;
    };
    const px = native.locationX ?? native.offsetX;
    const py = native.locationY ?? native.offsetY;
    if (typeof px !== 'number' || typeof py !== 'number') return;
    const coord = unworld(scene.left + px, scene.top + py, scene.zoom);
    onPickCoordinate(coord);
  }

  const mapInner = (
    <>
      {scene?.tiles.map((tile) => (
        <Image key={tile.key} source={{ uri: tile.uri }} style={[styles.tile, { left: tile.left, top: tile.top }]} />
      ))}
      {scene && scene.polyPlaced.length > 1 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Polyline
            points={scene.polyPlaced.map((m) => `${m.left},${m.top}`).join(' ')}
            fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
          />
          <Polyline
            points={scene.polyPlaced.map((m) => `${m.left},${m.top}`).join(' ')}
            fill="none" stroke={color.brand} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 5"
          />
        </Svg>
      )}
      {scene?.markers.map((m, index) => {
        const isHome = m.kind === 'home' || m.kind === 'gps';
        return (
          <View key={`${m.kind}-${m.label}-${index}`} pointerEvents="none" style={[styles.marker, { left: m.left, top: m.top }]}>
            {isHome ? (
              <View style={styles.homePinOuter}>
                <View style={styles.homePinCore}>
                  {m.kind === 'gps' ? <LocateFixed size={15} color={color.white} /> : <House size={15} color={color.white} />}
                </View>
              </View>
            ) : (
              <View style={[styles.pin, m.kind === 'campus' ? styles.campus : styles.you]}>
                <Copy size={12} weight={800} tint={color.white}>{m.kind === 'campus' ? 'U' : String(index + 1)}</Copy>
              </View>
            )}
            {!numbered && (
              <View style={[styles.label, isHome && styles.homeLabel]}>
                <Copy size={12} weight={800} tint={isHome ? color.brand : color.navy} numberOfLines={1}>
                  {m.label}
                </Copy>
              </View>
            )}
          </View>
        );
      })}
      {scene?.driver && (
        <View pointerEvents="none" style={[styles.driver, { left: scene.driver.left, top: scene.driver.top }]}>
          <Row gap={4}>
            <PulseDot tint={color.white} size={6} />
            <Copy size={12} weight={800} tint={color.white}>Captain</Copy>
          </Row>
        </View>
      )}
      <View pointerEvents="none" style={styles.attribution}>
        <Copy size={10} weight={600} tint={color.muted}>{MAP_CREDIT}</Copy>
      </View>
      {showBadge && (
        <View pointerEvents="none" style={styles.routeBadge}>
          <Copy size={12} weight={700} tint={color.navy}>
            {onPickCoordinate ? 'Tap street to move pin' : 'Corridor route'}
          </Copy>
        </View>
      )}
    </>
  );

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(e) => {
        const { width, height: h } = e.nativeEvent.layout;
        if (width !== box.w || h !== box.h) setBox({ w: width, h });
      }}
    >
      {onPickCoordinate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Interactive street map, tap anywhere to set your home pickup pin"
          onPress={handleMapPress}
          style={StyleSheet.absoluteFill}
        >
          {mapInner}
        </Pressable>
      ) : (
        mapInner
      )}

      {onPickCoordinate && scene && (
        <View style={styles.zoomCol}>
          <ScalePressable
            accessibilityLabel="Zoom in map"
            onPress={() => setManualZoom(Math.min(16, scene.zoom + 1))}
            style={styles.zoomBtn}
          >
            <Plus size={18} color={color.navy} />
          </ScalePressable>
          <ScalePressable
            accessibilityLabel="Zoom out map"
            onPress={() => setManualZoom(Math.max(10, scene.zoom - 1))}
            style={styles.zoomBtn}
          >
            <Minus size={18} color={color.navy} />
          </ScalePressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#E6EEF2', borderWidth: 1, borderColor: color.line },
  tile: { position: 'absolute', width: TILE, height: TILE },
  attribution: {
    position: 'absolute', left: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2,
    borderTopRightRadius: 8, backgroundColor: '#FFFFFFCC',
  },
  marker: { position: 'absolute', alignItems: 'center', width: 128, marginLeft: -64, marginTop: -20 },
  pin: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: color.white,
    alignItems: 'center', justifyContent: 'center', ...shadow(4, 10, '#271C3A33'),
  },
  homePinOuter: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#E900762E',
    alignItems: 'center', justifyContent: 'center',
  },
  homePinCore: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: color.brand,
    borderWidth: 2.5, borderColor: color.white, alignItems: 'center', justifyContent: 'center',
    ...shadow(6, 14, '#E9007655'),
  },
  you: { backgroundColor: color.brand },
  campus: { backgroundColor: color.navy, borderRadius: 8 },
  label: {
    backgroundColor: color.white, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
    marginTop: 4, borderWidth: 1, borderColor: color.line, ...shadow(2, 6, '#271C3A1A'),
  },
  homeLabel: {
    borderColor: color.pinkBorder, backgroundColor: '#FFF5FA',
  },
  driver: {
    position: 'absolute', marginLeft: -42, marginTop: -16, backgroundColor: color.brand,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 2, borderColor: color.white,
    ...shadow(6, 14, '#E9007650'),
  },
  routeBadge: {
    position: 'absolute', left: 10, top: 10, backgroundColor: '#FFFFFFEB',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: color.line,
  },
  zoomCol: {
    position: 'absolute', right: 10, bottom: 10, gap: 6,
  },
  zoomBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: color.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.line,
    ...shadow(4, 10, '#271C3A22'),
  },
});
