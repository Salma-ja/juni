-- Captain (driver) mode: a demo profile can be linked to a seeded captain and drive the trips assigned to them.
alter table profiles add column if not exists captain_id text references captains(id);
alter table bookings add column if not exists picked_up_at timestamptz;

create or replace function core._captain_group(p_captain text, p_group uuid) returns groups language plpgsql as $$
declare g groups%rowtype;
begin
  select * into g from groups where id = p_group for update;
  if not found or g.captain_id is distinct from p_captain then perform core.fail('NOT_YOUR_TRIP'); end if;
  return g;
end $$;

create or replace function core.captain_trips(p_captain text, p_now timestamptz) returns jsonb language plpgsql as $$
declare gid uuid;
begin
  for gid in select id from groups where captain_id = p_captain and status in ('full', 'awaiting_captain', 'open') loop
    perform core.enforce_deadline(gid, p_now);
  end loop;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'group_id', g.id, 'status', g.status, 'pref', g.pref,
      'campus', jsonb_build_object('id', c.id, 'label', c.label, 'code', c.code),
      'departure_at', g.departure_at, 'arrival_at', g.arrival_target_at, 'route_minutes', g.route_minutes,
      'route_km', g.route_km, 'seats_taken', core.seats_booked(g.id), 'capacity', g.capacity,
      'confirmed', g.captain_confirmed_at is not null,
      'vehicle', jsonb_build_object('make_model', v.make_model, 'color', v.color, 'plate', v.plate),
      'collected_fils', core.collected_fils(g.id), 'payout_fils', (core.collected_fils(g.id) * 80) / 100,
      'stops', (select coalesce(jsonb_agg(jsonb_build_object('seq', s.seq, 'name', pa.name, 'detail', pa.detail, 'eta_at', s.eta_at,
          'riders', (select coalesce(jsonb_agg(jsonb_build_object('booking_id', b.id, 'first_name', core.first_name(p.full_name),
                       'picked_up', b.picked_up_at is not null) order by b.created_at), '[]'::jsonb)
                       from bookings b join profiles p on p.id = b.rider_id
                      where b.group_id = g.id and b.pickup_area_id = s.pickup_area_id and b.status <> 'cancelled'))
          order by s.seq), '[]'::jsonb)
          from group_stops s join pickup_areas pa on pa.id = s.pickup_area_id where s.group_id = g.id))
      order by g.departure_at), '[]'::jsonb)
  from groups g join campuses c on c.id = g.campus_id left join vehicles v on v.id = g.vehicle_id
  where g.captain_id = p_captain and g.status in ('awaiting_captain', 'full', 'confirmed', 'in_progress', 'completed'));
end $$;

create or replace function core.captain_confirm(p_captain text, p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
begin
  perform core._captain_group(p_captain, p_group);
  return core.confirm_captain(p_group, p_now);
end $$;

-- Decline an unconfirmed trip: the group is offered to the next eligible captain (never back to the decliner).
create or replace function core.captain_decline(p_captain text, p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare g groups%rowtype; r record; seats int; next_cap text;
begin
  g := core._captain_group(p_captain, p_group);
  if g.status not in ('full', 'awaiting_captain') then perform core.fail('GROUP_NOT_AWAITING'); end if;
  update groups set captain_id = null, vehicle_id = null where id = g.id;
  seats := core.seats_booked(g.id);
  for r in select c.id as cid, v.id as vid from captains c join vehicles v on v.captain_id = c.id where c.id <> p_captain order by c.id loop
    if core.captain_eligible(r.cid, r.vid, greatest(seats, 1), p_now) and not core.captain_busy(r.cid, g.id) then
      perform core._set_captain(g.id, r.cid, r.vid);
      next_cap := r.cid;
      exit;
    end if;
  end loop;
  return jsonb_build_object('group_id', g.id, 'reassigned_to', next_cap);
end $$;

create or replace function core.captain_start(p_captain text, p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
begin
  perform core._captain_group(p_captain, p_group);
  return core.start_trip(p_group, p_now);
end $$;

create or replace function core.captain_pickup(p_captain text, p_group uuid, p_booking uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare g groups%rowtype;
begin
  g := core._captain_group(p_captain, p_group);
  if g.status <> 'in_progress' then perform core.fail('TRIP_NOT_STARTED'); end if;
  update bookings set picked_up_at = coalesce(picked_up_at, p_now)
   where id = p_booking and group_id = p_group and status = 'in_progress';
  if not found then perform core.fail('BOOKING_NOT_FOUND'); end if;
  return jsonb_build_object('booking_id', p_booking, 'picked_up', true);
end $$;

create or replace function core.captain_complete(p_captain text, p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare g groups%rowtype;
begin
  g := core._captain_group(p_captain, p_group);
  if g.status <> 'in_progress' then perform core.fail('TRIP_NOT_STARTED'); end if;
  if exists (select 1 from bookings where group_id = p_group and status = 'in_progress' and picked_up_at is null) then
    perform core.fail('PICKUPS_PENDING');
  end if;
  return core.complete_trip(p_group, p_now);
end $$;

create or replace function core.captain_earnings(p_captain text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'completed_trips', count(*)::int,
    'total_payout_fils', coalesce(sum((core.collected_fils(g.id) * 80) / 100), 0)::int,
    'trips', coalesce(jsonb_agg(jsonb_build_object('group_id', g.id, 'departure_at', g.departure_at, 'campus_code', c.code,
        'riders', core.seats_booked(g.id), 'payout_fils', (core.collected_fils(g.id) * 80) / 100) order by g.departure_at desc), '[]'::jsonb))
  from groups g join campuses c on c.id = g.campus_id where g.captain_id = p_captain and g.status = 'completed'
$$;
