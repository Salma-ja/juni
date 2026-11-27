import { ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Copy, fill, PulseDot, Row, ScalePressable, spread } from '@/components/ui';
import type { Pending } from '@/data/api';
import { formatCountdown, formatDate, formatFils, formatTime } from '@/data/format';
import { useRefData } from '@/data/refdata';
import { useCountdown } from '@/features/booking';
import { TripRoute, tripCardFrame } from '@/features/tripCard';
import { color } from '@/theme';

/** A seat the rider is holding but has not paid for yet. Counts down; asks the parent to refresh when the hold lapses. */
export function HoldCard({ hold, appNow, onPress, onExpire }: {
  hold: NonNullable<Pending['hold']>; appNow: string; onPress: () => void; onExpire: () => void;
}) {
  const ref = useRefData();
  const remaining = useCountdown(hold.expires_at, appNow);
  useEffect(() => {
    if (remaining !== null && remaining <= 0) onExpire();
  }, [remaining, onExpire]);

  return (
    <ScalePressable
      accessibilityLabel={`Seat held for ${formatCountdown(remaining ?? 0)}. Finish booking ${hold.pickup_name} to ${ref.campus(hold.campus_id)?.code ?? ''}`}
      onPress={onPress}
      scaleTo={0.98}
      style={tripCardFrame}
    >
      <Row style={spread}>
        <Row gap={6} style={fill}>
          <PulseDot tint={color.amber} size={6} />
          <Copy size={13} weight={700} tint={color.amber} numberOfLines={1}>
            {`Seat held · ${formatCountdown(remaining ?? 300)}`}
          </Copy>
        </Row>
        <Copy size={13} weight={600} tint={color.muted}>{formatDate(hold.pickup_at)}</Copy>
      </Row>
      <TripRoute
        from={hold.pickup_name}
        fromTime={formatTime(hold.pickup_at)}
        to={ref.campus(hold.campus_id)?.code ?? ''}
        toTime={formatTime(hold.arrival_at)}
      />
      <View style={styles.divider} />
      <Row style={spread}>
        <Copy size={15} weight={800} tint={color.brand}>Finish booking</Copy>
        <Row gap={4}>
          <Copy size={15} weight={800} tint={color.navy}>{formatFils(hold.fare_fils)}</Copy>
          <ChevronRight size={18} color={color.muted} />
        </Row>
      </Row>
    </ScalePressable>
  );
}

/** A group search that found a group, with nothing booked yet. */
export function PlanCard({ plan, onPress }: { plan: NonNullable<Pending['plan']>; onPress: () => void }) {
  const ref = useRefData();
  return (
    <ScalePressable
      accessibilityLabel={`Groups found for ${plan.pickup_name} to ${ref.campus(plan.campus_id)?.code ?? ''}. Pick a group`}
      onPress={onPress}
      scaleTo={0.98}
      style={tripCardFrame}
    >
      <Row style={spread}>
        <Row gap={6} style={fill}>
          <PulseDot tint={color.brand} size={6} />
          <Copy size={13} weight={700} tint={color.brand} numberOfLines={1}>Groups found</Copy>
        </Row>
        <Copy size={13} weight={600} tint={color.muted}>{formatDate(plan.arrival_at)}</Copy>
      </Row>
      <TripRoute
        from={plan.pickup_name}
        fromTime=""
        to={ref.campus(plan.campus_id)?.code ?? ''}
        toTime={`Gate ${formatTime(plan.arrival_at)}`}
      />
      <View style={styles.divider} />
      <Row style={spread}>
        <Copy size={15} weight={800} tint={color.brand}>Pick your group</Copy>
        <ChevronRight size={18} color={color.muted} />
      </Row>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: color.line, marginVertical: 14 },
});
