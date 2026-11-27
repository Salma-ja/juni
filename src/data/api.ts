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

// ---------- plan, departure, search, groups (Phase 4) ----------
export type Pref = 'girls_only' | 'boys_only' | 'any';
export type RideRequest = {
  request_id: string; campus_id: string; pickup_area_id: string; class_start_at: string;
  arrival_target_at: string; pref: Pref;
};
export type Departure = {
  request_id: string; campus_id: string; pickup_area_id: string; departure_at: string; route_minutes: number;
  route_km: number; arrival_at: string; class_start_at: string; minutes_before_class: number; peak_factor: number;
  travel_source: 'model' | 'fallback'; alternative: { group_id: string; departure_at: string } | null;
};
export type Member = { first_name: string; verified: boolean; is_you?: boolean };
export type Candidate = {
  group_id: string; campus_id: string; status: string; pref: Pref; route_version: number;
  departure_at: string; pickup_at: string; arrival_at: string; route_minutes: number;
  travel_source: 'model' | 'fallback'; added_minutes: number; seats_taken: number; capacity: number;
  fare_fils: number; fare_cap_fils: number; group_fare_fils: number; stops: string[]; members: Member[];
};
export type GroupDetail = Candidate & { pickup_area_id: string; refund_rule: string; full: boolean; over_cap: boolean };
export type SearchResult = { request_id: string; candidates: Candidate[]; reason: string | null; filter: Pref };

export const createRequest = (b: { campusId: string; pickupAreaId: string; classStartAt: string; pref?: Pref }) =>
  call<RideRequest>('create-request', b);
export const recommendDeparture = (requestId: string) => call<Departure>('recommend-departure', { requestId });
export const searchGroups = (requestId: string, pref?: Pref) => call<SearchResult>('search-groups', { requestId, pref });
export const createGroup = (requestId: string) => call<Candidate>('create-group', { requestId });
export const groupDetail = (groupId: string, requestId: string) => call<GroupDetail>('group-detail', { groupId, requestId });
