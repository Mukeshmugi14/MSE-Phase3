-- ============================================================
-- AI-MSE Full Integrated Schema (Phase 1 + Phase 2)
-- Idempotent Version: Can be run multiple times safely
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Clinician Profiles ---------------------------------------
create table if not exists clinician_profiles (
  id                  uuid references auth.users(id) on delete cascade primary key,
  email               text unique not null,
  full_name           text not null,
  role                text not null default 'psychiatrist'
                        check (role in ('psychiatrist','resident','counsellor')),
  hospital            text not null default '',
  registration_number text not null default '',
  created_at          timestamptz default now()
);

alter table clinician_profiles enable row level security;

-- Drop existing policies to avoid "already exists" errors
do $$ begin
  drop policy if exists "Clinicians can view own profile" on clinician_profiles;
  drop policy if exists "Clinicians can update own profile" on clinician_profiles;
  drop policy if exists "Clinicians can insert own profile" on clinician_profiles;
exception when others then null; end $$;

create policy "Clinicians can view own profile" on clinician_profiles for select using (auth.uid() = id);
create policy "Clinicians can update own profile" on clinician_profiles for update using (auth.uid() = id);
create policy "Clinicians can insert own profile" on clinician_profiles for insert with check (auth.uid() = id);

-- 2. Patients -------------------------------------------------
create table if not exists patients (
  id                       uuid default uuid_generate_v4() primary key,
  clinician_id             uuid references clinician_profiles(id) on delete cascade not null,
  full_name                text not null,
  age                      integer not null check (age > 0 and age < 130),
  gender                   text not null check (gender in ('male','female','other')),
  phone                    text,
  presenting_complaint     text not null,
  referral_source          text,
  past_psychiatric_history text,
  past_medical_history     text,
  substance_use            text,
  family_history           text,
  education                text,
  occupation               text,
  consent_obtained         boolean default false,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table patients enable row level security;

do $$ begin
  drop policy if exists "Clinicians manage own patients" on patients;
exception when others then null; end $$;

create policy "Clinicians manage own patients" on patients for all using (auth.uid() = clinician_id);

-- 3. MSE Sessions ---------------------------------------------
create table if not exists mse_sessions (
  id                    uuid default uuid_generate_v4() primary key,
  patient_id            uuid references patients(id) on delete cascade not null,
  clinician_id          uuid references clinician_profiles(id) on delete cascade not null,
  transcript            text default '',
  audio_duration_seconds integer,
  assessment            jsonb,
  risk_assessment       jsonb,
  overall_severity      integer default 0 check (overall_severity >= 0 and overall_severity <= 100),
  clinical_summary      text default '',
  diagnostic_impression text,
  clinician_notes       text,
  clinician_overrides   jsonb,
  -- Phase 2 Biometrics
  facs_data             jsonb,
  prosody_data          jsonb,
  cognitive_data        jsonb,
  session_date          timestamptz default now(),
  status                text default 'recording'
                          check (status in ('recording','transcribing','assessing','complete','error')),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table mse_sessions enable row level security;

do $$ begin
  drop policy if exists "Clinicians manage own sessions" on mse_sessions;
exception when others then null; end $$;

create policy "Clinicians manage own sessions" on mse_sessions for all using (auth.uid() = clinician_id);

-- 4. Audit Log ------------------------------------------------
create table if not exists audit_log (
  id           uuid default uuid_generate_v4() primary key,
  clinician_id uuid references clinician_profiles(id),
  action       text not null,
  resource     text not null,
  resource_id  uuid,
  metadata     jsonb,
  created_at   timestamptz default now()
);

alter table audit_log enable row level security;

do $$ begin
  drop policy if exists "Clinicians manage own logs" on audit_log;
exception when others then null; end $$;

create policy "Clinicians manage own logs" on audit_log for all using (auth.uid() = clinician_id);

-- 5. Updated_at trigger ---------------------------------------
create or replace function update_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

-- Recreate triggers
drop trigger if exists patients_updated_at on patients;
create trigger patients_updated_at before update on patients for each row execute function update_updated_at();

drop trigger if exists sessions_updated_at on mse_sessions;
create trigger sessions_updated_at before update on mse_sessions for each row execute function update_updated_at();

-- 6. Auth Profile Sync ----------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.clinician_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', 'Clinician'));
  return new;
end;
$$ language plpgsql security definer;

-- Recreate Auth trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Recovery Fix: Ensure all current users have profiles
insert into public.clinician_profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', 'Clinician')
from auth.users on conflict (id) do nothing;
