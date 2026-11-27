-- Final-version audit fixes. The blueprint calls this 0006_final_audit_fixes.sql.
-- 0006a–0006g are already the live rules engine, so this file is 0010 and it
-- alters the real tables (campuses, pickup_areas, groups, bookings), not the
-- core.ride_groups names in the spec draft.

alter table campuses
  add column if not exists name_ar text not null default '',
  add column if not exists short_ar text not null default '',
  add column if not exists corridor_polyline jsonb not null default '[]'::jsonb;

alter table pickup_areas
  add column if not exists name_ar text not null default '',
  add column if not exists gate_landmark_en text not null default '',
  add column if not exists gate_landmark_ar text not null default '';

alter table bookings
  add column if not exists payment_method text not null default 'cash';

alter table bookings drop constraint if exists bookings_payment_method_check;
alter table bookings add constraint bookings_payment_method_check
  check (payment_method in ('cash', 'jeeny_wallet', 'card'));

update campuses set
  name_ar = 'جامعة العلوم والتكنولوجيا الأردنية', short_ar = 'التكنولوجيا',
  corridor_polyline = '[[32.5556,35.8500],[32.5420,35.8560],[32.5800,35.9170],[32.5050,35.9000],[32.4950,35.9910]]'::jsonb
where id = 'just';
update campuses set
  name_ar = 'جامعة اليرموك', short_ar = 'اليرموك',
  corridor_polyline = '[[32.5556,35.8500],[32.5420,35.8560],[32.5370,35.8550]]'::jsonb
where id = 'yarmouk';
update campuses set
  name_ar = 'جامعة إربد الأهلية', short_ar = 'إربد الأهلية',
  corridor_polyline = '[[32.5556,35.8500],[32.4870,35.8800],[32.4090,35.9370]]'::jsonb
where id = 'inu';

update pickup_areas set name_ar = 'حوارة', gate_landmark_en = 'Main highway pedestrian bridge', gate_landmark_ar = 'جسر المشاة' where id = 'hawara';
update pickup_areas set name_ar = 'الصريح', gate_landmark_en = 'Municipal roundabout', gate_landmark_ar = 'دوار بلدية الصريح' where id = 'sareeh';
update pickup_areas set name_ar = 'شارع الجامعة', gate_landmark_en = 'Yarmouk south approach', gate_landmark_ar = 'مقابل إشارة النسيم' where id = 'university-st';
update pickup_areas set name_ar = 'وسط البلد', gate_landmark_en = 'Clock tower transit bay', gate_landmark_ar = 'دوار الساعة' where id = 'irbid-downtown';
update pickup_areas set name_ar = 'الحصن', gate_landmark_en = 'Petra highway junction', gate_landmark_ar = 'مثلث الحصن' where id = 'al-husn';
update pickup_areas set name_ar = 'إيدون', gate_landmark_en = 'Military hospital stop', gate_landmark_ar = 'إشارة المستشفى العسكري' where id = 'aidoun';
update pickup_areas set name_ar = 'الرمثا', gate_landmark_en = 'Ramtha centre gate', gate_landmark_ar = 'وسط الرمثا' where id = 'ramtha';
update pickup_areas set name_ar = 'جرش', gate_landmark_en = 'Jerash bus station', gate_landmark_ar = 'مجمع جرش' where id = 'jerash';

