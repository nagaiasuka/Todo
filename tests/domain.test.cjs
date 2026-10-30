const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categoryOf, pendingTasks, reorder, nextTask, todayCount, parseDocument, initialDocument } = require('../.test-build/domain/tasks');
const { homeProps, lockProps, lockTimeline } = require('../.test-build/widgets/model');
const { Repository, STORAGE_KEY } = require('../.test-build/data/repository');
const task = (id, fields = {}) => ({ id, title: id, urgent: true, important: true, dueAt: null, note: '', order: 0, completedAt: null, createdAt: '2026-10-28T00:00:00.000Z', ...fields });
const doc = tasks => ({ ...initialDocument, settings: { ...initialDocument.settings }, tasks });

test('appearance defaults to off-white for legacy data, persists choices and rejects invalid values', async () => {
  const legacy = { ...doc([]), settings: { showTodayCount: true, showNextTask: false } };
  assert.equal(parseDocument(JSON.stringify(legacy)).settings.theme, 'light');
  let saved = JSON.stringify(legacy);
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const repository = new Repository(storage); await repository.load();
  for (const theme of ['dark', 'system', 'light']) {
    await repository.update(d => ({ ...d, settings: { ...d.settings, theme } }));
    const loaded = await new Repository(storage).load();
    assert.equal(loaded.settings.theme, theme);
    assert.equal(loaded.settings.showNextTask, false);
    assert.equal(homeProps(loaded, new Date()).theme, theme);
  }
  assert.throws(() => parseDocument(JSON.stringify({ ...legacy, settings: { ...legacy.settings, theme: 'invalid' } })));
});

