import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { compactFields } from '../lib/screen-layout';
import { colors } from '../theme';

type Values = { reps: string; load: string; rpe: string };
export function WorkoutSetRow({ number, values, done, disabled, onChange, onToggle }: {
  number: number; values: Values; done: boolean; disabled: boolean;
  onChange: (patch: Partial<Values>) => void; onToggle: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const compact = compactFields(width, fontScale);
  const toggle = <Pressable accessibilityRole="checkbox"
    accessibilityLabel={`Valider la série ${number}`} accessibilityState={{ checked: done, disabled }}
    disabled={disabled} onPress={onToggle} style={[styles.check, done && styles.done]}>
    <Text style={styles.checkText}>{done ? '✓' : ''}</Text>
  </Pressable>;
  return <View style={[styles.row, compact && styles.compact]}>
    {compact ? <View style={styles.heading}><Text style={styles.label}>SÉRIE {number}</Text>{toggle}</View>
      : <Text style={styles.number}>{number}</Text>}
    <View style={[styles.fields, compact && { flex: 0, width: "100%" }]}>
      {([['reps', 'REPS'], ['load', 'POIDS'], ['rpe', 'RPE']] as const).map(([key, label]) =>
        <View key={key} style={[styles.field, compact && styles.compactField]}>
          {compact ? <Text style={styles.label}>{label}</Text> : null}
          <TextInput accessibilityLabel={`${label}, série ${number}`} editable={!disabled}
            style={styles.input} keyboardType={key === 'reps' ? 'number-pad' : 'decimal-pad'}
            value={values[key]} onChangeText={(value) => onChange({ [key]: value })} />
        </View>)}
    </View>
    {!compact ? toggle : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  compact: { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  fields: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  field: { flex: 1, minWidth: 0, gap: 6 }, compactField: { minWidth: 70 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  number: { width: 42, color: colors.text, textAlign: 'center', fontWeight: '900' },
  input: { minHeight: 48, paddingHorizontal: 4, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface2, color: colors.text, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  check: { width: 42, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.green, borderColor: colors.green },
  checkText: { color: '#111', fontSize: 20, fontWeight: '900' },
});
