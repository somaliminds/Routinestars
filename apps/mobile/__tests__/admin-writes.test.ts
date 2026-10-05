/**
 * Tests for the admin write helpers. Each change is ONE RPC that writes the
 * change and its audit row together (migration 050), and every failure
 * surfaces — postgrest returns errors instead of throwing, so a swallowed
 * error used to look like success (and a failed audit insert went unnoticed).
 */

// Mock supabase so the module can be imported without .env vars in CI.
// jest.mock is hoisted above the imports below by the Jest transformer.
/* eslint-disable import/first */
jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn(), functions: { invoke: jest.fn() } },
}));

import { supabase } from '../src/lib/supabase';
import { liveFirst, setActivitySetArchived, setConfig } from '../src/lib/admin';

const rpc = supabase.rpc as jest.Mock;

describe('setConfig', () => {
  beforeEach(() => rpc.mockReset());

  it('changes the flag through admin_set_config — no separate client-side audit insert', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(setConfig('maintenance_mode', true)).resolves.toEqual({ error: null });
    expect(rpc).toHaveBeenCalledWith('admin_set_config', {
      p_key: 'maintenance_mode',
      p_value: true,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns the server error instead of reporting success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not authorised' } });
    await expect(setConfig('maintenance_mode', true)).resolves.toEqual({
      error: 'not authorised',
    });
  });
});

describe('setActivitySetArchived', () => {
  beforeEach(() => rpc.mockReset());

  it('archives through admin_set_activity_set_archived', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setActivitySetArchived('set-1', true);
    expect(rpc).toHaveBeenCalledWith('admin_set_activity_set_archived', {
      p_set_id: 'set-1',
      p_archived: true,
    });
  });

  it('throws when the server refuses (e.g. a family custom set)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'built-in set not found' } });
    await expect(setActivitySetArchived('custom-1', true)).rejects.toThrow(
      'built-in set not found',
    );
  });
});

describe('liveFirst', () => {
  it('lists live sets before archived ones, keeping each group in its original order', () => {
    const rows = [
      { id: 'a', is_archived: true },
      { id: 'b', is_archived: false },
      { id: 'c', is_archived: true },
      { id: 'd', is_archived: false },
    ];
    expect(liveFirst(rows).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});
