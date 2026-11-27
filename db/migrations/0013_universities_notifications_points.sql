-- 0013: Add AAU & UJ universities + Amman gates, multi-captain pool, real-time group notifications,
-- JUNI points (+30 last-seat bonus), live pickup telemetry, and resilient captain decline reassignment.

-- 1. Corridors, new universities (AAU, UJ), Amman pickup gates, and extra licensed 4-seat captains
alter table campuses add column if not exists corridor text not null default 'irbid';
alter table pickup_areas add column if not exists corridor text not null default 'irbid';

insert into campuses (id, code, name, label, name_ar, short_ar, lat, lng, corridor, corridor_polyline) values
  ('aau', 'AAU', 'Al-Ahliyya Amman University', 'Al-Ahliyya Amman University',
   'جامعة عمان الأهلية', 'عمان الأهلية', 32.0428, 35.7781, 'amman',
   '[[32.0268,35.8415],[32.0340,35.8120],[32.0428,35.7781]]'::jsonb),
  ('uj',  'UJ',  'The University of Jordan', 'University of Jordan (UJ)',
   'الجامعة الأردنية', 'الأردنية', 32.0160, 35.8696, 'amman',
   '[[31.9980,35.8390],[32.0120,35.8550],[32.0160,35.8696]]'::jsonb)
on conflict (id) do update set
  code = excluded.code, name = excluded.name, label = excluded.label,
  name_ar = excluded.name_ar, short_ar = excluded.short_ar,
  lat = excluded.lat, lng = excluded.lng, corridor = excluded.corridor,
  corridor_polyline = excluded.corridor_polyline;

insert into pickup_areas (id, name, detail, name_ar, gate_landmark_en, gate_landmark_ar, lat, lng, corridor) values
  ('sweileh',   'Sweileh',   'Sweileh BRT Circle',      'صويلح',   'Sweileh BRT overpass',             'جسر الباص السريع',       32.0268, 35.8415, 'amman'),
  ('jubaiha',   'Jubaiha',   'Al-Jubaiha Signal',       'الجبيهة', 'Higher Education signal bay',      'إشارة التعليم العالي',    32.0285, 35.8660, 'amman'),
  ('tabarbour', 'Tabarbour', 'Tareq Transit Hub',       'طبربور',  'Tareq intersection transit stop',  'دوار المشاغل',           31.9965, 35.9185, 'amman'),
  ('khalda',    'Khalda',    'Khalda Main Circle',      'خلدا',    'Wasfi Al-Tal highway bridge',      'جسر خلدا',               31.9980, 35.8390, 'amman')
on conflict (id) do update set
  name = excluded.name, detail = excluded.detail, name_ar = excluded.name_ar,
  gate_landmark_en = excluded.gate_landmark_en, gate_landmark_ar = excluded.gate_landmark_ar,
  lat = excluded.lat, lng = excluded.lng, corridor = excluded.corridor;

-- Keep campus_ref_km scoped per corridor so JUST ref_km stays 17.81 and Amman campuses get local ref_km
create or replace view core.campus_ref_km as
  select c.id as campus_id, round(avg(core.leg_km(p.lat, p.lng, c.lat, c.lng)), 2) as ref_km
    from campuses c
    join pickup_areas p on p.corridor = c.corridor
   group by c.id;

-- Additional licensed 4-seat captains (cap-7..cap-9 sort after cap-1..cap-6) so multi-campus groups & declines never starve
insert into captains (id, full_name, phone_masked, licensed, license_expires_on, active) values
  ('cap-7', 'Zaid Al-Momani',  '+962 7• ••• •• 44', true, '2028-05-31', true),
  ('cap-8', 'Tariq Al-Zoubi',  '+962 7• ••• •• 52', true, '2028-08-31', true),
  ('cap-9', 'Rami Al-Khatib',  '+962 7• ••• •• 89', true, '2028-11-30', true)
on conflict (id) do update set full_name = excluded.full_name, phone_masked = excluded.phone_masked,
  licensed = excluded.licensed, license_expires_on = excluded.license_expires_on, active = excluded.active;

