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

-- 3. Seed groups (handoff §7.5): next 5 working days (Sun-Thu, Asia/Amman) x each campus x 6 groups.
-- Members are booked through core.create_request / create_group / start_checkout / pay with p_now = now().
do $seed$
declare
  today date := (now() at time zone 'Asia/Amman')::date;
  d date;
  k int := 0;
  found_days int := 0;
  camp record;
  spec jsonb;
  specs jsonb := '[
    {"time":"07:50","pref":"girls_only","members":[["Lina A.","hawara"],["Rama K.","hawara"],["Noor M.","al-husn"]]},
    {"time":"07:50","pref":"any","members":[["Khaled R.","sareeh"],["Dana S.","aidoun"],["Yousef H.","sareeh"]]},
    {"time":"07:50","pref":"boys_only","members":[["Mahmoud J.","ramtha"]]},
    {"time":"08:50","pref":"any","members":[["Haya T.","irbid-downtown"],["Zaid F.","university-st"],["Hamza Q.","hawara"],["Ali N.","sareeh"]]},
    {"time":"09:50","pref":"girls_only","members":[["Sara B.","jerash"]]},
    {"time":"10:50","pref":"boys_only","members":[["Yousef H.","hawara"]]}
  ]'::jsonb;
  m jsonb;
  i int;
  arrival timestamptz;
  rider uuid;
  req jsonb;
  gid uuid;
  hold jsonb;
  rv int;
  cap text;
begin
  while found_days < 5 loop
    k := k + 1;
    d := today + k;
    if extract(dow from d) in (0, 1, 2, 3, 4) then           -- Sunday to Thursday
      found_days := found_days + 1;
      for camp in select id from campuses order by case id when 'just' then 1 when 'yarmouk' then 2 else 3 end loop
        for spec in select * from jsonb_array_elements(specs) loop
          arrival := ((d::text || ' ' || (spec->>'time'))::timestamp) at time zone 'Asia/Amman';
          i := 0;
          gid := null;
          for m in select * from jsonb_array_elements(spec->'members') loop
            i := i + 1;
            select id into rider from profiles where is_seed and full_name = m->>0;
            req := core.create_request(rider, camp.id, m->>1, arrival + interval '10 minutes', (spec->>'pref')::group_pref, now());
            if i = 1 then
              gid := (core.create_group(rider, (req->>'request_id')::uuid, now()))->>'group_id';
            end if;
            select route_version into rv from groups where id = gid;
            hold := core.start_checkout(rider, gid, m->>1, rv, gen_random_uuid(), now());
            perform core.pay(rider, (hold->>'hold_id')::uuid, 'success', gen_random_uuid(), now());
          end loop;
          -- The 08:50 group fills at seed time and pay auto-assigns the lowest free captain. Reassign from the
          -- highest ids (cap-4, cap-3, cap-2 by campus) so cap-1 stays free for the 07:50 demo group.
          if (spec->>'time') = '08:50' then
            cap := case camp.id when 'just' then 'cap-4' when 'yarmouk' then 'cap-3' else 'cap-2' end;
            update groups set captain_id = null, vehicle_id = null where id = gid;
            perform core.assign_captain(gid, cap, 'veh-' || substr(cap, 5), now());
          end if;
        end loop;
      end loop;
    end if;
  end loop;
end
$seed$;
