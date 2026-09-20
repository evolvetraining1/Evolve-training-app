alter policy "athlete_can_read_invite_by_self_email"
on public.coach_invites
to public
using (
  accepted_at is null
  and expires_at > now()
  and lower(email) = lower(
    coalesce(((select auth.jwt()) ->> 'email'::text), ''::text)
  )
);
