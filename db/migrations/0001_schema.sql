-- JUNI schema: enums, tables, indexes. Business rules live in schema core (0006+).
create extension if not exists pgcrypto;
create schema if not exists core;

create type gender as enum ('female','male');
create type group_pref as enum ('girls_only','boys_only','any');
create type group_status as enum ('open','full','awaiting_captain','confirmed','in_progress','completed','cancelled');
create type booking_status as enum ('seat_booked','awaiting_captain','confirmed','in_progress','completed','cancelled');
create type request_status as enum ('searching','matched','unmatched');
create type payment_outcome as enum ('success','failed');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  gender gender not null,
  verified boolean not null default false,
  is_demo boolean not null default false,
  is_seed boolean not null default false,
  created_at timestamptz not null default now()
);

create table sessions (
  token uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index sessions_profile_idx on sessions(profile_id);

create table campuses (
  id text primary key,
  code text not null,
  name text not null,
  label text not null,
  lat double precision not null,
  lng double precision not null
);

create table pickup_areas (
  id text primary key,
  name text not null,
  detail text not null,
  lat double precision not null,
  lng double precision not null
);

create table captains (
  id text primary key,
  full_name text not null,
  phone_masked text not null,
  licensed boolean not null,
  license_expires_on date not null,
  active boolean not null
);

create table vehicles (
  id text primary key,
  captain_id text not null references captains(id),
  make_model text not null,
  color text not null,
  plate text not null,
  category text not null check (category in ('sedan','hatchback','suv')),
  licensed_capacity int not null check (licensed_capacity between 1 and 4),
  eligible boolean not null
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  campus_id text not null references campuses(id),
  pref group_pref not null,
  arrival_target_at timestamptz not null,
  departure_at timestamptz not null,
  route_minutes int not null,
  route_km numeric(6,2) not null,
  route_version int not null default 1,
  fare_cap_fils int not null default 6000,
  group_fare_fils int not null,
  capacity int not null default 4 check (capacity between 1 and 4),
  status group_status not null default 'open',
  captain_id text references captains(id),
  vehicle_id text references vehicles(id),
  captain_confirmed_at timestamptz,
  travel_source text not null check (travel_source in ('model','fallback')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index groups_search_idx on groups(campus_id, arrival_target_at, status);

create table group_stops (
  group_id uuid not null references groups(id),
  seq int not null,
  pickup_area_id text not null references pickup_areas(id),
  eta_at timestamptz not null,
  primary key (group_id, seq)
);

create table ride_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references profiles(id),
  campus_id text not null references campuses(id),
  pickup_area_id text not null references pickup_areas(id),
  class_start_at timestamptz not null,
  arrival_target_at timestamptz not null,
  pref group_pref not null,
  status request_status not null default 'searching',
  created_at timestamptz not null default now()
);

create table seat_holds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id),
  rider_id uuid not null references profiles(id),
  pickup_area_id text not null references pickup_areas(id),
  quoted_fare_fils int not null,
  route_version int not null,
  expires_at timestamptz not null,
  released_at timestamptz,
  release_reason text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);
create index seat_holds_group_idx on seat_holds(group_id);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rider_id uuid not null references profiles(id),
  group_id uuid not null references groups(id),
  hold_id uuid not null unique references seat_holds(id),
  pickup_area_id text not null references pickup_areas(id),
  pickup_at timestamptz not null,
  fare_fils int not null,
  refund_rule text not null,
  status booking_status not null,
  cancelled_by text check (cancelled_by in ('rider','captain','platform')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index bookings_one_active_per_rider_group on bookings(rider_id, group_id) where status <> 'cancelled';
create index bookings_group_idx on bookings(group_id);
create index bookings_rider_idx on bookings(rider_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  hold_id uuid not null references seat_holds(id),
  booking_id uuid references bookings(id),
  amount_fils int not null,
  outcome payment_outcome not null,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id),
  amount_fils int not null,
  reason text not null check (reason in ('rider_12h_plus','rider_late_no_refund','no_captain','below_floor','captain_cancelled','platform_cancelled')),
  hours_before_pickup numeric(7,2) not null,
  decided_at timestamptz not null default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  group_id uuid references groups(id),
  booking_id uuid references bookings(id),
  actor text not null,
  kind text not null check (kind in ('sos','no_captain','below_floor','captain_ineligible','seat_conflict')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table idempotency_results (
  key uuid primary key,
  fn text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table demo_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  clock_offset_minutes int not null default 0,
  force_travel_outage boolean not null default false,
  force_payment_failure boolean not null default false
);
