-- Run once in the Supabase SQL editor. Safe to rerun; also adds portal fields to v1.
create table if not exists public.registrations (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 full_name text not null, cnic text not null unique check (cnic ~ '^[0-9]{13}$'),
 roll_number text not null unique, email text not null, contact text not null,
 emergency_contact text not null, transaction_number text not null unique, receipt_path text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 email_status text check (email_status in ('pending','approved','rejected')),reviewed_at timestamptz
);
alter table public.registrations add column if not exists user_id uuid unique references auth.users(id);
alter table public.registrations add column if not exists ticket_token uuid not null default gen_random_uuid() unique;
alter table public.registrations add column if not exists fee_paisa bigint not null default 0 check (fee_paisa>=0);
alter table public.registrations add column if not exists receipt_ready boolean not null default false;
alter table public.registrations add column if not exists reviewed_by uuid references auth.users(id);
create table if not exists public.trip_settings (
 id integer primary key default 1 check (id=1), name text not null default 'Into the mountains',
 description text not null default 'A little less screen time. A little more skyline. Join your university crew for a day on the trail.',
 location text not null default 'To be announced', departure_at timestamptz,
 fee_paisa bigint not null default 0 check (fee_paisa>=0), payment_details text not null default '',
 organizer_phone text not null default '',registrations_open boolean not null default false
);
insert into public.trip_settings(id) values(1) on conflict do nothing;
create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),title text not null, message text not null,
 priority text not null default 'normal' check(priority in ('normal','important')),
 created_at timestamptz not null default now(),created_by uuid references auth.users(id)
);
create table if not exists public.expenses (
 id uuid primary key default gen_random_uuid(),description text not null,
 amount_paisa bigint not null check(amount_paisa>0),spent_on date not null,
 created_at timestamptz not null default now(),created_by uuid references auth.users(id)
);
create table if not exists public.checkpoints (
 id uuid primary key default gen_random_uuid(),name text not null unique,
 kind text not null default 'checkpoint' check(kind in ('departure','checkpoint')),
 created_at timestamptz not null default now()
);
insert into public.checkpoints(name,kind) values('Departure','departure') on conflict(name) do nothing;
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(),registration_id uuid not null references public.registrations(id) on delete cascade,
 checkpoint_id uuid not null references public.checkpoints(id),checked_in_at timestamptz not null default now(),
 checked_in_by uuid references auth.users(id),unique(registration_id,checkpoint_id)
);
create table if not exists public.emergencies (
 id uuid primary key default gen_random_uuid(),registration_id uuid not null references public.registrations(id) on delete cascade,
 message text not null,latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180),accuracy double precision,
 location_at timestamptz,status text not null default 'open' check(status in ('open','acknowledged','resolved')),
 email_sent boolean not null default false,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),handled_by uuid references auth.users(id),
 check ((latitude is null)=(longitude is null))
);
create unique index if not exists one_active_emergency_per_student on public.emergencies(registration_id) where status<>'resolved';
create index if not exists emergencies_status_idx on public.emergencies(status,created_at desc);
create index if not exists registrations_status_idx on public.registrations(status);
-- All access is mediated by server APIs. No client policies, including for students.
alter table public.registrations enable row level security;
alter table public.trip_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.expenses enable row level security;
alter table public.checkpoints enable row level security;
alter table public.attendance enable row level security;
alter table public.emergencies enable row level security;
revoke all on public.registrations,public.trip_settings,public.announcements,public.expenses,public.checkpoints,public.attendance,public.emergencies from anon,authenticated;
grant all on public.registrations,public.trip_settings,public.announcements,public.expenses,public.checkpoints,public.attendance,public.emergencies to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;
-- Summaries span the entire trip, independently of paginated lists.
create or replace function public.trip_summary() returns jsonb
language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'registered',(select count(*) from registrations),
 'pending',(select count(*) from registrations where status='pending'),
 'approved',(select count(*) from registrations where status='approved'),
 'rejected',(select count(*) from registrations where status='rejected'),
 'collected_paisa',(select coalesce(sum(fee_paisa),0) from registrations where status='approved'),
 'expenses_paisa',(select coalesce(sum(amount_paisa),0) from expenses),
 'active_emergencies',(select count(*) from emergencies where status<>'resolved')
 );
$$;
revoke all on function public.trip_summary() from public,anon,authenticated;
grant execute on function public.trip_summary() to service_role;
