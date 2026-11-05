-- Image Makeover Phase 2: authentication profiles and appointment scheduling.
create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('customer', 'admin', 'staff');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.appointment_status as enum (
    'pending', 'confirmed', 'in_chair', 'completed', 'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text unique,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);
comment on table public.profiles is
  'Promote a trusted employee in the Supabase SQL editor: update public.profiles set role = ''admin'' where id = ''AUTH_USER_UUID'';';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(trim(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do update
    set full_name = coalesce(public.profiles.full_name, excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.has_staff_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin'::public.user_role, 'staff'::public.user_role)
  );
$$;

create table if not exists public.salon_settings (
  id boolean primary key default true check (id),
  max_parallel_appointments integer not null default 3
    check (max_parallel_appointments between 1 and 50),
  max_advance_days integer not null default 30
    check (max_advance_days between 1 and 90),
  updated_at timestamptz not null default now()
);

insert into public.salon_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete set null,
  guest_name text,
  guest_phone text,
  service_id uuid not null references public.services (id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 720),
  status public.appointment_status not null default 'pending',
  staff_notes text,
  created_at timestamptz not null default now(),
  constraint appointments_have_customer_or_guest
    check (customer_id is not null or nullif(trim(guest_name), '') is not null),
  constraint appointments_guest_name_length
    check (guest_name is null or char_length(trim(guest_name)) between 1 and 120),
  constraint appointments_guest_phone_length
    check (guest_phone is null or char_length(regexp_replace(guest_phone, '\D', '', 'g')) between 8 and 15)
);

create or replace function public.validate_appointment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_service public.services%rowtype;
  v_capacity integer;
  v_max_advance integer;
  v_local timestamp;
  v_local_date date;
  v_booked integer;
begin
  if not public.has_staff_access() then
    if new.status <> 'pending' then
      raise exception 'Customer bookings must start as pending';
    end if;
    if v_customer_id is null then
      if new.customer_id is not null or nullif(trim(new.guest_name), '') is null
        or nullif(regexp_replace(coalesce(new.guest_phone, ''), '\D', '', 'g'), '') is null then
        raise exception 'Guest name and phone are required';
      end if;
    elsif new.customer_id <> v_customer_id or new.guest_name is not null or new.guest_phone is not null then
      raise exception 'Bookings must belong to the signed-in customer';
    end if;
  end if;

  select * into v_service
  from public.services s
  where s.id = new.service_id and s.is_active;
  if not found then
    raise exception 'Selected service is unavailable';
  end if;
  new.duration_minutes := v_service.duration_minutes;
  if not public.has_staff_access() then
    new.staff_notes := null;
    new.created_at := now();
  end if;
  v_local := new.scheduled_at at time zone 'Asia/Kolkata';
  v_local_date := v_local::date;

  select s.max_parallel_appointments, s.max_advance_days
    into v_capacity, v_max_advance
  from public.salon_settings s where s.id = true;
  v_capacity := coalesce(v_capacity, 3);
  v_max_advance := coalesce(v_max_advance, 30);
  if not public.has_staff_access() then
    if extract(isodow from v_local_date) = 2 then
      raise exception 'The salon is closed on Tuesdays';
    end if;
    if v_local::time < time '10:00'
      or v_local::time >= time '20:00'
      or extract(minute from v_local)::integer not in (0, 30)
      or extract(second from v_local) <> 0 then
      raise exception 'Select a 30-minute slot between 10:00 AM and 7:30 PM IST';
    end if;
    if v_local + make_interval(mins => v_service.duration_minutes) > v_local_date + time '20:30' then
      raise exception 'The selected service must finish by 8:30 PM IST';
    end if;
    if v_local_date < (now() at time zone 'Asia/Kolkata')::date
      or v_local_date > (now() at time zone 'Asia/Kolkata')::date + v_max_advance
      or new.scheduled_at <= now() then
      raise exception 'Select a date within the next % days', v_max_advance;
    end if;
  end if;

  if new.status in ('pending', 'confirmed', 'in_chair') then
    perform pg_advisory_xact_lock(hashtext('appointments:' || v_local_date::text));
    select count(*)::integer into v_booked
    from public.appointments a
    where a.status in ('pending', 'confirmed', 'in_chair')
      and a.scheduled_at < new.scheduled_at + make_interval(mins => v_service.duration_minutes)
      and a.scheduled_at + make_interval(mins => a.duration_minutes) > new.scheduled_at;
    if v_booked >= v_capacity then
      raise exception 'This time slot just filled. Please choose another time.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_appointment_before_insert on public.appointments;
create trigger validate_appointment_before_insert
  before insert on public.appointments
  for each row execute procedure public.validate_appointment_insert();

create or replace function public.guard_customer_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.profile_delete', true) = old.customer_id::text then
    return new;
  end if;
  if public.has_staff_access() then
    return new;
  end if;
  if old.customer_id = auth.uid()
    and old.scheduled_at > now() + interval '4 hours'
    and old.status in ('pending', 'confirmed')
    and new.status = 'cancelled'
    and new.id = old.id
    and new.customer_id = old.customer_id
    and new.guest_name is not distinct from old.guest_name
    and new.guest_phone is not distinct from old.guest_phone
    and new.service_id = old.service_id
    and new.scheduled_at = old.scheduled_at
    and new.duration_minutes = old.duration_minutes
    and new.staff_notes is not distinct from old.staff_notes
    and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'Customers may only cancel their own appointment more than four hours in advance';
end;
$$;

drop trigger if exists guard_customer_appointment_update on public.appointments;
create trigger guard_customer_appointment_update
  before update on public.appointments
  for each row execute procedure public.guard_customer_appointment_update();

create or replace function public.guard_appointment_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'pending' and new.status in ('confirmed', 'cancelled')
    or old.status = 'confirmed' and new.status in ('in_chair', 'cancelled')
    or old.status = 'in_chair' and new.status in ('completed', 'cancelled') then
    return new;
  end if;
  raise exception 'Invalid appointment status transition: % to %', old.status, new.status;
end;
$$;

drop trigger if exists guard_appointment_status_transition on public.appointments;
create trigger guard_appointment_status_transition
  before update on public.appointments
  for each row execute procedure public.guard_appointment_status_transition();

create or replace function public.preserve_appointments_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.profile_delete', old.id::text, true);
  update public.appointments a
  set guest_name = coalesce(nullif(trim(a.guest_name), ''), nullif(trim(old.full_name), ''), 'Customer'),
      guest_phone = coalesce(nullif(trim(a.guest_phone), ''), old.phone)
  where a.customer_id = old.id;
  return old;
end;
$$;

drop trigger if exists preserve_appointments_on_profile_delete on public.profiles;
create trigger preserve_appointments_on_profile_delete
  before delete on public.profiles
  for each row execute procedure public.preserve_appointments_before_profile_delete();

create index if not exists appointments_scheduled_status_idx
  on public.appointments (scheduled_at, status)
  where status <> 'cancelled';
create index if not exists appointments_customer_scheduled_idx
  on public.appointments (customer_id, scheduled_at desc)
  where customer_id is not null;

alter table public.profiles enable row level security;
alter table public.salon_settings enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_staff_access()));
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = 'customer');
drop policy if exists "Staff manage profiles" on public.profiles;
create policy "Staff manage profiles"
  on public.profiles for all to authenticated
  using ((select public.has_staff_access()))
  with check ((select public.has_staff_access()));

