-- Review follow-up: demo reset removes only the caller's own bookings, holds and requests. Groups the caller created
-- are deleted only when nobody else has a booking or hold in them; otherwise they stay for the other riders.
create or replace function core.demo_reset_user(p_profile uuid) returns void language plpgsql as $$
declare mine uuid[]; gids uuid[];
begin
  select coalesce(array_agg(g.id), '{}') into gids from groups g
   where g.created_by = p_profile
     and not exists (select 1 from bookings b where b.group_id = g.id and b.rider_id <> p_profile)
     and not exists (select 1 from seat_holds h where h.group_id = g.id and h.rider_id <> p_profile);
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
