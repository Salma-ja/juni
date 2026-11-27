-- core: seats, holds, quotes, captains, deadline (§4.3, §5.3, §5.6).

-- Bookings that occupy a seat: not cancelled, or cancelled late with no refund (the seat stays paid).
create or replace view core.counted_bookings as
  select b.* from bookings b
   where b.status <> 'cancelled'
      or exists (select 1 from refunds r where r.booking_id = b.id and r.reason = 'rider_late_no_refund');

create or replace function core.seats_booked(p_group uuid) returns int language sql stable as $$
  select count(*)::int from core.counted_bookings where group_id = p_group
$$;

create or replace function core.seats_held(p_group uuid, p_now timestamptz) returns int language sql stable as $$
  select count(*)::int from seat_holds where group_id = p_group and released_at is null and expires_at > p_now
$$;

-- Money collected for a group: fares paid minus refunds issued.
create or replace function core.collected_fils(p_group uuid) returns int language sql stable as $$
  select coalesce(sum(b.fare_fils), 0)::int - coalesce(
    (select sum(r.amount_fils) from refunds r join bookings b2 on b2.id = r.booking_id where b2.group_id = p_group), 0)::int
    from bookings b where b.group_id = p_group
$$;

create or replace function core.release_expired_holds(p_group uuid, p_now timestamptz) returns int language plpgsql as $$
declare n int;
begin
  update seat_holds set released_at = p_now, release_reason = 'expired'
   where group_id = p_group and released_at is null and expires_at <= p_now;
  get diagnostics n = row_count;
  return n;
end $$;

-- Quote a fare for a rider joining at p_area. Counts booked seats and other riders' active holds as filled.
create or replace function core.quote(p_group uuid, p_area text, p_rider uuid, p_now timestamptz)
returns jsonb language plpgsql stable as $$
declare
  g groups%rowtype;
  ref numeric;
  dvec numeric[] := '{}';
  r record;
  filled int;
  frozen int;
  fare int;
  remaining int;
  is_last boolean;
  over boolean;
  i int;
begin
  select * into g from groups where id = p_group;
  select ref_km into ref from core.campus_ref_km where campus_id = g.campus_id;

  for r in
    select b.pickup_area_id from core.counted_bookings b where b.group_id = g.id
    union all
    select h.pickup_area_id from seat_holds h
     where h.group_id = g.id and h.released_at is null and h.expires_at > p_now and h.rider_id <> p_rider
  loop
    dvec := dvec || core.area_km(r.pickup_area_id, g.campus_id);
  end loop;
  filled := coalesce(cardinality(dvec), 0);
  if filled >= g.capacity then
    return jsonb_build_object('full', true, 'filled', filled);
  end if;

  dvec := dvec || core.area_km(p_area, g.campus_id);
  remaining := g.capacity - filled - 1;
  for i in 1..remaining loop
    dvec := dvec || ref;
  end loop;

  select coalesce(sum(b.fare_fils), 0)::int + coalesce((
      select sum(h.quoted_fare_fils) from seat_holds h
       where h.group_id = g.id and h.released_at is null and h.expires_at > p_now and h.rider_id <> p_rider), 0)::int
    into frozen from core.counted_bookings b where b.group_id = g.id;

  is_last := (remaining = 0);
  fare := core.fare_share(g.group_fare_fils, g.capacity, dvec, filled + 1, frozen, is_last);
  over := (frozen + fare > g.fare_cap_fils)
       or (not is_last and frozen + fare > g.group_fare_fils - remaining * 250)
       or fare <= 0;
  return jsonb_build_object('full', false, 'fare_fils', fare, 'over_cap', over, 'filled', filled,
                            'is_last', is_last, 'frozen_sum', frozen);
end $$;

-- ---------- captains ----------

create or replace function core.captain_eligible(p_captain text, p_vehicle text, p_seats int, p_now timestamptz)
returns boolean language sql stable as $$
  select exists (
    select 1 from captains c join vehicles v on v.captain_id = c.id
     where c.id = p_captain and v.id = p_vehicle
       and c.licensed and c.active
       and c.license_expires_on >= (p_now at time zone 'Asia/Amman')::date
       and v.eligible and v.licensed_capacity >= p_seats)
$$;

create or replace function core.captain_busy(p_captain text, p_group uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from groups o, groups g
     where g.id = p_group and o.captain_id = p_captain and o.id <> g.id
       and o.status not in ('cancelled', 'completed')
       and tstzrange(o.departure_at, o.arrival_target_at + interval '60 minutes')
        && tstzrange(g.departure_at, g.arrival_target_at + interval '60 minutes'))
$$;

create or replace function core._set_captain(p_group uuid, p_captain text, p_vehicle text) returns void language plpgsql as $$
begin
  update groups g set captain_id = p_captain, vehicle_id = p_vehicle,
         capacity = least(g.capacity, (select licensed_capacity from vehicles where id = p_vehicle))
   where g.id = p_group;
