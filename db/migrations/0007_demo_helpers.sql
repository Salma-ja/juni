-- Demo control panel helpers (handoff §8). Every function acts on the caller's own booking or hold,
-- except seed_checkout and release_hold (seed riders) and demo_reset (caller's data, then the seed is re-run).

create or replace function core.demo_booking_group(p_profile uuid, p_booking uuid) returns uuid language plpgsql stable as $$
declare gid uuid;
begin
  select group_id into gid from bookings where id = p_booking and rider_id = p_profile;
  if not found then perform core.fail('BOOKING_NOT_FOUND'); end if;
  return gid;
end $$;

-- Assign the first eligible captain if none, then confirm (T08 -> T10).
create or replace function core.demo_confirm_captain(p_profile uuid, p_booking uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare gid uuid := core.demo_booking_group(p_profile, p_booking); g groups%rowtype;
begin
  select * into g from groups where id = gid for update;
  if g.captain_id is null then
    if core.try_assign_captain(gid, p_now) is null then perform core.fail('CAPTAIN_BUSY'); end if;
  end if;
  return core.confirm_captain(gid, p_now);
end $$;

create or replace function core.demo_assign_captain(p_profile uuid, p_booking uuid, p_captain text, p_now timestamptz) returns jsonb language plpgsql as $$
declare gid uuid := core.demo_booking_group(p_profile, p_booking); v text;
begin
  select id into v from vehicles where captain_id = p_captain;
  if v is null then perform core.fail('INVALID_INPUT'); end if;
  return core.assign_captain(gid, p_captain, v, p_now);
end $$;

create or replace function core.demo_expire_hold(p_profile uuid, p_hold uuid, p_now timestamptz) returns jsonb language plpgsql as $$
begin
  update seat_holds set expires_at = p_now - interval '1 second'
   where id = p_hold and rider_id = p_profile and released_at is null;
  if not found then perform core.fail('HOLD_NOT_FOUND'); end if;
  return jsonb_build_object('hold_id', p_hold, 'expired', true);
end $$;

create or replace function core.demo_release_hold(p_profile uuid, p_hold uuid, p_now timestamptz) returns jsonb language plpgsql as $$
begin
  update seat_holds h set released_at = p_now, release_reason = 'demo_release'
   where h.id = p_hold and h.released_at is null
     and (h.rider_id = p_profile or h.rider_id in (select id from profiles where is_seed));
  return jsonb_build_object('hold_id', p_hold, 'released', found);
end $$;

create or replace function core.demo_start_trip(p_profile uuid, p_booking uuid, p_now timestamptz) returns jsonb language sql as $$
  select core.start_trip(core.demo_booking_group(p_profile, p_booking), p_now)
$$;
create or replace function core.demo_complete_trip(p_profile uuid, p_booking uuid, p_now timestamptz) returns jsonb language sql as $$
  select core.complete_trip(core.demo_booking_group(p_profile, p_booking), p_now)
$$;

-- Open groups with exactly one seat left that the caller may join, with the pickup area to race on (first stop).
create or replace function core.last_seat_groups(p_profile uuid, p_now timestamptz) returns jsonb language plpgsql stable as $$
declare prof profiles%rowtype;
begin
  select * into prof from profiles where id = p_profile;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'group_id', g.id, 'campus_id', g.campus_id, 'campus_code', c.code, 'pref', g.pref, 'departure_at', g.departure_at,
        'route_version', g.route_version, 'pickup_area_id', s.pickup_area_id, 'pickup_name', pa.name,
        'seats_taken', core.seats_booked(g.id) + core.seats_held(g.id, p_now), 'capacity', g.capacity)
      order by g.departure_at, g.id)
      from groups g
      join campuses c on c.id = g.campus_id
      join group_stops s on s.group_id = g.id and s.seq = 1
      join pickup_areas pa on pa.id = s.pickup_area_id
     where g.status = 'open' and g.departure_at > p_now + interval '60 minutes'
       and core.seats_booked(g.id) + core.seats_held(g.id, p_now) = g.capacity - 1
       and core.pref_ok(g.pref, prof.gender)
       and not exists (select 1 from bookings b where b.group_id = g.id and b.rider_id = p_profile and b.status <> 'cancelled')
     limit 12), '[]'::jsonb);
end $$;

-- Check out the group's last seat as a seed rider who fits its preference and has no seat in it.
create or replace function core.seed_checkout(p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare g groups%rowtype; rider profiles%rowtype; area text; hold jsonb;
begin
  select * into g from groups where id = p_group;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  select * into rider from profiles p
   where p.is_seed and core.pref_ok(g.pref, p.gender)
     and not exists (select 1 from bookings b where b.group_id = g.id and b.rider_id = p.id and b.status <> 'cancelled')
     and not exists (select 1 from seat_holds h where h.group_id = g.id and h.rider_id = p.id and h.released_at is null and h.expires_at > p_now)
   order by p.full_name limit 1;
  if not found then perform core.fail('NO_SEED_RIDER'); end if;
  select pickup_area_id into area from group_stops where group_id = g.id and seq = 1;
  hold := core.start_checkout(rider.id, g.id, area, g.route_version, gen_random_uuid(), p_now);
  return hold || jsonb_build_object('seed_rider', core.first_name(rider.full_name));
end $$;

-- Remove everything the caller created or booked, and reset their demo settings. The server then re-runs db/seed.sql.
create or replace function core.demo_reset_user(p_profile uuid) returns void language plpgsql as $$
declare mine uuid[]; gids uuid[];
begin
  select coalesce(array_agg(id), '{}') into gids from groups where created_by = p_profile;
  select coalesce(array_agg(id), '{}') into mine from bookings where rider_id = p_profile or group_id = any(gids);
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