drop policy if exists "Anyone can read salon capacity" on public.salon_settings;
create policy "Anyone can read salon capacity"
  on public.salon_settings for select to anon, authenticated
  using (true);
drop policy if exists "Staff manage salon capacity" on public.salon_settings;
create policy "Staff manage salon capacity"
  on public.salon_settings for all to authenticated
  using ((select public.has_staff_access()))
  with check ((select public.has_staff_access()));

drop policy if exists "Customers read own appointments" on public.appointments;
create policy "Customers read own appointments"
  on public.appointments for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.has_staff_access()));
drop policy if exists "Customers create own appointments" on public.appointments;
create policy "Customers create own appointments"
  on public.appointments for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and guest_name is null
    and guest_phone is null
    and status = 'pending'
  );
drop policy if exists "Guests create appointments" on public.appointments;
create policy "Guests create appointments"
  on public.appointments for insert to anon, authenticated
  with check (
    customer_id is null
    and nullif(trim(guest_name), '') is not null
    and nullif(trim(guest_phone), '') is not null
    and status = 'pending'
  );
drop policy if exists "Customers cancel own appointments" on public.appointments;
create policy "Customers cancel own appointments"
  on public.appointments for update to authenticated
  using (
    customer_id = (select auth.uid())
    and scheduled_at > now() + interval '4 hours'
    and status in ('pending', 'confirmed')
  )
  with check (
    customer_id = (select auth.uid())
    and scheduled_at > now() + interval '4 hours'
    and status = 'cancelled'
  );
drop policy if exists "Staff manage appointments" on public.appointments;
create policy "Staff manage appointments"
  on public.appointments for all to authenticated
  using ((select public.has_staff_access()))
  with check ((select public.has_staff_access()));

-- Phase 1 policies used JWT app_metadata. Use profiles as the single role source.
drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services"
  on public.services for select
  using (is_active or (select public.has_staff_access()));
