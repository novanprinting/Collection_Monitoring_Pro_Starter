-- COLLECTION CONTROL PRO | Supabase PostgreSQL
-- Jalankan sekali di SQL Editor pada proyek Supabase yang benar.
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin','pimpinan','pic');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.portfolio_type as enum ('NPL','WO','LANCAR');
exception when duplicate_object then null; end $$;

create table if not exists public.pic_master(
 id uuid primary key default gen_random_uuid(),
 pic_code text not null unique,
 pic_name text not null,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.pic_master(pic_code,pic_name) values
 ('UUD','UUD'),('ADI','ADI'),('RIZAL','RIZAL'),('RADIT','RADIT'),('NONAME','NONAME')
on conflict(pic_code) do nothing;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role public.app_role not null default 'pic',
 pic_id uuid references public.pic_master(id),
 created_at timestamptz not null default now(),
 constraint profile_pic_role check ((role='pic' and pic_id is not null) or role<>'pic')
);

create table if not exists public.import_batches(
 id uuid primary key default gen_random_uuid(),
 import_type text not null check(import_type in ('nominatif','payment')),
 file_name text not null,
 period_month date,
 row_count integer not null default 0,
 status text not null default 'processing',
 result_note text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);

create table if not exists public.nominatif(
 id uuid primary key default gen_random_uuid(),
 period_month date not null,
 no_rekening text not null,
 pic_id uuid references public.pic_master(id),
 pic_code_source text,
 nama text,
 kolek text,
 portfolio public.portfolio_type not null,
 plafond numeric(20,2) not null default 0,
 baki_debet numeric(20,2) not null default 0,
 angsuran numeric(20,2) not null default 0,
 angs_pokok numeric(20,2) not null default 0,
 angs_bunga numeric(20,2) not null default 0,
 tgt_pokok numeric(20,2) not null default 0,
 tgt_bunga numeric(20,2) not null default 0,
 hr_tgkp numeric(12,2) not null default 0,
 hr_tgkb numeric(12,2) not null default 0,
 status text,
 import_batch_id uuid references public.import_batches(id),
 created_at timestamptz not null default now(),
 unique(period_month,no_rekening)
);
create index if not exists nominatif_rek_period_idx on public.nominatif(no_rekening,period_month desc);
create index if not exists nominatif_pic_period_idx on public.nominatif(pic_id,period_month);

create table if not exists public.account_assignments(
 id uuid primary key default gen_random_uuid(),
 no_rekening text not null,
 pic_id uuid not null references public.pic_master(id),
 valid_from date not null,
 valid_to date,
 source text not null default 'MANUAL',
 created_at timestamptz not null default now(),
 check(valid_to is null or valid_to>=valid_from)
);
create index if not exists assignment_lookup_idx on public.account_assignments(no_rekening,valid_from,valid_to);

create table if not exists public.payment_transactions(
 id uuid primary key default gen_random_uuid(),
 external_transaction_id text not null unique,
 no_slip text,
 no_rekening text not null,
 pic_id uuid not null references public.pic_master(id),
 tgl_trans date not null,
 tgl_efektif date,
 kondisi_hb text,
 jns_produk text,
 nama text,
 keterangan text,
 angsuran numeric(20,2) not null default 0,
 nilai_debet numeric(20,2) not null default 0,
 nilai_kredit numeric(20,2) not null default 0,
 angs_pokok numeric(20,2) not null default 0,
 angs_bunga numeric(20,2) not null default 0,
 angs_denda numeric(20,2) not null default 0,
 penalti numeric(20,2) not null default 0,
 kolek text,
 portfolio public.portfolio_type not null,
 import_batch_id uuid references public.import_batches(id),
 created_at timestamptz not null default now()
);
create index if not exists payment_date_pic_idx on public.payment_transactions(tgl_trans,pic_id);
create index if not exists payment_rek_date_idx on public.payment_transactions(no_rekening,tgl_trans);

create table if not exists public.collection_targets(
 id uuid primary key default gen_random_uuid(),
 period_month date not null,
 pic_id uuid not null references public.pic_master(id),
 portfolio public.portfolio_type not null,
 target_amount numeric(20,2) not null default 0 check(target_amount>=0),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(period_month,pic_id,portfolio)
);
create table if not exists public.activity_logs(
 id bigserial primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 table_name text,
 record_key text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.current_pic_id()
returns uuid language sql stable security definer set search_path=public
as $$ select pic_id from public.profiles where id=auth.uid() $$;
create or replace function public.is_admin_or_manager()
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_app_role() in ('admin','pimpinan'),false) $$;

alter table public.pic_master enable row level security;
alter table public.profiles enable row level security;
alter table public.import_batches enable row level security;
alter table public.nominatif enable row level security;
alter table public.account_assignments enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.collection_targets enable row level security;
alter table public.activity_logs enable row level security;

