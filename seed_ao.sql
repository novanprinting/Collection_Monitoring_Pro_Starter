-- Jalankan SETELAH schema.sql.
-- Membuat lima AO awal sesuai daftar yang disepakati.
insert into public.ao_team(name, active)
values
  ('UUD', true),
  ('ADI', true),
  ('RIZAL', true),
  ('RADIT', true),
  ('NONAME', true)
on conflict (name) do update set active = excluded.active;

-- Setelah membuat user melalui Supabase Authentication > Users,
-- salin UUID user dan jalankan contoh berikut untuk tiap AO.
-- Ganti UUID dan nama sesuai akun yang dibuat.
--
-- insert into public.profiles(user_id, full_name, role, ao_id)
-- select 'UUID-AUTH-UUD', 'UUD', 'ao', id
-- from public.ao_team where name='UUD'
-- on conflict (user_id) do update
-- set full_name=excluded.full_name, role='ao', ao_id=excluded.ao_id, active=true;
--
-- Admin:
-- insert into public.profiles(user_id, full_name, role, ao_id)
-- values ('UUID-AUTH-ADMIN', 'Admin Collection', 'admin', null)
-- on conflict (user_id) do update
-- set full_name=excluded.full_name, role='admin', ao_id=null, active=true;
