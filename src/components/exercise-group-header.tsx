import { Text, View } from 'react-native';
import { colors } from '../theme';
import { groupRest, groupSetNumbers, type ExerciseGroup } from '../lib/exercise-groups';
export function ExerciseGroupHeader({ group }: { group: ExerciseGroup }) {
  if (!group.paired) return null;
  const rounds = groupSetNumbers(group).length;
  return <View style={{ gap: 6, marginBottom: 14 }}>
    <Text style={{ color: colors.yellow, fontSize: 18, fontWeight: '900' }}>{group.label} · {rounds} TOURS</Text>
    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>Enchaîne les {group.items.length} exercices dans l’ordre à chaque tour, puis prends le repos indiqué.</Text>
    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{groupRest(group)}</Text>
  </View>;
}
