const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const React = require('react');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name === 'react/jsx-runtime') return require(name);
    throw new Error(`Unmocked dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const groups = load('src/lib/exercise-groups.ts');
const { buildExerciseGroups, groupSetNumbers, groupRest, exercisePrescription } = groups;
const { buildFallbackSets } = load('src/lib/workout-sets.ts');
const wod = load('src/lib/wod.ts');
const snapshot = require('./fixtures/superset-programs.json');
snapshot.corrections.push(...require('./fixtures/powerbuilding-pullup-dips.json'));
for (const w of snapshot.workouts) w.items ??= [];
const before = structuredClone(snapshot.workouts);
const workouts = structuredClone(snapshot.workouts);
for (const w of workouts) for (const item of w.items) {
  const fix = snapshot.corrections.find((f) => f.id === item.id);
  if (fix) { assert.equal(item.prescription_notes, fix.old); item.prescription_notes = fix.note; }
  if (item.id === 'e6d67bde-a998-432a-8536-25aa3488a45c') {
    for (let n = 2; n <= 4; n++) item.prescribed_sets.push({ ...item.prescribed_sets[0], id: `added-curl-${n}`, set_number: n });
  }
}
const pick = (program, week, day) => workouts.find((w) => w.program === program && w.week === week && w.day === day);
const paired = (w) => wod.buildWorkoutSections(w.items, w).filter((s) => !s.format).flatMap((s) => buildExerciseGroups(s.items)).filter((g) => g.paired);
for (const w of workouts) {
  const original = before.find((o) => o.template_id === w.template_id);
  const sections = wod.buildWorkoutSections(w.items, w);
  assert.deepEqual(sections.flatMap((s) => buildExerciseGroups(s.items).flatMap((g) => g.items.map((i) => i.id))), original.items.map((i) => i.id), 'grouping neither loses nor reorders exercises');
  assert.deepEqual(sections.filter((s) => s.format), wod.buildWorkoutSections(original.items, original).filter((s) => s.format), 'existing WOD identities and prescriptions are untouched');
  for (const group of paired(w)) {
    const counts = group.items.map((i) => i.prescribed_sets?.length || buildFallbackSets(i).length);
    assert.ok(counts.every((c) => c === counts[0]), `${w.program} S${w.week}J${w.day}: unequal pair rounds ${counts}`);
  }
  for (const item of original.items) {
    const updated = w.items.find((i) => i.id === item.id);
    for (const set of item.prescribed_sets ?? []) assert.ok(updated.prescribed_sets.some((s) => s.id === set.id && s.set_number === set.set_number), 'existing prescribed set identity survives');
  }
}
for (const week of [2, 4]) {
  const pairs = paired(pick('tactical', week, 1));
  assert.deepEqual(pairs.map((g) => g.items.map((i) => i.position)), [[5,6],[7,8],[9,10],[11,12]]);
  assert.deepEqual(pairs.map((g) => groupSetNumbers(g).length), [4,4,3,4]);
  assert.match(groupRest(pairs[0]), /1 min 30 s/);
  assert.match(groupRest(pairs[1]), /2 min/);
  assert.match(groupRest(pairs[3]), /non précisé/);
  assert.match(exercisePrescription(pairs[3].items[1]), /4x1 aller-retour/);
}
for (const week of [8,10]) assert.equal(paired(pick('tactical', week, 3)).find((g) => g.items.length === 3).items[2].position, 9);
for (const week of [1,2,3]) {
  const pairs = paired(pick('powerbuilding', week, 1));
  assert.equal(pairs.length, 1); assert.deepEqual(pairs[0].items.map((i) => i.position), [6,7]);
  assert.deepEqual(pairs[0].items.map((i) => buildFallbackSets(i).length), [4,4]);
  assert.match(groupRest(pairs[0]), /2 min/);
  const benchPair = paired(pick('powerbuilding', week, 2));
  assert.equal(benchPair.length, 1, 'Pull-up + Dips confirmed by the user');
  assert.deepEqual(benchPair[0].items.map((i) => i.exercises.name), ['Pull-up','Dips']);
  assert.deepEqual(benchPair[0].items.map((i) => buildFallbackSets(i).length), [4,4]);
  assert.match(groupRest(benchPair[0]), /non précisé/);
}
const item = (id, note) => ({ id, prescription_notes: note });
assert.equal(buildExerciseGroups([item('a','RENFO — 4x12'),item('b','RENFO — 4x12')]).length, 2);
assert.equal(buildExerciseGroups([item('a','WARM UP — 4x12'),item('b','RENFO — 4x12 — repos 2 min après le superset')]).length, 2);
assert.equal(buildExerciseGroups([item('a','RENFO — SUPERSET A1'),item('b','RENFO — SUPERSET B2')]).length, 2);
assert.equal(buildExerciseGroups([item('a','RENFO — TRISET A1'),item('b','RENFO — TRISET A2')]).length, 2, 'incomplete triset is not a pair');
assert.equal(buildExerciseGroups([item('a','RENFO — BISET A1'),item('b','RENFO — BISET A2')])[0].paired, true);
assert.equal(buildFallbackSets(item('a','RENFO — 3x max time')).length, 3);
assert.equal(buildFallbackSets(item('a','RENFO — 3x8–12'))[0].reps, '');
assert.equal(buildFallbackSets(item('a','RENFO — 4x12 + 5 sec iso + 12 reps'))[0].reps, '');
assert.equal(buildFallbackSets({ ...item('a','RENFO — 12 reps'), exercises:{instructions:'faire 5x20'} }).length, 1, 'library instructions cannot override prescription');

// Exercise the actual card callbacks: round-major display must save original exercise/set IDs.
const native = { View:'View', Text:'Text', StyleSheet:{create:(s)=>s}, useWindowDimensions:()=>({width:390,fontScale:1}) };
const SupersetCard = load('src/components/superset-card.tsx', {
  'react-native': native, './ui':{Card:'Card'}, './exercise-group-header':{ExerciseGroupHeader:'GroupHeader'},
  './exercise-name-link':{ExerciseNameLink:'ExerciseLink'}, './workout-set-row':{WorkoutSetRow:'SetRow'},
  '../lib/exercise-groups':groups, '../lib/screen-layout':{compactFields:()=>true}, '../theme':{colors:{}},
}).SupersetCard;
const descendants = (node) => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(descendants)];
const group = paired(pick('tactical',2,1))[0];
const rows = Object.fromEntries(group.items.map((i) => [i.id, i.prescribed_sets.map((s) => ({
  prescribedId:s.id, workoutExerciseId:i.id, setNumber:s.set_number, reps:String(s.target_reps), load:'24', rpe:'7', done:true,
}))]));
const changes=[], toggles=[];
const props={group, rows, disabled:false, onChange:(...v)=>changes.push(v), onToggle:(...v)=>toggles.push(v)};
const nodes=descendants(SupersetCard(props));
const fields=nodes.filter((n)=>n.type==='SetRow');
assert.deepEqual(fields.map((n)=>[n.props.values.workoutExerciseId,n.props.number]), [1,2,3,4].flatMap((n)=>group.items.map((i)=>[i.id,n])));
fields[3].props.onChange({load:'28'}); fields[3].props.onToggle();
assert.deepEqual(changes[0],[group.items[1].id,2,{load:'28'}]);
assert.equal(toggles[0][1], rows[group.items[1].id][1]);
assert.equal(toggles[0][1].prescribedId, group.items[1].prescribed_sets[1].id);
assert.ok(descendants(SupersetCard({...props,disabled:true})).filter((n)=>n.type==='SetRow').every((n)=>n.props.disabled), 'completed session remains read-only');
const sparse = {...rows, [group.items[1].id]:rows[group.items[1].id].filter((s)=>s.setNumber===3)};
assert.deepEqual(descendants(SupersetCard({...props,rows:sparse})).filter((n)=>n.type==='SetRow').map((n)=>[n.props.values.workoutExerciseId,n.props.number]), [[group.items[0].id,1],[group.items[0].id,2],[group.items[0].id,3],[group.items[1].id,3],[group.items[0].id,4]], 'sparse historical rows are never reindexed');
assert.deepEqual(rows[group.items[1].id][1].load,'24', 'rendering/callback wiring does not mutate draft or saved values');
console.log(`Superset regressions passed: ${workouts.length} real workouts, ${workouts.reduce((n,w)=>n+paired(w).length,0)} groups, source counts/rest, no WOD changes, round order and save identity.`);

// The coach must see WORKOUT and the full prescription, not a reps-only AUTRE summary.
let stateIndex=0;
const coachDetail={exercises:pick('tactical',2,1).items,performedSets:[],workout:{name:'FULL BODY'},session:{status:'in_progress'}};
const coach=load('app/coach-athlete-session.tsx', {
  'react':{useEffect:()=>{},useState:()=>[[coachDetail,false,''][stateIndex++],()=>{}]},
  'react-native':native, 'expo-router':{useLocalSearchParams:()=>({athleteId:'athlete',workoutTemplateId:'template'})},
  '@/src/components/screen-scroll-view':{ScreenScrollView:'Scroll'},
  '@/src/components/ui':{Card:'Card',ScreenHeader:'Header',goBackOrReplace:()=>{}},
  '@/src/components/exercise-group-header':{ExerciseGroupHeader:'GroupHeader'},
  '@/src/lib/exercise-groups':groups, '@/src/lib/wod':wod, '@/src/theme':{colors:{}},
  '@/src/lib/coachApi':{getCoachAthleteSessionDetail:()=>{}},
}).default;
const coachNodes=descendants(coach());
const visibleText=coachNodes.filter((n)=>n.type==='Text').flatMap((n)=>React.Children.toArray(n.props.children)).filter((v)=>typeof v==='string').join(' ');
assert.match(visibleText,/WORKOUT/); assert.doesNotMatch(visibleText,/AUTRE/);
assert.match(visibleText,/4x12 — RPE 8 — repos 2 min après le superset|4x12 — pause en haut — RPE 8 — repos 2 min après le superset/);
assert.doesNotMatch(visibleText,/athleteId|workoutTemplateId/);
assert.equal(coachNodes.filter((n)=>n.type==='GroupHeader' && n.props.group.paired).length,4);
console.log('Coach regression passed: four paired blocks, full set/RPE/rest prescription, correct WORKOUT heading.');
