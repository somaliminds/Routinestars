-- ============================================================
-- Migration 011: (no-op placeholder)
-- PIN verification is handled entirely by the verify-pin
-- Edge Function using Deno bcrypt — no SQL function needed.
-- pgcrypto crypt() was removed due to Supabase schema path
-- issues (extensions schema vs public schema).
-- ============================================================

-- No SQL changes required for this migration.
SELECT 1;
