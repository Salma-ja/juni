-- core: requests, departure, search, groups, checkout, payment (§5.2, §5.5).

create or replace function core.first_name(p_name text) returns text language sql immutable as $$
  select split_part(p_name, ' ', 1)
$$;

create or replace function core.create_request(p_profile uuid, p_campus text, p_pickup text, p_class_start timestamptz,
                                               p_pref group_pref, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  prof profiles%rowtype;
  arrival timestamptz;
  route jsonb;
  pref group_pref;
  rid uuid;
begin
  select * into prof from profiles where id = p_profile;
  if not found then perform core.fail('NO_SESSION'); end if;
  if not exists (select 1 from campuses where id = p_campus) or not exists (select 1 from pickup_areas where id = p_pickup)
     or p_class_start is null then
    perform core.fail('INVALID_INPUT');
  end if;
  arrival := p_class_start - interval '10 minutes';
  route := core.build_route(p_campus, array[p_pickup], arrival, core.outage(p_profile));
  if (route->>'departure_at')::timestamptz < p_now + interval '60 minutes' then
    perform core.fail('TOO_SOON');
  end if;
  pref := coalesce(p_pref, case prof.gender when 'female' then 'girls_only' else 'boys_only' end::group_pref);
  insert into ride_requests (rider_id, campus_id, pickup_area_id, class_start_at, arrival_target_at, pref, created_at)
  values (p_profile, p_campus, p_pickup, p_class_start, arrival, pref, p_now)
  returning id into rid;
  return jsonb_build_object('request_id', rid, 'campus_id', p_campus, 'pickup_area_id', p_pickup,
                            'class_start_at', p_class_start, 'arrival_target_at', arrival, 'pref', pref);
end $$;

-- Everything the app shows about joining group p_group at p_area, plus the §5.2 feasibility flags.
create or replace function core.candidate_info(p_group uuid, p_area text, p_profile uuid, p_now timestamptz)
returns jsonb language plpgsql stable as $$
declare
  g groups%rowtype;
  areas text[];
  route jsonb;
  pickup_at timestamptz;
  new_dep timestamptz;
  q jsonb;
  shift_ok boolean := true;
  overlap boolean;
  b record;
  members jsonb;
begin
  select * into g from groups where id = p_group;
  select coalesce(array_agg(pickup_area_id), '{}') into areas from group_stops where group_id = g.id;
  areas := areas || p_area;
  route := core.build_route(g.campus_id, areas, g.arrival_target_at, core.outage(p_profile));
  new_dep := (route->>'departure_at')::timestamptz;
  pickup_at := core.route_eta(route, p_area);

  if route->>'travel_source' = 'model' then
    for b in select pickup_area_id, pickup_at as at from bookings where group_id = g.id and status <> 'cancelled' loop
      if abs(extract(epoch from (core.route_eta(route, b.pickup_area_id) - b.at))) > 600 then
        shift_ok := false;
      end if;
    end loop;
  end if;

  select exists (select 1 from bookings x where x.rider_id = p_profile and x.status <> 'cancelled'
                    and abs(extract(epoch from (x.pickup_at - pickup_at))) <= 3 * 3600) into overlap;

  q := core.quote(g.id, p_area, p_profile, p_now);

  select coalesce(jsonb_agg(jsonb_build_object('first_name', core.first_name(p.full_name), 'verified', p.verified)
                            order by b2.created_at), '[]'::jsonb)
    into members from bookings b2 join profiles p on p.id = b2.rider_id
   where b2.group_id = g.id and b2.status <> 'cancelled';

  return jsonb_build_object(
    'group_id', g.id, 'campus_id', g.campus_id, 'status', g.status, 'pref', g.pref, 'route_version', g.route_version,
    'departure_at', new_dep, 'pickup_at', pickup_at, 'arrival_at', g.arrival_target_at,
    'route_minutes', (route->>'route_minutes')::int, 'travel_source', route->>'travel_source',
    'added_minutes', greatest((route->>'route_minutes')::int - g.route_minutes, 0),
    'seats_taken', core.seats_booked(g.id) + core.seats_held(g.id, p_now), 'capacity', g.capacity,
    'fare_fils', q->'fare_fils', 'fare_cap_fils', g.fare_cap_fils, 'group_fare_fils', g.group_fare_fils,
    'stops', (select coalesce(jsonb_agg(e->'name' order by (e->>'seq')::int), '[]'::jsonb) from jsonb_array_elements(route->'stops') e),
    'members', members,
    'too_soon', new_dep < p_now + interval '60 minutes',
    'shift_ok', shift_ok, 'overlap', overlap,
    'full', coalesce((q->>'full')::boolean, false), 'over_cap', coalesce((q->>'over_cap')::boolean, false));
end $$;

-- Side-effect-light search used by search_groups and recommend_departure.
create or replace function core._search(p_profile uuid, p_request uuid, p_pref group_pref, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  prof profiles%rowtype;
  req ride_requests%rowtype;
  g groups%rowtype;
  info jsonb;
  cands jsonb[] := '{}';
  n_window int := 0;
  c_noseats int := 0; c_pref int := 0; c_soon int := 0; c_route int := 0; c_overlap int := 0;
  reason text;
  best int;
  out jsonb;
begin
  select * into prof from profiles where id = p_profile;
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;

  for g in select * from groups
            where campus_id = req.campus_id
              and arrival_target_at between req.arrival_target_at - interval '15 minutes' and req.class_start_at - interval '5 minutes'
            order by id
  loop
    perform core.enforce_deadline(g.id, p_now);
    select * into g from groups where id = g.id;
    n_window := n_window + 1;

    if g.status <> 'open' or core.seats_booked(g.id) + core.seats_held(g.id, p_now) >= g.capacity then
      c_noseats := c_noseats + 1; continue;
    end if;
    if not core.pref_ok(g.pref, prof.gender) or (p_pref <> 'any' and g.pref <> p_pref) then
      c_pref := c_pref + 1; continue;
    end if;
    info := core.candidate_info(g.id, req.pickup_area_id, p_profile, p_now);
    if (info->>'too_soon')::boolean then c_soon := c_soon + 1; continue; end if;
    if not (info->>'shift_ok')::boolean then c_route := c_route + 1; continue; end if;
    if (info->>'overlap')::boolean then c_overlap := c_overlap + 1; continue; end if;
    if (info->>'full')::boolean or (info->>'over_cap')::boolean then c_route := c_route + 1; continue; end if;
    cands := cands || (info || jsonb_build_object('arr_diff', abs(extract(epoch from (g.arrival_target_at - req.arrival_target_at)))));
  end loop;

  select coalesce(jsonb_agg(x - 'arr_diff' - 'too_soon' - 'shift_ok' - 'overlap' - 'full' - 'over_cap'), '[]'::jsonb) into out
    from (select x from unnest(cands) x
           order by (x->>'fare_fils')::int, (x->>'added_minutes')::int, (x->>'arr_diff')::numeric, x->>'group_id'
           limit 5) t;

  if jsonb_array_length(out) = 0 then
    if n_window = 0 then reason := 'NO_GROUPS_AT_TIME';
    else
      best := greatest(c_noseats, c_pref, c_soon, c_route, c_overlap);
      -- most specific reason among those eliminating the most groups
      reason := case
        when c_soon = best then 'TOO_SOON'
        when c_route = best then 'ROUTE_INFEASIBLE'
        when c_overlap = best then 'BOOKING_OVERLAP'
        when c_pref = best then 'PREF_NONE'
        else 'NO_SEATS' end;
    end if;
  end if;
  return jsonb_build_object('request_id', p_request, 'candidates', out, 'reason', reason, 'filter', p_pref);
end $$;

create or replace function core.search_groups(p_profile uuid, p_request uuid, p_pref group_pref, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  req ride_requests%rowtype;
  pref group_pref;
  res jsonb;
begin
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;
  pref := coalesce(p_pref, req.pref);
  res := core._search(p_profile, p_request, pref, p_now);
  update ride_requests
     set pref = pref_new.v,
         status = case when jsonb_array_length(res->'candidates') > 0 then 'matched' else 'unmatched' end::request_status
    from (select pref as v) pref_new
   where id = p_request;
  return res;
end $$;

create or replace function core.recommend_departure(p_profile uuid, p_request uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  req ride_requests%rowtype;
  route jsonb;
  alt jsonb;
  srch jsonb;
begin
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;
  route := core.build_route(req.campus_id, array[req.pickup_area_id], req.arrival_target_at, core.outage(p_profile));
  srch := core._search(p_profile, p_request, 'any', p_now);
  alt := srch->'candidates'->1;
  return jsonb_build_object(
    'request_id', req.id, 'campus_id', req.campus_id, 'pickup_area_id', req.pickup_area_id,
    'departure_at', route->>'departure_at', 'route_minutes', (route->>'route_minutes')::int,
    'route_km', (route->>'route_km')::numeric, 'arrival_at', req.arrival_target_at, 'class_start_at', req.class_start_at,
    'minutes_before_class', 10, 'peak_factor', (route->>'peak_factor')::numeric, 'travel_source', route->>'travel_source',
    'alternative', case when alt is null then null else jsonb_build_object('group_id', alt->'group_id', 'departure_at', alt->'departure_at') end);
end $$;

create or replace function core.create_group(p_profile uuid, p_request uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  prof profiles%rowtype;
  req ride_requests%rowtype;
  route jsonb;
  pref group_pref;
  gid uuid;
  s jsonb;
begin
  select * into prof from profiles where id = p_profile;
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;
  route := core.build_route(req.campus_id, array[req.pickup_area_id], req.arrival_target_at, core.outage(p_profile));
  if (route->>'departure_at')::timestamptz < p_now + interval '60 minutes' then
    perform core.fail('TOO_SOON');
  end if;
  pref := case when req.pref = 'girls_only' and prof.gender = 'female' then 'girls_only'
               when req.pref = 'boys_only' and prof.gender = 'male' then 'boys_only'
               else 'any' end;
  insert into groups (campus_id, pref, arrival_target_at, departure_at, route_minutes, route_km, group_fare_fils,
                      travel_source, created_by, created_at)
  values (req.campus_id, pref, req.arrival_target_at, (route->>'departure_at')::timestamptz,
          (route->>'route_minutes')::int, (route->>'route_km')::numeric,
          core.group_fare(req.campus_id, req.pickup_area_id), route->>'travel_source', p_profile, p_now)
  returning id into gid;
  for s in select * from jsonb_array_elements(route->'stops') loop
    insert into group_stops (group_id, seq, pickup_area_id, eta_at)
    values (gid, (s->>'seq')::int, s->>'pickup_area_id', (s->>'eta_at')::timestamptz);
  end loop;
  update ride_requests set status = 'matched' where id = p_request;
  return core.candidate_info(gid, req.pickup_area_id, p_profile, p_now);
end $$;

create or replace function core.start_checkout(p_profile uuid, p_group uuid, p_pickup text, p_route_version int,
                                               p_key uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  prof profiles%rowtype;
  g groups%rowtype;
  stored jsonb;
  info jsonb;
  pickup_at timestamptz;
  exp timestamptz;
  hid uuid;
  res jsonb;
begin
  select result into stored from idempotency_results where key = p_key and fn = 'start_checkout';
  if found then return stored; end if;

  select * into prof from profiles where id = p_profile;
  if not found then perform core.fail('NO_SESSION'); end if;
  if not exists (select 1 from pickup_areas where id = p_pickup) then perform core.fail('INVALID_INPUT'); end if;

  perform core.enforce_deadline(p_group, p_now);          -- locks the group
  select * into g from groups where id = p_group for update;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  perform core.release_expired_holds(g.id, p_now);

  -- §5.5 order
  if not prof.verified then perform core.fail('NOT_VERIFIED'); end if;
  if not core.pref_ok(g.pref, prof.gender) then perform core.fail('PREF_MISMATCH'); end if;
  if exists (select 1 from bookings b where b.group_id = g.id and b.rider_id = p_profile and b.status <> 'cancelled')
     or exists (select 1 from seat_holds h where h.group_id = g.id and h.rider_id = p_profile
                 and h.released_at is null and h.expires_at > p_now) then
    perform core.fail('ALREADY_BOOKED');
  end if;
  -- A group that is full by payment (full / awaiting_captain) reports GROUP_FULL, not GROUP_NOT_OPEN (T01).
  if g.status not in ('open', 'full', 'awaiting_captain') then perform core.fail('GROUP_NOT_OPEN'); end if;
  if core.seats_booked(g.id) + core.seats_held(g.id, p_now) >= g.capacity then perform core.fail('GROUP_FULL'); end if;
  if p_route_version is distinct from g.route_version then perform core.fail('QUOTE_STALE'); end if;

  info := core.candidate_info(g.id, p_pickup, p_profile, p_now);
  pickup_at := (info->>'pickup_at')::timestamptz;
  if pickup_at < p_now + interval '60 minutes' then perform core.fail('TOO_SOON'); end if;
  if (info->>'over_cap')::boolean then perform core.fail('FARE_OVER_CAP'); end if;

  exp := p_now + interval '5 minutes';
  insert into seat_holds (group_id, rider_id, pickup_area_id, quoted_fare_fils, route_version, expires_at, idempotency_key, created_at)
  values (g.id, p_profile, p_pickup, (info->>'fare_fils')::int, g.route_version, exp, p_key, p_now)
  returning id into hid;

  res := jsonb_build_object('hold_id', hid, 'group_id', g.id, 'pickup_area_id', p_pickup, 'expires_at', exp,
                            'app_now', p_now, 'fare_fils', (info->>'fare_fils')::int, 'pickup_at', pickup_at,
                            'departure_at', info->>'departure_at', 'campus_id', g.campus_id,
                            'route_version', g.route_version, 'inside_12h', (pickup_at - p_now) < interval '12 hours');
  insert into idempotency_results (key, fn, result) values (p_key, 'start_checkout', res);
  return res;
end $$;

create or replace function core.pay(p_profile uuid, p_hold uuid, p_outcome text, p_key uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  stored jsonb;
  h seat_holds%rowtype;
  g groups%rowtype;
  ds demo_settings%rowtype;
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
  res jsonb;
begin
  select result into stored from idempotency_results where key = p_key and fn = 'pay';
  if found then return stored; end if;
  if p_outcome not in ('success', 'failed') then perform core.fail('INVALID_INPUT'); end if;

  select * into h from seat_holds where id = p_hold and rider_id = p_profile;
  if not found then perform core.fail('HOLD_NOT_FOUND'); end if;
  perform core.enforce_deadline(h.group_id, p_now);        -- locks the group
  select * into g from groups where id = h.group_id for update;
  select * into h from seat_holds where id = p_hold;
  if h.released_at is not null or h.expires_at <= p_now then perform core.fail('HOLD_EXPIRED'); end if;

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

  -- A new pickup area becomes a stop now (booking time, not hold time); the route version moves with it.
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
  end if;

  res := jsonb_build_object('outcome', 'success', 'booking_id', bid, 'booking_code', bcode,
                            'payment_code', pcode, 'status', bstatus);
  insert into idempotency_results (key, fn, result) values (p_key, 'pay', res);
  return res;
end $$;
