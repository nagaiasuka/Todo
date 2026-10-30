const { test } = require('node:test');
const assert = require('node:assert/strict');
const { render, texts } = require('./helpers/lock-runtime.cjs');
const { lockProps, lockTimeline } = require('../.test-build/widgets/model');
const { initialDocument } = require('../.test-build/domain/tasks');
const families = ['accessoryInline', 'accessoryCircular', 'accessoryRectangular'];

test('all lock formats render in the real isolated Expo runtime for every privacy setting', () => {
  for (const family of families) for (const showCount of [false,true]) for (const showNext of [false,true]) {
    const props = { ...(showCount ? { today: 0 } : {}), ...(showNext ? { next: 'SECRET_TASK', nextDeadline: '今日 14:00', nextEmpty: false } : {}) };
    const tree = render(props, family);
    const json = JSON.stringify(tree);
    assert.ok(tree.type);
    assert.ok(json.includes('todo-performance:///'));
    if (!showCount) assert.equal(json.includes('今日が期限の未完了タスク'), false);
    if (!showNext) assert.equal(json.includes('SECRET_TASK'), false);
    if (!showCount && !showNext) assert.ok(texts(tree).includes('Todo'));
    if (showCount) assert.ok(texts(tree).join(' ').includes('0'));
  }
});
test('large counts remain compact with the precise total available to VoiceOver', () => {
  for (const family of ['accessoryCircular','accessoryRectangular']) {
    const tree = render({ today: 1200 }, family);
    assert.ok(texts(tree).includes('999+'));
    assert.ok(JSON.stringify(tree).includes('1200件'));
  }
});
test('empty and long next-task names render without inventing tasks or exposing disabled data', () => {
  for (const family of families) {
    assert.ok(texts(render({ next: 'タスクはありません', nextEmpty: true }, family)).join(' ').includes('タスクなし'));
    assert.ok(render({ next: '長い名前'.repeat(30), nextEmpty: false, nextDeadline: '10/31 18:00' }, family).type);
  }
  const due = new Date(2026, 9, 30, 14).toISOString();
  const task = { id: 'a', title: '資料\n  を確認', note: '', urgent: true, important: true, dueAt: due, reminderAt: null, order: 0, completedAt: null, createdAt: due };
  const doc = { ...initialDocument, tasks: [task], settings: { showTodayCount: true, showNextTask: false } };
  assert.deepEqual(lockProps(doc, new Date(2026,9,29,12)), { today: 0 });
  doc.settings = { showTodayCount: false, showNextTask: true };
  const props = lockProps(doc, new Date(2026,9,29,12));
  assert.equal(props.next, '資料 を確認');
  assert.equal(props.nextDeadline, '10/30 14:00');
  const timeline = lockTimeline(doc, new Date(2026,9,29,12));
  assert.equal(timeline[1].props.nextDeadline, '今日 14:00');
  assert.equal(timeline[2].props.nextDeadline, '10/30 14:00');
});
