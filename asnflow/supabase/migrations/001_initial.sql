-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Memberships
create table public.memberships (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  midtrans_order_id text,
  midtrans_transaction_id text,
  started_at timestamptz default now(),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.memberships enable row level security;

create policy "Users can view own membership" on public.memberships
  for select using (auth.uid() = user_id);

create policy "Admins can manage all memberships" on public.memberships
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Downloads history
create table public.downloads (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tool_type text not null check (tool_type in ('form-asn', 'absensi', 'arsip-surat', 'laporan', 'ai-generated')),
  file_name text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.downloads enable row level security;

create policy "Users can view own downloads" on public.downloads
  for select using (auth.uid() = user_id);

create policy "Users can insert own downloads" on public.downloads
  for insert with check (auth.uid() = user_id);

create policy "Admins can view all downloads" on public.downloads
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Arsip Surat
create table public.arsip_surat (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  nomor_surat text not null,
  tanggal date not null,
  pengirim text not null,
  tujuan text not null,
  perihal text not null,
  jenis text not null check (jenis in ('masuk', 'keluar')),
  keterangan text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.arsip_surat enable row level security;

create policy "Users can manage own arsip" on public.arsip_surat
  for all using (auth.uid() = user_id);

-- Function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.memberships (user_id, plan, status)
  values (new.id, 'free', 'active');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function: get download count this month
create or replace function public.get_monthly_download_count(p_user_id uuid)
returns integer as $$
  select count(*)::integer
  from public.downloads
  where user_id = p_user_id
    and created_at >= date_trunc('month', now());
$$ language sql security definer;

-- Indexes
create index idx_downloads_user_id on public.downloads(user_id);
create index idx_downloads_created_at on public.downloads(created_at desc);
create index idx_arsip_surat_user_id on public.arsip_surat(user_id);
create index idx_memberships_user_id on public.memberships(user_id);
