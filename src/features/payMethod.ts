export type PayMethod = 'wallet' | 'card' | 'cash';

const KEY = 'juni.payMethod';

export const payMethodLabel: Record<PayMethod, string> = {
  wallet: 'Jeeny Wallet',
  card: 'Visa',
  cash: 'Cash to the driver',
};

async function readAll(): Promise<Record<string, PayMethod>> {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as Record<string, PayMethod> : {};
  } catch {
    return {};
  }
}

export async function rememberPayMethod(bookingId: string, method: PayMethod) {
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const all = await readAll();
    all[bookingId] = method;
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* confirmation still works without the saved label */
  }
}

export async function readPayMethod(bookingId: string) {
  const all = await readAll();
  return all[bookingId] ?? null;
}
