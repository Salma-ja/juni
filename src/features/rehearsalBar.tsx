import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Copy, ScalePressable } from '@/components/ui';
import { myBookings, resetRehearsal } from '@/data/api';
import { DRIVER } from '@/features/accounts';
import { useAuth } from '@/features/authSession';

/** Dark slate rehearsal strip outside the consumer frame. */
export function RehearsalBar() {
  const router = useRouter();
  const { profile, switchAccount, signInWithToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!profile) return null;
  const who = profile.role === 'captain' ? `${profile.fullName} (Captain)` : `${profile.fullName} (Student)`;

  async function become(slot: 'rider' | 'driver', captainId?: string) {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      if (captainId) {
        const { claimCaptain } = await import('@/data/api');
        const res = await claimCaptain(captainId);
        if (!res.ok) throw new Error(res.message);
        await signInWithToken(res.data.token, res.data.profile);
        router.replace('/driver');
        return;
      }
      await switchAccount(slot);
      router.replace(slot === 'driver' ? '/driver' : '/home');
    } catch {
      setNote('Could not switch account.');
    } finally {
      setBusy(false);
    }
  }

  async function assigned() {
    const bookings = await myBookings();
    const next = bookings.ok ? (bookings.data.active[0] ?? bookings.data.upcoming[0]) : null;
    const captainId = next?.captain?.id;
    if (!captainId) {
      setNote('Book a 4th seat first so a captain is assigned.');
      return;
    }
    setNote('');
    await become('driver', captainId);
  }

  async function reset() {
    setBusy(true);
    const res = await resetRehearsal();
    setBusy(false);
    setNote(res.ok ? `Seed restored · ${res.data.seats_taken ?? 3}/4 seats ready` : 'Reset failed');
  }

  return (
    <View style={styles.bar}>
      <Copy size={12} weight={700} tint="#CBD5E1">{`DEMO SWITCHER · ${who}`}</Copy>
      <View style={styles.actions}>
        <ScalePressable accessibilityLabel="Switch to assigned captain" onPress={assigned} style={styles.btn}>
          <Copy size={12} weight={800} tint="#0F172A">Assigned Captain</Copy>
        </ScalePressable>
        <ScalePressable accessibilityLabel={`Switch to ${DRIVER.name}`} onPress={() => become('driver')} style={styles.btn}>
          <Copy size={12} weight={800} tint="#0F172A">{`${DRIVER.name} (Driver)`}</Copy>
        </ScalePressable>
        <ScalePressable accessibilityLabel="Switch to Rama student" onPress={() => become('rider')} style={styles.btn}>
          <Copy size={12} weight={800} tint="#0F172A">Rama (Student)</Copy>
        </ScalePressable>
        <ScalePressable accessibilityLabel="Reset demo seed" onPress={reset} style={[styles.btn, styles.resetBtn]}>
          <Copy size={12} weight={800} tint="#FFE4E6">Reset</Copy>
        </ScalePressable>
      </View>
      {!!note && <Copy size={12} tint="#FDE68A">{note}</Copy>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#120D1D', paddingHorizontal: 14, paddingVertical: 8, gap: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  btn: {
    minHeight: 44, backgroundColor: '#F8FAFC', borderRadius: 999,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
  },
  resetBtn: { backgroundColor: '#4C1D3D' },
});
