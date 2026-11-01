const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
function load(file,deps={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(n=>deps[n]??(n==='react/jsx-runtime'?require(n):{}),m,m.exports);return m.exports;}
const sets=load('src/lib/workout-sets.ts'),groups=load('src/lib/exercise-groups.ts'),wod=load('src/lib/wod.ts');
const h=load('src/lib/athlete-workout.ts',{'./workout-sets':sets,'./exercise-groups':groups});
const display=load('src/lib/athlete-display.ts',{'./athlete-workout':h});
const item=(id,note,extra={})=>({id,exercise_id:`ex-${id}`,prescription_notes:note,exercises:{id:`ex-${id}`,name:id},...extra});
const squat=item('squat','STRENGTH WORK — 3x10 @16 kg — RPE 7 — repos 90 sec');
const ps=h.prescribedRows(squat);assert.equal(ps.length,3);assert.equal(ps[0].reps,'10');assert.equal(ps[0].load,'16');assert.equal(ps[0].rpe,'');assert.ok(!ps[0].simpleCompletion);
assert.equal(h.withoutRpe('3x10 — RPE 7–8 — repos 90 s'),'3x10 — repos 90 s');
assert.equal(h.withoutRpe('RPE 8'),'');
const steps=h.athleteSteps(wod.buildWorkoutSections([item('warm','WARM UP — 3 rounds — 10 reps'),squat,item('pull','RENFO — SUPERSET A1 — 4x8 — RPE 7'),item('dip','RENFO — SUPERSET A2 — 4x12 — repos 90 sec après le superset'),item('snatch','WORKOUT — AMRAP 40 min — 5 reps'),item('push','WORKOUT — AMRAP 40 min — 10 reps')]),()=>true);
assert.equal(steps.length,4);assert.equal(steps[0].warmup,true);assert.equal(steps[2].group.items.length,2);assert.equal(steps[3].wod,true);assert.equal(steps[3].group.items.length,2);
const planned=h.asPlanned(steps[1],{squat:ps});assert.deepEqual(planned.map(h.parseAthleteSet),Array.from({length:3},()=>({reps:10,load_kg:16,rpe:null})));assert.ok(ps.every(r=>!r.done));
const changed=h.editCommon(ps,'2','8','14,5');assert.equal(h.stepStatus(changed),'partial');assert.deepEqual(changed.map(h.parseAthleteSet),[{reps:8,load_kg:14.5,rpe:null},{reps:8,load_kg:14.5,rpe:null},{reps:0,load_kg:0,rpe:null}]);
assert.equal(changed[1].setNumber,2);assert.equal(h.stepStatus(h.skipRows(planned)),'skipped');assert.ok(h.skipRows(planned).every(r=>h.parseAthleteSet(r).reps===0));
assert.equal(h.editCommon(ps,'4','8','14')[3].prescribedId,null);assert.equal(h.editCommon(ps,'4','8','14')[3].setNumber,4);assert.throws(()=>h.editCommon(ps,'101','8','14'));assert.throws(()=>h.editCommon(ps,'1.5','8','14'));
for(const patch of [{reps:''},{reps:'8-12'},{reps:'-1'},{reps:'2.5'},{load:''},{load:'80%'},{load:'-1'},{load:'Infinity'},{load:'1e3'},{inputError:'invalid'}])assert.throws(()=>h.parseAthleteSet({...planned[0],...patch}));
assert.equal(h.parseAthleteSet({...planned[0],load:'0'}).load_kg,0);
assert.equal(h.parseAthleteSet({...planned[0],done:false,reps:'oops',load:'80%',inputError:'bad draft'}).reps,0,'unfinished inputs cannot block completion or create a performance');
assert.equal(h.parseAthleteSet({...planned[0],rpe:'8'}).rpe,8,'historical measured RPE stays intact');
assert.equal(h.prescribedRows(item('carry','RENFO — 4x1 aller-retour — lourd'))[0].reps,'1');
assert.ok(h.prescribedRows(item('plank','RENFO — 3x30 sec plank hold')).every(r=>r.simpleCompletion));
assert.equal(h.restoreAthleteRow(planned[0],{...planned[0],done:false}).done,true,'server-confirmed completion survives a stale draft');
assert.equal(h.restoreAthleteRow(planned[0],{...planned[0],load:'20',done:true}).done,false,'changed draft never fabricates completion');
assert.equal(h.restoreAthleteRow(planned[0],{...planned[0],dirty:true,skipped:true}).skipped,true,'a skipped set draft survives reopening');
const native={View:'View',Text:'Text',Pressable:'Pressable',TextInput:'Input',StyleSheet:{create:s=>s},ActivityIndicator:'Spinner',ScrollView:'Scroll'};
const card=load('src/components/athlete-exercise-card.tsx',{'react':{useState:v=>[v,()=>{}]},'react-native':native,'./ui':{Card:'Card',PrimaryButton:'Button'},'./exercise-name-link':{ExerciseNameLink:'ExerciseLink'},'./exercise-group-header':{ExerciseGroupHeader:'GroupHeader'},'../lib/athlete-workout':h,'../lib/athlete-display':display,'../lib/exercise-groups':groups,'../theme':{colors:{}}}).AthleteExerciseCard;
const descend=n=>!React.isValidElement(n)?[]:[n,...React.Children.toArray(n.props.children).flatMap(descend)];
const props={step:steps[1],rows:{squat:ps},previous:{},editing:false,disabled:false,readOnly:false,onEdit:()=>{},onPatch:()=>{},onPlanned:()=>{},onSave:()=>{},onSkip:()=>{}};
const nodes=descend(card(props));assert.equal(nodes.filter(n=>n.type==='Input').length,0,'no input field on default card');assert.equal(nodes.filter(n=>n.type==='ExerciseLink')[0].props.exerciseId,'ex-squat');
assert.equal(nodes.find(n=>n.type==='Button').props.onPress,props.onPlanned);
assert.ok(!nodes.filter(n=>n.type==='Text').flatMap(n=>React.Children.toArray(n.props.children)).filter(v=>typeof v==='string').join(' ').includes('RPE 7'),'RPE removed from athlete prescription');
assert.equal(descend(card({...props,readOnly:true})).filter(n=>n.type==='Button'||n.type==='Pressable').length,0,'history has no mutation controls');
let statements=[],current='athlete';const supabase={auth:{getSession:async()=>({data:{session:{user:{id:current}}}})},from:table=>({upsert:async(rows,options)=>{statements.push({table,rows,options});return {error:null};}})};
const api=load('src/lib/api.ts',{'@/src/lib/supabase':{supabase}});
(async()=>{await api.savePerformedSets('session',planned.map(r=>({workout_exercise_id:r.workoutExerciseId,prescribed_set_id:r.prescribedId,set_number:r.setNumber,...h.parseAthleteSet(r),completed:r.done})));
 assert.equal(statements.length,1,'one atomic card upsert');assert.equal(statements[0].rows.length,3);assert.ok(statements[0].rows.every(r=>r.workout_session_id==='session'));assert.equal(statements[0].options.onConflict,'workout_session_id,workout_exercise_id,set_number');
 await assert.rejects(()=>api.savePerformedSets('session',[]));
 console.log('Athlete card regressions passed: one-card flow, supersets/WODs, exact/changed/skipped results, unknown loads, zero bodyweight, time prescriptions, RPE, draft restoration, history and atomic saves.');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Exercise screen state and async callbacks with the real component, isolated from live athlete data.
async function screenFlow(){
 let state=[],refs=[],cursor=0,refCursor=0,effects=[],upserts=[],fail=false,resolveSave,hold=false;
 let persisted={},finished=[],nav=[],wodSaves=[],alerts=[];
 const fixture={session:{id:'session',status:'in_progress',started_at:'2026-10-04T07:00:00Z',workout_templates:{name:'Test',estimated_minutes:60}},workoutExercises:[squat,item('row','RENFO — 2x12 @12 kg — RPE 8'),item('snatch','WORKOUT — AMRAP 10 min — 5 reps'),item('push','WORKOUT — AMRAP 10 min — 10 reps'),item('bike','WORKOUT — FOR TIME — 30 calories')],performedSets:[]};
 const hooks={useState:v=>{const k=cursor++;if(!(k in state))state[k]=v;return [state[k],n=>{state[k]=typeof n==='function'?n(state[k]):n}];},useRef:v=>{const k=refCursor++;if(!(k in refs))refs[k]={current:v};return refs[k];},useMemo:f=>f(),useEffect:f=>{if(!effects.length)effects.push(f);}};
 const apiMock={getSessionDetail:async()=>fixture,startWorkoutSession:async()=>fixture.session,getAthletePreviousSets:async()=>({}),savePerformedSets:async(id,rs)=>{upserts.push(rs);if(fail)throw new Error('offline');if(hold)await new Promise(r=>{resolveSave=r;});},saveWorkoutWodResults:async(id,rs)=>{wodSaves.push(rs);},completeWorkoutSession:async(...v)=>finished.push(v)};
 const Screen=load('app/workout.tsx',{'react':hooks,'react-native':{...native,Alert:{alert:(...v)=>alerts.push(v)}},'expo-router':{router:{replace:p=>nav.push(p)},useLocalSearchParams:()=>({sessionId:'session'})},'@react-native-async-storage/async-storage':{getItem:async k=>persisted[k]??null,setItem:async(k,v)=>{persisted[k]=v;},removeItem:async k=>{delete persisted[k];}},'@/src/components/screen-scroll-view':{ScreenScrollView:'Scroll'},'@/src/components/ui':{BackScreenHeader:'Header',Card:'Card',PrimaryButton:'Button'},'@/src/components/athlete-exercise-card':{AthleteExerciseCard:'AthleteCard'},'@/src/components/WodCard':{WodCard:'WodCard'},'@/src/theme':{colors:{}},'@/src/lib/session-flow':{isFinishedSession:s=>['completed','skipped'].includes(s?.status)},'@/src/lib/wod':wod,'@/src/lib/athlete-workout':h,'@/src/lib/api':apiMock}).default;
 const render=()=>{cursor=0;refCursor=0;return descend(Screen());};
 const tick=()=>new Promise(r=>setImmediate(r));
 const athlete=id=>render().find(n=>n.type==='AthleteCard'&&n.props.step.group.items[0].id===id);
 const wodCard=format=>render().find(n=>n.type==='WodCard'&&n.props.section.format===format);
 render();let cleanup=effects[0]();await tick();await tick();let nodes=render();
 assert.equal(nodes.filter(n=>n.type==='AthleteCard').length,2,'all strength blocks are visible together');
 assert.equal(nodes.filter(n=>n.type==='WodCard').length,2,'one card per WOD, never per movement');
 assert.ok(nodes.filter(n=>n.type==='AthleteCard'||n.type==='WodCard').every(n=>n.props.editing===false),'all editors start collapsed');
 athlete('row').props.onEdit(true);wodCard('amrap').props.onEdit(true);
 assert.equal(athlete('row').props.editing,true);assert.equal(athlete('squat').props.editing,false);assert.equal(wodCard('amrap').props.editing,true);
 fail=true;athlete('squat').props.onPlanned();await tick();assert.ok(athlete('squat').props.rows.squat.every(r=>!r.done));
 assert.equal(render().filter(n=>n.type==='AthleteCard').length,2,'failed save preserves the entire list');
 fail=false;hold=true;athlete('squat').props.onPlanned();athlete('row').props.onPlanned();await tick();assert.equal(upserts.length,2,'cross-block rapid taps are serialized');resolveSave();hold=false;await tick();
 assert.ok(athlete('squat').props.rows.squat.every(r=>r.done));assert.equal(athlete('row').props.editing,true,'saving one block does not close another editor');
 let card=athlete('row');card.props.onPatch('row',h.editCommon(card.props.rows.row,'1','9','10'));await tick();
 render().find(n=>n.type==='Scroll').props.onScroll({nativeEvent:{contentOffset:{y:640}}});athlete('row').props.onOpen();await tick();
 const draft=JSON.parse(Object.values(persisted)[0]);assert.equal(draft.scrollY,640);assert.equal(draft.sets.row[0].load,'10');
 // Recreate the screen from its stored draft, as after process recreation.
 cleanup();state=[];refs=[];effects=[];render();cleanup=effects[0]();await tick();await tick();
 assert.equal(athlete('row').props.rows.row[0].load,'10');assert.equal(athlete('row').props.editing,true);
 const positions=[];const scrollRef=refs.find(r=>r.current===null);scrollRef.current={scrollTo:v=>positions.push(v)};
 render().find(n=>n.type==='Scroll').props.onContentSizeChange();assert.deepEqual(positions,[{y:640,animated:false}]);
 // The server fixture is deliberately stale; revalidate squat after remount.
 athlete('squat').props.onPlanned();await tick();
 athlete('row').props.onEdit(false);athlete('row').props.onPlanned();await tick();
 assert.deepEqual(upserts.at(-1).map(r=>[r.set_number,r.reps,r.load_kg,r.completed]),[[1,9,10,true],[2,0,0,false]],'Terminé saves edits after Réduire');
 const count=positions.length;wodCard('amrap').props.onChange({rounds:'3',reps:'7'});wodCard('amrap').props.onValidate();await tick();
 assert.equal(wodSaves.length,1);assert.equal(wodSaves[0]['block-snatch'].rounds,3);assert.equal(wodCard('for_time').props.value.completed,undefined);
 // Finishing with an unconfirmed WOD must still ask, rather than silently marking it done.
 render().find(n=>n.type==='Button'&&n.props.label==='Terminer la séance').props.onPress();assert.equal(alerts.length,1);assert.equal(finished.length,0);
 wodCard('for_time').props.onChange({minutes:'6',seconds:'15'});wodCard('for_time').props.onValidate();await tick();
 assert.equal(wodSaves.length,2);assert.equal(wodSaves[1]['block-snatch'].reps,7);assert.equal(wodSaves[1]['block-bike'].elapsed_seconds,375);
 assert.equal(positions.length,count,'saving never jumps the scroll position');
 assert.equal(render().filter(n=>n.type==='AthleteCard').length,2,'all cards remain present after validation');
 render().find(n=>n.type==='Button'&&n.props.label==='Terminer la séance').props.onPress();await tick();await tick();
 assert.equal(finished.length,1);assert.equal(finished[0][1].filter(r=>r.completed).length,4);assert.deepEqual(nav,['/(tabs)']);assert.equal(Object.keys(persisted).length,0);
 cleanup();console.log('Full-session screen passed: all blocks, independent editors, failed saves, cross-block lock, restored draft/scroll, multiple WOD scores, pending warning and finish.');
}
screenFlow().catch(e=>{console.error(e);process.exitCode=1;});

// Compact presentation must preserve prescription meaning and never rewrite stored data.
const displayStep = (items) => h.athleteSteps(wod.buildWorkoutSections(items),()=>true)[0];
const pairItems = [item('extension','RENFO — 4x12 — SUPERSET A1 — enchaîné avec single leg ischio flexion — sans repos entre les exercices'), item('curl','RENFO — 4x12 — SUPERSET A2 — repos 2 min après le superset')];
const originalPair = structuredClone(pairItems);
const compact = display.compactAthleteDisplay(displayStep(pairItems));
assert.equal(compact.title,'Superset A · 4 tours');
assert.deepEqual(compact.prescriptions,{extension:'12 reps',curl:'12 reps'});
assert.equal(compact.footer,'Sans pause entre les exercices · repos 2 min après le tour');
assert.deepEqual(pairItems,originalPair);
const warm = display.compactAthleteDisplay(displayStep([item('star','WARM UP — 3 rounds — 20 sec'),item('bridge','WARM UP — 3 rounds — 10 reps + 5 sec iso + 5 reps'),item('hinge','WARM UP — 3 rounds — 5 reps — tempo 3111')]));
assert.equal(warm.title,'Échauffement · 3 tours');
assert.equal(warm.prescriptions.star,'20 sec');
assert.equal(warm.prescriptions.bridge,'10 reps + 5 sec iso + 5 reps');
assert.match(warm.prescriptions.hinge,/tempo 3111/);
const unequal = display.compactAthleteDisplay(displayStep([item('a','RENFO — 4x8 — SUPERSET A1 — tempo 3111'),item('b','RENFO — 3x12 — SUPERSET A2 — repos selon récupération')]));
assert.equal(unequal.title,'Superset A');
assert.match(unequal.prescriptions.a,/4x8.*tempo 3111/);
assert.match(unequal.prescriptions.b,/3x12.*repos selon récupération/);
const timed=display.compactAthleteDisplay(displayStep([item('a','RENFO — 4x30 sec — SUPERSET A1'),item('b','RENFO — 4x1 aller-retour — SUPERSET A2')]));
assert.equal(timed.prescriptions.a,'30 sec');assert.equal(timed.prescriptions.b,'1 aller-retour');
const special=display.compactAthleteDisplay(displayStep([item('a','RENFO — 4x8–12 — SUPERSET A1 — enchaîné avec curl tempo lent'),item('b','RENFO — 4x12 + 5 sec iso + 12 reps — SUPERSET A2')]));
assert.match(special.prescriptions.a,/4x8.*12/);assert.match(special.prescriptions.a,/tempo lent/);
assert.match(special.prescriptions.b,/12 reps \+ 5 sec iso \+ 12 reps/);
console.log('Compact cards: shared rounds/rest, warmup timing, tempo, unequal sets, rep ranges and unchanged source data passed.');

// Exercise links push the library sheet and snapshot the current draft before leaving.
let opened=0,dismissed=0;
const ExerciseLink=load('src/components/exercise-name-link.tsx',{'expo-router':{Link:'Link'},'react-native':{Text:'Text',Keyboard:{dismiss:()=>dismissed++}}}).ExerciseNameLink;
const link=ExerciseLink({exerciseId:'ex-squat',name:'Squat',children:'Squat',onOpen:()=>opened++});
assert.equal(link.type,'Link');assert.equal(link.props.push,true);assert.equal(link.props.href.pathname,'/exercise/[id]');
link.props.onPress();assert.equal(opened,1);assert.equal(dismissed,1);
assert.equal(ExerciseLink({name:'Unknown',children:'Unknown'}).type,'Text');
const wodUI=load('src/components/WodCard.tsx',{'react-native':native,'./ui':{Card:'Card'},'./exercise-name-link':{ExerciseNameLink:'ExerciseLink'},'../lib/athlete-workout':h,'../lib/wod':wod,'../theme':{colors:{}}});
const wp={section:steps[3].section,value:{},disabled:false,editing:false,readOnly:false,onChange:()=>{},onValidate:()=>{},onEdit:()=>{},onSkip:()=>{}};
assert.equal(descend(wodUI.WodCard(wp)).filter(n=>n.type==='Input').length,0,'WOD score inputs start collapsed');
assert.ok(descend(wodUI.WodCard({...wp,editing:true})).some(n=>n.type==='Input'&&n.props.accessibilityLabel==='Tours complets'));
assert.equal(descend(wodUI.WodCard({...wp,editing:true,readOnly:true})).filter(n=>n.type==='Input'||n.type==='Pressable').length,0,'historical WOD has no inputs or mutation actions');
assert.match(wodUI.wodScoreSummary('amrap',{rounds:'3',reps:'7'}),/3 tours \+ 7 reps/);
assert.match(wodUI.wodScoreSummary('for_time',{minutes:'6',seconds:'15'}),/6 min 15 s/);
console.log('Library push navigation, collapsed WOD forms and read-only scores passed.');

assert.doesNotMatch(wodUI.wodScoreSummary('for_time',{capped:true,notes:'Arrêt à mi-parcours'}),/0 tours|0 min|0 reps/,'unknown scores must not become zero');
assert.match(wodUI.wodScoreSummary('amrap',{rounds:'0',reps:'7'}),/0 tours \+ 7 reps/,'explicit zero remains visible');
