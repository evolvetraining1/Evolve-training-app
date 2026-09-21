-- Optional follow-up answers. Existing values and ownership policies are retained.
alter table public.routine_logs
  add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.routine_logs
  add constraint routine_logs_details_object check (jsonb_typeof(details) = 'object');

-- Observations are opt-in and neutral: no medication, symptom or supplement
-- is promoted as a performance target by these new catalogue entries.
insert into public.routine_catalog
  (slug, name, category, description, input_type, default_enabled, polarity,
   recovery_weight, stress_weight, readiness_weight, sort_order, active)
values
  ('proteins', 'Protéines consommées', 'nutrition', 'As-tu consommé des protéines ?', 'boolean', false, 'neutral', 0, 0, 0, 200, true),
  ('fibers', 'Fibres consommées', 'nutrition', 'As-tu consommé des fibres ?', 'boolean', false, 'neutral', 0, 0, 0, 201, true),
  ('carbohydrates', 'Glucides', 'nutrition', 'As-tu consommé des glucides ?', 'boolean', false, 'neutral', 0, 0, 0, 202, true),
  ('meat', 'Viande', 'nutrition', 'As-tu consommé de la viande ?', 'boolean', false, 'neutral', 0, 0, 0, 203, true),
  ('caffeine', 'Caféine', 'nutrition', 'As-tu consommé de la caféine ?', 'boolean', false, 'neutral', 0, 0, 0, 204, true),
  ('late_meal', 'Repas avant le coucher', 'nutrition', 'As-tu mangé peu avant de te coucher ?', 'boolean', false, 'neutral', 0, 0, 0, 205, true),
  ('dinner', 'Dîner', 'nutrition', 'As-tu dîné ?', 'boolean', false, 'neutral', 0, 0, 0, 206, true),
  ('morning_snack', 'Collation matinale', 'nutrition', 'As-tu pris une collation le matin ?', 'boolean', false, 'neutral', 0, 0, 0, 207, true),
  ('afternoon_snack', 'Collation de l’après-midi', 'nutrition', 'As-tu pris une collation l’après-midi ?', 'boolean', false, 'neutral', 0, 0, 0, 208, true),
  ('evening_snack', 'Collation du soir', 'nutrition', 'As-tu pris une collation le soir ?', 'boolean', false, 'neutral', 0, 0, 0, 209, true),
  ('dark_chocolate', 'Chocolat noir', 'nutrition', 'As-tu consommé du chocolat noir ?', 'boolean', false, 'neutral', 0, 0, 0, 210, true),
  ('magnesium', 'Magnésium', 'supplements', 'As-tu pris du magnésium ?', 'boolean', false, 'neutral', 0, 0, 0, 211, true),
  ('ashwagandha', 'Ashwagandha', 'supplements', 'As-tu pris de l’ashwagandha ?', 'boolean', false, 'neutral', 0, 0, 0, 212, true),
  ('calcium_supplement', 'Calcium en complément', 'supplements', 'As-tu pris du calcium en complément ?', 'boolean', false, 'neutral', 0, 0, 0, 213, true),
  ('turmeric', 'Curcuma', 'nutrition', 'As-tu consommé du curcuma ?', 'boolean', false, 'neutral', 0, 0, 0, 214, true),
  ('reading', 'Lecture au lit', 'sleep', 'As-tu lu au lit, sans écran ?', 'boolean', false, 'neutral', 0, 0, 0, 215, true),
  ('shared_bed', 'Lit partagé', 'sleep', 'As-tu partagé ton lit ?', 'boolean', false, 'neutral', 0, 0, 0, 216, true),
  ('white_noise', 'Bruit blanc', 'sleep', 'As-tu utilisé un bruit blanc pour dormir ?', 'boolean', false, 'neutral', 0, 0, 0, 217, true),
  ('hot_shower', 'Douche chaude', 'recovery', 'As-tu pris une douche chaude avant de dormir ?', 'boolean', false, 'neutral', 0, 0, 0, 218, true),
  ('cold_shower', 'Douche froide', 'recovery', 'As-tu pris une douche froide ?', 'boolean', false, 'neutral', 0, 0, 0, 219, true),
  ('hot_bath', 'Bain chaud', 'recovery', 'As-tu pris un bain chaud ?', 'boolean', false, 'neutral', 0, 0, 0, 220, true),
  ('ice_bath', 'Bain froid', 'recovery', 'As-tu pris un bain froid ?', 'boolean', false, 'neutral', 0, 0, 0, 221, true),
  ('sauna', 'Sauna', 'recovery', 'As-tu fait une séance de sauna ?', 'boolean', false, 'neutral', 0, 0, 0, 222, true),
  ('aromatherapy', 'Aromathérapie', 'recovery', 'As-tu utilisé des huiles essentielles ?', 'boolean', false, 'neutral', 0, 0, 0, 223, true),
  ('acupuncture', 'Acupuncture', 'recovery', 'As-tu eu une séance d’acupuncture ?', 'boolean', false, 'neutral', 0, 0, 0, 224, true),
  ('cryotherapy', 'Cryothérapie', 'recovery', 'As-tu eu une séance de cryothérapie ?', 'boolean', false, 'neutral', 0, 0, 0, 225, true),
  ('learning', 'Apprentissage', 'mental', 'As-tu appris quelque chose d’intéressant ?', 'boolean', false, 'neutral', 0, 0, 0, 226, true),
  ('anxiety', 'Anxiété ressentie', 'mental', 'T’es-tu senti(e) anxieux ou anxieuse ?', 'boolean', false, 'neutral', 0, 0, 0, 227, true),
  ('irritability', 'Irritabilité', 'mental', 'T’es-tu senti(e) irritable ?', 'boolean', false, 'neutral', 0, 0, 0, 228, true),
  ('concentration_difficulty', 'Difficultés de concentration', 'mental', 'As-tu eu du mal à te concentrer ?', 'boolean', false, 'neutral', 0, 0, 0, 229, true),
  ('low_motivation', 'Baisse de motivation', 'mental', 'As-tu ressenti une baisse de motivation ?', 'boolean', false, 'neutral', 0, 0, 0, 230, true),
  ('professional_calls', 'Appels professionnels', 'activity', 'As-tu participé à des appels professionnels ?', 'boolean', false, 'neutral', 0, 0, 0, 231, true),
  ('standing_desk', 'Bureau debout', 'activity', 'As-tu utilisé un bureau debout ?', 'boolean', false, 'neutral', 0, 0, 0, 232, true),
  ('camping', 'Camping', 'environment', 'As-tu dormi dehors ?', 'boolean', false, 'neutral', 0, 0, 0, 233, true),
  ('bloating', 'Ballonnements', 'health', 'As-tu eu des ballonnements ?', 'boolean', false, 'neutral', 0, 0, 0, 234, true),
  ('flatulence', 'Flatulences', 'health', 'As-tu eu des flatulences inhabituelles ?', 'boolean', false, 'neutral', 0, 0, 0, 235, true),
  ('heartburn', 'Brûlures d’estomac', 'health', 'As-tu eu des brûlures d’estomac ?', 'boolean', false, 'neutral', 0, 0, 0, 236, true),
  ('diarrhea', 'Diarrhée', 'health', 'As-tu eu de la diarrhée ?', 'boolean', false, 'neutral', 0, 0, 0, 237, true),
  ('injury', 'Blessure', 'health', 'As-tu une blessure à signaler ?', 'boolean', false, 'neutral', 0, 0, 0, 238, true),
  ('seasonal_allergies', 'Allergies saisonnières', 'health', 'As-tu ressenti des symptômes d’allergie ?', 'boolean', false, 'neutral', 0, 0, 0, 239, true),
  ('acne', 'Acné', 'health', 'As-tu eu de l’acné ?', 'boolean', false, 'neutral', 0, 0, 0, 240, true),
  ('tinnitus', 'Acouphènes', 'health', 'As-tu ressenti des acouphènes ?', 'boolean', false, 'neutral', 0, 0, 0, 241, true),
  ('menstrual_cramps', 'Crampes menstruelles', 'health', 'As-tu eu des crampes menstruelles ?', 'boolean', false, 'neutral', 0, 0, 0, 242, true),
  ('day_hot_flashes', 'Bouffées de chaleur en journée', 'health', 'As-tu eu des bouffées de chaleur en journée ?', 'boolean', false, 'neutral', 0, 0, 0, 243, true),
  ('night_hot_flashes', 'Bouffées de chaleur nocturnes', 'health', 'As-tu eu des bouffées de chaleur pendant la nuit ?', 'boolean', false, 'neutral', 0, 0, 0, 244, true),
  ('increased_libido', 'Hausse de libido', 'health', 'As-tu ressenti une hausse de libido ?', 'boolean', false, 'neutral', 0, 0, 0, 245, true),
  ('sexual_activity', 'Rapports sexuels', 'health', 'As-tu eu des rapports sexuels ?', 'boolean', false, 'neutral', 0, 0, 0, 246, true),
  ('masturbation', 'Masturbation', 'health', 'T’es-tu masturbé(e) ?', 'boolean', false, 'neutral', 0, 0, 0, 247, true),
  ('medication_taken', 'Prise de médicament', 'health', 'As-tu pris un médicament à consigner aujourd’hui ?', 'boolean', false, 'neutral', 0, 0, 0, 248, true)
on conflict (slug) do nothing;
