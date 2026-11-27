import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Copy, Row, ScalePressable } from '@/components/ui';
import { DRIVER, RIDER } from '@/features/accounts';
import { useAuth } from '@/features/authSession';
import { color } from '@/theme';

/** Switch between Rama (student) and Faris (captain) inside Profile. */
export function AccountSwitch() {
  const router = useRouter();
  const { profile, switchAccount } = useAuth();
  const [busy, setBusy] = useState<'rider' | 'driver' | null>(null);
  const riding = profile?.role !== 'captain';

  async function go(slot: 'rider' | 'driver') {
    if (busy || ((slot === 'rider' ? riding : !riding) && profile)) return;
    setBusy(slot);
    try {
      await switchAccount(slot);
      router.replace(slot === 'driver' ? '/driver' : '/home');
    } catch {
      /* keep current account */
    } finally {
      setBusy(null);
    }
  }

  return (
    <Row gap={6} style={styles.bar}>
      <Choice
        label={busy === 'rider' ? 'Switching…' : `${RIDER.name} · Student`}
        selected={riding}
        onPress={() => go('rider')}
      />
      <Choice
        label={busy === 'driver' ? 'Switching…' : `${DRIVER.name} · Captain`}
        selected={!riding}
        onPress={() => go('driver')}
      />
    </Row>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <ScalePressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Copy size={13} weight={800} tint={selected ? color.white : color.navy}>{label}</Copy>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.soft, borderRadius: 999, padding: 5, borderWidth: 1, borderColor: color.line },
  choice: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  selected: { backgroundColor: color.brand },
});
