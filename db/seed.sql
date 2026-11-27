-- Idempotent seed. Removes every seed-owned row, then re-inserts. Run via scripts/seed.mjs.
-- Reference data (campuses, pickup areas, captains, vehicles) is owned by migration 0005.

-- 1. Remove seed-owned data: groups created by seed riders and everything hanging off them.
create temp table _seed_groups on commit drop as
  select g.id from groups g join profiles p on p.id = g.created_by where p.is_seed;
create temp table _seed_bookings on commit drop as
  select b.id from bookings b
   where b.group_id in (select id from _seed_groups)
      or b.rider_id in (select id from profiles where is_seed);
delete from refunds   where booking_id in (select id from _seed_bookings);
delete from incidents where group_id in (select id from _seed_groups) or booking_id in (select id from _seed_bookings);
delete from payments  where booking_id in (select id from _seed_bookings)
                         or hold_id in (select id from seat_holds where group_id in (select id from _seed_groups)
                                                                   or rider_id in (select id from profiles where is_seed));
delete from bookings  where id in (select id from _seed_bookings);
delete from seat_holds where group_id in (select id from _seed_groups) or rider_id in (select id from profiles where is_seed);
delete from group_stops where group_id in (select id from _seed_groups);
delete from groups where id in (select id from _seed_groups);
delete from ride_requests where rider_id in (select id from profiles where is_seed);
delete from profiles where is_seed;

-- 2. Seed riders (handoff §7.4).
insert into profiles (full_name, gender, verified, is_seed) values
  ('Lina A.',   'female', true, true),
  ('Rama K.',   'female', true, true),
  ('Noor M.',   'female', true, true),
  ('Dana S.',   'female', true, true),
  ('Haya T.',   'female', true, true),
  ('Sara B.',   'female', true, true),
  ('Khaled R.', 'male',   true, true),
  ('Mahmoud J.','male',   true, true),
  ('Zaid F.',   'male',   true, true),
  ('Hamza Q.',  'male',   true, true),
  ('Ali N.',    'male',   true, true),
  ('Yousef H.', 'male',   true, true);
