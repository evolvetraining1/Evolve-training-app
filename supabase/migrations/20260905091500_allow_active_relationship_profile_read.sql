-- Allow members of an active coach-athlete relationship to read each
-- other's profile. This is required by messaging so an athlete can resolve
-- the coach profile (and vice versa) after the relationship row is found.
-- Access remains limited to the two users participating in an active
-- relationship.

create policy "relationship_members_read_profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.coach_athlete_relationships r
    where r.status = 'active'
      and (
        (r.coach_id = (select auth.uid()) and r.athlete_id = profiles.id)
        or
        (r.athlete_id = (select auth.uid()) and r.coach_id = profiles.id)
      )
  )
);
