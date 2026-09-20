-- EVOLVE TRAINING
-- Réduit le coût des contrôles RLS par ligne et ajoute les index manquants
-- relevés par les advisors Supabase.

do $$
declare
  policy_row record;
  role_list text;
  next_qual text;
  next_check text;
  alter_statement text;
begin
  for policy_row in
    select schemaname, tablename, policyname, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (
          coalesce(qual, '') like '%auth.uid()%'
          and coalesce(qual, '') not ilike '%select auth.uid()%'
        )
        or (
          coalesce(with_check, '') like '%auth.uid()%'
          and coalesce(with_check, '') not ilike '%select auth.uid()%'
        )
        or (
          coalesce(qual, '') like '%auth.email()%'
          and coalesce(qual, '') not ilike '%select auth.email()%'
        )
        or (
          coalesce(with_check, '') like '%auth.email()%'
          and coalesce(with_check, '') not ilike '%select auth.email()%'
        )
      )
  loop
    select string_agg(quote_ident(role_name::text), ', ')
    into role_list
    from unnest(policy_row.roles) as role_name;

    next_qual := policy_row.qual;
    next_check := policy_row.with_check;

    if next_qual is not null and next_qual not ilike '%select auth.uid()%' then
      next_qual := replace(next_qual, 'auth.uid()', '(select auth.uid())');
    end if;

    if next_check is not null and next_check not ilike '%select auth.uid()%' then
      next_check := replace(next_check, 'auth.uid()', '(select auth.uid())');
    end if;

    if next_qual is not null and next_qual not ilike '%select auth.email()%' then
      next_qual := replace(next_qual, 'auth.email()', '(select auth.email())');
    end if;

    if next_check is not null and next_check not ilike '%select auth.email()%' then
      next_check := replace(next_check, 'auth.email()', '(select auth.email())');
    end if;

    alter_statement := format(
      'alter policy %I on %I.%I to %s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      role_list
    );

    if next_qual is not null then
      alter_statement := alter_statement || format(' using (%s)', next_qual);
    end if;

    if next_check is not null then
      alter_statement := alter_statement || format(' with check (%s)', next_check);
    end if;

    execute alter_statement;
  end loop;
end;
$$;

create index if not exists messages_unread_by_conversation_idx
  on public.messages (conversation_id, sender_id)
  where read_at is null;

create index if not exists athlete_subscriptions_athlete_id_idx
  on public.athlete_subscriptions (athlete_id);

create index if not exists athlete_subscriptions_coach_id_idx
  on public.athlete_subscriptions (coach_id);

create index if not exists athlete_subscriptions_plan_id_idx
  on public.athlete_subscriptions (plan_id);

create index if not exists body_measurements_athlete_id_idx
  on public.body_measurements (athlete_id);

create index if not exists coach_invites_accepted_by_idx
  on public.coach_invites (accepted_by);

create index if not exists coach_invites_coach_id_idx
  on public.coach_invites (coach_id);

create index if not exists coach_notes_athlete_id_idx
  on public.coach_notes (athlete_id);

create index if not exists coach_notes_coach_id_idx
  on public.coach_notes (coach_id);

create index if not exists exercises_owner_coach_id_idx
  on public.exercises (owner_coach_id);

create index if not exists service_plans_coach_id_idx
  on public.service_plans (coach_id);