insert into vehicles (id, captain_id, make_model, color, plate, category, licensed_capacity, eligible) values
  ('veh-7', 'cap-7', 'Hyundai Ioniq',  'White',  '27-61204', 'sedan', 4, true),
  ('veh-8', 'cap-8', 'Toyota Camry',   'Silver', '28-33910', 'sedan', 4, true),
  ('veh-9', 'cap-9', 'Kia Cerato',     'Pearl',  '29-50822', 'sedan', 4, true)
on conflict (id) do update set captain_id = excluded.captain_id, make_model = excluded.make_model,
  color = excluded.color, plate = excluded.plate, category = excluded.category,
  licensed_capacity = excluded.licensed_capacity, eligible = excluded.eligible;

-- 2. JUNI Points & Group Notifications tables
alter table profiles add column if not exists points_balance int not null default 120;
alter table profiles add column if not exists default_pickup_id text references pickup_areas(id);

create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  delta int not null,
  reason text not null,
  label text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_points_ledger_profile on points_ledger(profile_id, created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  kind text not null check (kind in (
    'trip_accepted', 'captain_reassigned', 'trip_started',
    'rider_picked_up', 'trip_completed', 'last_seat_points', 'ride_points'
  )),
  title text not null,
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_recipient on notifications(recipient_id, created_at desc);

-- Helper to notify all active riders in a group
create or replace function core.notify_group(
  p_group uuid, p_kind text, p_title text, p_body text, p_meta jsonb default '{}'::jsonb, p_now timestamptz default now()
) returns void language plpgsql as $$
begin
  insert into notifications (recipient_id, group_id, booking_id, kind, title, body, meta, created_at)
  select b.rider_id, p_group, b.id, p_kind, p_title, p_body, p_meta, p_now
    from bookings b
   where b.group_id = p_group and b.status <> 'cancelled' and not exists (
     select 1 from profiles p where p.id = b.rider_id and p.is_seed
   );
end $$;

-- 3. Update _confirm so accepting a trip notifies every rider in the group
create or replace function core._confirm(p_group uuid, p_now timestamptz) returns void language plpgsql as $$
declare
  g groups%rowtype;
  cap_name text;
  veh_label text;
  veh_plate text;
  camp_code text;
begin
  update groups set status = 'confirmed', captain_confirmed_at = p_now where id = p_group returning * into g;
  update bookings set status = 'confirmed' where group_id = p_group and status in ('seat_booked', 'awaiting_captain');

  if g.captain_id is not null then
    select c.full_name into cap_name from captains c where c.id = g.captain_id;
    select v.make_model, v.plate into veh_label, veh_plate from vehicles v where v.id = g.vehicle_id;
    select code into camp_code from campuses where id = g.campus_id;

    insert into captain_dispatch_audit (group_id, captain_id, outcome, detail, created_at)
    values (p_group, g.captain_id, 'ACCEPTED_BY_CAPTAIN', coalesce(cap_name, 'Captain') || ' accepted group', p_now);

    insert into notifications (recipient_id, group_id, booking_id, kind, title, body, meta, created_at)
    select b.rider_id, p_group, b.id, 'trip_accepted',
           'Ride Confirmed · ' || coalesce(cap_name, 'Captain') || ' Accepted',
           coalesce(cap_name, 'Your captain') || ' (' || coalesce(veh_label, 'Sedan') || ' · ' || coalesce(veh_plate, '') || ') confirmed your group to ' || coalesce(camp_code, 'Campus') || '. Pickup at ' || pa.name || '.',
           jsonb_build_object(
             'captain_name', cap_name,
             'vehicle', veh_label,
             'plate', veh_plate,
             'campus_code', camp_code,
             'gate_name', pa.name
           ),
           p_now
      from bookings b
      join pickup_areas pa on pa.id = b.pickup_area_id
      join profiles p on p.id = b.rider_id
     where b.group_id = p_group and b.status <> 'cancelled' and not p.is_seed;
  end if;
end $$;

-- 4. Fix captain_decline: audit trail, anti-ping-pong reassignment, safe status fallback, and rider notification
create or replace function core.captain_decline(p_captain text, p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
  r record;
  seats int;
  next_cap text;
  next_name text;
  old_name text;
  camp_code text;
begin
  g := core._captain_group(p_captain, p_group);
  if g.status not in ('full', 'awaiting_captain') then perform core.fail('GROUP_NOT_AWAITING'); end if;

  select full_name into old_name from captains where id = p_captain;
  select code into camp_code from campuses where id = g.campus_id;

  insert into captain_dispatch_audit (group_id, captain_id, outcome, detail, created_at)
  values (g.id, p_captain, 'DECLINED_BY_CAPTAIN', coalesce(old_name, p_captain) || ' declined run', p_now);

  update groups set captain_id = null, vehicle_id = null where id = g.id;
  seats := core.seats_booked(g.id);

  -- First pass: eligible captains who have NOT previously declined this group
  for r in
    select c.id as cid, v.id as vid, c.full_name, c.licensed, c.active, c.license_expires_on, v.eligible, v.licensed_capacity
      from captains c join vehicles v on v.captain_id = c.id
     where c.id <> p_captain
     order by
       case when exists (
         select 1 from captain_dispatch_audit a
          where a.group_id = g.id and a.captain_id = c.id and a.outcome = 'DECLINED_BY_CAPTAIN'
       ) then 1 else 0 end,
       c.id
  loop
    if not (r.licensed and r.active and r.eligible and r.license_expires_on >= (p_now at time zone 'Asia/Amman')::date
            and r.licensed_capacity >= greatest(seats, 1)) then
      if r.license_expires_on < (p_now at time zone 'Asia/Amman')::date then
        insert into captain_dispatch_audit (group_id, captain_id, outcome, detail, created_at)
        values (g.id, r.cid, 'SKIPPED_EXPIRED_LICENSE', r.full_name || ' skipped (expired license)', p_now);
      end if;
      continue;
    end if;
    if core.captain_busy(r.cid, g.id) then
      insert into captain_dispatch_audit (group_id, captain_id, outcome, detail, created_at)
      values (g.id, r.cid, 'SKIPPED_TIME_CONFLICT', r.full_name || ' busy on overlapping trip', p_now);
      continue;
    end if;
    perform core._set_captain(g.id, r.cid, r.vid);
    next_cap := r.cid;
    next_name := r.full_name;
    insert into captain_dispatch_audit (group_id, captain_id, outcome, detail, created_at)
    values (g.id, r.cid, 'ASSIGNED', r.full_name || ' offered run after decline', p_now);
    exit;
  end loop;

  if next_cap is null then
    -- Keep status 'full' (not 'awaiting_captain' with null captain) so rider UI stays accurate
    update groups set status = 'full' where id = g.id;
  else
    update groups set status = 'awaiting_captain' where id = g.id;
    perform core.notify_group(
      g.id,
      'captain_reassigned',
      'Captain Reassigned · ' || next_name,
      coalesce(old_name, 'Previous captain') || ' passed this run. Offered to licensed captain ' || next_name || ' for ' || coalesce(camp_code, 'Campus') || '.',
      jsonb_build_object('previous_captain', old_name, 'captain_id', next_cap, 'captain_name', next_name),
      p_now
    );
  end if;

  return jsonb_build_object('group_id', g.id, 'reassigned_to', next_cap, 'reassigned_name', next_name);
end $$;

-- 5. Notify group on trip start, every rider pickup, and trip completion (+10 pts)
create or replace function core.start_trip(p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
  cap_name text;
  camp_code text;
begin
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  if g.status <> 'confirmed' then perform core.fail('GROUP_NOT_CONFIRMED'); end if;
  update groups set status = 'in_progress' where id = g.id;
  update bookings set status = 'in_progress' where group_id = g.id and status = 'confirmed';

  select full_name into cap_name from captains where id = g.captain_id;
  select code into camp_code from campuses where id = g.campus_id;
  perform core.notify_group(
    g.id,
    'trip_started',
    'Captain En Route · Live Tracking Active',
    coalesce(cap_name, 'Your captain') || ' started the pickup run to ' || coalesce(camp_code, 'Campus') || '. Watch live ETA & stops.',
    jsonb_build_object('captain_name', cap_name, 'campus_code', camp_code),
    p_now
  );
  return jsonb_build_object('group_id', g.id, 'status', 'in_progress');
end $$;

create or replace function core.captain_pickup(p_captain text, p_group uuid, p_booking uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
  picked_b bookings%rowtype;
  picked_name text;
  gate_name text;
  camp_code text;
  picked_cnt int;
  total_cnt int;
  rem_campus int;
begin
  g := core._captain_group(p_captain, p_group);
  if g.status <> 'in_progress' then perform core.fail('TRIP_NOT_STARTED'); end if;
  update bookings set picked_up_at = coalesce(picked_up_at, p_now)
   where id = p_booking and group_id = p_group and status = 'in_progress'
   returning * into picked_b;
  if not found then perform core.fail('BOOKING_NOT_FOUND'); end if;

  select core.first_name(full_name) into picked_name from profiles where id = picked_b.rider_id;
  select name into gate_name from pickup_areas where id = picked_b.pickup_area_id;
  select code into camp_code from campuses where id = g.campus_id;
  select count(*) filter (where picked_up_at is not null)::int,
         count(*)::int
    into picked_cnt, total_cnt
    from bookings where group_id = p_group and status <> 'cancelled';

  rem_campus := greatest(3, round(extract(epoch from (g.arrival_target_at - p_now)) / 60)::int);

  insert into notifications (recipient_id, group_id, booking_id, kind, title, body, meta, created_at)
  select b.rider_id, p_group, b.id, 'rider_picked_up',
         case when b.id = p_booking
              then 'You’re On Board! (' || picked_cnt || '/' || total_cnt || ' picked up)'
              else picked_name || ' Picked Up · ' || picked_cnt || '/' || total_cnt || ' On Board'
         end,
         case when b.id = p_booking
              then 'Boarded at ' || gate_name || '. ' || greatest(total_cnt - picked_cnt, 0) || ' rider(s) remaining · ~' || rem_campus || ' min to ' || camp_code || '.'
              when b.picked_up_at is not null
              then picked_name || ' boarded at ' || gate_name || ' (' || picked_cnt || '/' || total_cnt || ' in car) · ~' || rem_campus || ' min to ' || camp_code || '.'
              else picked_name || ' boarded at ' || gate_name || ' (' || picked_cnt || '/' || total_cnt || ' picked up). Captain arriving at your gate soon!'
         end,
         jsonb_build_object(
           'picked_up_count', picked_cnt,
           'total_riders', total_cnt,
           'picked_name', picked_name,
           'gate_name', gate_name,
           'remaining_minutes', rem_campus
         ),
         p_now
    from bookings b
    join profiles p on p.id = b.rider_id
   where b.group_id = p_group and b.status <> 'cancelled' and not p.is_seed;

  return jsonb_build_object('booking_id', p_booking, 'picked_up', true, 'picked_up_count', picked_cnt, 'total_riders', total_cnt);
end $$;

create or replace function core.complete_trip(p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
  camp_code text;
  b record;
begin
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  if g.status <> 'in_progress' then perform core.fail('TRIP_NOT_STARTED'); end if;
  update groups set status = 'completed' where id = g.id;
  update bookings set status = 'completed' where group_id = g.id and status = 'in_progress';

  select code into camp_code from campuses where id = g.campus_id;
  for b in
    select bk.id, bk.rider_id, p.is_seed
      from bookings bk join profiles p on p.id = bk.rider_id
     where bk.group_id = g.id and bk.status = 'completed'
  loop
    if not b.is_seed then
      update profiles set points_balance = points_balance + 10 where id = b.rider_id;
      insert into points_ledger (profile_id, booking_id, delta, reason, label, created_at)
      values (b.rider_id, b.id, 10, 'ride_completed', 'Completed ride to ' || coalesce(camp_code, 'Campus'), p_now);
      insert into notifications (recipient_id, group_id, booking_id, kind, title, body, meta, created_at)
      values (b.rider_id, g.id, b.id, 'trip_completed',
              'Arrived at ' || coalesce(camp_code, 'Campus') || ' · +10 pts',
              'Trip completed! +10 JUNI Points added to your balance.',
              jsonb_build_object('points_earned', 10, 'campus_code', camp_code), p_now);
    end if;
  end loop;

  return jsonb_build_object('group_id', g.id, 'status', 'completed');
end $$;

-- 6. Award +30 JUNI Points when a non-seed rider fills the last seat in core.pay
create or replace function core.pay(p_profile uuid, p_hold uuid, p_outcome text, p_key uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  stored jsonb;
  h seat_holds%rowtype;
  g groups%rowtype;
  ds demo_settings%rowtype;
  prof profiles%rowtype;
  failed boolean;
  route jsonb;
  areas text[];
  s jsonb;
  pickup_at timestamptz;
  bid uuid;
  bcode text;
  pcode text;
  bstatus booking_status;
  booked int;
  pts_awarded int := 0;
  res jsonb;
begin
  select result into stored from idempotency_results where key = p_key and fn = 'pay';
  if found then return stored; end if;
  if p_outcome not in ('success', 'failed') then perform core.fail('INVALID_INPUT'); end if;

  select * into h from seat_holds where id = p_hold and rider_id = p_profile;
  if not found then perform core.fail('HOLD_NOT_FOUND'); end if;
  perform core.enforce_deadline(h.group_id, p_now);
  select * into g from groups where id = h.group_id for update;
  select * into h from seat_holds where id = p_hold;
  if h.released_at is not null or h.expires_at <= p_now then perform core.fail('HOLD_EXPIRED'); end if;

  select * into prof from profiles where id = p_profile;
  select * into ds from demo_settings where profile_id = p_profile;
  failed := (p_outcome = 'failed') or coalesce(ds.force_payment_failure, false);
  if coalesce(ds.force_payment_failure, false) then
    update demo_settings set force_payment_failure = false where profile_id = p_profile;
  end if;
  pcode := core.rand_code('PAY-');

  if failed then
    insert into payments (code, hold_id, booking_id, amount_fils, outcome, idempotency_key, created_at)
    values (pcode, h.id, null, h.quoted_fare_fils, 'failed', p_key, p_now);
    update seat_holds set released_at = p_now, release_reason = 'payment_failed' where id = h.id;
    res := jsonb_build_object('outcome', 'failed', 'booking_id', null, 'booking_code', null,
                              'payment_code', pcode, 'status', 'payment_failed');
    insert into idempotency_results (key, fn, result) values (p_key, 'pay', res);
    return res;
  end if;

  if g.status <> 'open' then perform core.fail('GROUP_NOT_OPEN'); end if;

  if not exists (select 1 from group_stops where group_id = g.id and pickup_area_id = h.pickup_area_id) then
    select array_agg(pickup_area_id) into areas from group_stops where group_id = g.id;
    route := core.build_route(g.campus_id, areas || h.pickup_area_id, g.arrival_target_at, false);
    delete from group_stops where group_id = g.id;
    for s in select * from jsonb_array_elements(route->'stops') loop
      insert into group_stops (group_id, seq, pickup_area_id, eta_at)
      values (g.id, (s->>'seq')::int, s->>'pickup_area_id', (s->>'eta_at')::timestamptz);
    end loop;
    update groups set departure_at = (route->>'departure_at')::timestamptz, route_minutes = (route->>'route_minutes')::int,
                      route_km = (route->>'route_km')::numeric, route_version = route_version + 1,
                      travel_source = route->>'travel_source'
     where id = g.id;
    update bookings b set pickup_at = core.route_eta(route, b.pickup_area_id)
     where b.group_id = g.id and b.status <> 'cancelled';
  end if;
  select eta_at into pickup_at from group_stops where group_id = g.id and pickup_area_id = h.pickup_area_id;

  booked := core.seats_booked(g.id) + 1;
  bstatus := case when booked >= g.capacity then 'awaiting_captain' else 'seat_booked' end;
  bcode := core.rand_code('JUNI-');
  insert into bookings (code, rider_id, group_id, hold_id, pickup_area_id, pickup_at, fare_fils, refund_rule, status, created_at)
  values (bcode, p_profile, g.id, h.id, h.pickup_area_id, pickup_at, h.quoted_fare_fils,
          'Full refund ≥12h before pickup; no refund <12h; no cancellation after start', bstatus, p_now)
  returning id into bid;
  insert into payments (code, hold_id, booking_id, amount_fils, outcome, idempotency_key, created_at)
  values (pcode, h.id, bid, h.quoted_fare_fils, 'success', p_key, p_now);
  update seat_holds set released_at = p_now, release_reason = 'converted' where id = h.id;

  if (select coalesce(sum(fare_fils), 0) from bookings where group_id = g.id and status <> 'cancelled') > g.fare_cap_fils then
    perform core.fail('FARE_OVER_CAP');
  end if;

  if booked >= g.capacity then
    update groups set status = 'awaiting_captain' where id = g.id;
    update bookings set status = 'awaiting_captain' where group_id = g.id and status = 'seat_booked';
    perform core.try_assign_captain(g.id, p_now);

    if not coalesce(prof.is_seed, false) then
      pts_awarded := 30;
      update profiles set points_balance = points_balance + 30 where id = p_profile;
      insert into points_ledger (profile_id, booking_id, delta, reason, label, created_at)
      values (p_profile, bid, 30, 'last_seat_bonus', 'Filled the last seat (4/4 bonus)', p_now);
      insert into notifications (recipient_id, group_id, booking_id, kind, title, body, meta, created_at)
      values (p_profile, g.id, bid, 'last_seat_points',
              'Last Seat Offer Unlocked · +30 pts!',
              'You filled the final seat in your campus group and earned +30 JUNI Points!',
              jsonb_build_object('points_earned', 30), p_now);
    end if;
  end if;

  res := jsonb_build_object('outcome', 'success', 'booking_id', bid, 'booking_code', bcode,
                            'payment_code', pcode, 'status', bstatus, 'points_awarded', pts_awarded);
  insert into idempotency_results (key, fn, result) values (p_key, 'pay', res);
  return res;
end $$;

-- 7. Enrich _booking_json and booking_detail with live pickup counts & member boarding telemetry
create or replace function core._booking_json(p_booking uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'status', b.status, 'fare_fils', b.fare_fils, 'pickup_at', b.pickup_at,
    'picked_up', b.picked_up_at is not null, 'picked_up_at', b.picked_up_at,
    'picked_up_count', (select count(*)::int from bookings x where x.group_id = g.id and x.status <> 'cancelled' and x.picked_up_at is not null),
    'total_riders', (select count(*)::int from bookings x where x.group_id = g.id and x.status <> 'cancelled'),
    'pickup_area', jsonb_build_object('id', pa.id, 'name', pa.name, 'name_ar', pa.name_ar, 'detail', pa.detail, 'gate_landmark_en', pa.gate_landmark_en),
    'campus', jsonb_build_object('id', c.id, 'label', c.label, 'code', c.code, 'name_ar', c.name_ar, 'short_ar', c.short_ar),
    'group_id', g.id, 'group_status', g.status, 'pref', g.pref, 'departure_at', g.departure_at,
    'arrival_at', g.arrival_target_at, 'route_minutes', g.route_minutes,
    'captain', case when g.captain_id is null then null else jsonb_build_object('id', cp.id, 'name', cp.full_name, 'phone_masked', cp.phone_masked) end,
    'captain_confirmed', g.captain_confirmed_at is not null,
    'vehicle', case when g.vehicle_id is null then null else jsonb_build_object('make_model', v.make_model, 'color', v.color, 'plate', v.plate) end,
    'cancelled_by', b.cancelled_by, 'cancelled_at', b.cancelled_at,
    'refund', (select jsonb_build_object('amount_fils', r.amount_fils, 'reason', r.reason, 'hours_before_pickup', r.hours_before_pickup)
                 from refunds r where r.booking_id = b.id),
    'payment_code', (select p.code from payments p where p.booking_id = b.id order by p.created_at limit 1),
    'seats_taken', core.seats_booked(g.id), 'capacity', g.capacity)
  from bookings b
  join groups g on g.id = b.group_id
  join campuses c on c.id = g.campus_id
  join pickup_areas pa on pa.id = b.pickup_area_id
  left join captains cp on cp.id = g.captain_id
  left join vehicles v on v.id = g.vehicle_id
  where b.id = p_booking
$$;

create or replace function core.booking_detail(p_profile uuid, p_booking uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  b bookings%rowtype;
  g groups%rowtype;
  res jsonb;
begin
  select * into b from bookings where id = p_booking and rider_id = p_profile;
  if not found then perform core.fail('BOOKING_NOT_FOUND'); end if;
  perform core.enforce_deadline(b.group_id, p_now);
  select * into g from groups where id = b.group_id;
  res := core._booking_json(b.id);
  return res || jsonb_build_object(
    'app_now', p_now,
    'hours_to_pickup', round((extract(epoch from (b.pickup_at - p_now)) / 3600)::numeric, 2),
    'route_km', g.route_km, 'travel_source', g.travel_source, 'group_fare_fils', g.group_fare_fils,
    'fare_cap_fils', g.fare_cap_fils, 'refund_rule', b.refund_rule,
    'stops', (select coalesce(jsonb_agg(jsonb_build_object(
                'seq', s.seq, 'pickup_area_id', s.pickup_area_id, 'name', pa.name, 'name_ar', pa.name_ar, 'eta_at', s.eta_at,
                'picked_count', (select count(*)::int from bookings bx where bx.group_id = g.id and bx.pickup_area_id = s.pickup_area_id and bx.status <> 'cancelled' and bx.picked_up_at is not null),
                'rider_count', (select count(*)::int from bookings bx where bx.group_id = g.id and bx.pickup_area_id = s.pickup_area_id and bx.status <> 'cancelled')
              ) order by s.seq), '[]')
                from group_stops s join pickup_areas pa on pa.id = s.pickup_area_id where s.group_id = g.id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                'first_name', core.first_name(p.full_name), 'verified', p.verified,
                'is_you', p.id = p_profile, 'picked_up', x.picked_up_at is not null,
                'picked_up_at', x.picked_up_at, 'pickup_name', pa2.name, 'pickup_at', x.pickup_at
              ) order by x.created_at), '[]')
                  from bookings x
                  join profiles p on p.id = x.rider_id
                  join pickup_areas pa2 on pa2.id = x.pickup_area_id
                 where x.group_id = g.id and x.status <> 'cancelled'));
end $$;

-- 8. Clean up notifications & points_ledger on demo_reset_user
create or replace function core.demo_reset_user(p_profile uuid) returns void language plpgsql as $$
declare mine uuid[]; gids uuid[];
begin
  select coalesce(array_agg(g.id), '{}') into gids from groups g
   where g.created_by = p_profile
     and not exists (select 1 from bookings b where b.group_id = g.id and b.rider_id <> p_profile)
     and not exists (select 1 from seat_holds h where h.group_id = g.id and h.rider_id <> p_profile);
  select coalesce(array_agg(id), '{}') into mine from bookings where rider_id = p_profile or group_id = any(gids);
  delete from notifications where recipient_id = p_profile or booking_id = any(mine) or group_id = any(gids);
  delete from points_ledger where profile_id = p_profile or booking_id = any(mine);
  update profiles set points_balance = 120 where id = p_profile;
  delete from refunds where booking_id = any(mine);
  delete from incidents where booking_id = any(mine) or group_id = any(gids);
  delete from payments where booking_id = any(mine)
     or hold_id in (select id from seat_holds where rider_id = p_profile or group_id = any(gids));
  delete from bookings where id = any(mine);
  delete from seat_holds where rider_id = p_profile or group_id = any(gids);
  delete from group_stops where group_id = any(gids);
  delete from groups where id = any(gids);
  delete from ride_requests where rider_id = p_profile;
  update demo_settings set clock_offset_minutes = 0, force_travel_outage = false, force_payment_failure = false
   where profile_id = p_profile;
end $$;
