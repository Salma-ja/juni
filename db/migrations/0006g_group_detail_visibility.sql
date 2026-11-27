-- Review follow-up: group_detail is a read, so it no longer runs deadline enforcement (which writes, and would
-- apply a demo user's clock offset to a shared group). It also refuses groups the rider is not eligible to see:
-- wrong campus for the request, or a preference the rider's gender does not satisfy.
create or replace function core.group_detail(p_profile uuid, p_group uuid, p_request uuid, p_now timestamptz)
returns jsonb language plpgsql as $$
declare
  prof profiles%rowtype;
  req ride_requests%rowtype;
  g groups%rowtype;
  info jsonb;
begin
  select * into prof from profiles where id = p_profile;
  select * into req from ride_requests where id = p_request and rider_id = p_profile;
  if not found then perform core.fail('REQUEST_NOT_FOUND'); end if;
  select * into g from groups where id = p_group;
  if not found then perform core.fail('GROUP_NOT_FOUND'); end if;
  if g.campus_id <> req.campus_id then perform core.fail('GROUP_NOT_FOUND'); end if;
  if not core.pref_ok(g.pref, prof.gender)
     and not exists (select 1 from bookings b where b.group_id = g.id and b.rider_id = p_profile) then
    perform core.fail('PREF_MISMATCH');
  end if;
  info := core.candidate_info(p_group, req.pickup_area_id, p_profile, p_now);
  return info - 'too_soon' - 'shift_ok' - 'overlap' || jsonb_build_object(
    'pickup_area_id', req.pickup_area_id,
    'refund_rule', 'Full refund ≥12h before pickup; no refund <12h; no cancellation after start');
end $$;
