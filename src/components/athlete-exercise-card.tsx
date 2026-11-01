import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton } from './ui';
import { ExerciseNameLink } from './exercise-name-link';
import { compactAthleteDisplay } from '../lib/athlete-display';
import { editCommon, stepRows, stepStatus, summaryRows, type AthleteSet, type AthleteStep } from '../lib/athlete-workout';
import { repetitionLabel } from '../lib/exercise-groups';
import { colors } from '../theme';
const exercise = (i: any) => Array.isArray(i.exercises) ? i.exercises[0] : i.exercises;
export function AthleteExerciseCard({ step, rows, previous, editing, disabled, readOnly, onEdit, onPatch, onPlanned, onSave, onSkip, ordinal, onOpen }: {
    ordinal?: number;
    onOpen?: () => void;
    step: AthleteStep;
    rows: Record<string, AthleteSet[]>;
    previous: Record<string, string>;
    editing: boolean;
    disabled: boolean;
    readOnly: boolean;
    onEdit: (value: boolean) => void;
    onPatch: (id: string, rows: AthleteSet[]) => void;
    onPlanned: () => void;
    onSave: () => void;
    onSkip: () => void;
}) {
    const all = stepRows(step, rows), status = stepStatus(all);
    const display = compactAthleteDisplay(step);
    const title = display.title || ({ 'STRENGTH WORK': 'Force', RENFO: 'Renforcement' }[step.section.block] ?? 'Exercice');
    return <Card style={styles.card}>
    <View style={styles.heading}><Text style={styles.phase}>{ordinal ? `${ordinal} · ` : ''}{title}</Text>{status !== 'pending' ? <Text style={styles.muted}>{({ done: '✓ Terminé', partial: 'Adapté', skipped: 'Passé' })[status]}</Text> : null}</View>
    {step.group.items.map(item => <View key={item.id} style={styles.exercise}>
      <ExerciseNameLink exerciseId={item.exercise_id ?? exercise(item)?.id} name={exercise(item)?.name} disabled={disabled} onOpen={onOpen} style={styles.name}>{exercise(item)?.name ?? 'Exercice'}</ExerciseNameLink>
      <Text style={styles.prescription}>{display.prescriptions[item.id] || 'Suis les consignes de ton coach.'}</Text>
      {editing && !step.warmup && previous[item.exercise_id] ? <Text style={styles.previous}>Précédent : {previous[item.exercise_id]}</Text> : null}
      {readOnly || (!step.warmup && status !== 'pending') ? <Text style={styles.result}>{summaryRows(rows[item.id] ?? [])}</Text> : null}
      {editing && !readOnly ? <ExerciseEditor key={`${step.id}:${item.id}`} item={item} rows={rows[item.id] ?? []} disabled={disabled} onChange={next => onPatch(item.id, next)}/> : null}
    </View>)}
    {display.footer ? <Text style={styles.muted}>{display.footer}</Text> : null}
    {!readOnly ? <View style={styles.actions}>
      {!editing ? <PrimaryButton compact label={status === 'done' ? 'Terminé ✓' : 'Terminé'} onPress={onPlanned} disabled={disabled || status === 'done'}/> : <PrimaryButton compact label="Enregistrer" onPress={onSave} disabled={disabled}/>}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onEdit(!editing)} style={styles.secondary}><Text style={styles.secondaryText}>{editing ? 'Réduire' : 'Saisir / modifier'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onSkip} style={styles.secondary}><Text style={styles.muted}>Passer</Text></Pressable>
    </View> : null}
  </Card>;
}
function ExerciseEditor({ item, rows, disabled, onChange }: {
    item: any;
    rows: AthleteSet[];
    disabled: boolean;
    onChange: (rows: AthleteSet[]) => void;
}) {
    const first = rows.find(r => !r.skipped) ?? rows[0];
    const varied = rows.some(r => r.reps !== first?.reps || r.load !== first?.load);
    const [detailed, setDetailed] = useState(varied);
    const [count, setCount] = useState(String(rows.filter(r => !r.skipped).length));
    const [error, setError] = useState('');
    if (!first)
        return null;
    const updateCommon = (key: 'count' | 'reps' | 'load', value: string) => {
        if (key === 'count')
            setCount(value);
        try {
            onChange(editCommon(rows, key === 'count' ? value : count, key === 'reps' ? value : first.reps, key === 'load' ? value : first.load));
            setError('');
        }
        catch (e: any) {
            setError(e.message);
            onChange(rows.map((r, i) => ({ ...r, inputError: i === 0 ? e.message : undefined })));
        }
    };
    const field = (label: string, value: string, change: (v: string) => void, decimal = false) => <View style={styles.field} key={label}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={`${exercise(item)?.name}, ${label}`} editable={!disabled} style={styles.input} value={value} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} onChangeText={change}/></View>;
    if (first.simpleCompletion)
        return <Pressable disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: !first.skipped, disabled }} onPress={() => onChange(rows.map(r => ({ ...r, done: !!first.skipped, skipped: !first.skipped })))} style={styles.secondary}><Text style={styles.secondaryText}>{!first.skipped ? '✓ Réalisé' : 'Non réalisé'}</Text></Pressable>;
    return <View style={styles.editor}>
    <Text style={styles.muted}>Charge ajoutée : 0 kg si aucune.</Text>
    {!detailed ? <View style={styles.fields}>
      {field('Séries', count, v => updateCommon('count', v))}
      {field(repetitionLabel(item) === 'A/R' ? 'A/R' : 'Reps', first.reps, v => updateCommon('reps', v))}
      {field('Charge (kg)', first.load, v => updateCommon('load', v), true)}
    </View> : rows.map(row => <View key={row.setNumber} style={styles.series}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !row.skipped, disabled }} disabled={disabled} onPress={() => onChange(rows.map(r => r.setNumber === row.setNumber ? { ...r, skipped: !r.skipped, done: r.skipped ?? false } : r))} style={styles.secondary}><Text style={styles.secondaryText}>Série {row.setNumber} · {row.skipped ? 'Non réalisée' : 'Réalisée ✓'}</Text></Pressable>
      {!row.skipped ? <View style={styles.fields}>
        {field(`${repetitionLabel(item)} · série ${row.setNumber}`, row.reps, v => onChange(rows.map(r => r.setNumber === row.setNumber ? { ...r, reps: v, rpe: '', done: true } : r)))}
        {field(`kg · série ${row.setNumber}`, row.load, v => onChange(rows.map(r => r.setNumber === row.setNumber ? { ...r, load: v, rpe: '', done: true } : r)), true)}
      </View> : null}
    </View>)}
    {!detailed ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { setDetailed(true); setError(''); onChange(rows.map(r => ({ ...r, inputError: undefined }))); }} style={styles.secondary}><Text style={styles.secondaryText}>Détail par série</Text></Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
    card: { gap: 12, padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' }, heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, exercise: { gap: 4 }, phase: { color: colors.yellow, fontSize: 14, fontWeight: '500' }, name: { color: colors.yellow, fontSize: 18, fontWeight: '500', lineHeight: 25 },
    prescription: { color: colors.text, fontSize: 15, lineHeight: 22 }, previous: { color: colors.muted, fontSize: 13, lineHeight: 20 }, result: { color: colors.yellow, fontSize: 14, lineHeight: 21 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 }, secondary: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' }, secondaryText: { color: colors.yellow, fontSize: 14, fontWeight: '400' }, muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    editor: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, field: { flexGrow: 1, flexBasis: 95, gap: 6 }, label: { color: colors.text, fontSize: 12, lineHeight: 18 },
    input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, color: colors.text, fontSize: 16, backgroundColor: colors.surface2 }, series: { borderTopWidth: 1, borderTopColor: colors.border }, error: { color: colors.red, lineHeight: 20 }
});
