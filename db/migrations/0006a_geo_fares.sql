-- core: helpers, deterministic travel model (§5.1) and fares (§5.3).

create or replace function core.fail(p_code text) returns void language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end $$;

create or replace function core.rand_code(p_prefix text) returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  bytes bytea := gen_random_bytes(6);
  out text := '';
  i int;
begin
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return p_prefix || out;
end $$;

-- §8.2: demo users may shift the clock; everyone else gets now().
create or replace function core.app_now(p_profile uuid) returns timestamptz language sql stable as $$
  select now() + make_interval(mins => coalesce(
    (select clock_offset_minutes from demo_settings where profile_id = p_profile), 0))
$$;

create or replace function core.outage(p_profile uuid) returns boolean language sql stable as $$
  select coalesce((select force_travel_outage from demo_settings where profile_id = p_profile), false)
$$;

create or replace function core.pref_ok(p_pref group_pref, p_gender gender) returns boolean language sql immutable as $$
  select case p_pref
    when 'girls_only' then p_gender = 'female'
    when 'boys_only'  then p_gender = 'male'
    else true end
$$;

create or replace function core.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371.0 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- road factor 1.35, rounded to 2 decimals
create or replace function core.leg_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns numeric language sql immutable as $$
  select round((core.haversine_km(lat1, lng1, lat2, lng2) * 1.35)::numeric, 2)
$$;

-- 37.5 km/h average (1.6 min per km) times peak factor, plus 2 min urban overhead
create or replace function core.leg_min(p_km numeric, p_peak numeric) returns int language sql immutable as $$
  select ceil(p_km * 1.6 * p_peak)::int + 2
$$;

create or replace function core.peak_factor(p_arrival timestamptz) returns numeric language sql stable as $$
  select case
    when (p_arrival at time zone 'Asia/Amman')::time between time '07:00' and time '09:30' then 1.25
    when (p_arrival at time zone 'Asia/Amman')::time between time '13:00' and time '14:30' then 1.25
    else 1.0 end
$$;

-- direct km from a pickup area to a campus
create or replace function core.area_km(p_area text, p_campus text) returns numeric language sql stable as $$
  select core.leg_km(a.lat, a.lng, c.lat, c.lng) from pickup_areas a, campuses c where a.id = p_area and c.id = p_campus
$$;

-- mean leg_km from all pickup areas to each campus
create or replace view core.campus_ref_km as
  select c.id as campus_id, round(avg(core.leg_km(p.lat, p.lng, c.lat, c.lng)), 2) as ref_km
    from campuses c cross join pickup_areas p
   group by c.id;

-- Route for a set of pickup areas (one stop per area), farthest first.
-- Returns {route_minutes, route_km, travel_source, peak_factor, departure_at, stops:[{seq,pickup_area_id,name,eta_at}]}
create or replace function core.build_route(p_campus text, p_areas text[], p_arrival timestamptz, p_outage boolean)
returns jsonb language plpgsql stable as $$
declare
  c campuses%rowtype;
  areas text[];
  n_req int;
  n_found int;
  peak numeric;
  r record;
  v_leg_km numeric;
  v_leg_min int;
  offs int := 0;
  total_min int := 0;
  total_km numeric := 0;
  stops jsonb := '[]'::jsonb;
  seq int := 0;
  src text := 'model';
  dep timestamptz;
begin
  select * into c from campuses where id = p_campus;
  select coalesce(array_agg(distinct x), '{}') into areas from unnest(p_areas) x;
  n_req := coalesce(cardinality(areas), 0);
  select count(*) into n_found from pickup_areas where id = any(areas);
  peak := core.peak_factor(p_arrival);

  if p_outage or c.id is null or n_req = 0 or n_found <> n_req then
    -- §5.1 fallback
    src := 'fallback';
    total_min := 45;
    total_km := 20;
    dep := p_arrival - make_interval(mins => 45);
    for r in select u.id, pa.name from unnest(areas) as u(id) left join pickup_areas pa on pa.id = u.id order by u.id loop
      seq := seq + 1;
      stops := stops || jsonb_build_object('seq', seq, 'pickup_area_id', r.id, 'name', r.name,
                 'eta_at', dep + make_interval(mins => ((seq - 1) * 45) / n_req));
    end loop;
  else
    for r in
      with s as (
        select pa.id, pa.name, pa.lat, pa.lng, core.leg_km(pa.lat, pa.lng, c.lat, c.lng) as dkm
          from pickup_areas pa where pa.id = any(areas)
      ), o as (
        select s.*, row_number() over (order by s.dkm desc, s.id) as seq from s
      )
      select o.*, lead(o.lat) over (order by o.seq) as nlat, lead(o.lng) over (order by o.seq) as nlng
        from o order by o.seq
    loop
      if r.nlat is null then
        v_leg_km := r.dkm;                                  -- last stop to campus
      else
        v_leg_km := core.leg_km(r.lat, r.lng, r.nlat, r.nlng);
      end if;
      v_leg_min := core.leg_min(v_leg_km, peak);
      stops := stops || jsonb_build_object('seq', r.seq, 'pickup_area_id', r.id, 'name', r.name, 'offset', offs);
      offs := offs + v_leg_min + 2;
      total_min := total_min + v_leg_min;
      total_km := total_km + v_leg_km;
    end loop;
    total_min := total_min + 2 * (n_req - 1);               -- dwell: 2 min per stop after the first
    dep := p_arrival - make_interval(mins => total_min);
    select jsonb_agg(jsonb_build_object('seq', (e->>'seq')::int, 'pickup_area_id', e->>'pickup_area_id',
                                        'name', e->>'name',
                                        'eta_at', dep + make_interval(mins => (e->>'offset')::int))
                     order by (e->>'seq')::int)
      into stops from jsonb_array_elements(stops) e;
  end if;

  return jsonb_build_object('route_minutes', total_min, 'route_km', total_km, 'travel_source', src,
                            'peak_factor', peak, 'departure_at', dep, 'stops', stops);
end $$;

create or replace function core.route_eta(p_route jsonb, p_area text) returns timestamptz language sql immutable as $$
  select (e->>'eta_at')::timestamptz from jsonb_array_elements(p_route->'stops') e where e->>'pickup_area_id' = p_area
$$;

-- Pure fare function (§5.3). p_direct_km holds the km of all C seats, rider at p_rider_index (1-based).
-- share = G * (S + 3*C*d) / (4*C*S)  ==  G * (0.25/C + 0.75*d/S), computed with integers (km x100) so floor is exact.
create or replace function core.fare_share(p_group_fare int, p_capacity int, p_direct_km numeric[], p_rider_index int,
                                           p_frozen_sum int, p_is_last boolean)
returns int language plpgsql immutable as $$
declare
  mx numeric; mn numeric; s numeric; d numeric; num bigint; den bigint;
begin
  if p_is_last then
    return p_group_fare - p_frozen_sum;
  end if;
  select max(x), min(x), sum(x) into mx, mn, s from unnest(p_direct_km) x;
  if mx - mn <= 2.0 then
    return p_group_fare / p_capacity;
  end if;
  d := p_direct_km[p_rider_index];
  num := p_group_fare::bigint * round((s + 3 * p_capacity * d) * 100)::bigint;
  den := 4::bigint * p_capacity * round(s * 100)::bigint;
  return (num / den)::int;
end $$;

-- Group fare is fixed at creation from the first rider's direct distance.
create or replace function core.group_fare(p_campus text, p_first_area text) returns int language sql stable as $$
  select least(6000, (round((3000 + 200 * core.area_km(p_first_area, p_campus)) / 10) * 10)::int)
$$;
