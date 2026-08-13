import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View
} from "react-native";
import BrandLogo from "@/src/components/BrandLogo";
import SideMenu from "@/src/components/SideMenu";
import { colors } from "@/src/theme";
import {
  getLatestPerformance, getMyProfile, getMyUpcomingSessions, getRecentCheckins,
  getSessionDetail, getTodayCheckin
} from "@/src/lib/api";
import { displayDuration, recoveryLabel, recoveryScore } from "@/src/lib/dashboard";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [checkin, setCheckin] = useState<any>(null);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [nextDetail, setNextDetail] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, s, c, rc, perf] = await Promise.all([
        getMyProfile(), getMyUpcomingSessions(), getTodayCheckin(), getRecentCheckins(7), getLatestPerformance()
      ]);
      setProfile(p); setSessions(s); setCheckin(c); setRecentCheckins(rc); setPerformance(perf);
      const active = s.find((x:any) => x.status !== "completed" && x.status !== "skipped");
      if (active?.id) setNextDetail(await getSessionDetail(active.id)); else setNextDetail(null);
    } catch (e:any) { setError(e?.message ?? "Impossible de charger les données"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const score = recoveryScore(checkin);
  const next = sessions.find(s => s.status !== "completed" && s.status !== "skipped");
  const afterNext = sessions.filter(s => s.status !== "completed" && s.status !== "skipped")[1];
  const template:any = next?.workout_templates;
  const previewExercises = (nextDetail?.workoutExercises ?? []).slice(0, 3);
  const checkinDates = useMemo(() => new Set(recentCheckins.map((x:any) => x.checkin_date)), [recentCheckins]);
  const streak = recentCheckins.length;

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.yellow}/></View>;

  return (
    <View style={styles.root}>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} role={profile?.role} />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.yellow} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}/>}>

        <View style={styles.topbar}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.squareButton}>
            <Text style={styles.menuGlyph}>☷</Text>
          </Pressable>
          <View style={styles.logoWrap}><BrandLogo compact /></View>
          <Pressable style={styles.squareButton}>
            <Text style={styles.bell}>♧</Text>
            <View style={styles.notification}><Text style={styles.notificationText}>2</Text></View>
          </Pressable>
        </View>

        <View style={styles.greetingRecovery}>
          <View style={styles.greetingBlock}>
            <Text style={styles.hello}>Bonjour</Text>
            <Text style={styles.name}>{profile?.first_name || "Athlète"} <Text style={styles.fist}>👊</Text></Text>
          </View>
          <View style={styles.recoveryCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryLabel}>RÉCUPÉRATION</Text>
              <Text style={[styles.recoveryValue, { color: score != null && score >= 65 ? colors.green : colors.yellow }]}>{score == null ? "--" : `${score}%`}</Text>
              <Text style={styles.recoveryText}>{recoveryLabel(score)}</Text>
            </View>
            <View style={[styles.ring, { borderColor: score != null && score >= 65 ? colors.green : colors.yellow }]}>
              <Text style={[styles.ringBolt, { color: score != null && score >= 65 ? colors.green : colors.yellow }]}>⚡</Text>
            </View>
          </View>
        </View>

        {error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text></View> : null}

        <SectionTitle title="SÉANCE DU JOUR" />
        <View style={styles.workoutCard}>
          <Image source={require("@/assets/workout-male.jpg")} style={styles.workoutImage} resizeMode="cover" />
          <View style={styles.imageShade} />
          <View style={styles.workoutContent}>
            <View style={styles.workoutHead}>
              <HexIcon glyph="▮▮" />
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutTitle}>{template?.name || "Aucune séance"}</Text>
                <Text style={styles.workoutMeta}>◷ {displayDuration(template?.estimated_minutes)}    ▥ Focus Force</Text>
              </View>
            </View>

            {next ? previewExercises.length ? previewExercises.map((we:any, index:number) => {
              const ex = we.exercises;
              const set = (we.prescribed_sets ?? [])[0];
              const prescription = set
                ? `${(we.prescribed_sets ?? []).length} × ${set.target_reps ?? "—"}${set.target_load_kg ? ` @ ${set.target_load_kg} kg` : set.target_rpe ? ` @ RPE ${set.target_rpe}` : ""}`
                : we.prescription_notes || "Prescription disponible";
              return <ExerciseRow key={we.id} index={index+1} name={ex?.name || "Exercice"} detail={prescription} />;
            }) : <Text style={styles.emptyWorkout}>Le détail de la séance apparaîtra ici.</Text>
            : <Text style={styles.emptyWorkout}>Aucune séance programmée pour aujourd’hui.</Text>}

            <Pressable
              disabled={!next}
              onPress={() => next && router.push({ pathname: "/workout", params: { sessionId: next.id } })}
              style={[styles.startButton, !next && { opacity: .45 }]}>
              <Text style={styles.play}>▶</Text><Text style={styles.startText}>{next?.status === "in_progress" ? "REPRENDRE LA SÉANCE" : "COMMENCER LA SÉANCE"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.nextCard}>
          <HexIcon glyph="▣" small />
          <View style={{ flex: 1 }}>
            <Text style={styles.smallCap}>PROCHAINE SÉANCE</Text>
            <Text style={styles.nextTitle}>{afterNext?.workout_templates?.name || "À programmer"}</Text>
            <Text style={styles.muted}>{afterNext?.scheduled_for ? `${afterNext.scheduled_for} • ${displayDuration(afterNext.workout_templates?.estimated_minutes)}` : "Aucune autre séance planifiée"}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>

        <SectionTitle title="SUIVI DE ROUTINE" action="Voir le suivi  →" onAction={() => router.push("/(tabs)/journal")} />
        <View style={styles.routineCard}>
          <View style={styles.streakBlock}><Text style={styles.fire}>🔥</Text><Text style={styles.streakNumber}>{streak}</Text><Text style={styles.streakDays}>JOURS</Text><Text style={styles.smallCap}>SÉRIE ACTUELLE</Text></View>
          <View style={styles.routineDivider} />
          <View style={styles.weekBlock}>
            <View style={styles.daysRow}>{DAYS.map((d, i) => {
              const date = new Date(); date.setDate(date.getDate() - (6-i));
              const key = date.toISOString().slice(0,10); const done = checkinDates.has(key);
              const isToday = i === 6;
              return <View key={i} style={styles.dayCol}><Text style={[styles.dayLabel,isToday&&{color:colors.yellow}]}>{d}</Text><View style={[styles.dayDot, done&&styles.dayDone, isToday&&!done&&styles.dayToday]}><Text style={styles.dayCheck}>{done ? "✓" : ""}</Text></View></View>;
            })}</View>
            <Text style={styles.routineMessage}>{streak ? "Continue comme ça !" : "Commence ton suivi aujourd’hui."}</Text>
          </View>
        </View>

        <SectionTitle title="AUJOURD’HUI" action="Voir le suivi  →" onAction={() => router.push("/(tabs)/journal")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricScroller}>
          <MetricCard icon="🌙" label="SOMMEIL" value={checkin?.sleep_minutes ? `${Math.floor(checkin.sleep_minutes/60)}h${String(checkin.sleep_minutes%60).padStart(2,'0')}` : "--"} state={checkin?.sleep_minutes ? "Renseigné" : "À saisir"} color={colors.purple}/>
          <MetricCard icon="⚡" label="FATIGUE" value={checkin?.fatigue ? `${checkin.fatigue}/10` : "--"} state={checkin?.fatigue ? (checkin.fatigue <= 3 ? "Faible" : checkin.fatigue <= 6 ? "Modérée" : "Élevée") : "À saisir"} color={colors.yellow}/>
          <MetricCard icon="❤️" label="COURBATURES" value={checkin?.soreness ? `${checkin.soreness}/10` : "--"} state={checkin?.soreness ? (checkin.soreness <= 3 ? "Faibles" : "Présentes") : "À saisir"} color={colors.green}/>
          <MetricCard icon="🙂" label="MOTIVATION" value={checkin?.motivation ? `${checkin.motivation}/10` : "--"} state={checkin?.motivation ? (checkin.motivation >= 7 ? "Élevée" : "Normale") : "À saisir"} color={colors.blue}/>
          <MetricCard icon="🟢" label="DOULEUR" value={checkin?.pain != null ? `${checkin.pain}/10` : "--"} state={checkin?.pain === 0 ? "Aucune" : checkin?.pain ? "Présente" : "À saisir"} color={colors.green}/>
        </ScrollView>

        <SectionTitle title="DERNIÈRES PERFORMANCES" action="Voir tout  →" onAction={() => router.push("/(tabs)/stats")} />
        <View style={styles.performanceCard}>
          <HexIcon glyph="▮▮" small />
          <View style={{ flex: 1 }}><Text style={styles.performanceName}>{performance?.exerciseName || "Aucune performance"}</Text><Text style={styles.muted}>{performance?.isPR ? "Nouveau PR" : "Dernière performance"}</Text></View>
          <View><Text style={styles.smallCap}>1RM estimé</Text><Text style={styles.oneRm}>{performance?.estimated1rm ? `${performance.estimated1rm} kg` : "--"}</Text></View>
          <View style={{ alignItems: "flex-end", minWidth: 55 }}><Text style={styles.prUp}>{performance?.deltaKg ? `↑ ${performance.deltaKg} kg` : ""}</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title, action, onAction }: { title:string; action?:string; onAction?:()=>void }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionLeft}><View style={styles.yellowBar}/><Text style={styles.sectionTitle}>{title}</Text></View>{action?<Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable>:null}</View>;
}
function HexIcon({ glyph, small=false }:{glyph:string;small?:boolean}) { return <View style={[styles.hexIcon, small&&styles.hexSmall]}><Text style={styles.hexGlyph}>{glyph}</Text></View>; }
function ExerciseRow({ index, name, detail }:{index:number;name:string;detail:string}) { return <View style={styles.exerciseRow}><View style={styles.exerciseIndex}><Text style={styles.exerciseIndexText}>{index}</Text></View><View style={{flex:1}}><Text style={styles.exerciseName}>{name}</Text><Text style={styles.exerciseDetail}>{detail}</Text></View><View style={styles.arrowCircle}><Text style={styles.arrowText}>›</Text></View></View>; }
function MetricCard({icon,label,value,state,color}:{icon:string;label:string;value:string;state:string;color:string}) { return <View style={styles.metricCard}><Text style={styles.metricIcon}>{icon}</Text><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={[styles.metricState,{color}]}>{state}</Text></View>; }

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg}, page:{paddingHorizontal:15,paddingTop:18,paddingBottom:105,backgroundColor:colors.bg}, center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.bg},
  topbar:{height:116,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between"}, squareButton:{width:54,height:54,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:"#0A0A0B",alignItems:"center",justifyContent:"center",position:"relative"}, menuGlyph:{color:colors.text,fontSize:29,lineHeight:31}, bell:{color:colors.text,fontSize:26}, notification:{position:"absolute",right:-3,top:-4,width:22,height:22,borderRadius:11,backgroundColor:colors.yellow,alignItems:"center",justifyContent:"center"}, notificationText:{color:"#080808",fontSize:11,fontWeight:"900"}, logoWrap:{position:"absolute",left:"50%",transform:[{translateX:-76}],top:-10,width:152,height:120,alignItems:"center",overflow:"hidden"},
  greetingRecovery:{flexDirection:"row",gap:10,alignItems:"stretch",marginBottom:18}, greetingBlock:{flex:1,justifyContent:"center",paddingLeft:4}, hello:{color:colors.muted,fontSize:15,marginBottom:3}, name:{color:colors.text,fontSize:33,fontWeight:"900",letterSpacing:-1}, fist:{fontSize:22}, recoveryCard:{flex:1.12,minHeight:108,borderWidth:1,borderColor:colors.border,borderRadius:17,backgroundColor:"#0A0A0B",padding:13,flexDirection:"row",alignItems:"center",gap:8}, recoveryLabel:{color:colors.muted,fontSize:10}, recoveryValue:{fontSize:27,fontWeight:"900",marginTop:3}, recoveryText:{color:colors.muted,fontSize:10,marginTop:2}, ring:{width:64,height:64,borderRadius:32,borderWidth:7,alignItems:"center",justifyContent:"center",backgroundColor:"#0B1009"}, ringBolt:{fontSize:24},
  errorCard:{borderColor:"#632E2E",borderWidth:1,borderRadius:14,padding:12,marginBottom:12},error:{color:colors.red}, sectionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:11,marginBottom:10},sectionLeft:{flexDirection:"row",alignItems:"center"},yellowBar:{width:3,height:20,borderRadius:2,backgroundColor:colors.yellow,marginRight:10},sectionTitle:{color:colors.text,fontWeight:"800",fontSize:17},sectionAction:{color:colors.yellow,fontSize:13},
  workoutCard:{minHeight:430,borderWidth:1,borderColor:colors.border,borderRadius:20,overflow:"hidden",backgroundColor:"#080809",position:"relative"},workoutImage:{position:"absolute",right:0,top:0,width:"49%",height:"83%"},imageShade:{position:"absolute",right:0,top:0,width:"58%",height:"84%",backgroundColor:"rgba(0,0,0,.28)"},workoutContent:{padding:15,paddingTop:17},workoutHead:{flexDirection:"row",alignItems:"center",gap:13,marginBottom:13,maxWidth:"73%"},hexIcon:{width:54,height:54,borderWidth:1,borderColor:colors.yellow,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(0,0,0,.55)"},hexSmall:{width:48,height:48,borderRadius:15},hexGlyph:{color:colors.yellow,fontWeight:"900",fontSize:18},workoutTitle:{color:colors.text,fontWeight:"900",fontSize:23},workoutMeta:{color:colors.muted,fontSize:11,marginTop:7},exerciseRow:{minHeight:76,maxWidth:"64%",flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:1,borderBottomColor:colors.borderSoft},exerciseIndex:{width:38,height:38,borderRadius:19,backgroundColor:"rgba(255,196,0,.08)",alignItems:"center",justifyContent:"center"},exerciseIndexText:{color:colors.yellow,fontWeight:"900",fontSize:21},exerciseName:{color:colors.text,fontWeight:"800",fontSize:14},exerciseDetail:{color:colors.muted,fontSize:12,marginTop:5},arrowCircle:{width:32,height:32,borderRadius:16,backgroundColor:"rgba(20,20,21,.85)",alignItems:"center",justifyContent:"center"},arrowText:{color:colors.text,fontSize:28,lineHeight:29},emptyWorkout:{color:colors.muted,maxWidth:"55%",paddingVertical:54},startButton:{height:57,borderRadius:10,backgroundColor:colors.yellow,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:12,marginTop:15},play:{color:"#060606",fontSize:16},startText:{color:"#060606",fontWeight:"900",fontSize:13},
  nextCard:{minHeight:100,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:"#09090A",padding:14,flexDirection:"row",alignItems:"center",gap:12,marginTop:12},smallCap:{color:colors.muted,fontSize:10,letterSpacing:.4},nextTitle:{color:colors.text,fontSize:19,fontWeight:"800",marginTop:4},muted:{color:colors.muted,fontSize:12,marginTop:3},chevron:{color:colors.text,fontSize:38,paddingHorizontal:8},
  routineCard:{minHeight:126,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:"#09090A",padding:14,flexDirection:"row",alignItems:"center"},streakBlock:{width:98,alignItems:"center"},fire:{fontSize:29},streakNumber:{color:colors.text,fontSize:28,fontWeight:"900",position:"absolute",right:7,top:0},streakDays:{color:colors.muted,fontSize:11,position:"absolute",right:3,top:34},routineDivider:{width:1,height:88,backgroundColor:colors.border,marginHorizontal:12},weekBlock:{flex:1},daysRow:{flexDirection:"row",justifyContent:"space-between"},dayCol:{alignItems:"center",gap:7},dayLabel:{color:colors.muted,fontSize:10},dayDot:{width:30,height:30,borderRadius:15,borderWidth:2,borderColor:colors.border,alignItems:"center",justifyContent:"center"},dayDone:{backgroundColor:"#3C8B1B",borderColor:"#3C8B1B"},dayToday:{borderColor:colors.yellow},dayCheck:{color:colors.text,fontWeight:"900"},routineMessage:{color:colors.muted,fontSize:11,marginTop:9},
  metricScroller:{gap:8,paddingRight:4},metricCard:{width:104,minHeight:145,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:"#0A0A0B",padding:12,alignItems:"center"},metricIcon:{fontSize:26,marginBottom:8},metricLabel:{color:colors.muted,fontSize:9},metricValue:{color:colors.text,fontSize:24,fontWeight:"800",marginTop:8},metricState:{fontWeight:"800",fontSize:11,marginTop:6},
  performanceCard:{minHeight:90,borderWidth:1,borderColor:colors.border,borderRadius:17,backgroundColor:"#09090A",padding:13,flexDirection:"row",alignItems:"center",gap:11},performanceName:{color:colors.text,fontSize:16,fontWeight:"800"},oneRm:{color:colors.text,fontSize:19,fontWeight:"800",marginTop:4},prUp:{color:colors.green,fontSize:14,fontWeight:"800"},
});
