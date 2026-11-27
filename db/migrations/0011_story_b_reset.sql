-- Story B: the next teaching day's full JUST boys car sits with Faris, waiting to accept or decline.

create or replace function core.reset_rehearsal_seed() returns jsonb language plpgsql as $$
declare
  d1 date := core.next_teaching_day((now() at time zone 'Asia/Amman')::date);
  gid uuid;
  bid uuid;
  rider uuid;
  boys uuid;
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
    exit when bid is null;
    perform core.cancel_booking(rider, bid, now());
    seats := core.seats_booked(gid);
  end loop;

  select g.id into boys from groups g
   where g.campus_id = 'just' and g.pref = 'boys_only'
     and (g.arrival_target_at at time zone 'Asia/Amman')::date = d1
     and core.seats_booked(g.id) >= 4
     and g.status in ('full', 'awaiting_captain', 'confirmed')
   order by case when g.captain_id = 'cap-4' then 0 else 1 end, g.created_at
   limit 1;
  if boys is not null then
    update groups set captain_id = 'cap-4', vehicle_id = 'veh-4', status = 'awaiting_captain', captain_confirmed_at = null
     where id = boys;
    update bookings set status = 'awaiting_captain'
     where group_id = boys and status in ('seat_booked', 'confirmed', 'awaiting_captain');
  end if;

  return jsonb_build_object(
    'ok', true, 'teaching_day', d1, 'group_id', gid, 'seats_taken', core.seats_booked(gid),
    'story_b', boys, 'story_b_captain', case when boys is null then null else 'cap-4' end
  );
end $$;
