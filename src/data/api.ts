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
export type Me = {
  profileId: string; fullName: string; gender: Gender; verified: boolean; isDemo: boolean;
  role: 'rider' | 'captain'; captainId: string | null;
  captain?: { make_model: string; color: string; plate: string; license_expires_on: string; phone_masked: string } | null;
};
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

// ---------- checkout, payment, status (Phase 5) ----------
export type Checkout = {
  hold_id: string; group_id: string; pickup_area_id: string; expires_at: string; app_now: string; fare_fils: number;
  pickup_at: string; departure_at: string; campus_id: string; route_version: number; inside_12h: boolean;
};
export type Hold = {
  hold_id: string; group_id: string; pickup_area_id: string; fare_fils: number; expires_at: string;
  released_at: string | null; release_reason: string | null; departure_at: string; campus_id: string;
  app_now: string; active: boolean;
};
export type PayResult = {
  outcome: 'success' | 'failed'; booking_id: string | null; booking_code: string | null; payment_code: string;
  status: string;
};
export type BookingStatus = 'seat_booked' | 'awaiting_captain' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type BookingData = {
  id: string; code: string; status: BookingStatus; fare_fils: number; pickup_at: string;
  pickup_area: { id: string; name: string; detail: string }; campus: { id: string; label: string; code: string };
  group_id: string; group_status: string; pref: Pref; departure_at: string; arrival_at: string; route_minutes: number;
  captain: { id: string; name: string; phone_masked: string } | null; captain_confirmed: boolean;
  vehicle: { make_model: string; color: string; plate: string } | null;
  cancelled_by: string | null; cancelled_at: string | null;
  refund: { amount_fils: number; reason: string; hours_before_pickup: number } | null;
  payment_code: string | null; seats_taken: number; capacity: number;
};
export type BookingDetail = BookingData & {
  app_now: string; hours_to_pickup: number; route_km: number; travel_source: string; group_fare_fils: number;
  fare_cap_fils: number; refund_rule: string; stops: { seq: number; name: string; eta_at: string }[]; members: Member[];
};

export const startCheckout = (b: { groupId: string; pickupAreaId: string; routeVersion: number; idempotencyKey: string }) =>
  call<Checkout>('start-checkout', b);
export const hold = (holdId: string) => call<Hold>('hold', { holdId });
export const pay = (holdId: string, outcome: 'success' | 'failed', idempotencyKey: string) =>
  call<PayResult>('pay', { holdId, outcome, idempotencyKey });
export const booking = (bookingId: string) => call<BookingDetail>('booking', { bookingId });

// ---------- rides, cancellation, SOS (Phase 6) ----------
export type MyBookings = { app_now: string; upcoming: BookingData[]; active: BookingData[]; past: BookingData[] };
export type CancelResult = { booking_id: string; refund_fils: number; reason: string; hours_before_pickup: number };

export const myBookings = () => call<MyBookings>('my-bookings');
export const cancelBooking = (bookingId: string) => call<CancelResult>('cancel-booking', { bookingId });
export const logSos = (bookingId: string) => call<{ code: string; created_at: string }>('log-sos', { bookingId });

// ---------- demo controls (Phase 7) ----------
export type DemoSettings = {
  clockOffsetMinutes: number; forceTravelOutage: boolean; forcePaymentFailure: boolean; realNow: string; appNow: string;
  activeHoldId: string | null;
};
export type LastSeatGroup = {
  group_id: string; campus_id: string; campus_code: string; pref: Pref; departure_at: string; route_version: number;
  pickup_area_id: string; pickup_name: string; seats_taken: number; capacity: number;
};
export const demoSettings = () => call<DemoSettings>('demo/settings');
export const demoSet = (b: { clockOffsetMinutes?: number; forceTravelOutage?: boolean; forcePaymentFailure?: boolean }) =>
  call<DemoSettings>('demo/set', b);
export const demoConfirmCaptain = (bookingId: string) => call<unknown>('demo/confirm-captain', { bookingId });
export const demoAssignCaptain = (bookingId: string, captainId: string) => call<unknown>('demo/assign-captain', { bookingId, captainId });
export const demoExpireHold = (holdId: string) => call<unknown>('demo/expire-hold', { holdId });
export const demoReleaseHold = (holdId: string) => call<unknown>('demo/release-hold', { holdId });
export const demoStartTrip = (bookingId: string) => call<unknown>('demo/start-trip', { bookingId });
export const demoCompleteTrip = (bookingId: string) => call<unknown>('demo/complete-trip', { bookingId });
export const demoLastSeatGroups = () => call<LastSeatGroup[]>('demo/last-seat-groups');
export const demoSeedCheckout = (groupId: string) => call<Checkout & { seed_rider: string }>('demo/seed-checkout', { groupId });
export const demoReset = () => call<{ reset: boolean }>('demo/reset');

// ---------- captain (driver) mode ----------
export type TripRider = { booking_id: string; first_name: string; picked_up: boolean };
export type TripStop = { seq: number; name: string; detail: string; eta_at: string; riders: TripRider[] };
export type CaptainTrip = {
  group_id: string; status: 'full' | 'awaiting_captain' | 'confirmed' | 'in_progress' | 'completed'; pref: Pref;
  campus: { id: string; label: string; code: string }; departure_at: string; arrival_at: string; route_minutes: number;
  route_km: number; seats_taken: number; capacity: number; confirmed: boolean;
  vehicle: { make_model: string; color: string; plate: string } | null; collected_fils: number; payout_fils: number;
  stops: TripStop[];
};
export type Earnings = {
  completed_trips: number; total_payout_fils: number;
  trips: { group_id: string; departure_at: string; campus_code: string; riders: number; payout_fils: number }[];
};
export const claimCaptain = (captainId: string) => call<{ token: string; profile: Me }>('demo/claim', { role: 'captain', captainId });
export const captainTrips = () => call<CaptainTrip[]>('captain/trips');
export const captainConfirm = (groupId: string) => call<unknown>('captain/confirm', { groupId });
export const captainDecline = (groupId: string) => call<{ reassigned_to: string | null }>('captain/decline', { groupId });
export const captainStart = (groupId: string) => call<unknown>('captain/start', { groupId });
export const captainPickup = (groupId: string, bookingId: string) => call<unknown>('captain/pickup', { groupId, bookingId });
export const captainComplete = (groupId: string) => call<unknown>('captain/complete', { groupId });
export const captainEarnings = () => call<Earnings>('captain/earnings');
