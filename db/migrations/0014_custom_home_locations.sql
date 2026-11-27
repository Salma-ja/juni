-- 0014: Support rider-specific Custom Home & Current GPS pickup locations for home-to-campus grouping.

alter table pickup_areas
  add column if not exists is_custom boolean not null default false,
  add column if not exists owner_profile_id uuid references profiles(id) on delete cascade,
  add column if not exists location_kind text not null default 'gate'
    check (location_kind in ('gate', 'current_gps', 'custom_home'));

create index if not exists idx_pickup_areas_owner on pickup_areas(owner_profile_id) where is_custom;

-- Keep campus_ref_km strictly computed from standard reference gates so existing fare math & JUST ref_km (17.81) stay invariant
create or replace view core.campus_ref_km as
  select c.id as campus_id, round(avg(core.leg_km(p.lat, p.lng, c.lat, c.lng)), 2) as ref_km
    from campuses c
    join pickup_areas p on p.corridor = c.corridor and not p.is_custom
   group by c.id;

-- Exclude one-off custom home pins from public corridor hotspot highlights unless standard gates
create or replace view core.corridor_demand_stats as
with area_counts as (
  select b.pickup_area_id,
         count(*) filter (where b.status in ('seat_booked', 'awaiting_captain', 'confirmed', 'in_progress')) as active_riders
    from bookings b
    join groups g on g.id = b.group_id
    join pickup_areas pa on pa.id = b.pickup_area_id
   where not pa.is_custom
     and (g.arrival_target_at at time zone 'Asia/Amman')::date >= (now() at time zone 'Asia/Amman')::date
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

-- Clean up custom home/GPS pickup rows on demo_reset_user when unused by other riders
create or replace function core.demo_reset_user(p_profile uuid) returns void language plpgsql as $$
declare mine uuid[]; gids uuid[];
begin
  update profiles set default_pickup_id = null where id = p_profile;
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
  delete from pickup_areas pa
   where pa.is_custom and pa.owner_profile_id = p_profile
     and not exists (select 1 from group_stops gs where gs.pickup_area_id = pa.id)
     and not exists (select 1 from bookings b where b.pickup_area_id = pa.id)
     and not exists (select 1 from seat_holds sh where sh.pickup_area_id = pa.id)
     and not exists (select 1 from ride_requests rr where rr.pickup_area_id = pa.id);
  update demo_settings set clock_offset_minutes = 0, force_travel_outage = false, force_payment_failure = false
   where profile_id = p_profile;
end $$;
