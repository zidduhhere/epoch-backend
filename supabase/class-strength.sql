-- Class strength: how many students each class has in total (set by an admin).
-- Analytics uses it so the target covers the whole class, not only the students
-- entered so far. Null means "not set yet" and falls back to students entered.
alter table public.classes
  add column if not exists total_students int check (total_students is null or total_students >= 0);