drop policy if exists "Admins can insert services" on public.services;
drop policy if exists "Admins can update services" on public.services;
drop policy if exists "Admins can delete services" on public.services;
create policy "Staff can insert services"
  on public.services for insert to authenticated
  with check ((select public.has_staff_access()));
create policy "Staff can update services"
  on public.services for update to authenticated
  using ((select public.has_staff_access()))
  with check ((select public.has_staff_access()));
create policy "Staff can delete services"
  on public.services for delete to authenticated
  using ((select public.has_staff_access()));

drop policy if exists "Admins can insert gallery" on public.gallery;
drop policy if exists "Public can read public gallery" on public.gallery;
create policy "Public can read public gallery"
  on public.gallery for select
  using (is_public or (select public.has_staff_access()));
drop policy if exists "Admins can update gallery" on public.gallery;
drop policy if exists "Admins can delete gallery" on public.gallery;
create policy "Staff can insert gallery"
  on public.gallery for insert to authenticated
  with check ((select public.has_staff_access()));
create policy "Staff can update gallery"
  on public.gallery for update to authenticated
  using ((select public.has_staff_access()))
  with check ((select public.has_staff_access()));
create policy "Staff can delete gallery"
  on public.gallery for delete to authenticated
  using ((select public.has_staff_access()));

drop policy if exists "Authenticated users can upload portfolio images" on storage.objects;
drop policy if exists "Authenticated users can update portfolio images" on storage.objects;
drop policy if exists "Authenticated users can delete portfolio images" on storage.objects;
create policy "Staff can upload portfolio images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (select public.has_staff_access()));
create policy "Staff can update portfolio images"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and (select public.has_staff_access()))
  with check (bucket_id = 'portfolio' and (select public.has_staff_access()));
create policy "Staff can delete portfolio images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (select public.has_staff_access()));

