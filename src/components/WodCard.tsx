import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from './ui';
import { colors } from '../theme';
import { wodHelp, wodLabels, type WorkoutSection, type WodDraft } from '../lib/wod';

export function WodCard({ section, value, disabled, onChange, onValidate }: {
  section: WorkoutSection; value: WodDraft; disabled: boolean;
  onChange: (patch: Partial<WodDraft>) => void; onValidate: () => void;
}) {
  const format = section.format!;
  const prescriptions = section.items.map((item) => String(item.prescription_notes ?? '').replace(/^(WORKOUT|WOD)\s*[—–:-]?\s*/i, ''));
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
    <Text style={styles.title}>{commonHeader ? commonHeader.toUpperCase() : wodLabels[format]}</Text>
    {section.items.map((item: any) => {
      const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
      const fullPrescription = String(item.prescription_notes ?? '').replace(/^(WORKOUT|WOD)\s*[—–:-]?\s*/i, '');
      const prescription = commonHeader ? fullPrescription.slice(commonHeader.length).replace(/^\s*[—–]\s*/, '') : fullPrescription;
      return <View style={styles.movement} key={item.id}>
        <Text style={styles.name}>{exercise?.name ?? 'Mouvement'}</Text>
        <Text style={styles.prescription}>{prescription}</Text>
      </View>;
    })}
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
      <Text style={styles.validateText}>{value.completed ? '✓ RÉSULTAT VALIDÉ' : 'VALIDER LE RÉSULTAT DU BLOC'}</Text>
    </Pressable>
  </Card>;
}
const styles = StyleSheet.create({
  card: { marginBottom: 16, gap: 12 }, title: { color: colors.yellow, fontSize: 23, fontWeight: '900' },
  movement: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft, paddingBottom: 10, gap: 3 },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' }, prescription: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  help: { color: colors.muted, fontSize: 14, lineHeight: 21 }, fields: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  field: { flexGrow: 1, minWidth: 120, gap: 6 }, label: { color: colors.text, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 12, padding: 12, color: colors.text, fontSize: 18, backgroundColor: '#101010' },
  multiline: { minHeight: 66, fontSize: 14, textAlignVertical: 'top' },
  status: { paddingVertical: 8 }, statusText: { color: colors.text, fontSize: 14 },
  validate: { padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.yellow, alignItems: 'center' },
  done: { backgroundColor: '#39320a' }, validateText: { color: colors.yellow, fontSize: 13, fontWeight: '900' },
});
