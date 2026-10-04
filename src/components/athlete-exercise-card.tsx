import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton } from './ui';
import { ExerciseNameLink } from './exercise-name-link';
import { ExerciseGroupHeader } from './exercise-group-header';
import { athletePrescription, editCommon, stepRows, stepStatus, summaryRows, type AthleteSet, type AthleteStep } from '../lib/athlete-workout';
import { repetitionLabel } from '../lib/exercise-groups';
import { colors } from '../theme';
const exercise = (i: any) => Array.isArray(i.exercises) ? i.exercises[0] : i.exercises;
export function AthleteExerciseCard({ step, rows, previous, editing, disabled, readOnly, onEdit, onPatch, onPlanned, onSave, onSkip }: {
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
    return <Card style={styles.card}>
    {step.warmup ? <Text style={styles.phase}>ÉCHAUFFEMENT / PRÉPARATION</Text> : <ExerciseGroupHeader group={step.group}/>}
    {step.group.items.map(item => <View key={item.id} style={styles.exercise}>
      <ExerciseNameLink exerciseId={item.exercise_id ?? exercise(item)?.id} name={exercise(item)?.name} disabled={disabled} style={styles.name}>{exercise(item)?.name ?? 'Exercice'}</ExerciseNameLink>
      <Text style={styles.prescription}>{athletePrescription(item) || 'Suis les consignes de ton coach.'}</Text>
      {!step.warmup && previous[item.exercise_id] ? <Text style={styles.previous}>Dernière séance : {previous[item.exercise_id]}</Text> : null}
      {readOnly || status !== 'pending' ? <Text style={styles.result}>{summaryRows(rows[item.id] ?? [])}</Text> : null}
      {editing && !readOnly ? <ExerciseEditor key={`${step.id}:${item.id}`} item={item} rows={rows[item.id] ?? []} disabled={disabled} onChange={next => onPatch(item.id, next)}/> : null}
    </View>)}
    {!readOnly ? <>
      {!editing ? <PrimaryButton label="FAIT COMME PRÉVU ✓" onPress={onPlanned} disabled={disabled}/> : <PrimaryButton label="VALIDER MES CHANGEMENTS" onPress={onSave} disabled={disabled}/>}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onEdit(!editing)} style={styles.secondary}><Text style={styles.secondaryText}>{editing ? 'Fermer les détails' : 'J’ai fait autrement'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onSkip} style={styles.secondary}><Text style={styles.muted}>{step.warmup ? 'Je n’ai pas fait ce bloc' : step.group.paired ? 'Je n’ai pas fait cet enchaînement' : 'Je n’ai pas fait cet exercice'}</Text></Pressable>
    </> : null}
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
        return <Pressable disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: !first.skipped, disabled }} onPress={() => onChange(rows.map(r => ({ ...r, done: !!first.skipped, skipped: !first.skipped })))} style={styles.secondary}><Text style={styles.secondaryText}>{!first.skipped ? '✓ Réalisé' : 'Non réalisé — toucher pour confirmer'}</Text></Pressable>;
    return <View style={styles.editor}>
    <Text style={styles.muted}>0 kg = aucune charge ajoutée. Les valeurs sont celles réellement réalisées.</Text>
    {!detailed ? <View style={styles.fields}>
      {field('Séries réalisées', count, v => updateCommon('count', v))}
      {field(repetitionLabel(item) === 'A/R' ? 'Allers-retours' : 'Répétitions', first.reps, v => updateCommon('reps', v))}
      {field('Charge (kg)', first.load, v => updateCommon('load', v), true)}
    </View> : rows.map(row => <View key={row.setNumber} style={styles.series}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !row.skipped, disabled }} disabled={disabled} onPress={() => onChange(rows.map(r => r.setNumber === row.setNumber ? { ...r, skipped: !r.skipped, done: r.skipped ?? false } : r))} style={styles.secondary}><Text style={styles.secondaryText}>Série {row.setNumber} · {row.skipped ? 'Non réalisée' : 'Réalisée ✓'}</Text></Pressable>
      {!row.skipped ? <View style={styles.fields}>
        {field(`${repetitionLabel(item)} · série ${row.setNumber}`, row.reps, v => onChange(rows.map(r => r.setNumber === row.setNumber ? { ...r, reps: v, rpe: '', done: true } : r)))}
        {field(`kg · série ${row.setNumber}`, row.load, v => onChange(rows.map(r => r.setNumber === row.setNumber ? { ...r, load: v, rpe: '', done: true } : r)), true)}
      </View> : null}
    </View>)}
    {!detailed ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { setDetailed(true); setError(''); onChange(rows.map(r => ({ ...r, inputError: undefined }))); }} style={styles.secondary}><Text style={styles.secondaryText}>Mes séries sont différentes</Text></Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
    card: { gap: 16 }, exercise: { gap: 9 }, phase: { color: colors.yellow, fontSize: 14, fontWeight: '900' }, name: { color: colors.text, fontSize: 25, fontWeight: '900', lineHeight: 32 },
    prescription: { color: colors.text, fontSize: 18, lineHeight: 27 }, previous: { color: colors.muted, fontSize: 13, lineHeight: 20 }, result: { color: colors.yellow, fontSize: 14, lineHeight: 21 },
    secondary: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' }, secondaryText: { color: colors.yellow, fontSize: 15, fontWeight: '700' }, muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    editor: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }, fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, field: { flexGrow: 1, flexBasis: 95, gap: 6 }, label: { color: colors.text, fontSize: 12, lineHeight: 18 },
    input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, color: colors.text, fontSize: 18, backgroundColor: colors.surface2 }, series: { borderTopWidth: 1, borderTopColor: colors.border }, error: { color: colors.red, lineHeight: 20 }
});
