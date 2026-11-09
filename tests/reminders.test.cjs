const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ReminderScheduler, plannedReminders, REMINDER_PREFIX, REMINDER_LIMIT } = require('../.test-build/domain/reminders');
const { parseDocument, initialDocument, reminderDates } = require('../.test-build/domain/tasks');
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
  assert.equal([...f.scheduled.values()].find(r => r.taskId === 'a').title, 'edited');
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
  assert.equal([...f.scheduled.values()].some(r => r.taskId === '60'), false);
});

test('multiple custom dates survive restart and an explicit empty array clears a legacy reminder', async () => {
  const dates = [future(1), future(7), future(90)];
  let saved = null;
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { saved = value; } };
  const repo = new Repository(storage); await repo.load();
  const a = task('a', { reminderAts: dates });
  await repo.update(d => ({ ...d, tasks: [a], draft: { ...a, title: '', taskId: a.id } }));
  const restored = await new Repository(storage).load();
  assert.deepEqual(reminderDates(restored.tasks[0]), dates);
  assert.deepEqual(reminderDates(restored.draft), dates);
  assert.deepEqual(reminderDates({ reminderAt: dates[0], reminderAts: [] }), []);
});

test('multiple dates are independent, deduplicated by instant, and exclude past dates', () => {
  const at = '2035-01-01T00:00:00.000Z';
  const tasks = [task('a', { reminderAts: [at, '2035-01-01T09:00:00+09:00', '2035-01-02T00:00:00Z', '2020-01-01T00:00:00Z'] })];
  const reminders = plannedReminders(tasks, Date.parse('2034-12-31T00:00:00Z'));
  assert.deepEqual(reminders.map(r => r.at), [at, '2035-01-02T00:00:00.000Z']);
  assert.equal(new Set(reminders.map(r => r.identifier)).size, 2);
});

test('migration cancels legacy requests; deleting one date preserves the other; completion cancels all', async () => {
  const f = fixture();
  const early = future(1), late = future(10);
  const a = task('a', { reminderAts: [early, late] });
  f.scheduled.set(REMINDER_PREFIX + 'a', { identifier: REMINDER_PREFIX + 'a', taskId: 'a', title: 'a', at: early });
  await f.scheduler.sync([a]);
  assert.equal(f.scheduled.has(REMINDER_PREFIX + 'a'), false);
  assert.equal(f.scheduled.size, 2);
  const earlyId = [...f.scheduled.values()].find(r => r.at === early).identifier;
  f.events.length = 0;
  await f.scheduler.sync([{ ...a, reminderAts: [early] }]);
  assert.equal(f.scheduled.size, 1);
  assert.equal(f.scheduled.has(earlyId), true);
  assert.equal(f.events.some(event => event[0] === 'schedule'), false);
  await f.scheduler.sync([{ ...a, completedAt: future(0) }]);
  assert.equal(f.scheduled.size, 0);
  await f.scheduler.sync([a]);
  assert.equal(f.scheduled.size, 2);
});

test('malformed reminder arrays in saved tasks and drafts fail without erasing existing data', () => {
  for (const reminderAts of [null, 'bad', [42], ['bad'], [{}]]) {
    const a = task('a', { reminderAts });
    assert.throws(() => parseDocument(JSON.stringify({ ...initialDocument, tasks: [a] })));
    assert.throws(() => parseDocument(JSON.stringify({ ...initialDocument, draft: { ...a, taskId: null, title: '' } })));
  }
});

test('capacity is shared across reminder times rather than task count', async () => {
  const f = fixture();
  const a = task('a', { reminderAts: Array.from({ length: REMINDER_LIMIT + 1 }, (_, i) => future(i)) });
  await assert.rejects(f.scheduler.sync([a]), /60件/);
  assert.equal(f.scheduled.size, REMINDER_LIMIT);
});

test('daily and selected weekdays coexist with one-off dates, and next occurrences use local time', () => {
  const now = new Date(2035, 0, 1, 9, 0).getTime();
  const daily = task('daily', { reminderAt: null, recurringReminder: { hour: 8, minute: 0, weekdays: [0,1,2,3,4,5,6] } });
  const plans = plannedReminders([daily], now);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].recurrence, { hour: 8, minute: 0 });
  const { nextReminderTime } = require('../.test-build/domain/reminders');
  assert.equal(nextReminderTime(plans[0], now), new Date(2035, 0, 2, 8).getTime());
  const day = new Date(now).getDay();
  const weekly = task('weekly', { reminderAts: [new Date(now + 60000).toISOString()], recurringReminder: { hour: 8, minute: 0, weekdays: [day, (day + 2) % 7] } });
  const mixed = plannedReminders([weekly], now);
  assert.equal(mixed.length, 3);
  assert.equal(mixed[0].at, weekly.reminderAts[0]);
  const sameDay = mixed.find(r => r.recurrence?.weekday === day);
  assert.equal(nextReminderTime(sameDay, now), new Date(2035, 0, 8, 8).getTime());
  assert.deepEqual(plannedReminders([daily], now + 86400000), plans);
});

test('recurring schedules persist and reject malformed task and draft rules', () => {
  const a = task('repeat', { recurringReminder: { hour: 8, minute: 30, weekdays: [1,3,5] } });
  const doc = { ...initialDocument, tasks: [a], draft: { ...a, taskId: a.id } };
  assert.deepEqual(parseDocument(JSON.stringify(doc)).tasks[0].recurringReminder, a.recurringReminder);
  for (const invalid of [false, {}, {hour:24,minute:0,weekdays:[1]}, {hour:8,minute:60,weekdays:[1]}, {hour:8,minute:0,weekdays:[]}, {hour:8,minute:0,weekdays:[7]}, {hour:8,minute:0,weekdays:[1,1]}]) {
    assert.throws(() => parseDocument(JSON.stringify({...doc,tasks:[{...a,recurringReminder:invalid}]})));
    assert.throws(() => parseDocument(JSON.stringify({...doc,draft:{...doc.draft,recurringReminder:invalid}})));
  }
});

test('repeating notifications are idempotent, replace edited time/days, cancel on completion and resume on restore', async () => {
  const f = fixture();
  const a = task('a', { reminderAt: null, recurringReminder: { hour: 8, minute: 0, weekdays: [0,1,2,3,4,5,6] } });
  await f.scheduler.sync([a]); await f.scheduler.sync([a]);
  assert.equal(f.events.length, 1);
  const weekly = { ...a, recurringReminder: { hour: 10, minute: 15, weekdays: [1,3,5] } };
  await f.scheduler.sync([weekly]);
  assert.equal(f.scheduled.size, 3);
  assert.ok([...f.scheduled.values()].every(r => r.recurrence.hour === 10 && r.recurrence.minute === 15));
  await f.scheduler.sync([{ ...weekly, recurringReminder: { ...weekly.recurringReminder, hour: 12 } }]);
  assert.ok([...f.scheduled.values()].every(r => r.recurrence.hour === 12));
  await f.scheduler.sync([{...weekly,completedAt:future(0)}]); assert.equal(f.scheduled.size, 0);
  await f.scheduler.sync([weekly]); assert.equal(f.scheduled.size, 3);
  await f.scheduler.sync([{...weekly,recurringReminder:null}]); assert.equal(f.scheduled.size, 0);
  f.permission(false); await assert.rejects(f.scheduler.sync([a]), /通知が許可/);
});