test('four classifications take precedence over deadlines', () => {
  const tasks = [task('4', { urgent: false, important: false, dueAt: '2026-01-01T00:00:00Z' }), task('3', { important: false }), task('2', { urgent: false }), task('1')];
  assert.deepEqual(pendingTasks(tasks).map(t => t.id), ['1', '2', '3', '4']);
  assert.deepEqual(pendingTasks(tasks).map(categoryOf), [0,1,2,3]);
});
test('deadlines precede undated tasks; equal deadlines retain manual order; completed excluded', () => {
  const tasks = [task('undated'), task('later', { dueAt: '2026-11-02T00:00:00Z' }), task('second', { order: 2, dueAt: '2026-11-01T00:00:00Z' }), task('first', { order: 1, dueAt: '2026-11-01T00:00:00Z' }), task('done', { completedAt: '2026-10-28T00:00:00Z' })];
  assert.deepEqual(pendingTasks(tasks).map(t => t.id), ['first','second','later','undated']);
  assert.deepEqual(pendingTasks(reorder(tasks, 'second', -1)).map(t => t.id), ['second','first','later','undated']);
  assert.equal(reorder(tasks, 'undated', -1), tasks);
});
test('manual moves work for undated tasks without crossing categories', () => {
  const tasks = [task('a', { order: 1 }), task('b', { order: 2 }), task('c', { urgent: false })];
  assert.deepEqual(pendingTasks(reorder(tasks,'a',1)).map(t => t.id), ['b','a','c']);
  assert.equal(reorder(tasks, 'c', -1), tasks);
});
test('next task chooses earliest deadline across categories and otherwise uses classification', () => {
  assert.equal(nextTask([task('priority'), task('next', { important: false, dueAt: '2026-10-27T12:00:00Z' }), task('later', { dueAt: '2026-10-28T00:00:00Z' })]).id, 'next');
  assert.equal(nextTask([task('low', { important: false }), task('high')]).id, 'high');
  assert.equal(nextTask([]), null);
});
test('today uses local calendar date and excludes undated/completed tasks', () => {
  const now = new Date(2026,9,28,12);
  assert.equal(todayCount([task('today', { dueAt: new Date(2026,9,28,0,1).toISOString() }), task('tomorrow', { dueAt: new Date(2026,9,29,0,1).toISOString() }), task('no'), task('done', { dueAt: now.toISOString(), completedAt: now.toISOString() })], now), 1);
});
test('home payload excludes completed tasks and private notes', () => {
  const props = homeProps(doc([task('done', { completedAt: '2026-10-28T00:00:00Z' }), task('visible', { note: 'private memo' })]), new Date());
  assert.equal(props.total, 1); assert.equal(props.rows[0].id, 'visible');
  assert.equal(JSON.stringify(props).includes('private memo'), false);
});
test('lock toggles independently remove disabled information from shared payloads', () => {
  const document = doc([task('secret', { dueAt: '2026-10-28T00:00:00Z' })]);
  for (const count of [false, true]) for (const next of [false, true]) {
    document.settings = { showTodayCount: count, showNextTask: next };
    const props = lockProps(document, new Date('2026-10-28T01:00:00Z'));
    assert.equal(Object.hasOwn(props, 'today'), count); assert.equal(Object.hasOwn(props, 'next'), next);
    assert.equal(JSON.stringify(props).includes('secret'), next);
  }
});
test('widget payloads contain only UserDefaults-compatible property-list values', () => {
  const check = value => {
    assert.notEqual(value, null); assert.notEqual(value, undefined);
    if (Array.isArray(value)) value.forEach(check);
    else if (typeof value === 'object') Object.values(value).forEach(check);
    else assert.ok(['string','number','boolean'].includes(typeof value));
  };
  const document = doc([task('undated'), task('dated', { dueAt: new Date(2026,9,29,9).toISOString() })]);
  check(homeProps(document, new Date()));
  for (const showTodayCount of [false,true]) for (const showNextTask of [false,true]) {
    document.settings = { showTodayCount, showNextTask };
    lockTimeline(document, new Date()).forEach(entry => check(entry.props));
  }
});
test('timeline schedules local midnight and resets count, even for distant deadlines', () => {
  const document = doc([task('tomorrow', { dueAt: new Date(2026,9,29,9).toISOString() }), task('far', { dueAt: new Date(2028,1,8,9).toISOString() })]);
  const timeline = lockTimeline(document, new Date(2026,9,28,12));
  assert.deepEqual(timeline.map(e => e.props.today), [0,1,0,1,0]);
  assert.equal(timeline[1].date.getTime(), new Date(2026,9,29).getTime());
});
test('invalid or unsupported data fails without silently resetting stored tasks', () => {
  assert.throws(() => parseDocument('{broken'));
  assert.throws(() => parseDocument(JSON.stringify({ ...doc([]), version: 2 })));
  assert.throws(() => parseDocument(JSON.stringify(doc([task('x', { dueAt: 'invalid' })]))));
  assert.throws(() => parseDocument(JSON.stringify(doc([task('same'), task('same')]))));
  assert.deepEqual(parseDocument(JSON.stringify(doc([task('ok')]))).tasks[0], task('ok'));
});
test('concurrent writes survive restart; write failure does not advance or lose saved state', async () => {
  let saved = null, fail = false;
  const storage = {
    async getItem(key) { assert.equal(key, STORAGE_KEY); return saved; },
    async setItem(key, value) { assert.equal(key, STORAGE_KEY); await new Promise(resolve => setTimeout(resolve, 5)); if (fail) throw new Error('disk full'); saved = value; },
  };
  const repository = new Repository(storage); await repository.load();
  await Promise.all([
    repository.update(v => ({ ...v, tasks: [task('first')] })),
    repository.update(v => ({ ...v, settings: { ...v.settings, showNextTask: false } })),
    repository.update(v => ({ ...v, draft: { taskId: null, title: '', note: 'draft', urgent: true, important: false, dueAt: null } })),
  ]);
  const restarted = await new Repository(storage).load();
  assert.equal(restarted.tasks[0].id, 'first'); assert.equal(restarted.settings.showNextTask, false); assert.equal(restarted.draft.note, 'draft');
  fail = true;
  await assert.rejects(repository.update(v => ({ ...v, tasks: [] })));
  fail = false;
  const recovered = await repository.update(v => ({ ...v, draft: null }));
  assert.equal(recovered.tasks[0].id, 'first');
});
