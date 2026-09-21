// Pure data tests; no account, network, or database required.
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const cache = {};
function load(file) {
  file = path.resolve(file);
  if (cache[file]) return cache[file].exports;
  const module = { exports: {} }; cache[file] = module;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => load(path.resolve(path.dirname(file), name + '.ts')), module, module.exports);
  return module.exports;
}
const { behaviorAnswer, setBehaviorAnswer, validateRoutineValue, searchText } = load('src/lib/journal-behaviors.ts');
const { calculateWellnessScores, routineQuality, sleepHoursFromTimes } = load('src/lib/wellness.ts');
const alcohol = { id: 'a', slug: 'alcohol', name: 'Alcool', input_type: 'number', polarity: 'lower_better', target_max: 0, recovery_weight: 0, stress_weight: 0 };
const magnesium = { ...alcohol, id: 'm', slug: 'magnesium', name: 'Magnésium', input_type: 'boolean', polarity: 'neutral' };
assert.equal(behaviorAnswer(alcohol, {}), undefined);
assert.equal(behaviorAnswer(alcohol, { value: '0' }), false, 'old zero means no');
assert.equal(behaviorAnswer(alcohol, { value: '2' }), true, 'old positive quantity means yes');
const yes = setBehaviorAnswer(alcohol, {}, true);
assert.equal(yes.value, undefined, 'yes without quantity must not invent zero');
assert.equal(routineQuality(alcohol, yes), null, 'unknown quantity must not be scored');
assert.equal(calculateWellnessScores([alcohol], { a: yes }).completion, 100, 'a yes/no answer counts even without optional quantity');
const no = setBehaviorAnswer(alcohol, { bool: true, value: '2', details: { time: '22:00' } }, false);
assert.deepEqual(no, { bool: false, value: '0' }, 'no clears stale follow-ups');
assert.deepEqual(setBehaviorAnswer(alcohol, no, false), {}, 'tapping selected answer clears it');
assert.equal(calculateWellnessScores([alcohol], { a: no }).answered, 1);
assert.equal(calculateWellnessScores([alcohol], { a: {} }).answered, 0);
assert.equal(routineQuality(magnesium, { bool: true }), null, 'neutral observations never improve score');
validateRoutineValue(magnesium, { bool: true, details: { amount: '200,5', time: '23:59' } });
validateRoutineValue(alcohol, { bool: true });
assert.throws(() => validateRoutineValue(magnesium, { bool: true, details: { time: '24:00' } }));
assert.throws(() => validateRoutineValue(magnesium, { bool: true, details: { amount: '-1' } }));
assert.throws(() => validateRoutineValue(alcohol, { value: 'oops' }));
assert.throws(() => validateRoutineValue({ ...alcohol, input_type: 'scale_5' }, { value: '6' }));
assert.throws(() => validateRoutineValue({ ...alcohol, input_type: 'hours' }, { value: '25' }));
assert.equal(sleepHoursFromTimes('23:30', '07:00'), 7.5);
assert.equal(searchText('CAFÉINE'), searchText('cafeine'));
console.log('Journal behavior tests passed: legacy answers, no/unknown distinction, optional details, score neutrality, validation, search.');

// Exercise the real API serializer and decoder with a fake Supabase transport.
let writes = [], storedRows = [], queries = [];
const userId = 'journal-test-user';
const fakeSupabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }) },
  from(table) {
    const q = { table, filters: [], columns: '' }; queries.push(q);
    const chain = {
      select(columns) { q.columns = columns; return chain; },
      eq(column, value) { q.filters.push([column, value]); return chain; },
      gte() { return chain; }, lt() { return chain; }, lte() { return chain; }, not() { return chain; }, order() { return chain; }, maybeSingle() { return chain; }, in() { return chain; },
      delete() { writes.push({ table, deletion: true, query: q }); return chain; },
      upsert(rows) { writes.push({ table, rows }); if (table === 'routine_logs') storedRows = rows; return chain; },
      then(resolve) { return Promise.resolve({ error: null, data: table === 'routine_catalog' ? [alcohol, magnesium] : table === 'routine_logs' ? q.columns.includes('routine_catalog') ? [] : storedRows : table === 'daily_checkins' ? { notes: 'Test note' } : [] }).then(resolve); },
    };
    return chain;
  },
};
const apiFile = path.resolve('src/lib/wellness-api.ts');
const apiModule = { exports: {} };
const apiCode = ts.transpileModule(fs.readFileSync(apiFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('require', 'module', 'exports', apiCode)((name) => name === '@/src/lib/supabase' ? { supabase: fakeSupabase } : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(apiFile), name + '.ts')), apiModule, apiModule.exports);
(async () => {
  const values = { a: { bool: true }, m: { bool: true, details: { amount: '200', time: '21:45' } } };
  const input = { date: '2026-09-20', routines: [alcohol, magnesium], values, notes: 'Test note', scores: calculateWellnessScores([alcohol, magnesium], values) };
  await apiModule.exports.saveJournalDay(input);
  assert.equal(storedRows[0].value, null, 'unknown quantity roundtrips as null');
  assert.equal(storedRows[0].bool_value, true);
  assert.deepEqual(storedRows[1].details, values.m.details);
  assert(storedRows.every((r) => r.athlete_id === userId && r.log_date === input.date));
  const loaded = await apiModule.exports.loadJournalDay(input.date);
  assert.equal(loaded.values.a.bool, true);
  assert.equal(loaded.values.a.value, undefined);
  assert.deepEqual(loaded.values.m.details, values.m.details);
  assert(queries.filter((q) => q.table === 'routine_logs' && q.columns).every((q) => q.filters.some(([col, val]) => col === 'athlete_id' && val === userId)), 'read queries remain scoped to user');
  writes = [];
  await assert.rejects(apiModule.exports.saveJournalDay({ ...input, values: { a: {}, m: { bool: true, details: { time: '25:00' } } } }));
  assert.equal(writes.length, 0, 'invalid later fields must be rejected before deleting earlier unanswered rows');
  await apiModule.exports.saveJournalDay({ ...input, values: { a: no, m: {} } });
  assert.equal(storedRows[0].value, 0);
  assert.equal(storedRows[0].bool_value, false);
  assert.deepEqual(storedRows[0].details, {});
  const deletion = writes.find((w) => w.deletion);
  assert(deletion.query.filters.some(([col, val]) => col === 'athlete_id' && val === userId));
  assert(deletion.query.filters.some(([col, val]) => col === 'log_date' && val === input.date));
  console.log('Journal API tests passed: save/load roundtrip, account/date scoping, invalid-field protection.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
