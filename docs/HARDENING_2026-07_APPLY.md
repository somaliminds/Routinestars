# Production Hardening (July 2026) — Apply Checklist

Fixes from the full-codebase audit. Code is committed + pushed. This is the
**operator checklist** for what must be applied/deployed for the fixes to take
effect. Do it in this order.

## 1. Database migrations (Supabase → SQL Editor)

Apply in numerical order. Each is idempotent-safe to run once.

| # | File | What it does | Breaking? |
|---|------|--------------|-----------|
| 032 | `032_mfa_rls_enforcement.sql` | Requires `aal2` in `has_active_consent` → MFA now enforced at the DB for professionals | No (parents/children unaffected). Professionals must complete MFA to read data — intended |
| 033 | `033_pin_bruteforce_protection.sql` | Adds `pin_attempt_count` + `pin_locked_until` to `parent_profiles` | No (additive columns, safe defaults) |
| 034 | `034_stripe_event_idempotency.sql` | `processed_stripe_events` ledger | No (new table) |
| 035 | `035_plan_quota_enforcement.sql` | `effective_plan()` + BEFORE INSERT triggers on `child_profiles` + `activity_sets` | No for existing rows (INSERT-only). New inserts over-limit are blocked — intended |
| 036 | `036_data_retention_cron.sql` | Daily pg_cron purge of completions > 90 days | No (report windows are inside 90d). **Needs pg_cron extension enabled** |
| 037 | `037_reports_completion_rate.sql` | `get_completion_rate_30d()` aggregate for the reports chart | No (new function) |

> **pg_cron**: 036 does `CREATE EXTENSION IF NOT EXISTS pg_cron`. If your plan
> requires enabling it via Dashboard → Database → Extensions first, do that,
> then run 036.

## 2. Edge Functions (redeploy)

These functions changed and must be redeployed:

- `verify-pin` — now requires JWT + owner match + lockout (C2)
- `change-pin` — owner check + clears lockout (C3)
- `stripe-webhook` — idempotency claim/rollback (H2)
- `delete-account` — **NEW** function, must be deployed (H3)
- `request-pin-reset` + `reset-pin` — token now hashed at rest (M3). Deploy
  **both together**; any reset links already outstanding become invalid (they
  expire within 1h regardless).

```bash
supabase functions deploy verify-pin change-pin stripe-webhook \
  delete-account request-pin-reset reset-pin
```

## 3. Client (rebuild)

All client changes ship in the next EAS build (paywall messages, delete-account
UI, PIN lockout messages, error boundaries, faster reports). No action beyond a
normal `eas build`.

## 4. Post-apply smoke checks

- **MFA**: a professional at aal1 (before MFA) gets no rows from child data
  endpoints; after MFA (aal2) they load. (C1)
- **Quota**: a FREE account adding a 2nd child sees the "Child limit reached"
  paywall. (H1)
- **Delete account**: Settings → Delete my account removes the account and all
  data; signing back in fails. (H3)
- **Reports**: 30-day chart still renders and is noticeably faster. (M1)
- **EHCP pack / One Page Profile**: "most-completed activities" now populate
  (were silently empty before the completions-query fix).

## Still open (not in this batch — governance / infra, not code)

- DPIA director sign-off before opening the professional portal to real
  professionals.
- Stripe live mode (needs business registration).
- Optional: automated invite email via Resend (Share-sheet MVP already ships).
