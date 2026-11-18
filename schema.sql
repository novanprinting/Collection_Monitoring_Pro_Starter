-- COLLECTION MONITORING PRO - Supabase SQL
-- Jalankan di Supabase SQL Editor pada project BARU/yang telah disetujui.
create extension if not exists pgcrypto;

create table if not exists public.ao_team (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','ao')),
  ao_id uuid references public.ao_team(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ao_profile_requires_ao check ((role='admin' and ao_id is null) or (role='ao' and ao_id is not null))
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  account_no text not null unique,
  customer_name text not null,
  ao_id uuid not null references public.ao_team(id),
  installment numeric(18,2) not null default 0,
  due_date date not null,
  arrears numeric(18,2) not null default 0,
  payment_status text not null check (payment_status in ('Lunas','Bayar sebagian','Menunggak','Belum bayar')),
  collectibility text,
  updated_at timestamptz not null default now()
);

create table if not exists public.monitoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_no text not null,
  customer_name text not null,
  ao_id uuid not null references public.ao_team(id),
  installment numeric(18,2) not null default 0,
  due_date date not null,
  arrears numeric(18,2) not null default 0,
  payment_status text not null,
  collectibility text,
  snapshot_date date not null,
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(account_no,snapshot_date)
);
create index if not exists idx_customers_ao on public.customers(ao_id);
create index if not exists idx_customers_due on public.customers(due_date);
create index if not exists idx_snapshots_date on public.monitoring_snapshots(snapshot_date);
create index if not exists idx_snapshots_ao_date on public.monitoring_snapshots(ao_id,snapshot_date);

-- Security-definer helper functions avoid recursive RLS policy evaluation.
create or replace function public.cm_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and p.active=true); $$;
create or replace function public.cm_my_ao()
returns uuid language sql stable security definer set search_path=public
as $$ select p.ao_id from public.profiles p where p.user_id=auth.uid() and p.active=true limit 1; $$;

alter table public.ao_team enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.monitoring_snapshots enable row level security;

drop policy if exists "ao list authenticated" on public.ao_team;
create policy "ao list authenticated" on public.ao_team for select to authenticated using (true);
drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles for select to authenticated using (user_id=auth.uid() or public.cm_is_admin());
drop policy if exists "admin manage ao" on public.ao_team;
create policy "admin manage ao" on public.ao_team for all to authenticated using (public.cm_is_admin()) with check (public.cm_is_admin());
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for all to authenticated using (public.cm_is_admin()) with check (public.cm_is_admin());

drop policy if exists "customer read scoped" on public.customers;
create policy "customer read scoped" on public.customers for select to authenticated using (public.cm_is_admin() or ao_id=public.cm_my_ao());
drop policy if exists "admin insert customers" on public.customers;
create policy "admin insert customers" on public.customers for insert to authenticated with check (public.cm_is_admin());
drop policy if exists "admin update customers" on public.customers;
create policy "admin update customers" on public.customers for update to authenticated using (public.cm_is_admin()) with check (public.cm_is_admin());
drop policy if exists "admin delete customers" on public.customers;
create policy "admin delete customers" on public.customers for delete to authenticated using (public.cm_is_admin());

drop policy if exists "snapshot read scoped" on public.monitoring_snapshots;
create policy "snapshot read scoped" on public.monitoring_snapshots for select to authenticated using (public.cm_is_admin() or ao_id=public.cm_my_ao());
drop policy if exists "admin insert snapshots" on public.monitoring_snapshots;
create policy "admin insert snapshots" on public.monitoring_snapshots for insert to authenticated with check (public.cm_is_admin() and imported_by=auth.uid());
drop policy if exists "admin update snapshots" on public.monitoring_snapshots;
create policy "admin update snapshots" on public.monitoring_snapshots for update to authenticated using (public.cm_is_admin()) with check (public.cm_is_admin());
drop policy if exists "admin delete snapshots" on public.monitoring_snapshots;
create policy "admin delete snapshots" on public.monitoring_snapshots for delete to authenticated using (public.cm_is_admin());

grant usage on schema public to authenticated;
grant select on public.ao_team, public.profiles, public.customers, public.monitoring_snapshots to authenticated;
grant insert,update,delete on public.ao_team, public.profiles, public.customers, public.monitoring_snapshots to authenticated;
