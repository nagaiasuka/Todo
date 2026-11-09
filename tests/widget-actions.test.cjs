const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Repository } = require('../.test-build/data/repository');
const { initialDocument } = require('../.test-build/domain/tasks');
const { plannedReminders } = require('../.test-build/domain/reminders');
const { homeProps, lockProps } = require('../.test-build/widgets/model');

const now = '2035-01-01T00:00:00.000Z';
const task = { id: 'a', title: 'Review', urgent: true, important: true, dueAt: now, note: 'private', order: 0, completedAt: null, createdAt: now, recurringReminder: { hour: 8, minute: 0, weekdays: [1,3,5] }, reminderAts: ['2035-01-02T00:00:00.000Z', '2035-01-03T00:00:00.000Z'] };
const action = { id: 'event-1', taskId: 'a', completedAt: now };

test('completion while app is closed persists, removes widget rows and cancels every reminder', async () => {
  const before = homeProps({ ...initialDocument, tasks: [task] }, new Date(now));
  assert.ok(before.rows[0].notificationIds.includes('todo-reminder:a:weekday-1'));
  assert.ok(before.rows[0].notificationIds.includes('todo-reminder:a:weekday-3'));
  assert.ok(before.rows[0].notificationIds.includes('todo-reminder:a:weekday-5'));
  let saved = JSON.stringify({ ...initialDocument, tasks: [task] });
  let actions = [action];
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const source = { read: () => actions, acknowledge: ids => { actions = actions.filter(a => !ids.includes(a.id)); } };
  const repo = new Repository(storage, source);
  const document = await repo.load();
  assert.equal(document.tasks[0].completedAt, now);
  assert.equal(homeProps(document, new Date(now)).total, 0);
  assert.equal(lockProps(document, new Date(now)).today, 0);
  assert.deepEqual(plannedReminders(document.tasks, Date.parse(now)), []);
  assert.deepEqual(actions, []);
  assert.equal((await new Repository(storage).load()).tasks[0].completedAt, now);
});

test('failed app save retains widget actions for retry without losing tasks', async () => {
  let saved = JSON.stringify({ ...initialDocument, tasks: [task] });
  let fail = true, acknowledged = false;
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { if (fail) throw Error('disk full'); saved = value; } };
  const source = { read: () => [action], acknowledge: () => { acknowledged = true; } };
  await assert.rejects(new Repository(storage, source).load(), /disk full/);
  assert.equal(acknowledged, false);
  assert.equal(JSON.parse(saved).tasks[0].completedAt, null);
  fail = false;
  assert.equal((await new Repository(storage, source).load()).tasks[0].completedAt, now);
});

test('replayed completion after acknowledgement failure cannot undo a later restore', async () => {
  let saved = JSON.stringify({ ...initialDocument, tasks: [task] });
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const acknowledgedStates = [];
  const source = { read: () => [action], acknowledge: (_ids, completedIds) => { acknowledgedStates.push(completedIds); throw Error('temporary failure'); } };
  const repo = new Repository(storage, source);
  await repo.load();
  await repo.update(d => ({ ...d, tasks: d.tasks.map(t => ({ ...t, completedAt: null })) }));
  assert.equal((await new Repository(storage, source).load()).tasks[0].completedAt, null);
  assert.deepEqual(acknowledgedStates, [['a'], [], []]);
});

test('foreground edits merge pending completions and ignore actions for deleted tasks', async () => {
  let saved = JSON.stringify({ ...initialDocument, tasks: [task] });
  let actions = [];
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const source = { read: () => actions, acknowledge: () => { actions = []; } };
  const repo = new Repository(storage, source); await repo.load();
  actions = [action, { ...action, id: 'event-2', taskId: 'deleted' }];
  const document = await repo.update(d => ({ ...d, tasks: d.tasks.map(t => ({ ...t, title: 'Edited' })) }));
  assert.equal(document.tasks.length, 1);
  assert.equal(document.tasks[0].title, 'Edited');
  assert.equal(document.tasks[0].completedAt, now);
  assert.deepEqual(actions, []);
});
