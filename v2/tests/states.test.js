import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_STATUSES, ITEM_TRANSITIONS, StateConflict,
  validateItemTransition, requestProgress, validateRequestClose,
} from '../src/domain/states.js';

const statuses = ['missing', 'received', 'under_review', 'accepted', 'needs_replacement', 'waived'];
const legal = new Set([
  'missing:received', 'missing:waived', 'received:under_review', 'received:accepted',
  'received:needs_replacement', 'under_review:accepted', 'under_review:needs_replacement',
  'needs_replacement:received', 'needs_replacement:waived', 'waived:missing',
]);
const staff = { type: 'staff' };
const client = { type: 'client_link' };
function conflict(fn, currentStatus) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof StateConflict);
    assert.equal(error.status, 409);
    assert.equal(error.currentStatus, currentStatus);
    assert.deepEqual(error.toJSON(), { error: error.message, currentStatus });
    return true;
  });
}

for (const from of statuses) {
  for (const to of statuses) {
    test(`staff transition ${from} -> ${to}`, () => {
      if (legal.has(`${from}:${to}`)) {
        const result = validateItemTransition(from, to, staff, ' Review reason ');
        assert.deepEqual(result, {
          fromStatus: from, toStatus: to, actorType: 'staff', reason: 'Review reason',
        });
      } else conflict(() => validateItemTransition(from, to, staff, 'reason'), from);
    });
    test(`client transition ${from} -> ${to}`, () => {
      if (legal.has(`${from}:${to}`) && to === 'received') {
        assert.equal(validateItemTransition(from, to, client).toStatus, 'received');
      } else conflict(() => validateItemTransition(from, to, client, 'reason'), from);
    });
  }
}

test('transition table matches the spec and is deeply immutable', () => {
  assert.deepEqual(ITEM_STATUSES, statuses);
  const edges = Object.entries(ITEM_TRANSITIONS).flatMap(([from, targets]) => targets.map((to) => `${from}:${to}`));
  assert.deepEqual(new Set(edges), legal);
  assert.ok(Object.isFrozen(ITEM_STATUSES));
  assert.ok(Object.isFrozen(ITEM_TRANSITIONS));
  for (const targets of Object.values(ITEM_TRANSITIONS)) assert.ok(Object.isFrozen(targets));
  assert.throws(() => ITEM_TRANSITIONS.missing.push('accepted'), TypeError);
});

test('unknown, legacy and prototype-like statuses fail with current status', () => {
  for (const value of ['pending', 'done', 'constructor', '__proto__', '', null, undefined, 1]) {
    conflict(() => validateItemTransition(value, 'received', staff), value);
    conflict(() => validateItemTransition('missing', value, staff), 'missing');
  }
});

test('unknown and absent actors fail on every legal edge', () => {
  for (const edge of legal) {
    const [from, to] = edge.split(':');
    for (const actor of [undefined, null, {}, { type: 'system' }, { type: 'client' }]) {
      conflict(() => validateItemTransition(from, to, actor, 'reason'), from);
    }
  }
});

for (const edge of ['received:needs_replacement', 'under_review:needs_replacement', 'missing:waived', 'needs_replacement:waived']) {
  test(`${edge} requires a nonblank string reason`, () => {
    const [from, to] = edge.split(':');
    for (const reason of [undefined, null, '', ' \n\t ', 42, {}, []]) {
      conflict(() => validateItemTransition(from, to, staff, reason), from);
    }
    assert.equal(validateItemTransition(from, to, staff, ' why ').reason, 'why');
  });
}

test('plans are immutable and input actor is not mutated', () => {
  const actor = Object.freeze({ type: 'client_link', id: 'link-1' });
  const plan = validateItemTransition('missing', 'received', actor);
  assert.ok(Object.isFrozen(plan));
  assert.equal(plan.reason, null);
  assert.deepEqual(actor, { type: 'client_link', id: 'link-1' });
});

for (const status of statuses) {
  test(`required ${status} close eligibility`, () => {
    const items = [{ status, required: 1 }];
    const progress = requestProgress(items);
    assert.equal(progress.counts[status], 1);
    assert.equal(progress.total, 1);
    assert.equal(progress.requiredTotal, 1);
    const complete = status === 'accepted' || status === 'waived';
    assert.equal(progress.requiredComplete, Number(complete));
    assert.equal(progress.requiredRemaining, Number(!complete));
    assert.equal(progress.canClose, complete);
    if (complete) assert.deepEqual(validateRequestClose(items, 'open'), progress);
    else conflict(() => validateRequestClose(items, 'open'), 'open');
  });
  test(`optional ${status} does not prevent closing`, () => {
    assert.equal(validateRequestClose([{ status, required: false }], 'open').canClose, true);
  });
}

test('mixed checklist counts all statuses but only required blockers', () => {
  const items = statuses.map((status) => ({ status, required: false }));
  items.push({ status: 'accepted', required: true }, { status: 'waived', required: 1 });
  const before = structuredClone(items);
  const progress = validateRequestClose(items, 'draft');
  assert.deepEqual(progress.counts, { missing: 1, received: 1, under_review: 1, accepted: 2, needs_replacement: 1, waived: 2 });
  assert.equal(progress.total, 8);
  assert.equal(progress.requiredTotal, 2);
  assert.equal(progress.requiredComplete, 2);
  assert.equal(progress.requiredRemaining, 0);
  assert.deepEqual(items, before);
  assert.ok(Object.isFrozen(progress));
  assert.ok(Object.isFrozen(progress.counts));
  items.push({ status: 'received', required: true });
  conflict(() => validateRequestClose(items, 'open'), 'open');
});

test('empty checklist and numeric optional flag have no required blockers', () => {
  assert.deepEqual(requestProgress([]), {
    counts: { missing: 0, received: 0, under_review: 0, accepted: 0, needs_replacement: 0, waived: 0 },
    total: 0, requiredTotal: 0, requiredComplete: 0, requiredRemaining: 0, canClose: true,
  });
  assert.equal(validateRequestClose([], 'open').canClose, true);
  assert.equal(requestProgress([{ status: 'missing', required: 0 }]).requiredTotal, 0);
});

test('invalid snapshots fail closed rather than silently omitting a blocker', () => {
  for (const items of [null, undefined, {}, 'items']) assert.throws(() => requestProgress(items), TypeError);
  for (const item of [null, {}, { status: 'pending', required: 1 }, { status: '__proto__', required: 1 },
    ...[undefined, null, '0', '1', 2, {}].map((required) => ({ status: 'accepted', required }))]) {
    assert.throws(() => requestProgress([item]), TypeError);
    assert.throws(() => validateRequestClose([item], 'open'), TypeError);
  }
});