end $$;

-- Picks the first eligible, non-busy captain by id and assigns (does not confirm). Returns captain id or null.
create or replace function core.try_assign_captain(p_group uuid, p_now timestamptz) returns text language plpgsql as $$
declare
  g groups%rowtype;
  r record;
  seats int;
begin
  select * into g from groups where id = p_group for update;
  if not found or g.captain_id is not null then
    return g.captain_id;
  end if;
  seats := core.seats_booked(p_group);
  for r in select c.id as captain_id, v.id as vehicle_id from captains c join vehicles v on v.captain_id = c.id order by c.id loop
    if core.captain_eligible(r.captain_id, r.vehicle_id, greatest(seats, 1), p_now) and not core.captain_busy(r.captain_id, p_group) then
      perform core._set_captain(p_group, r.captain_id, r.vehicle_id);
      return r.captain_id;
    end if;
  end loop;
  return null;
end $$;

create or replace function core.assign_captain(p_group uuid, p_captain text, p_vehicle text, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
  seats int;
begin
  perform core.enforce_deadline(p_group, p_now);
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  seats := core.seats_booked(p_group);
  if not core.captain_eligible(p_captain, p_vehicle, greatest(seats, 1), p_now) then
    perform core.fail('CAPTAIN_INELIGIBLE');
  end if;
  if g.status not in ('full', 'awaiting_captain') or g.captain_id is not null then
    perform core.fail('GROUP_NOT_AWAITING');
  end if;
  if core.captain_busy(p_captain, p_group) then
    perform core.fail('CAPTAIN_BUSY');
  end if;
  perform core._set_captain(p_group, p_captain, p_vehicle);
  return jsonb_build_object('group_id', p_group, 'captain_id', p_captain, 'vehicle_id', p_vehicle, 'status', g.status);
end $$;

create or replace function core._confirm(p_group uuid, p_now timestamptz) returns void language plpgsql as $$
begin
  update groups set status = 'confirmed', captain_confirmed_at = p_now where id = p_group;
  update bookings set status = 'confirmed' where group_id = p_group and status in ('seat_booked', 'awaiting_captain');
end $$;

create or replace function core.confirm_captain(p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
begin
  perform core.enforce_deadline(p_group, p_now);
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  if g.captain_id is null then perform core.fail('NO_CAPTAIN'); end if;
  if g.status not in ('full', 'awaiting_captain', 'open') then perform core.fail('GROUP_NOT_AWAITING'); end if;
  if not core.captain_eligible(g.captain_id, g.vehicle_id, greatest(core.seats_booked(g.id), 1), p_now) then
    perform core.fail('CAPTAIN_INELIGIBLE');
  end if;
  perform core._confirm(g.id, p_now);
  return jsonb_build_object('group_id', g.id, 'status', 'confirmed', 'captain_id', g.captain_id);
end $$;

-- ---------- cancelling a whole group ----------

create or replace function core._cancel_group(p_group uuid, p_reason text, p_now timestamptz) returns void language plpgsql as $$
declare
  b bookings%rowtype;
begin
  for b in select * from bookings where group_id = p_group and status <> 'cancelled' loop
    insert into refunds (booking_id, amount_fils, reason, hours_before_pickup, decided_at)
    values (b.id, b.fare_fils, p_reason,
            round((extract(epoch from (b.pickup_at - p_now)) / 3600)::numeric, 2), p_now);
    update bookings set status = 'cancelled', cancelled_by = 'platform', cancelled_at = p_now where id = b.id;
  end loop;
  update seat_holds set released_at = p_now, release_reason = 'group_cancelled' where group_id = p_group and released_at is null;
  update groups set status = 'cancelled' where id = p_group;
  insert into incidents (code, group_id, actor, kind, detail)
  values (core.rand_code('SAFE-'), p_group, 'platform', p_reason, jsonb_build_object('at', p_now));
end $$;

-- §5.6 lazy deadline. Returns what it did: none | cancelled_below_floor | cancelled_no_captain | confirmed
create or replace function core.enforce_deadline(p_group uuid, p_now timestamptz) returns text language plpgsql as $$
declare
  g groups%rowtype;
  cap text;
begin
  select * into g from groups where id = p_group for update;
  if not found or g.status not in ('open', 'full', 'awaiting_captain')
     or p_now < g.departure_at - interval '2 hours' then
    return 'none';
  end if;
  if core.collected_fils(g.id) < 3750 then
    perform core._cancel_group(g.id, 'below_floor', p_now);
    return 'cancelled_below_floor';
  end if;
  cap := g.captain_id;
  if cap is null then
    cap := core.try_assign_captain(g.id, p_now);
  end if;
  if cap is null then
    perform core._cancel_group(g.id, 'no_captain', p_now);
    return 'cancelled_no_captain';
  end if;
  perform core._confirm(g.id, p_now);
  return 'confirmed';
end $$;
