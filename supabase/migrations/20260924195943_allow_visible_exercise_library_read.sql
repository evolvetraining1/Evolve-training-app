-- Shared, visible movement-library entries are readable by signed-in athletes,
-- even before a program containing these movements has been assigned.
-- Coach ownership remains required by the existing write policies.
create policy authenticated_reads_visible_exercise_library
on public.exercises
for select
to authenticated
using (is_library_visible = true);
