-- EVOLVE TRAINING
-- Sécurise les modifications du profil côté client.
-- Un utilisateur peut modifier ses informations personnelles et
-- son programme sélectionné, mais jamais son rôle ou son identité système.

-- Supprime le droit UPDATE global.
revoke update on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

-- Un utilisateur anonyme ne doit jamais modifier un profil.
-- Les utilisateurs connectés ne peuvent modifier que ces colonnes.
grant update (
  first_name,
  last_name,
  avatar_url,
  selected_program_id,
  updated_at
)
on table public.profiles
to authenticated;

-- La RLS existante continue de garantir que l'utilisateur
-- ne peut modifier que sa propre ligne.
drop policy if exists "profile_self_update_selected_program"
on public.profiles;

create policy "profile_self_update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
