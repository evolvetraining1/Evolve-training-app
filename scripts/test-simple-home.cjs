const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), React = require('react');
function load(file, deps) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(n => deps[n] ?? (n === 'react/jsx-runtime' ? require(n) : {}), m, m.exports);
  return m.exports;
}
const descend = n => !React.isValidElement(n) ? [] : [n, ...React.Children.toArray(n.props.children).flatMap(descend)];
const text = n => typeof n === 'string' || typeof n === 'number' ? String(n) : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '';
let expanded = false, starts = 0, picked = 0, settings = 0, routes = [], selections = [];
const Home = load('src/components/simple-home.tsx', {
  react: { useState: initial => [expanded, value => { expanded = typeof value === 'function' ? value(expanded) : value; }] },
  'expo-router': { router: { push: route => routes.push(route) } },
  'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', RefreshControl: 'Refresh', StyleSheet: { create: s => s } },
  './screen-scroll-view': { ScreenScrollView: 'Screen' }, './ui': { PrimaryButton: 'Button' }, '../theme': { colors: {} }
}).SimpleHome;
const props = { firstName: 'Alex', workout: { id: 'w1', name: 'Force', week_number: 2, day_number: 1, estimated_minutes: 45 }, program: { id: 'p1', name: 'Foundation' }, programs: [{ id: 'p1', name: 'Foundation' }, { id: 'p2', name: 'Initium' }], switchingProgram: false, ready: true, starting: false, inProgress: false, complete: false, checkedIn: false, unread: 3, error: null, refreshing: false, onRefresh() {}, onStart: () => starts++, onChooseWorkout: () => picked++, onSelectProgram: async id => selections.push(id), onMenu() {}, onSettings: () => settings++ };
const render = (extra = {}) => descend(Home({ ...props, ...extra }));
const press = (label, extra) => render(extra).find(n => n.type === 'Pressable' && text(n) === label).props.onPress();
assert.equal(render().filter(n => n.type === 'Screen').length, 1);
assert.equal(render().find(n => n.type === 'Button').props.label, 'Commencer la séance');
assert.equal(render({ inProgress: true }).find(n => n.type === 'Button').props.label, 'Reprendre la séance');
assert.equal(render({ ready: false }).find(n => n.type === 'Button').props.disabled, true);
assert.equal(render({ starting: true }).find(n => n.type === 'Button').props.disabled, true);
assert.equal(render({ workout: null }).find(n => n.type === 'Button').props.disabled, true);
assert.equal(render({ complete: true }).filter(n => n.type === 'Button').length, 0, 'completed program never exposes a new start');
assert.ok(!text(Home({ ...props, workout: null, program: null, programs: [] })).includes('45 min'), 'no invented duration');
press('Voir le détail'); assert.deepEqual(routes.pop(), { pathname: '/program-workout', params: { workoutId: 'w1' } }); assert.equal(starts, 0, 'preview does not start a session');
press('Choisir une séance'); assert.equal(picked, 1);
press('Personnaliser'); assert.equal(settings, 1);
press('Changer de programme+');
const choices = render().filter(n => n.props.accessibilityRole === 'radio');
assert.equal(choices.length, 2); choices[1].props.onPress(); assert.deepEqual(selections, ['p2']);
assert.ok(render({ switchingProgram: true }).filter(n => n.props.accessibilityRole === 'radio').every(n => n.props.disabled));
for (const route of ['/(tabs)/journal', '/nutrition', '/messaging']) {
  const row = render().find(n => n.type === 'Pressable' && text(n).startsWith(route.endsWith('journal') ? 'Bilan du jour' : route.endsWith('nutrition') ? 'Nutrition' : 'Messages'));
  row.props.onPress(); assert.equal(routes.pop(), route);
}
assert.ok(text(Home(props)).includes('3 messages non lus'));
console.log('Simple home: session access, safe preview, program selection, completed/empty states, follow-up links and settings passed.');

async function presentation() {
  const oldLayout = JSON.stringify([{ id: 'steps', visible: true }, { id: 'workout', visible: false }]);
  const stored = { 'evolve-dashboard-layout-v1': oldLayout };
  let state = [], refs = [], cursor = 0, refCursor = 0, effect, fail = false, hold = false, release, writes = [];
  const hooks = {
    useState: value => { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: value => { const i = refCursor++; return refs[i] ?? (refs[i] = { current: value }); },
    useEffect: f => { effect ??= f; }
  };
  const { useHomePresentation } = load('src/lib/home-presentation.ts', { react: hooks, '@react-native-async-storage/async-storage': {
    getItem: async key => stored[key] ?? null,
    setItem: async (key, value) => { writes.push(key); if (fail) throw new Error('disk'); if (hold) await new Promise(r => { release = r; }); stored[key] = value; }
  } });
  const render = () => { cursor = 0; refCursor = 0; return useHomePresentation(); };
  const tick = () => new Promise(r => setImmediate(r));
  assert.equal(render().ready, false); effect(); await tick(); assert.equal(render().simple, true);
  assert.equal(await render().change(false), true); assert.equal(render().simple, false); assert.equal(stored['evolve-dashboard-layout-v1'], oldLayout);
  state = []; refs = []; effect = undefined; render(); effect(); await tick(); assert.equal(render().simple, false, 'complete mode survives reopening');
  fail = true; assert.equal(await render().change(true), false); assert.equal(render().simple, false); assert.ok(render().error); fail = false;
  hold = true; const first = render().change(true); const count = writes.length; assert.equal(await render().change(true), false); assert.equal(writes.length, count, 'rapid taps cannot race storage writes'); release(); await first; hold = false;
  assert.equal(render().simple, true); assert.equal(stored['evolve-dashboard-layout-v1'], oldLayout);
  assert.ok(writes.every(k => k === 'evolve-home-presentation-v1'), 'mode switching never writes the previous dashboard layout');
  console.log('Home rollback: previous layout retained, simple/complete persistence, failed saves and double-tap protection passed.');
}
presentation().catch(e => { console.error(e); process.exitCode = 1; });
