/**
 * Lightweight Event Bus for decoupled cross-module communication.
 */
const listeners = new Map();

export const events = {
  on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);
    return () => listeners.get(event)?.delete(callback);
  },

  emit(event, data) {
    if (!listeners.has(event)) return;
    for (const cb of listeners.get(event)) {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    }
  }
};
