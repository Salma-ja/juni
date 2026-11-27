-- core: cancellation, trip progression, SOS and read models (§5.7, §5.8, §9).

create or replace function core.cancel_booking(p_profile uuid, p_booking uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  b bookings%rowtype;
  g groups%rowtype;
  full_refund boolean;
  reason text;
  refund int;
  hrs numeric;
begin
  select * into b from bookings where id = p_booking and rider_id = p_profile;
  if not found then perform core.fail('BOOKING_NOT_FOUND'); end if;
  perform core.enforce_deadline(b.group_id, p_now);        -- locks the group
  select * into g from groups where id = b.group_id for update;
  select * into b from bookings where id = p_booking;
  if b.status = 'cancelled' then perform core.fail('ALREADY_CANCELLED'); end if;
  if g.status in ('in_progress', 'completed', 'cancelled') then perform core.fail('CANCEL_NOT_ALLOWED'); end if;

  hrs := round((extract(epoch from (b.pickup_at - p_now)) / 3600)::numeric, 2);
  full_refund := (b.pickup_at - p_now) >= interval '12 hours';
  if full_refund then
    refund := b.fare_fils;
    reason := 'rider_12h_plus';
  else
    refund := 0;
    reason := 'rider_late_no_refund';
  end if;

  update bookings set status = 'cancelled', cancelled_by = 'rider', cancelled_at = p_now where id = b.id;
  insert into refunds (booking_id, amount_fils, reason, hours_before_pickup, decided_at)
  values (b.id, refund, reason, hrs, p_now);

  if full_refund and g.status in ('full', 'awaiting_captain') then
    update groups set status = 'open', captain_id = null, vehicle_id = null where id = g.id;
    update bookings set status = 'seat_booked' where group_id = g.id and status = 'awaiting_captain';
  end if;
  return jsonb_build_object('booking_id', b.id, 'refund_fils', refund, 'reason', reason, 'hours_before_pickup', hrs);
end $$;

create or replace function core.start_trip(p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
begin
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  if g.status <> 'confirmed' then perform core.fail('GROUP_NOT_CONFIRMED'); end if;
  update groups set status = 'in_progress' where id = g.id;
  update bookings set status = 'in_progress' where group_id = g.id and status = 'confirmed';
  return jsonb_build_object('group_id', g.id, 'status', 'in_progress');
end $$;

create or replace function core.complete_trip(p_group uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  g groups%rowtype;
begin
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  if g.status <> 'in_progress' then perform core.fail('TRIP_NOT_STARTED'); end if;
  update groups set status = 'completed' where id = g.id;
  update bookings set status = 'completed' where group_id = g.id and status = 'in_progress';
  return jsonb_build_object('group_id', g.id, 'status', 'completed');
end $$;

create or replace function core.log_sos(p_profile uuid, p_booking uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  b bookings%rowtype;
  c text := core.rand_code('SAFE-');
begin
  select * into b from bookings where id = p_booking and rider_id = p_profile;
  if not found then perform core.fail('BOOKING_NOT_FOUND'); end if;
  insert into incidents (code, group_id, booking_id, actor, kind, detail, created_at)
  values (c, b.group_id, b.id, 'rider', 'sos', jsonb_build_object('booking_code', b.code), p_now);
  return jsonb_build_object('code', c, 'created_at', p_now);
end $$;

-- One booking as the app shows it.
create or replace function core._booking_json(p_booking uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', b.id, 'code', b.code, 'status', b.status, 'fare_fils', b.fare_fils, 'pickup_at', b.pickup_at,
    'pickup_area', jsonb_build_object('id', pa.id, 'name', pa.name, 'detail', pa.detail),
    'campus', jsonb_build_object('id', c.id, 'label', c.label, 'code', c.code),
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

create or replace function core.my_bookings(p_profile uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  gid uuid;
  upcoming jsonb; active jsonb; past jsonb;
begin
  for gid in select distinct group_id from bookings where rider_id = p_profile and status in ('seat_booked', 'awaiting_captain', 'confirmed') loop
    perform core.enforce_deadline(gid, p_now);
  end loop;
  select coalesce(jsonb_agg(core._booking_json(id) order by pickup_at), '[]') into upcoming
    from bookings where rider_id = p_profile and status in ('seat_booked', 'awaiting_captain', 'confirmed');
  select coalesce(jsonb_agg(core._booking_json(id) order by pickup_at), '[]') into active
    from bookings where rider_id = p_profile and status = 'in_progress';
  select coalesce(jsonb_agg(core._booking_json(id) order by pickup_at desc), '[]') into past
    from bookings where rider_id = p_profile and status in ('completed', 'cancelled');
  return jsonb_build_object('app_now', p_now, 'upcoming', upcoming, 'active', active, 'past', past);
end $$;

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
    'stops', (select coalesce(jsonb_agg(jsonb_build_object('seq', s.seq, 'name', pa.name, 'eta_at', s.eta_at) order by s.seq), '[]')
                from group_stops s join pickup_areas pa on pa.id = s.pickup_area_id where s.group_id = g.id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('first_name', core.first_name(p.full_name), 'verified', p.verified,
                                                             'is_you', p.id = p_profile) order by x.created_at), '[]')
                  from bookings x join profiles p on p.id = x.rider_id where x.group_id = g.id and x.status <> 'cancelled'));
end $$;

-- Group page for a rider planning to join at the request's pickup.
create or replace function core.group_detail(p_profile uuid, p_group uuid, p_request uuid, p_now timestamptz) returns jsonb language plpgsql as $$
declare
  req ride_requests%rowtype;
  info jsonb;
begin
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;
  if not exists (select 1 from groups where id = p_group) then perform core.fail('GROUP_NOT_FOUND'); end if;
  perform core.enforce_deadline(p_group, p_now);
  info := core.candidate_info(p_group, req.pickup_area_id, p_profile, p_now);
  return info - 'too_soon' - 'shift_ok' - 'overlap' || jsonb_build_object(
    'pickup_area_id', req.pickup_area_id,
    'refund_rule', 'Full refund ≥12h before pickup; no refund <12h; no cancellation after start');
end $$;