create table if not exists captain_dispatch_audit (
  id bigserial primary key,
  group_id uuid not null references groups(id) on delete cascade,
  captain_id text not null references captains(id),
  outcome text not null check (outcome in (
    'ASSIGNED', 'SKIPPED_EXPIRED_LICENSE', 'SKIPPED_TIME_CONFLICT',
    'SKIPPED_PREVIOUSLY_DECLINED', 'SKIPPED_INACTIVE', 'DECLINED_BY_CAPTAIN', 'ACCEPTED_BY_CAPTAIN'
  )),
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispatch_audit_group on captain_dispatch_audit(group_id, created_at desc);

create or replace function core.next_teaching_day(p_from date default null)
returns date language plpgsql stable as $$
declare
  v_candidate date := coalesce(p_from, (now() at time zone 'Asia/Amman')::date) + 1;
begin
  while extract(dow from v_candidate) in (5, 6) loop
    v_candidate := v_candidate + 1;
  end loop;
  return v_candidate;
end $$;

-- 10-fils largest remainder. Does not replace the live quote function (tests pin those fils).
create or replace function core.allocate_fares_10fils(
  p_car_total_fils integer,
  p_booking_ids text[],
  p_distances_km numeric[]
) returns table(booking_id text, fare_fils integer, solo_estimate_fils integer)
language plpgsql immutable as $$
declare
  v_total_units integer := p_car_total_fils / 10;
  v_count integer := array_length(p_booking_ids, 1);
begin
  if p_car_total_fils % 10 <> 0 then
    raise exception 'car_total_fils (%) must be a multiple of 10 fils', p_car_total_fils;
  end if;
  return query
  with raw_inputs as (
    select unnest(p_booking_ids) as b_id, unnest(p_distances_km) as dist_km
  ),
  totals as (select sum(dist_km) as sum_km from raw_inputs),
  weighted as (
    select r.b_id, r.dist_km,
      (v_total_units::numeric * (0.25 / v_count + 0.75 * (r.dist_km / nullif(t.sum_km, 0)))) as exact_units,
      (round((850 + 195 * r.dist_km) / 50.0) * 50)::integer as solo_fils
    from raw_inputs r cross join totals t
  ),
  floored as (
    select b_id, dist_km, solo_fils, floor(exact_units)::integer as base_units,
           (exact_units - floor(exact_units)) as remainder
    from weighted
  ),
  shortfall as (select (v_total_units - sum(base_units))::integer as rem_units from floored),
  ranked as (
    select f.b_id, f.base_units, f.solo_fils,
           row_number() over (order by f.remainder desc, f.dist_km desc, f.b_id asc) as rn,
           s.rem_units
    from floored f cross join shortfall s
  )
  select b_id, ((base_units + case when rn <= rem_units then 1 else 0 end) * 10)::integer, solo_fils
  from ranked;
end $$;

create or replace view core.corridor_demand_stats as
with area_counts as (
  select b.pickup_area_id,
         count(*) filter (where b.status in ('seat_booked', 'awaiting_captain', 'confirmed', 'in_progress')) as active_riders
    from bookings b
    join groups g on g.id = b.group_id
   where (g.arrival_target_at at time zone 'Asia/Amman')::date >= (now() at time zone 'Asia/Amman')::date
   group by b.pickup_area_id
),
ranked as (
  select pickup_area_id, active_riders,
         rank() over (order by active_riders desc) as demand_rank
    from area_counts
),
slot_counts as (
  select to_char(g.arrival_target_at at time zone 'Asia/Amman', 'HH24:MI') as class_time,
         count(b.id) filter (where b.status in ('seat_booked', 'awaiting_captain', 'confirmed', 'in_progress')) as slot_riders
    from groups g
    left join bookings b on b.group_id = g.id
   where (g.arrival_target_at at time zone 'Asia/Amman')::date >= (now() at time zone 'Asia/Amman')::date
   group by 1
)
select 'pickup_area'::text as stat_type, pickup_area_id as entity_key,
       active_riders::int as rider_count,
       (demand_rank <= 3 and active_riders >= 2) as is_highlighted
  from ranked
union all
select 'class_slot'::text, class_time, slot_riders::int,
       (slot_riders = (select max(slot_riders) from slot_counts) and slot_riders > 0)
  from slot_counts;

-- Log why a captain was skipped, then assign the same first eligible captain as before.
create or replace function core.try_assign_captain(p_group uuid, p_now timestamptz) returns text language plpgsql as $$
declare
  g groups%rowtype;
  r record;
  seats int;
  why text;
begin
  select * into g from groups where id = p_group for update;
  if not found or g.captain_id is not null then
    return g.captain_id;
  end if;
  seats := core.seats_booked(p_group);
  for r in select c.id as captain_id, v.id as vehicle_id, c.licensed, c.active, c.license_expires_on, c.full_name,
                  v.eligible, v.licensed_capacity
             from captains c join vehicles v on v.captain_id = c.id order by c.id loop
    if not (r.licensed and r.active and r.eligible and r.license_expires_on >= (p_now at time zone 'Asia/Amman')::date
            and r.licensed_capacity >= greatest(seats, 1)) then
      why := case when r.license_expires_on < (p_now at time zone 'Asia/Amman')::date then 'SKIPPED_EXPIRED_LICENSE'
                  else 'SKIPPED_INACTIVE' end;
      insert into captain_dispatch_audit (group_id, captain_id, outcome, detail)
      values (p_group, r.captain_id, why, r.full_name || ' skipped');
      continue;
    end if;
    if core.captain_busy(r.captain_id, p_group) then
      insert into captain_dispatch_audit (group_id, captain_id, outcome, detail)
      values (p_group, r.captain_id, 'SKIPPED_TIME_CONFLICT', r.full_name || ' already on an overlapping run');
      continue;
    end if;
    perform core._set_captain(p_group, r.captain_id, r.vehicle_id);
    insert into captain_dispatch_audit (group_id, captain_id, outcome, detail)
    values (p_group, r.captain_id, 'ASSIGNED', r.full_name || ' assigned, not yet accepted');
    return r.captain_id;
  end loop;
  return null;
end $$;

-- Re-open the next teaching day's JUST 07:50 girls car if a rehearsal filled the last seat.
create or replace function core.reset_rehearsal_seed() returns jsonb language plpgsql as $$
declare
  d1 date := core.next_teaching_day((now() at time zone 'Asia/Amman')::date);
  gid uuid;
  bid uuid;
  rider uuid;
  seats int;
begin
  select g.id into gid from groups g
   where g.campus_id = 'just' and g.pref = 'girls_only'
     and (g.arrival_target_at at time zone 'Asia/Amman')::date = d1
     and to_char(g.arrival_target_at at time zone 'Asia/Amman', 'HH24:MI') = '07:50'
   order by g.created_at limit 1;
  if gid is null then
    return jsonb_build_object('ok', false, 'reason', 'NO_STORY_A', 'teaching_day', d1);
  end if;
  seats := core.seats_booked(gid);
  while seats >= 4 loop
    select b.id, b.rider_id into bid, rider
      from bookings b join profiles p on p.id = b.rider_id
     where b.group_id = gid and b.status <> 'cancelled' and p.is_demo
     order by b.created_at desc limit 1;
    if bid is null then exit; end if;
    perform core.cancel_booking(rider, bid, now());
    seats := core.seats_booked(gid);
  end loop;
  return jsonb_build_object('ok', true, 'teaching_day', d1, 'group_id', gid, 'seats_taken', core.seats_booked(gid));
end $$;
