-- Reference data: campuses, pickup areas, captains, vehicles (handoff §7.1-7.3).
insert into campuses (id, code, name, label, lat, lng) values
  ('just',    'JUST', 'Jordan University of Science and Technology', 'JUST Main Campus',   32.4950, 35.9910),
  ('yarmouk', 'YU',   'Yarmouk University',                          'Yarmouk University', 32.5370, 35.8550),
  ('inu',     'INU',  'Irbid National University',                   'Irbid National University', 32.4090, 35.9370)
on conflict (id) do update set code = excluded.code, name = excluded.name, label = excluded.label, lat = excluded.lat, lng = excluded.lng;

insert into pickup_areas (id, name, detail, lat, lng) values
  ('irbid-downtown', 'Irbid Downtown',   'Wasat Al-Balad',          32.5556, 35.8500),
  ('university-st',  'University Street','Near Yarmouk south gate', 32.5420, 35.8560),
  ('al-husn',        'Al-Husn',          'Al-Husn Road',            32.4870, 35.8800),
  ('hawara',         'Hawara',           'Hawara main road',        32.5800, 35.9170),
  ('ramtha',         'Ramtha',           'Ramtha centre',           32.5590, 36.0080),
  ('sareeh',         'Sareeh',           'Sareeh junction',         32.5050, 35.9000),
  ('aidoun',         'Aidoun',           'Aidoun square',           32.5100, 35.8550),
  ('jerash',         'Jerash',           'Jerash bus station',      32.2747, 35.8961)
on conflict (id) do update set name = excluded.name, detail = excluded.detail, lat = excluded.lat, lng = excluded.lng;

insert into captains (id, full_name, phone_masked, licensed, license_expires_on, active) values
  ('cap-1', 'Omar Khalil',     '+962 7• ••• •• 67', true,  '2027-12-31', true),
  ('cap-2', 'Yazan Haddad',    '+962 7• ••• •• 02', true,  '2027-06-30', true),
  ('cap-3', 'Ahmad Rawashdeh', '+962 7• ••• •• 20', true,  '2027-09-30', true),
  ('cap-4', 'Faris Obeidat',   '+962 7• ••• •• 31', true,  '2027-03-31', true),
  ('cap-5', 'Laith Momani',    '+962 7• ••• •• 18', true,  '2027-08-31', true),
  ('cap-6', 'Sami Nasser',     '+962 7• ••• •• 11', false, '2025-01-31', true)
on conflict (id) do update set full_name = excluded.full_name, phone_masked = excluded.phone_masked,
  licensed = excluded.licensed, license_expires_on = excluded.license_expires_on, active = excluded.active;

insert into vehicles (id, captain_id, make_model, color, plate, category, licensed_capacity, eligible) values
  ('veh-1', 'cap-1', 'Toyota Prius',    'White',  '21-84567', 'sedan',     4, true),
  ('veh-2', 'cap-2', 'Hyundai Elantra', 'Silver', '22-11902', 'sedan',     4, true),
  ('veh-3', 'cap-3', 'Kia Niro',        'Blue',   '23-45120', 'hatchback', 4, true),
  ('veh-4', 'cap-4', 'Toyota Corolla',  'Grey',   '24-77031', 'sedan',     4, true),
  ('veh-5', 'cap-5', 'Kia Picanto',     'Red',    '25-30418', 'hatchback', 3, true),
  ('veh-6', 'cap-6', 'Hyundai Accent',  'Black',  '26-90211', 'sedan',     4, true)
on conflict (id) do update set captain_id = excluded.captain_id, make_model = excluded.make_model, color = excluded.color,
  plate = excluded.plate, category = excluded.category, licensed_capacity = excluded.licensed_capacity, eligible = excluded.eligible;
