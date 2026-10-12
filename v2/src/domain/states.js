/** Pure rules for document collection. Persistence and route wiring come later. */
export const ITEM_STATUSES = Object.freeze([
  'missing', 'received', 'under_review', 'accepted', 'needs_replacement', 'waived',
]);

export const ITEM_TRANSITIONS = Object.freeze({
  missing: Object.freeze(['received', 'waived']),
  received: Object.freeze(['under_review', 'accepted', 'needs_replacement']),
  under_review: Object.freeze(['accepted', 'needs_replacement']),
  accepted: Object.freeze([]),
  needs_replacement: Object.freeze(['received', 'waived']),
  waived: Object.freeze(['missing']),
});

export class StateConflict extends Error {
  constructor(message, currentStatus) {
    super(message);
    this.name = 'StateConflict';
    this.status = 409;
    this.currentStatus = currentStatus;
  }

  toJSON() {
    return { error: this.message, currentStatus: this.currentStatus };
  }
}

/**
 * Validate one edge and return a plan, without changing the item or writing an event.
 * actor.type is staff or client_link. Staff may also complete an upload, but a
 * caller must verify storage first. All other edges are staff-only review actions.
 * This does not authenticate the actor or check firm/link ownership.
 */
export function validateItemTransition(fromStatus, toStatus, actor, reason) {
  if (!Object.hasOwn(ITEM_TRANSITIONS, fromStatus)
      || !ITEM_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new StateConflict('Item transition is not allowed.', fromStatus);
  }
  const actorType = actor?.type;
  if (actorType !== 'staff' && actorType !== 'client_link') {
    throw new StateConflict('A staff or client_link actor is required.', fromStatus);
  }
  if (toStatus !== 'received' && actorType !== 'staff') {
    throw new StateConflict('This item transition requires staff.', fromStatus);
  }
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
  if ((toStatus === 'needs_replacement' || toStatus === 'waived') && !normalizedReason) {
    throw new StateConflict('A reason is required.', fromStatus);
  }
  return Object.freeze({ fromStatus, toStatus, actorType, reason: normalizedReason || null });
}

/**
 * Count a supplied checklist snapshot. Callers must load ALL items in the request,
 * using an authorized firm-scoped query. Missing/invalid metadata fails closed.
 * Optional items never block closing. An empty checklist has no required blockers.
 */
export function requestProgress(items) {
  if (!Array.isArray(items)) throw new TypeError('Checklist items must be an array.');
  const counts = Object.fromEntries(ITEM_STATUSES.map((status) => [status, 0]));
  let requiredTotal = 0;
  let requiredComplete = 0;
  for (const item of items) {
    if (!item || !Object.hasOwn(counts, item.status)) {
      throw new TypeError('Every checklist item must have a document-collection status.');
    }
    if (![true, false, 1, 0].includes(item.required)) {
      throw new TypeError('Every checklist item must have a boolean or 0/1 required flag.');
    }
    counts[item.status] += 1;
    if (item.required === true || item.required === 1) {
      requiredTotal += 1;
      if (item.status === 'accepted' || item.status === 'waived') requiredComplete += 1;
    }
  }
  return Object.freeze({
    counts: Object.freeze(counts), total: items.length,
    requiredTotal, requiredComplete, requiredRemaining: requiredTotal - requiredComplete,
    canClose: requiredTotal === requiredComplete,
  });
}

/** Only close eligibility is defined here, not a legacy request-status graph. */
export function validateRequestClose(items, currentStatus) {
  const progress = requestProgress(items);
  if (!progress.canClose) {
    throw new StateConflict('Required items must be accepted or waived before closing.', currentStatus);
  }
  return progress;
}
