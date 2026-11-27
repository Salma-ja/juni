import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Copy, fill, Pile, PulseDot, Row, ScalePressable, spread } from '@/components/ui';
import type { BookingData } from '@/data/api';
import { formatDate, formatFils, formatTime } from '@/data/format';
import { LivePickupWidget } from '@/features/liveUpdates';
import { color } from '@/theme';

/** One short phrase for where a booking stands. */
function statusLine(b: BookingData) {
  if (b.status === 'in_progress') return `On the way · ${b.picked_up_count ?? 0}/${b.total_riders ?? b.seats_taken} picked up`;
  if (b.status === 'confirmed') return `Confirmed${b.captain ? ` · ${b.captain.name.split(' ')[0]}` : ''}`;
  if (b.captain) return 'Awaiting captain';
  return `Filling · ${b.seats_taken}/${b.capacity}`;
}

/** Two-stop timeline: pickup + time, campus + arrival. Shared by every trip screen. */
export function TripRoute({ from, fromTime, to, toTime }: { from: string; fromTime: string; to: string; toTime: string }) {
  return (
    <Row gap={12} style={{ marginTop: 14 }}>
      <View style={styles.rail}>
        <View style={styles.dotFrom} />
        <View style={styles.line} />
        <View style={styles.dotTo} />
      </View>
      <Pile gap={18} style={fill}>
        <Row style={spread}>
          <Copy size={16} weight={800} tint={color.navy} style={fill} numberOfLines={1}>{from}</Copy>
          <Copy size={18} weight={800} tint={color.navy}>{fromTime}</Copy>
        </Row>
        <Row style={spread}>
          <Copy size={16} weight={800} tint={color.navy} style={fill}>{to}</Copy>
          <Copy size={14} weight={700} tint={color.muted}>{toTime}</Copy>
        </Row>
      </Pile>
    </Row>
  );
}

/**
 * The one booking card used on Home and My trips: status + date on top, a two-stop timeline,
 * then seat bars and the price. The whole card is the tap target.
 */
export const TripCard = memo(function TripCard({ b, appNow, onPress }: {
  b: BookingData; appNow?: string; onPress: () => void;
}) {
  const live = b.status === 'confirmed' || b.status === 'in_progress';
  const tone = live ? color.emerald : color.brand;
  const label = statusLine(b);

  return (
    <ScalePressable
      accessibilityLabel={`${b.pickup_area.name} to ${b.campus.code}, ${formatDate(b.pickup_at)} ${formatTime(b.pickup_at)}, ${label}`}
      onPress={onPress}
      scaleTo={0.98}
      style={styles.card}
    >
      <Row style={spread}>
        <Row gap={6} style={fill}>
          <PulseDot tint={tone} size={6} />
          <Copy size={13} weight={700} tint={tone} numberOfLines={1}>{label}</Copy>
        </Row>
        <Copy size={13} weight={600} tint={color.muted}>{formatDate(b.pickup_at)}</Copy>
      </Row>

      <TripRoute from={b.pickup_area.name} fromTime={formatTime(b.pickup_at)} to={b.campus.code} toTime={formatTime(b.arrival_at)} />

      {b.status === 'in_progress' && (
        <View style={{ marginTop: 14 }}>
          <LivePickupWidget booking={b} appNow={appNow} compact />
        </View>
      )}

      <View style={styles.divider} />
      <Row style={spread}>
        <Row gap={6}>
          {Array.from({ length: b.capacity }, (_, i) => (
            <View key={i} style={[styles.pip, i < b.seats_taken && styles.pipOn]} />
          ))}
        </Row>
        <Row gap={4}>
          <Copy size={15} weight={800} tint={color.navy}>{formatFils(b.fare_fils)}</Copy>
          <ChevronRight size={18} color={color.muted} />
        </Row>
      </Row>
    </ScalePressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 18, borderRadius: 22, backgroundColor: color.white, borderWidth: 1, borderColor: color.line,
  },
  rail: { alignItems: 'center', alignSelf: 'stretch', paddingVertical: 5 },
  dotFrom: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: color.brand, backgroundColor: color.white },
  line: { width: 2, flex: 1, backgroundColor: color.line, marginVertical: 4 },
  dotTo: { width: 12, height: 12, borderRadius: 3, backgroundColor: color.navy },
  divider: { height: 1, backgroundColor: color.line, marginVertical: 14 },
  pip: { width: 22, height: 8, borderRadius: 4, backgroundColor: color.line },
  pipOn: { backgroundColor: color.brand },
});

/** The card frame, shared with the Past list so every booking row looks the same. */
export const tripCardFrame = styles.card;
