-- LetLearn Supabase Database Schema
-- Run via: supabase db push  OR  paste in Supabase SQL Editor

-- ────────────────────────────────────────────────
-- STUDENTS TABLE
-- ────────────────────────────────────────────────
create table if not exists public.students (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text unique not null,
  state text,
  role text default 'Student (University)',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.students enable row level security;

create policy "Students can view own profile" on public.students
  for select using (auth.uid() = id);

create policy "Students can update own profile" on public.students
  for update using (auth.uid() = id);

create policy "Allow insert on signup" on public.students
  for insert with check (auth.uid() = id);

-- ────────────────────────────────────────────────
-- TUTOR APPLICATIONS TABLE
-- ────────────────────────────────────────────────
create table if not exists public.tutor_applications (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  phone text,
  subject text not null,
  experience text,
  qualification text,
  state text,
  hourly_rate integer,
  bio text,
  linkedin_url text,
  status text default 'pending',  -- pending | approved | rejected
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

alter table public.tutor_applications enable row level security;

-- Applicants can insert; admins can read/update all
create policy "Anyone can submit tutor application" on public.tutor_applications
  for insert with check (true);

create policy "Applicants can view own application" on public.tutor_applications
  for select using (email = (select email from auth.users where id = auth.uid()));

-- ────────────────────────────────────────────────
-- SCHOLARSHIP TRACKING TABLE
-- ────────────────────────────────────────────────
create table if not exists public.scholarship_tracking (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students(id) on delete cascade,
  scholarship_title text not null,
  scholarship_org text,
  amount text,
  deadline date,
  status text default 'saved',    -- saved | applied | won | rejected
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.scholarship_tracking enable row level security;

create policy "Students see own tracking" on public.scholarship_tracking
  for select using (auth.uid() = student_id);

create policy "Students can insert tracking" on public.scholarship_tracking
  for insert with check (auth.uid() = student_id);

create policy "Students can update tracking" on public.scholarship_tracking
  for update using (auth.uid() = student_id);

create policy "Students can delete tracking" on public.scholarship_tracking
  for delete using (auth.uid() = student_id);

-- ────────────────────────────────────────────────
-- TUTOR BOOKINGS TABLE
-- ────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students(id),
  student_name text not null,
  student_phone text,
  subject text not null,
  session_date date,
  session_type text default 'Online (Google Meet)',
  status text default 'pending',  -- pending | confirmed | completed | cancelled
  created_at timestamptz default now()
);

alter table public.bookings enable row level security;

create policy "Students see own bookings" on public.bookings
  for select using (auth.uid() = student_id);

create policy "Anyone can book" on public.bookings
  for insert with check (true);

-- ────────────────────────────────────────────────
-- HELPER: auto-update updated_at
-- ────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger students_updated_at before update on public.students
  for each row execute function update_updated_at();

create trigger tracking_updated_at before update on public.scholarship_tracking
  for each row execute function update_updated_at();
