-- Sécurise la création des profils :
-- toute inscription publique crée obligatoirement un athlète.
-- Le rôle coach devra être attribué via une opération administrative contrôlée.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    role,
    first_name,
    last_name
  )
  values (
    new.id,
    'athlete'::public.user_role,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
