-- Live technician location tracking table
create table technician_locations (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints(id) on delete cascade,
  technician_name text not null,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_technician_locations_complaint_id on technician_locations(complaint_id);
create index idx_technician_locations_created_at on technician_locations(created_at desc);
create index idx_technician_locations_technician_name on technician_locations(technician_name);

alter table technician_locations enable row level security;

create policy "Allow public read on technician_locations"
  on technician_locations for select
  using (true);

create policy "Allow authenticated insert on technician_locations"
  on technician_locations for insert
  with check (auth.role() = 'authenticated');

create policy "Allow authenticated update on technician_locations"
  on technician_locations for update
  using (auth.role() = 'authenticated');
