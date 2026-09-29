import { Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Card } from './ui';
import { ExerciseGroupHeader } from './exercise-group-header';
import { ExerciseNameLink } from './exercise-name-link';
import { WorkoutSetRow } from './workout-set-row';
import { exercisePrescription, groupSetNumbers, groupRest, repetitionLabel, type ExerciseGroup } from '../lib/exercise-groups';
import { type LocalSet } from '../lib/workout-sets';
import { compactFields } from '../lib/screen-layout';
import { colors } from '../theme';

export function SupersetCard({ group, rows, disabled, onChange, onToggle }: {
  group: ExerciseGroup; rows: Record<string, LocalSet[]>; disabled: boolean;
  onChange: (id: string, number: number, value: Partial<LocalSet>) => void;
  onToggle: (id: string, row: LocalSet) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const compact = compactFields(width, fontScale);
  const exercise = (item: any) => Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
  return <Card style={{ marginBottom: 10 }}>
    <ExerciseGroupHeader group={group} />
    {group.items.map((item, index) => (
      <ExerciseNameLink key={item.id} exerciseId={item.exercise_id ?? exercise(item)?.id}
        name={exercise(item)?.name} style={styles.name}>
        {index + 1}. {exercise(item)?.name ?? 'Exercice'} — {exercisePrescription(item)}
      </ExerciseNameLink>
    ))}
    {groupSetNumbers(group, rows).map((number) => (
      <View key={number} style={styles.round}>
        <Text style={styles.roundTitle}>TOUR {number}</Text>
        {group.items.map((item) => {
          const row = (rows[item.id] ?? []).find((set) => set.setNumber === number);
          if (!row) return null;
          return <View key={item.id}>
            <ExerciseNameLink exerciseId={item.exercise_id ?? exercise(item)?.id}
              name={exercise(item)?.name} style={styles.name}>
              {exercise(item)?.name ?? 'Exercice'}
            </ExerciseNameLink>
            {!compact ? <Text style={styles.fields}>SÉRIE · {repetitionLabel(item)} · POIDS (kg) · RPE · OK</Text> : null}
            <WorkoutSetRow number={row.setNumber} values={row} done={row.done}
              repsLabel={repetitionLabel(item)} contextLabel={exercise(item)?.name} disabled={disabled}
              onChange={(value) => onChange(item.id, row.setNumber, value)}
              onToggle={() => onToggle(item.id, row)} />
          </View>;
        })}
        <Text style={styles.fields}>{groupRest(group, number)}</Text>
      </View>
    ))}
  </Card>;
}
const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 23, marginBottom: 12 },
  round: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  roundTitle: { color: colors.yellow, fontSize: 14, fontWeight: '900', marginBottom: 12 },
  fields: { color: colors.muted, fontSize: 11, lineHeight: 17, marginBottom: 8 },
});
