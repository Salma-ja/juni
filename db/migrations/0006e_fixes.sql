-- Fixes to 0006c (plpgsql variable/column name clashes).

create or replace function core.candidate_info(p_group uuid, p_area text, p_profile uuid, p_now timestamptz)
returns jsonb language plpgsql stable as $$
declare
  g groups%rowtype;
  areas text[];
  route jsonb;
  v_pickup timestamptz;
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
  v_pickup := core.route_eta(route, p_area);

  if route->>'travel_source' = 'model' then
    for b in select b0.pickup_area_id, b0.pickup_at as at from bookings b0 where group_id = g.id and status <> 'cancelled' loop
      if abs(extract(epoch from (core.route_eta(route, b.pickup_area_id) - b.at))) > 600 then
        shift_ok := false;
      end if;
    end loop;
  end if;

  select exists (select 1 from bookings x where x.rider_id = p_profile and x.status <> 'cancelled'
                    and abs(extract(epoch from (x.pickup_at - v_pickup))) <= 3 * 3600) into overlap;

  q := core.quote(g.id, p_area, p_profile, p_now);

  select coalesce(jsonb_agg(jsonb_build_object('first_name', core.first_name(p.full_name), 'verified', p.verified)
                            order by b2.created_at), '[]'::jsonb)
    into members from bookings b2 join profiles p on p.id = b2.rider_id
   where b2.group_id = g.id and b2.status <> 'cancelled';

  return jsonb_build_object(
    'group_id', g.id, 'campus_id', g.campus_id, 'status', g.status, 'pref', g.pref, 'route_version', g.route_version,
    'departure_at', new_dep, 'pickup_at', v_pickup, 'arrival_at', g.arrival_target_at,
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

create or replace function core.search_groups(p_profile uuid, p_request uuid, p_pref group_pref, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  req ride_requests%rowtype;
  v_pref group_pref;
  res jsonb;
begin
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;
  v_pref := coalesce(p_pref, req.pref);
  res := core._search(p_profile, p_request, v_pref, p_now);
  update ride_requests
     set pref = v_pref,
         status = case when jsonb_array_length(res->'candidates') > 0 then 'matched' else 'unmatched' end::request_status
   where id = p_request;
  return res;
end $$;
