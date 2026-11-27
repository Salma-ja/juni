import AsyncStorage from '@react-native-async-storage/async-storage';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; code: string; message: string };
export type Result<T> = ApiOk<T> | ApiErr;

const TOKEN_KEY = 'juni.session';
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadToken() {
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function setToken(value: string | null) {
  token = value;
  try {
    if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the in-memory token still works for this session */
  }
}

export const hasToken = () => token !== null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** The one place every endpoint goes through. Adds the bearer token and clears it on 401. */
async function call<T>(path: string, body: Record<string, unknown> = {}): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Result<T>;
    if (res.status === 401) {
      await setToken(null);
      onUnauthorized?.();
    }
    return json;
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Could not reach JUNI. Check your connection.' };
  }
}

// ---------- types ----------
export type Gender = 'female' | 'male';
export type Me = { profileId: string; fullName: string; gender: Gender; verified: boolean; isDemo: boolean };
export type PickupArea = { id: string; name: string; detail: string; lat: number; lng: number };
export type Campus = { id: string; code: string; name: string; label: string; lat: number; lng: number };

// ---------- endpoints ----------
export async function config(): Promise<Result<{ demoLoginEnabled: boolean }>> {
  try {
    const res = await fetch(`${BASE}/api/config`);
    const json = (await res.json()) as { demoLoginEnabled: boolean };
    return { ok: true, data: json };
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Could not reach JUNI. Check your connection.' };
  }
}

export const claimPersona = (gender: Gender, fullName: string) =>
  call<{ token: string; profile: Me }>('demo/claim', { gender, fullName });
export const me = () => call<Me>('me');
export const signOut = () => call<{ signedOut: boolean }>('signout');
export const pickupAreas = () => call<PickupArea[]>('pickup-areas');
export const campuses = () => call<Campus[]>('campuses');
