import { withoutRpe } from '../lib/athlete-workout';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from './ui';
import { ExerciseNameLink } from './exercise-name-link';
import { colors } from '../theme';
import { wodHelp, wodLabels, type WorkoutSection, type WodDraft } from '../lib/wod';

export function WodCard({ section, value, disabled, navigationDisabled = false, onChange, onValidate, ordinal, editing = true, readOnly = false, onEdit, onOpen, onSkip }: {
  section: WorkoutSection; value: WodDraft; disabled: boolean;
  navigationDisabled?: boolean;
  ordinal?: number; editing?: boolean; readOnly?: boolean;
  onEdit?: (value: boolean) => void; onOpen?: () => void; onSkip?: () => void;
  onChange: (patch: Partial<WodDraft>) => void; onValidate: () => void;
}) {
  const format = section.format!;
  const prescriptions = section.items.map((item) => withoutRpe(item.prescription_notes).replace(/^(WORKOUT|WOD)\s*[—–:-]?\s*/i, ''));
  const firstHeader = prescriptions[0]?.split(/[—–]/)[0].trim() ?? '';
  const commonHeader = firstHeader && prescriptions.every((p) => p.startsWith(firstHeader) && /[—–]/.test(p)) ? firstHeader : '';

  const field = (key: keyof WodDraft, label: string, placeholder = '', multiline = false) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} editable={!disabled} style={[styles.input, multiline && styles.multiline]}
        value={String(value[key] ?? '')} placeholder={placeholder} placeholderTextColor={colors.muted}
        keyboardType={multiline ? 'default' : 'number-pad'} multiline={multiline}
        onChangeText={(text) => onChange({ [key]: text })} />
    </View>
  );
  return <Card style={styles.card}>
    <Text style={styles.title}>{ordinal ? `${ordinal} · ` : ''}{commonHeader || wodLabels[format]}</Text>
    {section.items.map((item: any) => {
      const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
      const fullPrescription = withoutRpe(item.prescription_notes).replace(/^(WORKOUT|WOD)\s*[—–:-]?\s*/i, '');
      const prescription = commonHeader ? fullPrescription.slice(commonHeader.length).replace(/^\s*[—–]\s*/, '') : fullPrescription;
      return <View style={styles.movement} key={item.id}>
        <ExerciseNameLink exerciseId={item.exercise_id ?? exercise?.id} name={exercise?.name}
          disabled={navigationDisabled} onOpen={onOpen} style={styles.name}>{exercise?.name ?? 'Mouvement'}{item.exercise_id || exercise?.id ? <Text style={styles.chevron}> ›</Text> : null}</ExerciseNameLink>
        <Text style={styles.prescription}>{prescription}</Text>
      </View>;
    })}
    {value.completed ? <Text style={styles.result}>{wodScoreSummary(format, value)}</Text> : value.notes === 'Non réalisé' ? <Text style={styles.help}>Passé</Text> : null}
    {value.completed && value.notes ? <Text style={styles.help}>{value.notes}</Text> : null}
    {editing && !readOnly ? <>
    <Text style={styles.help}>{wodHelp[format]}</Text>
    {['amrap', 'rounds'].includes(format) || (format === 'for_time' && value.capped) ? <View style={styles.fields}>
      {field('rounds', 'Tours complets', '0')}{field('reps', 'Reps supplémentaires', '0')}
    </View> : null}
    {format === 'emom' ? <View style={styles.fields}>{field('intervals', 'Intervalles accomplis', '0')}{field('reps', 'Reps du dernier intervalle', '0')}</View> : null}
    {format === 'for_time' || format === 'rounds' ? <>
      {format === 'for_time' ? <Pressable accessibilityRole="checkbox" accessibilityState={{checked: !!value.capped, disabled}} disabled={disabled}
        onPress={() => onChange({ capped: !value.capped })} style={styles.status}>
        <Text style={styles.statusText}>{value.capped ? '☑' : '☐'} Limite de temps atteinte / arrêt avant la fin</Text>
      </Pressable> : null}
      <View style={styles.fields}>{field('minutes', value.capped ? 'Temps écoulé · min' : 'Temps · minutes', '00')}{field('seconds', 'Secondes', '00')}</View>
    </> : null}
    {format === 'tabata' || format === 'intervals' ? field('intervalResults', 'Résultats par intervalle et mouvement', format === 'tabata' ? 'Squats : 12, 11, 10, 10, 9, 9, 8, 8…' : '1 : 2:10 · 2 : 2:15…', true) : null}
    {field('notes', value.capped ? 'Travail réalisé / adaptations' : 'Charges, adaptations, ressenti (facultatif)', 'Ex. haltère 15 kg, variante adaptée…', true)}
    <Pressable disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: !!value.completed, disabled }} onPress={onValidate}
      style={[styles.validate, value.completed && styles.done]}>
      <Text style={styles.validateText}>{value.completed ? 'Résultat enregistré ✓' : 'Enregistrer'}</Text>
    </Pressable>
    </> : null}
    {!readOnly ? <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: editing, disabled }} disabled={disabled} onPress={() => onEdit?.(!editing)} style={styles.action}>
        <Text style={styles.actionText}>{editing ? 'Réduire' : value.completed ? 'Modifier le résultat' : 'Saisir le résultat'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onSkip} style={styles.action}><Text style={styles.help}>Passer</Text></Pressable>
    </View> : null}
  </Card>;
}
export function wodScoreSummary(format: string, value: WodDraft): string {
  const score: string[] = [];
  if (value.capped) score.push('Arrêt avant la fin');
  if (['amrap', 'rounds'].includes(format) || format === 'for_time' && value.capped)
    score.push([value.rounds ? `${value.rounds} tours` : '', value.reps ? `${value.reps} reps` : ''].filter(Boolean).join(' + '));
  if (format === 'emom') score.push([value.intervals ? `${value.intervals} intervalles` : '', value.reps ? `${value.reps} reps au dernier` : ''].filter(Boolean).join(' · '));
  if ((format === 'for_time' || format === 'rounds') && (value.minutes || value.seconds)) score.push(`${value.minutes || '0'} min ${value.seconds || '0'} s`);
  if (format === 'tabata' || format === 'intervals') score.push(value.intervalResults || '');
  return ['✓ Terminé', ...score.filter(Boolean)].join(' · ');
}
const styles = StyleSheet.create({
  card: { padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', gap: 18 }, title: { color: colors.yellow, fontSize: 13, lineHeight: 20, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  movement: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingBottom: 16, gap: 6 },
  name: { color: colors.text, fontSize: 20, fontWeight: '600', lineHeight: 28 },
  chevron: { color: colors.yellow, fontWeight: '400' },
  prescription: { color: '#D7D6D3', fontSize: 16, fontWeight: '400', lineHeight: 24 },
  result: { color: colors.text, fontSize: 15, fontWeight: '500', lineHeight: 23 },
  help: { color: colors.muted, fontSize: 14, fontWeight: '400', lineHeight: 22 }, fields: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  field: { flexGrow: 1, minWidth: 120, gap: 6 }, label: { color: colors.muted, fontSize: 13, fontWeight: '500', lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 12, padding: 12, color: colors.text, fontSize: 18, backgroundColor: '#101010' },
  multiline: { minHeight: 66, fontSize: 14, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }, action: { minHeight: 48, justifyContent: 'center' }, actionText: { color: colors.yellow, fontSize: 14, fontWeight: '500', lineHeight: 21 },
  status: { paddingVertical: 8 }, statusText: { color: colors.text, fontSize: 14 },
  validate: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.yellow, alignItems: 'center' },
  done: { backgroundColor: '#39320a' }, validateText: { color: colors.yellow, fontSize: 13, fontWeight: '500' },
});
