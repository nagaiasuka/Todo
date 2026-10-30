const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ReminderScheduler, plannedReminders, REMINDER_PREFIX, REMINDER_LIMIT } = require('../.test-build/domain/reminders');
const { parseDocument, initialDocument } = require('../.test-build/domain/tasks');
const { Repository } = require('../.test-build/data/repository');
const future = offset => new Date(Date.now() + 3600000 + offset * 60000).toISOString();
const task = (id, fields = {}) => ({ id, title: id, urgent: true, important: true, dueAt: null, note: '', order: 0, completedAt: null, createdAt: future(0), reminderAt: future(1), ...fields });
function fixture() {
  const scheduled = new Map();
  const events = [];
  let allowed = true;
  let fail = false;
  const scheduler = new ReminderScheduler({
    list: async () => [...scheduled.values()],
    allowed: async () => allowed,
    cancel: async id => { scheduled.delete(id); events.push(['cancel', id]); },
    schedule: async r => { if (fail) throw new Error('OS failure'); scheduled.set(r.identifier, r); events.push(['schedule', r.identifier]); },
  });
  return { scheduler, scheduled, events, permission: v => allowed = v, fail: v => fail = v };
}
test('legacy tasks/drafts load; malformed reminder timestamps are rejected', () => {
  const old = task('old'); delete old.reminderAt;
  const doc = { ...initialDocument, tasks: [old], draft: { ...old, taskId: old.id } };
  assert.equal(parseDocument(JSON.stringify(doc)).tasks[0].reminderAt, undefined);
  doc.tasks[0].reminderAt = 'bad';
  assert.throws(() => parseDocument(JSON.stringify(doc)));
  delete doc.tasks[0].reminderAt; doc.draft.reminderAt = 42;
  assert.throws(() => parseDocument(JSON.stringify(doc)));
});
test('only future, incomplete reminders are planned, independent of deadlines and priority', () => {
  const now = Date.now();
  const tasks = [task('late', { reminderAt: future(5) }), task('first', { important: false, dueAt: null }), task('done', { completedAt: future(0) }), task('past', { reminderAt: new Date(now - 1).toISOString() }), task('none', { reminderAt: null })];
  assert.deepEqual(plannedReminders(tasks, now).map(r => r.taskId), ['first', 'late']);
});
test('notification dates and reminder drafts survive storage and restart', async () => {
  let saved = null;
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const repo = new Repository(storage); await repo.load();
  const a = task('a'); const draft = { ...a, title: '', taskId: a.id };
  await repo.update(d => ({ ...d, tasks: [a], draft }));
  const restored = await new Repository(storage).load();
  assert.equal(restored.tasks[0].reminderAt, a.reminderAt);
  assert.equal(restored.draft.reminderAt, a.reminderAt);
});
test('reconciliation is idempotent; edits replace, completion/delete/off cancel, restore schedules', async () => {
  const f = fixture(); const a = task('a'); const b = task('b');
  await f.scheduler.sync([a,b]); await f.scheduler.sync([a,b]);
  assert.equal(f.events.length, 2);
  await f.scheduler.sync([{ ...a, title: 'edited', reminderAt: future(9) },b]);
  assert.equal(f.scheduled.get(REMINDER_PREFIX + 'a').title, 'edited');
  await f.scheduler.sync([{ ...a, completedAt: future(0) }, { ...b, reminderAt: null }]);
  assert.equal(f.scheduled.size, 0);
  await f.scheduler.sync([a]); assert.equal(f.scheduled.size, 1);
  await f.scheduler.sync([]); assert.equal(f.scheduled.size, 0);
});
test('denial is reported, cancellation still works, OS failures recover on retry', async () => {
  const f = fixture(); const a = task('a'); const b = task('b');
  await f.scheduler.sync([a]); f.permission(false);
  await assert.rejects(f.scheduler.sync([b]), /通知が許可/);
  assert.equal(f.scheduled.size, 0);
  f.permission(true); f.fail(true);
  await assert.rejects(f.scheduler.sync([b]), /OS failure/);
  f.fail(false); await f.scheduler.sync([b]); assert.equal(f.scheduled.size, 1);
});
test('concurrent older saves cannot restore a deleted notification; unrelated requests survive', async () => {
  const f = fixture(); f.scheduled.set('other', { identifier: 'other' });
  await Promise.all([f.scheduler.sync([task('a')]), f.scheduler.sync([])]);
  assert.deepEqual([...f.scheduled.keys()], ['other']);
});
test('capacity overflow reports limited scheduling instead of silently dropping reminders', async () => {
  const f = fixture();
  await assert.rejects(f.scheduler.sync(Array.from({ length: REMINDER_LIMIT + 1 }, (_, i) => task(String(i), { reminderAt: future(i) }))), /60件/);
  assert.equal(f.scheduled.size, REMINDER_LIMIT);
  assert.equal(f.scheduled.has(REMINDER_PREFIX + '60'), false);
});
