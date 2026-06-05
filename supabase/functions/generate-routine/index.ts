/**
 * generate-routine — Phase 5 Sprint 2.4 (scaffolding stub).
 * Supabase Edge Function (Deno runtime).
 *
 * This is the scaffold that Sprint 3 will fill in. Today it returns 503
 * unconditionally so callers see a clean, well-documented "not yet
 * available" response while the AI governance work proceeds in the
 * background.
 *
 * Why scaffold now:
 *   - Lets us wire the parent UI's opt-in toggle and the audit-log
 *     plumbing into a real (if stubbed) endpoint without blocking on
 *     the LLM provider DPA paperwork or prompt engineering.
 *   - Establishes the request/response contract so the front-end team
 *     and the prompt-engineering team can iterate in parallel.
 *
 * When Sprint 3 lights this up:
 *   - Replace the body of `Deno.serve` with the 8-layer governance
 *     pipeline (input validation, system prompt, forced tool use,
 *     output schema check, content classifier, audit log write,
 *     return draft to client).
 *   - Add ANTHROPIC_API_KEY to function env (Dashboard → Edge Functions
 *     → generate-routine → Secrets).
 *
 * Contract (Sprint 3 will honour this):
 *   Method: POST
 *   Auth:   Bearer <user JWT> (the parent's session token, not the
 *           service role)
 *   Body:   { prompt: string, child_first_name: string,
 *             age_band: '4-6' | '7-10' | '11-14' }
 *   200:    { kind: 'draft', set_name, steps: [...] }
 *   200:    { kind: 'refusal', reason: string }
 *   400:    { error: 'invalid_input', detail }
 *   401:    { error: 'unauthorised' }
 *   403:    { error: 'feature_disabled' }  // when ai_routine_gen_enabled = FALSE
 *   429:    { error: 'rate_limited' }
 *   503:    { error: 'not_yet_available' }  // current stub response
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      error: 'not_yet_available',
      detail:
        'AI routine generation is rolling out gradually. The endpoint will be enabled in a future release; for now, please use the Activity Sets editor to create routines manually.',
      sprint: 'Phase 5 Sprint 2.4 scaffold; lights up in Sprint 3.',
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '604800', // 7 days; tells clients not to hammer
      },
    },
  );
});