create or replace function public.available_appointment_slots(
  p_date date,
  p_duration_minutes integer default 30
)
returns table (
  slot_at timestamptz,
  available boolean,
  booked_count integer,
  capacity integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_max_advance integer;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_duration_minutes not between 1 and 720 then
    raise exception 'Invalid appointment duration';
  end if;

  select s.max_parallel_appointments, s.max_advance_days
    into v_capacity, v_max_advance
  from public.salon_settings s
  where s.id = true;
  v_capacity := coalesce(v_capacity, 3);
  v_max_advance := coalesce(v_max_advance, 30);

  if p_date < v_today or p_date > v_today + v_max_advance then
    return;
  end if;
  if extract(isodow from p_date) = 2 then
    return;
  end if;

  return query
  with requested_slots as (
    select (p_date + time '10:00' + make_interval(mins => step)) at time zone 'Asia/Kolkata' as starts_at
    from generate_series(0, 19 * 30, 30) as slots(step)
  ),
  counts as (
    select requested_slots.starts_at,
      count(a.id)::integer as number_booked
    from requested_slots
    left join public.appointments a
      on a.status in ('pending', 'confirmed', 'in_chair')
      and a.scheduled_at < requested_slots.starts_at + make_interval(mins => p_duration_minutes)
      and a.scheduled_at + make_interval(mins => a.duration_minutes) > requested_slots.starts_at
    where requested_slots.starts_at > now()
      and requested_slots.starts_at + make_interval(mins => p_duration_minutes)
        <= (p_date + time '20:30') at time zone 'Asia/Kolkata'
    group by requested_slots.starts_at
  )
  select counts.starts_at, counts.number_booked < v_capacity, counts.number_booked, v_capacity
  from counts
  order by counts.starts_at;
end;
$$;

create or replace function public.create_customer_appointment(
  p_service_id uuid,
  p_scheduled_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_service public.services%rowtype;
  v_appointment public.appointments%rowtype;
  v_capacity integer;
  v_max_advance integer;
  v_local_time timestamp;
  v_local_date date;
  v_booked integer;
begin
  if v_customer_id is null then
    raise exception 'Sign in before booking an appointment';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_customer_id and p.role = 'customer'
  ) then
    raise exception 'Only customer accounts can create customer bookings';
  end if;

  select * into v_service
  from public.services s
  where s.id = p_service_id and s.is_active;
  if not found then
    raise exception 'Selected service is unavailable';
  end if;

  v_local_time := p_scheduled_at at time zone 'Asia/Kolkata';
  v_local_date := v_local_time::date;
  if extract(isodow from v_local_date) = 2 then
    raise exception 'The salon is closed on Tuesdays';
  end if;
  if v_local_time::time < time '10:00'
    or v_local_time::time >= time '20:00'
    or extract(minute from v_local_time)::integer not in (0, 30)
    or extract(second from v_local_time) <> 0 then
    raise exception 'Select a 30-minute slot between 10:00 AM and 7:30 PM IST';
  end if;
  if v_local_time + make_interval(mins => v_service.duration_minutes) > v_local_date + time '20:30' then
    raise exception 'The selected service must finish by 8:30 PM IST';
  end if;
  select s.max_parallel_appointments, s.max_advance_days
    into v_capacity, v_max_advance
  from public.salon_settings s where s.id = true;
  v_capacity := coalesce(v_capacity, 3);
  v_max_advance := coalesce(v_max_advance, 30);
  if v_local_date < (now() at time zone 'Asia/Kolkata')::date
    or v_local_date > (now() at time zone 'Asia/Kolkata')::date + v_max_advance
    or p_scheduled_at <= now() then
    raise exception 'Select a date within the next % days', v_max_advance;
  end if;

  -- Serialize bookings for a local calendar date to prevent capacity races.
  perform pg_advisory_xact_lock(hashtext('appointments:' || v_local_date::text));
  select count(*)::integer into v_booked
  from public.appointments a
  where a.status in ('pending', 'confirmed', 'in_chair')
    and a.scheduled_at < p_scheduled_at + make_interval(mins => v_service.duration_minutes)
    and a.scheduled_at + make_interval(mins => a.duration_minutes) > p_scheduled_at;
  if v_booked >= v_capacity then
    raise exception 'This time slot just filled. Please choose another time.';
  end if;

  insert into public.appointments (
    customer_id, service_id, scheduled_at, duration_minutes, status
  )
  values (v_customer_id, p_service_id, p_scheduled_at, v_service.duration_minutes, 'pending')
  returning * into v_appointment;

  return v_appointment;
end;
$$;

create or replace function public.create_walkin_appointment(
  p_guest_name text,
  p_guest_phone text,
  p_service_id uuid
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services%rowtype;
  v_appointment public.appointments%rowtype;
  v_capacity integer;
  v_now timestamptz := now();
  v_local timestamp := v_now at time zone 'Asia/Kolkata';
  v_booked integer;
begin
  if not public.has_staff_access() then
    raise exception 'Staff access required';
  end if;
  if nullif(trim(p_guest_name), '') is null
    or char_length(trim(p_guest_name)) > 120
    or char_length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) not between 8 and 15 then
    raise exception 'Walk-in name and phone are required';
  end if;
  if extract(isodow from v_local::date) = 2
    or v_local::time < time '10:00' or v_local::time >= time '20:30' then
    raise exception 'Walk-ins are only available during salon opening hours';
  end if;
  select * into v_service from public.services s
    where s.id = p_service_id and s.is_active;
  if not found then
    raise exception 'Selected service is unavailable';
  end if;
  if v_local + make_interval(mins => v_service.duration_minutes) > v_local::date + time '20:30' then
    raise exception 'This service cannot be completed before closing';
  end if;
  select s.max_parallel_appointments into v_capacity
    from public.salon_settings s where s.id = true;
  v_capacity := coalesce(v_capacity, 3);

  perform pg_advisory_xact_lock(hashtext('appointments:' || v_local::date::text));
  select count(*)::integer into v_booked
  from public.appointments a
  where a.status in ('pending', 'confirmed', 'in_chair')
    and a.scheduled_at < v_now + make_interval(mins => v_service.duration_minutes)
    and a.scheduled_at + make_interval(mins => a.duration_minutes) > v_now;
  if v_booked >= v_capacity then
    raise exception 'All salon chairs are currently occupied';
  end if;

  insert into public.appointments (
    guest_name, guest_phone, service_id, scheduled_at,
    duration_minutes, status
  )
  values (
    trim(p_guest_name),
    regexp_replace(p_guest_phone, '\D', '', 'g'),
    p_service_id,
    v_now,
    v_service.duration_minutes,
    'in_chair'
  )
  returning * into v_appointment;
  return v_appointment;
end;
$$;

revoke all on function public.available_appointment_slots(date, integer) from public;
grant execute on function public.available_appointment_slots(date, integer) to anon, authenticated;
revoke all on function public.create_customer_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.create_customer_appointment(uuid, timestamptz) to authenticated;
revoke all on function public.create_walkin_appointment(text, text, uuid) from public, anon;
grant execute on function public.create_walkin_appointment(text, text, uuid) to authenticated;

grant select on public.profiles, public.appointments to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.salon_settings to anon, authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant insert on public.appointments to anon;
grant update, insert, delete on public.salon_settings to authenticated;

comment on table public.salon_settings is
  'Singleton settings row; max_parallel_appointments defaults to 3.';
comment on function public.available_appointment_slots(date, integer) is
  'Lists future 30-minute slots for an IST date and reports availability without exposing appointment details.';
