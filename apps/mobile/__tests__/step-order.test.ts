/**
 * Tests for step-order — the order_index rules behind the parent set editor.
 * Both guard bugs that silently lost a parent's work: "add step" used
 * steps.length (collides in 1-based or gapped sets), and reorder issued one
 * UPDATE per step (collides with the non-deferrable UNIQUE(set_id, order_index)).
 */

// Mock supabase so the module can be imported without .env vars in CI.
// jest.mock is hoisted above the imports below by the Jest transformer.
/* eslint-disable import/first */
jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '../src/lib/supabase';
import { nextStepIndex, saveStepOrder } from '../src/lib/step-order';

const rpc = supabase.rpc as jest.Mock;
const idx = (...values: number[]) => values.map((order_index) => ({ order_index }));

describe('nextStepIndex', () => {
  it('starts an empty set at 0', () => {
    expect(nextStepIndex([])).toBe(0);
  });

  it('appends after a 0-based set', () => {
    expect(nextStepIndex(idx(0, 1, 2))).toBe(3);
  });

  it('appends after a 1-based set (built-ins and old copies) instead of reusing the last index', () => {
    const steps = idx(1, 2, 3);
    expect(nextStepIndex(steps)).toBe(4);
    expect(steps.map((s) => s.order_index)).not.toContain(nextStepIndex(steps));
  });

  it('appends after the gap a deleted step leaves', () => {
    expect(nextStepIndex(idx(0, 2))).toBe(3);
  });

  it('does not depend on array order', () => {
    expect(nextStepIndex(idx(5, 1, 3))).toBe(6);
  });
});

describe('saveStepOrder', () => {
  beforeEach(() => rpc.mockReset());

  it('saves the whole order in ONE reorder_set_steps call', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await saveStepOrder('set-1', ['b', 'a', 'c']);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('reorder_set_steps', {
      p_set_id: 'set-1',
      p_step_ids: ['b', 'a', 'c'],
    });
  });

  it('throws when the server rejects it (postgrest returns errors, never throws)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'set not found' } });
    await expect(saveStepOrder('set-1', ['a'])).rejects.toThrow('set not found');
  });
});
