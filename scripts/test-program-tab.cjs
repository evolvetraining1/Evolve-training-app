const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
function load(file, deps = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(name => deps[name] ?? (name === 'react/jsx-runtime' ? require(name) : {}), module, module.exports);
  return module.exports;
}
const flow = load('src/lib/session-flow.ts');
const programs = [{ id: 'a', name: 'Force' }, { id: 'b', name: 'Conditionnement' }];
const templates = [
  { id: 'done', program_id: 'a', name: 'Séance terminée', week_number: 1, day_number: 1 },
  { id: 'next', program_id: 'a', name: 'Séance suivante', week_number: 1, day_number: 2 },
  { id: 'future', program_id: 'a', name: 'Séance future', week_number: 2, day_number: 1 },
  { id: 'other', program_id: 'b', name: 'Autre programme', week_number: 1, day_number: 1 },
];
const sessions = [{ id: 'history', workout_template_id: 'done', status: 'completed', workout_templates: templates[0] }];
let state = [], refs = [], cursor = 0, refCursor = 0, effect, selected = 'a', assigned = programs;
let failLoad = false, failOpen = false, releaseOpen, holdOpen = false, releaseLoad, holdLoad = false;
const routes = [], openings = [], selections = [];
const Screen = load('app/(tabs)/training.tsx', {
  react: {
    useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
    useRef: value => refs[refCursor++] ?? (refs[refCursor - 1] = { current: value }),
    useMemo: fn => fn(), useCallback: fn => fn,
  },
  'expo-router': { router: { push: route => routes.push(route) }, useFocusEffect: fn => { effect = fn; } },
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', RefreshControl: 'Refresh', ActivityIndicator: 'Spinner', StyleSheet: { create: x => x } },
  '@/src/components/screen-scroll-view': { ScreenScrollView: 'Scroll' },
  '@/src/components/ui': { BackScreenHeader: 'Header', Card: 'Card', PrimaryButton: 'Button' },
  '@/src/theme': { colors: {} }, '@/src/lib/session-flow': flow,
  '@/src/lib/api': {
    getMyProgramsWithSelection: async () => { if (failLoad) throw new Error('Réseau indisponible'); return { programs: assigned, selectedProgramId: selected }; },
    getMyUpcomingSessions: async () => sessions,
    getProgramDetail: async id => { const result = { workouts: templates.filter(t => t.program_id === id) }; if (holdLoad) await new Promise(resolve => { releaseLoad = resolve; }); return result; },
    setSelectedProgramId: async id => { selections.push(id); selected = id; },
    getOrCreateWorkoutSession: async id => { openings.push(id); if (holdOpen) await new Promise(resolve => { releaseOpen = resolve; }); if (failOpen) throw new Error('Échec ouverture'); return { id: `session-${id}` }; },
  },
}).default;
const descend = n => !React.isValidElement(n) ? [] : [n, ...React.Children.toArray(n.props.children).flatMap(descend)];
const text = n => typeof n === 'string' || typeof n === 'number' ? String(n) : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '';
const render = () => { cursor = refCursor = 0; return descend(Screen()); };
const button = label => { const node = render().find(n => n.type === 'Pressable' && text(n) === label); assert.ok(node, label); return node; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const refresh = () => render()[0].props.refreshControl.props.onRefresh();
(async () => {
  render(); let blur = effect(); await tick();
  assert.ok(render().some(n => text(n) === 'Force'));
  assert.ok(!render().some(n => text(n).includes('Séance future')), 'other weeks start collapsed');
  render().find(n => n.props.accessibilityLabel === 'Voir le détail : Séance suivante').props.onPress();
  assert.deepEqual(routes.pop(), { pathname: '/program-workout', params: { workoutId: 'next' } });
  assert.equal(openings.length, 0, 'preview never creates a session');
  button('Voir le résultat').props.onPress();
  assert.deepEqual(routes.pop(), { pathname: '/workout', params: { sessionId: 'history' } });
  assert.equal(openings.length, 0, 'history never creates a session');
  holdOpen = true;
  const start = button('Commencer'); start.props.onPress(); start.props.onPress();
  assert.deepEqual(openings, ['next'], 'double tap opens only once');
  releaseOpen(); holdOpen = false; await tick();
  assert.deepEqual(routes.pop(), { pathname: '/workout', params: { sessionId: 'session-next' } });
  button('Semaine 20/1  +').props.onPress();
  assert.ok(render().some(n => text(n).includes('Séance future')));
  failOpen = true; button('Commencer').props.onPress(); await tick();
  assert.ok(render().some(n => n.props.accessibilityRole === 'alert' && text(n) === 'Échec ouverture'));
  assert.equal(routes.length, 0);
  failOpen = false; refresh(); await tick();
  holdOpen = true; button('Commencer').props.onPress(); blur(); releaseOpen(); holdOpen = false; await tick();
  assert.equal(routes.length, 0, 'late open cannot navigate after leaving');
  render(); blur = effect(); await tick();
  button('Changer de programme').props.onPress(); button('Conditionnement›').props.onPress(); await tick();
  assert.deepEqual(selections, ['b']);
  assert.ok(render().some(n => text(n).includes('Autre programme')));
  assert.ok(!render().some(n => text(n).includes('Séance suivante')), 'program switch clears previous sessions');
  holdLoad = true; selected = 'a'; refresh(); await tick(); blur();
  selected = 'b'; holdLoad = false; render(); blur = effect(); await tick(); releaseLoad(); await tick();
  assert.ok(render().some(n => text(n).includes('Autre programme')), 'stale response cannot replace current selection');
  failLoad = true; refresh(); await tick();
  assert.ok(render().some(n => text(n).includes('Autre programme')), 'refresh failure retains the existing view');
  assert.equal(button('Commencer').props.disabled, true, 'failed refresh prevents stale session actions');
  failLoad = false; assigned = []; refresh(); await tick();
  assert.ok(render().some(n => text(n) === 'Aucun programme attribué'));
  button('Découvrir les programmes ›').props.onPress(); assert.equal(routes.pop(), '/program');
  blur();
  console.log('Programme tab passed: weeks, preview, history, double taps, errors, focus races, selection and empty catalogue access.');
})().catch(error => { console.error(error); process.exitCode = 1; });
