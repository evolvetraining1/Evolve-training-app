-- SECURITY DEFINER functions receive EXECUTE for PUBLIC by default.
-- Revoking only anon is insufficient while PUBLIC still has EXECUTE,
-- because anon inherits PUBLIC privileges. Restrict these helpers to
-- authenticated application flows only.

revoke execute on function public.accept_coach_invite(text) from public;
revoke execute on function public.is_coach_of(uuid) from public;
revoke execute on function public.current_user_is_program_coach(uuid) from public;
revoke execute on function public.current_user_has_program_assignment(uuid) from public;

grant execute on function public.accept_coach_invite(text) to authenticated;
grant execute on function public.is_coach_of(uuid) to authenticated;
grant execute on function public.current_user_is_program_coach(uuid) to authenticated;
grant execute on function public.current_user_has_program_assignment(uuid) to authenticated;
