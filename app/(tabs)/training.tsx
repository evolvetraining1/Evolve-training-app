import { useCallback, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ScreenScrollView } from '@/src/components/screen-scroll-view';
import { BackScreenHeader, Card, PrimaryButton } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { getMyProgramsWithSelection, getMyUpcomingSessions, getProgramDetail, getOrCreateWorkoutSession, setSelectedProgramId } from '@/src/lib/api';
import { buildProgramProgress } from '@/src/lib/session-flow';

type Overview = { programs: any[]; selected: any; templates: any[]; sessions: any[] };
type Option = ReturnType<typeof buildProgramProgress>['options'][number];

export default function TrainingScreen() {
  const [data, setData] = useState<Overview | null>(null), current = useRef<Overview | null>(null);
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [openWeek, setOpenWeek] = useState<number | null>(null), [showPrograms, setShowPrograms] = useState(false);
  const request = useRef(0), focused = useRef(false), lock = useRef(false);
  const load = useCallback(async () => {
    const token = ++request.current;
    setRefreshing(true);
    setError('');
    try {
      const [selection, sessions] = await Promise.all([getMyProgramsWithSelection(), getMyUpcomingSessions()]);
      if (!focused.current || token !== request.current) return;
      const programs = selection.programs ?? [];
      const selected = programs.find((p: any) => String(p.id) === String(selection.selectedProgramId)) ?? programs[0] ?? null;
      const detail = selected ? await getProgramDetail(String(selected.id)) : null;
      if (!focused.current || token !== request.current) return;
      const next = { programs, selected, templates: detail?.workouts ?? [], sessions };
      if (!current.current || String(current.current.selected?.id) !== String(selected?.id)) {
        const progress = buildProgramProgress(next.templates, sessions, selected?.id);
        const first = progress.recommended?.template ?? progress.options[0]?.template;
        setOpenWeek(first ? Number(first.week_number) : null);
      }
      current.current = next;
      setData(next);
    } catch (e: any) {
      if (focused.current && token === request.current) setError(e?.message ?? 'Impossible de charger ton programme.');
    } finally {
      if (focused.current && token === request.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load();
    return () => { focused.current = false; request.current += 1; };
  }, [load]));

  const progress = useMemo(() => buildProgramProgress(data?.templates ?? [], data?.sessions ?? [], data?.selected?.id), [data]);
  const weeks = useMemo(() => {
    const result = new Map<number, Option[]>();
    for (const option of progress.options) {
      const week = Number(option.template.week_number);
      result.set(week, [...(result.get(week) ?? []), option]);
    }
    return [...result.entries()];
  }, [progress]);

  async function chooseProgram(id: string) {
    if (lock.current || refreshing || id === String(data?.selected?.id)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await setSelectedProgramId(id);
      if (!focused.current) return;
      setShowPrograms(false);
      await load();
    } catch (e: any) {
      if (focused.current) setError(e?.message ?? 'Impossible de changer de programme.');
    } finally { lock.current = false; setBusy(false); }
  }
  async function openSession(option: Option) {
    if (lock.current || refreshing || error) return;
    if (option.finished && option.session?.id) {
      router.push({ pathname: '/workout', params: { sessionId: option.session.id } });
      return;
    }
    lock.current = true; setBusy(true); setError('');
    const token = request.current;
    try {
      // Reuse the same idempotent session opening as the home screen.
      const session = await getOrCreateWorkoutSession(String(option.template.id));
      if (focused.current && token === request.current) router.push({ pathname: '/workout', params: { sessionId: session.id } });
    } catch (e: any) {
      if (focused.current && token === request.current) setError(e?.message ?? 'Impossible d’ouvrir la séance.');
    } finally { lock.current = false; setBusy(false); }
  }

  return <ScreenScrollView contentContainerStyle={styles.page}
    refreshControl={<RefreshControl refreshing={refreshing && !loading} onRefresh={() => { if (!lock.current) void load(); }} tintColor={colors.yellow}/>}
    showsVerticalScrollIndicator={false}>
    <BackScreenHeader compact title="Mon programme" subtitle="Tes semaines, tes séances et tes résultats."/>
    {loading ? <ActivityIndicator color={colors.yellow} size="large"/> : null}
    {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PrimaryButton compact label="Réessayer" onPress={() => void load()} disabled={busy || refreshing}/></View> : null}
    {!loading && data?.selected ? <>
      <Card style={styles.programCard}>
        <Text style={styles.label}>Programme actif</Text>
        <Text style={styles.programName}>{data.selected.name}</Text>
        <Text style={styles.meta}>{progress.options.filter(o => o.finished).length} / {progress.options.length} séances renseignées</Text>
        {progress.complete ? <Text style={styles.meta}>Programme terminé · tes résultats restent consultables.</Text> : null}
        {data.programs.length > 1 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPrograms }} disabled={busy || refreshing} onPress={() => setShowPrograms(value => !value)} style={styles.action}><Text style={styles.link}>{showPrograms ? 'Fermer la liste' : 'Changer de programme'}</Text></Pressable> : null}
        {showPrograms ? data.programs.map(p => <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: p.id === data.selected.id, disabled: busy || refreshing }} disabled={busy || refreshing} onPress={() => void chooseProgram(String(p.id))} style={styles.programOption}><Text style={styles.optionName}>{p.name}</Text><Text style={styles.link}>{p.id === data.selected.id ? '✓' : '›'}</Text></Pressable>) : null}
      </Card>
      {!progress.options.length && !error ? <Text style={styles.empty}>Aucune séance n’est encore renseignée pour ce programme.</Text> : null}
      {weeks.map(([week, options]) => <View key={week} style={styles.week}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: openWeek === week }} onPress={() => setOpenWeek(value => value === week ? null : week)} style={styles.weekHeader}>
          <Text style={styles.weekTitle}>Semaine {week}</Text><Text style={styles.meta}>{options.filter(o => o.finished).length}/{options.length}  {openWeek === week ? '−' : '+'}</Text>
        </Pressable>
        {openWeek === week ? options.map(option => <View key={option.template.id} style={styles.session}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Voir le détail : ${option.template.name}`} disabled={busy}
            onPress={() => router.push({ pathname: '/program-workout', params: { workoutId: String(option.template.id) } })} style={styles.sessionDetail}>
            <Text style={styles.day}>Jour {option.template.day_number}{option.template.estimated_minutes ? ` · ≈ ${option.template.estimated_minutes} min` : ''}</Text>
            <Text style={styles.sessionName}>{option.template.name} <Text style={styles.link}>›</Text></Text>
          </Pressable>
          <View style={styles.sessionFooter}>
            <Text style={styles.meta}>{option.finished ? option.session?.status === 'skipped' ? 'Passée' : 'Terminée' : option.session?.status === 'in_progress' ? 'En cours' : 'À faire'}</Text>
            <Pressable accessibilityRole="button" disabled={busy || refreshing || !!error} onPress={() => void openSession(option)} style={[styles.open, (busy || refreshing || !!error) && styles.disabled]}>
              <Text style={styles.link}>{option.finished ? 'Voir le résultat' : option.session?.status === 'in_progress' ? 'Reprendre' : 'Commencer'}</Text>
            </Pressable>
          </View>
        </View>) : null}
      </View>)}
    </> : !loading && data && !error ? <Card><Text style={styles.programName}>Aucun programme attribué</Text><Text style={styles.empty}>Ton programme apparaîtra ici dès qu’il sera disponible.</Text></Card> : null}
    {busy ? <ActivityIndicator color={colors.yellow} style={styles.spinner}/> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.push('/program')} style={styles.catalog}><Text style={styles.link}>Découvrir les programmes ›</Text></Pressable>
  </ScreenScrollView>;
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40 }, programCard: { gap: 8, marginBottom: 18 },
  label: { color: colors.yellow, fontSize: 13, fontWeight: '600', lineHeight: 20 }, programName: { color: colors.text, fontSize: 23, fontWeight: '600', lineHeight: 31 },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 22 }, link: { color: colors.yellow, fontSize: 14, lineHeight: 22 },
  action: { minHeight: 44, justifyContent: 'center' }, programOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }, optionName: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 23 },
  week: { marginBottom: 12 }, weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 }, weekTitle: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  session: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  sessionDetail: { gap: 6, minHeight: 48 }, day: { color: colors.muted, fontSize: 13, lineHeight: 20 }, sessionName: { color: colors.text, fontSize: 18, lineHeight: 26, fontWeight: '500' },
  sessionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 8 }, open: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, disabled: { opacity: 0.4 },
  catalog: { minHeight: 52, marginTop: 16, alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted, fontSize: 15, lineHeight: 23, marginVertical: 14 },
  errorBox: { gap: 12, marginBottom: 16 }, error: { color: colors.red, fontSize: 14, lineHeight: 22 }, spinner: { marginVertical: 12 }
});
