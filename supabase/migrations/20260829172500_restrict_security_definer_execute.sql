-- Restrict SECURITY DEFINER helpers to authenticated users only.
-- These functions are used by authenticated app flows / RLS helpers and
-- should not be directly executable by the anonymous role.

revoke execute on function public.accept_coach_invite(text) from anon;
revoke execute on function public.is_coach_of(uuid) from anon;
revoke execute on function public.current_user_is_program_coach(uuid) from anon;
revoke execute on function public.current_user_has_program_assignment(uuid) from anon;

grant execute on function public.accept_coach_invite(text) to authenticated;
grant execute on function public.is_coach_of(uuid) to authenticated;
grant execute on function public.current_user_is_program_coach(uuid) to authenticated;
grant execute on function public.current_user_has_program_assignment(uuid) to authenticated;
