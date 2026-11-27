-- §5.7 change: a >=12h cancel also reopens a confirmed group (decision recorded in docs/replit-handoff.md).

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

  -- Decision (user, 2026-11-27): a full-refund cancel reopens the group, including a confirmed one.
  -- The captain is unassigned and unconfirmed, so the seat can be re-booked.
  if full_refund and g.status in ('full', 'awaiting_captain', 'confirmed') then
    update groups set status = 'open', captain_id = null, vehicle_id = null, captain_confirmed_at = null where id = g.id;
    update bookings set status = 'seat_booked' where group_id = g.id and status in ('awaiting_captain', 'confirmed');
  end if;
  return jsonb_build_object('booking_id', b.id, 'refund_fils', refund, 'reason', reason, 'hours_before_pickup', hrs);
end $$;
