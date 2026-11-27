import { claimCaptain, claimPersona, me, setToken, type Me } from '@/data/api';

/** The two built-in accounts. Sessions are reused so a booking survives a switch. */
export const RIDER = { slot: 'rider' as const, name: 'Rama', gender: 'female' as const, label: 'Student' };
export const DRIVER = { slot: 'driver' as const, id: 'cap-4', name: 'Faris', label: 'Driver' };

const STORE_KEY = 'juni.accounts';
type Slot = 'rider' | 'driver';
type Saved = Partial<Record<Slot, string>>;

async function readSaved(): Promise<Saved> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) as Saved : {};
  } catch {
    return {};
  }
}

async function writeSaved(saved: Saved) {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(saved));
  } catch {
    /* the in-memory session still works */
  }
}

async function claim(slot: Slot) {
  const res = slot === 'rider'
    ? await claimPersona(RIDER.gender, RIDER.name)
    : await claimCaptain(DRIVER.id);
  if (!res.ok) throw new Error(res.message);
  await setToken(res.data.token);
  const saved = await readSaved();
  saved[slot] = res.data.token;
  await writeSaved(saved);
  return res.data;
}

/** Restore this account, or claim it once. */
export async function ensureAccount(slot: Slot): Promise<{ token: string; profile: Me }> {
  const saved = await readSaved();
  const token = saved[slot];
  if (token) {
    await setToken(token);
    const res = await me();
    if (res.ok) return { token, profile: res.data };
  }
  return claim(slot);
}
