-- DO NOT RUN. Legacy file kept for history only. It opens or overwrites live data.
-- Use phone-login-migration.sql and the later migrations instead.
-- 1. Alter bills table: allow nullable submitted_by and add submitted_by_name
alter table public.bills alter column submitted_by drop not null;
alter table public.bills add column if not exists submitted_by_name text;

-- 2. Alter students table: add updated_by_name and updated_by_role
alter table public.students add column if not exists updated_by_name text;
alter table public.students add column if not exists updated_by_role text;

-- 3. Grants for anon and authenticated roles
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;

-- 4. Enable anon access policies for seamless browser connection
do $$ begin
  create policy "classes_anon_select" on public.classes for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "students_anon_select" on public.students for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "students_anon_insert" on public.students for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "students_anon_update" on public.students for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "payment_ledger_anon_select" on public.payment_ledger for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "payment_ledger_anon_insert" on public.payment_ledger for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bills_anon_select" on public.bills for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bills_anon_insert" on public.bills for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bills_anon_update" on public.bills for update to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