-- Remove/recreate named policies so script can be rerun.
drop policy if exists "pic master read" on public.pic_master;
create policy "pic master read" on public.pic_master for select to authenticated using (true);
drop policy if exists "pic master admin write" on public.pic_master;
create policy "pic master admin write" on public.pic_master for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "profile read self or manager" on public.profiles;
create policy "profile read self or manager" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin_or_manager());
drop policy if exists "profile admin update" on public.profiles;
create policy "profile admin update" on public.profiles for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "nominatif read scope" on public.nominatif;
create policy "nominatif read scope" on public.nominatif for select to authenticated using (public.is_admin_or_manager() or pic_id=public.current_pic_id());
drop policy if exists "nominatif admin write" on public.nominatif;
create policy "nominatif admin write" on public.nominatif for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "assignment read scope" on public.account_assignments;
create policy "assignment read scope" on public.account_assignments for select to authenticated using (public.is_admin_or_manager() or pic_id=public.current_pic_id());
drop policy if exists "assignment admin write" on public.account_assignments;
create policy "assignment admin write" on public.account_assignments for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "payment read scope" on public.payment_transactions;
create policy "payment read scope" on public.payment_transactions for select to authenticated using (public.is_admin_or_manager() or pic_id=public.current_pic_id());
drop policy if exists "payment admin write" on public.payment_transactions;
create policy "payment admin write" on public.payment_transactions for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "target read scope" on public.collection_targets;
create policy "target read scope" on public.collection_targets for select to authenticated using (public.is_admin_or_manager() or pic_id=public.current_pic_id());
drop policy if exists "target admin write" on public.collection_targets;
create policy "target admin write" on public.collection_targets for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "imports manager read" on public.import_batches;
create policy "imports manager read" on public.import_batches for select to authenticated using (public.is_admin_or_manager());
drop policy if exists "imports admin write" on public.import_batches;
create policy "imports admin write" on public.import_batches for all to authenticated using (public.current_app_role()='admin') with check (public.current_app_role()='admin');

drop policy if exists "logs manager read" on public.activity_logs;
create policy "logs manager read" on public.activity_logs for select to authenticated using (public.is_admin_or_manager());
drop policy if exists "logs authenticated insert" on public.activity_logs;
create policy "logs authenticated insert" on public.activity_logs for insert to authenticated with check (actor_id=auth.uid());


-- Atomic nominatif replace: penghapusan dan pemasukan berjalan dalam satu transaksi DB.
create or replace function public.replace_nominatif_period(
 p_period date, p_rows jsonb, p_batch_id uuid
) returns integer
language plpgsql security definer set search_path=public
as $$
declare inserted_count integer;
begin
 if public.current_app_role() <> 'admin' then
   raise exception 'Hanya admin yang boleh mengganti nominatif';
 end if;
 if p_period is null or jsonb_typeof(p_rows) <> 'array' then
   raise exception 'Periode atau format data tidak valid';
 end if;
 delete from public.nominatif where period_month=p_period;
 insert into public.nominatif(
   period_month,no_rekening,pic_id,pic_code_source,nama,kolek,portfolio,
   plafond,baki_debet,angsuran,angs_pokok,angs_bunga,tgt_pokok,tgt_bunga,
   hr_tgkp,hr_tgkb,status,import_batch_id
 )
 select p_period,x.no_rekening,x.pic_id,x.pic_code_source,x.nama,x.kolek,
   x.portfolio::public.portfolio_type,coalesce(x.plafond,0),coalesce(x.baki_debet,0),
   coalesce(x.angsuran,0),coalesce(x.angs_pokok,0),coalesce(x.angs_bunga,0),
   coalesce(x.tgt_pokok,0),coalesce(x.tgt_bunga,0),coalesce(x.hr_tgkp,0),
   coalesce(x.hr_tgkb,0),x.status,p_batch_id
 from jsonb_to_recordset(p_rows) as x(
   no_rekening text,pic_id uuid,pic_code_source text,nama text,kolek text,
   portfolio text,plafond numeric,baki_debet numeric,angsuran numeric,
   angs_pokok numeric,angs_bunga numeric,tgt_pokok numeric,tgt_bunga numeric,
   hr_tgkp numeric,hr_tgkb numeric,status text
 );
 get diagnostics inserted_count = row_count;
 return inserted_count;
end $$;
grant execute on function public.replace_nominatif_period(date,jsonb,uuid) to authenticated;

-- Buat profile admin setelah akun Auth admin dibuat:
-- insert into public.profiles(id,full_name,role)
-- select id,'Administrator','admin' from auth.users where email='EMAIL_ADMIN_ANDA'
-- on conflict(id) do update set role='admin',full_name='Administrator';
--
-- Untuk PIC:
-- insert into public.profiles(id,full_name,role,pic_id)
-- select u.id,'Nama AO','pic',p.id from auth.users u
-- join public.pic_master p on p.pic_code='UUD'
-- where u.email='EMAIL_AO_ANDA';
--
-- Untuk pimpinan: insert profile role='pimpinan', pic_id NULL.
