import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ScreenScrollView } from './screen-scroll-view';
import { PrimaryButton } from './ui';
import { colors } from '../theme';

type Props = {
  firstName?: string;
  workout: any;
  program: any;
  programs: any[];
  switchingProgram: boolean;
  ready: boolean;
  starting: boolean;
  inProgress: boolean;
  complete: boolean;
  checkedIn: boolean;
  unread: number;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onStart: () => void;
  onChooseWorkout: () => void;
  onSelectProgram: (id: string) => Promise<void>;
  onMenu: () => void;
  onSettings: () => void;
};

/** Lightweight home. The complete dashboard and its saved layout remain available. */
export function SimpleHome(props: Props) {
  const [showPrograms, setShowPrograms] = useState(false);
  const { workout, program, ready, complete } = props;
  const meta = [workout?.week_number ? `Semaine ${workout.week_number}` : '', workout?.day_number ? `Jour ${workout.day_number}` : '', workout?.estimated_minutes ? `≈ ${workout.estimated_minutes} min` : ''].filter(Boolean).join(' · ');
  return <ScreenScrollView style={styles.surface} contentContainerStyle={styles.page}
    refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.yellow}/>}
    showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir le menu et les outils" onPress={props.onMenu} style={styles.menu}><Text style={styles.menuText}>☰</Text></Pressable>
      <Text style={styles.brand}>EVOLVE</Text>
      <Pressable accessibilityRole="button" onPress={props.onSettings} style={styles.settings}><Text style={styles.link}>Personnaliser</Text></Pressable>
    </View>
    <Text style={styles.greeting}>Bonjour{props.firstName ? ` ${props.firstName}` : ''}</Text>
    {props.error ? <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text> : null}

    <View style={styles.workout}>
      <Text style={styles.eyebrow}>{complete ? 'Programme terminé' : props.inProgress ? 'Séance en cours' : 'Ta séance'}</Text>
      <Text style={styles.title}>{!ready ? 'Chargement de ta séance…' : complete ? 'Toutes tes séances sont terminées' : workout?.name || 'Aucune séance disponible'}</Text>
      {ready && !complete && meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {program?.name ? <Text style={styles.programName}>{program.name}</Text> : null}
      {ready && complete ? <Text style={styles.muted}>Retrouve tes résultats ou choisis un autre programme.</Text> : null}
      {ready && !workout?.id && !complete ? <Text style={styles.muted}>{props.programs.length ? 'Choisis un programme ou une séance ci-dessous.' : 'Ton programme apparaîtra ici dès qu’il sera attribué.'}</Text> : null}
      {!complete ? <PrimaryButton compact label={props.starting ? 'Ouverture…' : props.inProgress ? 'Reprendre la séance' : 'Commencer la séance'} onPress={props.onStart} disabled={!ready || !workout?.id || props.starting}/> : null}
      <View style={styles.workoutLinks}>
        {ready && workout?.id && !complete ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/program-workout', params: { workoutId: String(workout.id) } })} style={styles.action}><Text style={styles.link}>Voir le détail</Text></Pressable> : null}
        {ready && program ? <Pressable accessibilityRole="button" onPress={props.onChooseWorkout} style={styles.action}><Text style={styles.link}>{complete ? 'Consulter mes séances' : 'Choisir une séance'}</Text></Pressable> : null}
        {!ready ? <Pressable accessibilityRole="button" onPress={props.onRefresh} style={styles.action}><Text style={styles.link}>Réessayer</Text></Pressable> : null}
      </View>
    </View>

    {props.programs.length > 1 ? <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPrograms }} onPress={() => setShowPrograms(value => !value)} style={styles.programToggle}><Text style={styles.muted}>Changer de programme</Text><Text style={styles.link}>{showPrograms ? '−' : '+'}</Text></Pressable>
      {showPrograms ? props.programs.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === program?.id, disabled: props.switchingProgram }} disabled={props.switchingProgram}
        onPress={() => void props.onSelectProgram(String(item.id))} style={styles.programOption}>
        <Text style={[styles.programOptionText, item.id === program?.id && styles.selected]}>{item.name}</Text><Text style={styles.link}>{item.id === program?.id ? '✓' : '›'}</Text>
      </Pressable>) : null}
    </View> : null}

    <Text style={styles.sectionTitle}>Ton suivi</Text>
    <View style={styles.links}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/journal')} style={styles.row}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Bilan du jour</Text><Text style={styles.muted}>{props.checkedIn ? 'Consulter ou compléter mon bilan' : 'Renseigner mes sensations et mes habitudes'}</Text></View><Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/nutrition')} style={styles.row}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Nutrition</Text><Text style={styles.muted}>Mes repas et mes apports</Text></View><Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/messaging')} style={[styles.row, styles.lastRow]}>
        <View style={styles.rowCopy}><Text style={styles.rowTitle}>Messages</Text><Text style={styles.muted}>{props.unread ? `${props.unread} message${props.unread > 1 ? 's' : ''} non lu${props.unread > 1 ? 's' : ''}` : 'Mes échanges avec le coach'}</Text></View>
        {props.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{props.unread > 99 ? '99+' : props.unread}</Text></View> : <Text style={styles.chevron}>›</Text>}
      </Pressable>
    </View>
  </ScreenScrollView>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: colors.surface }, page: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  menu: { minWidth: 44, minHeight: 48, justifyContent: 'center' }, menuText: { color: colors.text, fontSize: 24 },
  brand: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: 2 },
  settings: { minHeight: 48, justifyContent: 'center' }, link: { color: colors.yellow, fontSize: 14, lineHeight: 22 },
  greeting: { color: colors.text, fontSize: 26, lineHeight: 34, fontWeight: '600', marginBottom: 24 },
  workout: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: 18, padding: 18, gap: 12 },
  eyebrow: { color: colors.yellow, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  title: { color: colors.text, fontSize: 23, lineHeight: 31, fontWeight: '600' },
  meta: { color: colors.text, fontSize: 14, lineHeight: 22 }, programName: { color: colors.muted, fontSize: 14, lineHeight: 22, marginBottom: 4 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  workoutLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 16 }, action: { minHeight: 44, justifyContent: 'center' },
  programToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  programOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, programOptionText: { color: colors.text, fontSize: 15, lineHeight: 23, flex: 1 }, selected: { color: colors.yellow },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600', lineHeight: 26, marginTop: 28, marginBottom: 12 },
  links: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.border }, lastRow: { borderBottomWidth: 0 },
  rowCopy: { flex: 1, gap: 3 }, rowTitle: { color: colors.text, fontSize: 16, fontWeight: '500', lineHeight: 24 }, chevron: { color: colors.muted, fontSize: 24 },
  badge: { borderRadius: 12, backgroundColor: colors.yellow, paddingHorizontal: 8, paddingVertical: 3 }, badgeText: { color: colors.black, fontSize: 12, fontWeight: '600' },
  error: { color: colors.red, lineHeight: 22, marginBottom: 16 }
});
