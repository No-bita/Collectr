import { describe, it, expect } from 'vitest';
import { generateTicket, shuffleArray } from './tambolaEngine.js';

/**
 * Helper: create a pool of N dummy items with unique IDs
 */
function createItemPool(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: { en: `Item ${i + 1}`, hi: `आइटम ${i + 1}`, gu: `આઇટમ ${i + 1}` }
  }));
}

/**
 * Helper: extract all item IDs from a ticket's grid
 */
function getItemIdsFromTicket(ticket) {
  const ids = new Set();
  for (const row of ticket.grid) {
    for (const cell of row) {
      if (cell) ids.add(cell.id);
    }
  }
  return ids;
}

describe('Item distribution with 75-item pool', () => {
  const TOTAL_ITEMS = 75;
  const ROWS = 3;
  const COLUMNS = 9;
  const ITEMS_PER_ROW = 5;
  const ITEMS_PER_TICKET = ROWS * ITEMS_PER_ROW; // 15
  const items = createItemPool(TOTAL_ITEMS);

  it('should use items from beyond the first 15 (no top-of-list bias)', () => {
    // Generate 20 tickets and check that items with IDs > 15 appear at least once
    const allUsedIds = new Set();
    for (let i = 0; i < 20; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);
      ids.forEach(id => allUsedIds.add(id));
    }

    // Items beyond the first 15 should be used
    const highIndexItems = items.slice(15).map(item => item.id);
    const usedHighItems = highIndexItems.filter(id => allUsedIds.has(id));

    expect(usedHighItems.length).toBeGreaterThan(0);
    // With 20 tickets x 15 items each = 300 draws from 75 items,
    // statistically almost all should be used
    expect(usedHighItems.length).toBeGreaterThan(highIndexItems.length * 0.5);
  });

  it('should eventually use ALL 75 items when enough tickets are generated', () => {
    // Generate a large number of tickets (e.g. 50)
    // With 50 tickets x 15 items = 750 draws from 75 items,
    // each item should appear ~10 times on average
    const allUsedIds = new Set();
    for (let i = 0; i < 50; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);
      ids.forEach(id => allUsedIds.add(id));
    }

    // ALL 75 items should be represented at least once
    const unusedItems = items.filter(item => !allUsedIds.has(item.id));
    expect(unusedItems).toEqual([]);
    expect(allUsedIds.size).toBe(TOTAL_ITEMS);
  });

  it('should not always pick items from the same positions in the array', () => {
    // Generate 30 tickets and track which items appear.
    // No single item should appear in ALL tickets (showing no fixed selection)
    const itemAppearanceCounts = {};
    items.forEach(item => { itemAppearanceCounts[item.id] = 0; });

    const TICKET_COUNT = 30;
    for (let i = 0; i < TICKET_COUNT; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);
      ids.forEach(id => { itemAppearanceCounts[id]++; });
    }

    // With 75 items and only 15 per ticket, no item should appear in all 30 tickets
    const alwaysPresentItems = Object.entries(itemAppearanceCounts)
      .filter(([_, count]) => count === TICKET_COUNT);

    expect(alwaysPresentItems.length).toBe(0);
  });

  it('should distribute items roughly evenly across tickets', () => {
    // Each item has a 15/75 = 20% chance per ticket
    // Over 100 tickets, expected count per item = 20
    // A fair distribution means no item has count < 5 or > 40
    const itemAppearanceCounts = {};
    items.forEach(item => { itemAppearanceCounts[item.id] = 0; });

    const TICKET_COUNT = 100;
    for (let i = 0; i < TICKET_COUNT; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);
      ids.forEach(id => { itemAppearanceCounts[id]++; });
    }

    const counts = Object.values(itemAppearanceCounts);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    // Average should be close to expected (100 * 15/75 = 20)
    expect(avgCount).toBeCloseTo(20, 0);

    // No item should be drastically over or underrepresented
    // Allow generous bounds to account for randomness
    expect(minCount).toBeGreaterThanOrEqual(3);
    expect(maxCount).toBeLessThanOrEqual(40);
  });

  it('should not have items from the bottom of the list appear less than items from the top', () => {
    // Split items into top-25, middle-25, bottom-25
    const topIds = new Set(items.slice(0, 25).map(i => i.id));
    const midIds = new Set(items.slice(25, 50).map(i => i.id));
    const botIds = new Set(items.slice(50, 75).map(i => i.id));

    let topTotal = 0, midTotal = 0, botTotal = 0;

    const TICKET_COUNT = 100;
    for (let i = 0; i < TICKET_COUNT; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);
      ids.forEach(id => {
        if (topIds.has(id)) topTotal++;
        else if (midIds.has(id)) midTotal++;
        else if (botIds.has(id)) botTotal++;
      });
    }

    // All three thirds should be roughly equal (total = 1500, each ~500)
    // Allow 30% tolerance
    const expectedPerThird = (TICKET_COUNT * ITEMS_PER_TICKET) / 3; // 500
    const tolerance = expectedPerThird * 0.3; // 150

    expect(topTotal).toBeGreaterThan(expectedPerThird - tolerance);
    expect(topTotal).toBeLessThan(expectedPerThird + tolerance);
    expect(midTotal).toBeGreaterThan(expectedPerThird - tolerance);
    expect(midTotal).toBeLessThan(expectedPerThird + tolerance);
    expect(botTotal).toBeGreaterThan(expectedPerThird - tolerance);
    expect(botTotal).toBeLessThan(expectedPerThird + tolerance);
  });

  it('each individual ticket should have exactly 15 unique items (no duplicates)', () => {
    for (let i = 0; i < 30; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);

      // Should have exactly ITEMS_PER_ROW * ROWS = 15 items
      expect(ids.size).toBe(ITEMS_PER_TICKET);

      // All IDs should come from the original pool
      ids.forEach(id => {
        expect(items.some(item => item.id === id)).toBe(true);
      });
    }
  });

  it('items at index 50+ should appear in at least some tickets out of 10', () => {
    // Focused test: with only 10 tickets, do items from the tail end get picked?
    const tailItemIds = new Set(items.slice(50).map(i => i.id));
    const usedTailIds = new Set();

    for (let i = 0; i < 10; i++) {
      const ticket = generateTicket(items, i, ROWS, COLUMNS, ITEMS_PER_ROW);
      const ids = getItemIdsFromTicket(ticket);
      ids.forEach(id => {
        if (tailItemIds.has(id)) usedTailIds.add(id);
      });
    }

    // 10 tickets x 15 items = 150 draws from 75 items
    // 25 tail items should have ~50 draws total → most should appear
    expect(usedTailIds.size).toBeGreaterThan(10);
  });
});

describe('shuffleArray fairness', () => {
  it('should produce different orderings on repeated calls', () => {
    const arr = Array.from({ length: 75 }, (_, i) => i);
    const results = new Set();

    for (let i = 0; i < 10; i++) {
      results.add(JSON.stringify(shuffleArray(arr)));
    }

    // Should produce multiple unique orderings (extremely unlikely to be <3)
    expect(results.size).toBeGreaterThan(3);
  });

  it('first element should not always come from top of original array', () => {
    const arr = Array.from({ length: 75 }, (_, i) => i);
    const firstElements = [];

    for (let i = 0; i < 50; i++) {
      firstElements.push(shuffleArray(arr)[0]);
    }

    // First elements should span across the range, not cluster at 0-14
    const uniqueFirsts = new Set(firstElements);
    expect(uniqueFirsts.size).toBeGreaterThan(10);

    // At least some first elements should be >= 15
    const highFirsts = firstElements.filter(v => v >= 15);
    expect(highFirsts.length).toBeGreaterThan(10);
  });
});
