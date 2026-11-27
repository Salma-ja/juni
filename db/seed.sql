-- Idempotent seed. Removes every seed-owned row, then re-inserts across all 5 universities (JUST, YU, INU, UJ, AAU).
-- Reference data (campuses, pickup areas, captains, vehicles) is owned by migrations 0005 & 0013.

-- 1. Remove seed-owned data: groups created by seed riders and everything hanging off them.
create temp table _seed_groups on commit drop as
  select g.id from groups g join profiles p on p.id = g.created_by where p.is_seed;
create temp table _seed_bookings on commit drop as
  select b.id from bookings b
   where b.group_id in (select id from _seed_groups)
      or b.rider_id in (select id from profiles where is_seed);
delete from notifications where group_id in (select id from _seed_groups) or booking_id in (select id from _seed_bookings);
delete from points_ledger where booking_id in (select id from _seed_bookings);
delete from captain_dispatch_audit where group_id in (select id from _seed_groups);
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

-- 2. Seed riders (verified female & male students across corridors).
insert into profiles (full_name, gender, verified, is_seed) values
  ('Lina A.',    'female', true, true),
  ('Rama K.',    'female', true, true),
  ('Noor M.',    'female', true, true),
  ('Dana S.',    'female', true, true),
  ('Haya T.',    'female', true, true),
  ('Sara B.',    'female', true, true),
  ('Maya Z.',    'female', true, true),
  ('Leen K.',    'female', true, true),
  ('Aya M.',     'female', true, true),
  ('Khaled R.',  'male',   true, true),
  ('Mahmoud J.', 'male',   true, true),
  ('Zaid F.',    'male',   true, true),
  ('Hamza Q.',   'male',   true, true),
  ('Ali N.',     'male',   true, true),
  ('Yousef H.',  'male',   true, true),
  ('Tariq S.',   'male',   true, true),
  ('Sami D.',    'male',   true, true),
  ('Kareem B.',  'male',   true, true);

-- 3. Seed multiple gender-isolated groups (Girls-only & Boys-only, including 3/4 Last-Seat +30pt groups)
-- across next 5 working days (Sun-Thu, Asia/Amman) x all 5 campuses (JUST, Yarmouk, INU, UJ, AAU).
do $seed$
declare
  today date := (now() at time zone 'Asia/Amman')::date;
  d date;
  k int := 0;
  found_days int := 0;
  camp record;
  spec jsonb;
  irbid_specs jsonb := '[
    {"time":"07:50","pref":"girls_only","members":[["Lina A.","hawara"],["Rama K.","hawara"],["Noor M.","al-husn"]]},
    {"time":"07:45","pref":"girls_only","members":[["Dana S.","aidoun"],["Haya T.","sareeh"],["Maya Z.","university-st"]]},
    {"time":"07:53","pref":"girls_only","members":[["Leen K.","irbid-downtown"],["Aya M.","university-st"]]},
    {"time":"07:50","pref":"boys_only","members":[["Khaled R.","sareeh"],["Tariq S.","hawara"],["Sami D.","aidoun"]]},
    {"time":"07:46","pref":"boys_only","members":[["Mahmoud J.","ramtha"],["Kareem B.","hawara"]]},
    {"time":"08:50","pref":"girls_only","members":[["Sara B.","hawara"],["Dana S.","sareeh"],["Maya Z.","al-husn"]]},
    {"time":"08:50","pref":"boys_only","members":[["Zaid F.","university-st"],["Hamza Q.","hawara"],["Ali N.","sareeh"],["Yousef H.","sareeh"]]},
    {"time":"09:50","pref":"girls_only","members":[["Sara B.","jerash"],["Leen K.","al-husn"]]},
    {"time":"09:50","pref":"boys_only","members":[["Tariq S.","irbid-downtown"],["Kareem B.","university-st"],["Sami D.","sareeh"]]},
    {"time":"10:50","pref":"girls_only","members":[["Aya M.","hawara"],["Haya T.","university-st"],["Noor M.","sareeh"]]},
    {"time":"12:50","pref":"boys_only","members":[["Khaled R.","hawara"],["Mahmoud J.","sareeh"]]}
  ]'::jsonb;
  amman_specs jsonb := '[
    {"time":"07:50","pref":"girls_only","members":[["Lina A.","sweileh"],["Rama K.","jubaiha"],["Noor M.","khalda"]]},
    {"time":"07:45","pref":"girls_only","members":[["Dana S.","tabarbour"],["Haya T.","jubaiha"]]},
    {"time":"07:53","pref":"girls_only","members":[["Maya Z.","sweileh"],["Leen K.","khalda"],["Aya M.","sweileh"]]},
    {"time":"07:50","pref":"boys_only","members":[["Khaled R.","sweileh"],["Tariq S.","jubaiha"],["Sami D.","khalda"]]},
    {"time":"07:46","pref":"boys_only","members":[["Mahmoud J.","tabarbour"],["Kareem B.","jubaiha"]]},
    {"time":"08:50","pref":"girls_only","members":[["Sara B.","khalda"],["Dana S.","sweileh"],["Leen K.","jubaiha"]]},
    {"time":"08:50","pref":"boys_only","members":[["Zaid F.","sweileh"],["Hamza Q.","jubaiha"],["Ali N.","khalda"],["Yousef H.","sweileh"]]},
    {"time":"09:50","pref":"girls_only","members":[["Aya M.","tabarbour"],["Maya Z.","jubaiha"]]},
    {"time":"10:50","pref":"girls_only","members":[["Haya T.","sweileh"],["Noor M.","khalda"],["Sara B.","jubaiha"]]},
    {"time":"12:50","pref":"boys_only","members":[["Khaled R.","sweileh"],["Tariq S.","tabarbour"]]}
  ]'::jsonb;
  active_specs jsonb;
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
      for camp in select id, corridor from campuses order by case id when 'just' then 1 when 'yarmouk' then 2 when 'inu' then 3 when 'uj' then 4 else 5 end loop
        active_specs := case when camp.corridor = 'amman' then amman_specs else irbid_specs end;
        for spec in select * from jsonb_array_elements(active_specs) loop
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
          -- Keep cap-1 (Omar) & cap-9 free for live bookings & decline reassignments by assigning 08:50 full boys runs to dedicated captains
          if (spec->>'time') = '08:50' and (spec->>'pref') = 'boys_only' then
            cap := case camp.id
              when 'just' then 'cap-4'
              when 'yarmouk' then 'cap-3'
              when 'inu' then 'cap-2'
              when 'uj' then 'cap-8'
              else 'cap-7'
            end;
            update groups set captain_id = null, vehicle_id = null where id = gid;
            perform core.assign_captain(gid, cap, 'veh-' || substr(cap, 5), now());
          end if;
        end loop;
      end loop;
    end if;
  end loop;
end
$seed$;
