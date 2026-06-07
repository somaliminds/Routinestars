-- ============================================================
-- Migration 024 — Cross-environment continuity (home ⇄ school ⇄ respite).
--
-- Phase 5 / Sprint 4, Feature 1.
--
-- Unmet UK SEN need: the same child's routine runs at home, at school
-- with a TA, and at grandparents' on weekends. The parent wants to see
-- WHERE each completion happened, who marked it done, and any
-- contextual notes. Schools/respite carers want a minimal interface
-- focused on today's routine — not the parent app's full surface.
--
-- This migration prepares the data side. Sprint 4.2-4.4 will build the
-- UI on top.
--
-- Changes:
--
--   1. care_team_members.role gains 'school_ta' (TA who marks done at
--      school) alongside the existing 'view_only' and 'approver'. A
--      single carer row is now (parent, child, email, role,
--      environment) — same email can hold different roles for
--      different children, or even for the same child across
--      environments.
--
--   2. care_team_members.environment column: HOME / SCHOOL / RESPITE,
--      defaulting to HOME for back-compat (existing rows keep working).
--
--   3. completions.environment: the same enum, recording where the
--      completion happened. Defaults to HOME so historical rows stay
--      sensible. The child app writes HOME implicitly; the TA app
--      writes SCHOOL.
--
--   4. completions.carer_user_id: which carer (TA or parent) marked
--      this completion done. NULL means the child self-marked.
--
--   5. completions.carer_note: optional free-text from the carer (max
--      280 chars). E.g. "noise from playground next door, needed
--      extra prompting on step 3".
--
--   6. New RLS policies for school_ta:
--      - Read scheduled_sets / day_schedules / activity_sets / steps
--        for any child they're an accepted school_ta for.
--      - INSERT and UPDATE completions for those children with
--        environment=SCHOOL.
--      - No access to anything else (no settings, no schedule editing).
-- ============================================================

-- ── 1. Expand care_team_members.role check ──
ALTER TABLE public.care_team_members
  DROP CONSTRAINT IF EXISTS care_team_members_role_check;

ALTER TABLE public.care_team_members
  ADD CONSTRAINT care_team_members_role_check
  CHECK (role IN ('view_only', 'approver', 'school_ta'));

-- ── 2. Environment column on care_team_members ──
ALTER TABLE public.care_team_members
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'HOME'
  CHECK (environment IN ('HOME', 'SCHOOL', 'RESPITE'));

COMMENT ON COLUMN public.care_team_members.environment IS
  'Context the carer operates in. Defaults to HOME for back-compat. '
  'SCHOOL routes the carer to the TA-facing app on login. RESPITE is '
  'currently informational (no UI distinct from HOME yet).';

-- The UNIQUE (parent_id, child_id, email) constraint stays — a single
-- email can hold ONE role per (parent, child) pair. To assign someone
-- as both home approver AND school TA for the same child, the parent
-- uses two different email addresses (or we change the constraint in
-- a future migration).

-- ── 3. completions.environment ──
ALTER TABLE public.completions
  ADD COLUMN IF NOT EXISTS environment VARCHAR(10) NOT NULL DEFAULT 'HOME'
  CHECK (environment IN ('HOME', 'SCHOOL', 'RESPITE'));

COMMENT ON COLUMN public.completions.environment IS
  'Where the completion happened. Written by the carer or child app '
  'based on the actor. Used by parent reports to show cross-context '
  'activity.';

-- ── 4. completions.carer_user_id ──
ALTER TABLE public.completions
  ADD COLUMN IF NOT EXISTS carer_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.completions.carer_user_id IS
  'Which carer (TA or parent or grandparent) marked this completion '
  'done. NULL if the child self-marked from the child app.';

-- ── 5. completions.carer_note ──
ALTER TABLE public.completions
  ADD COLUMN IF NOT EXISTS carer_note TEXT
  CHECK (carer_note IS NULL OR length(carer_note) <= 280);

COMMENT ON COLUMN public.completions.carer_note IS
  'Optional free-text note from the carer (max 280 chars). Surfaces '
  'in parent reports + approval screen. Useful for "needed extra '
  'prompting on step 3" / "calm regulated session" / etc.';

-- ── 6. RLS policies for school_ta ──
-- TAs read across several tables for their linked children. Inlined
-- EXISTS to stay self-contained per the project pattern (migration 002
-- helper is deferred).

-- TAs can read child_profiles for any child they're an accepted school_ta for.
CREATE POLICY "child_profiles_ta_read" ON public.child_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.care_team_members ctm
      WHERE ctm.child_id = child_profiles.profile_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs read day_schedules for their linked children.
CREATE POLICY "day_schedules_ta_read" ON public.day_schedules
  FOR SELECT USING (
    is_published = TRUE
    AND EXISTS (
      SELECT 1 FROM public.care_team_members ctm
      WHERE ctm.child_id = day_schedules.child_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs read scheduled_sets in those day_schedules.
CREATE POLICY "scheduled_sets_ta_read" ON public.scheduled_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.day_schedules ds
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
      WHERE ds.schedule_id = scheduled_sets.schedule_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs update scheduled_set status (mark IN_PROGRESS / AWAITING_APPROVAL).
CREATE POLICY "scheduled_sets_ta_update" ON public.scheduled_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.day_schedules ds
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
      WHERE ds.schedule_id = scheduled_sets.schedule_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs insert completions for their linked children.
CREATE POLICY "completions_ta_insert" ON public.completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.care_team_members ctm
      WHERE ctm.child_id = completions.child_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs read completions they created (for their own session review).
CREATE POLICY "completions_ta_read" ON public.completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.care_team_members ctm
      WHERE ctm.child_id = completions.child_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs insert step_completions tied to their own completion rows.
CREATE POLICY "step_completions_ta_insert" ON public.step_completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.completions c
      JOIN public.care_team_members ctm ON ctm.child_id = c.child_id
      WHERE c.completion_id = step_completions.completion_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- TAs read activity_sets + steps for any set scheduled to a linked child.
CREATE POLICY "activity_sets_ta_read" ON public.activity_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_sets ss
      JOIN public.day_schedules ds ON ds.schedule_id = ss.schedule_id
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
      WHERE ss.set_id = activity_sets.set_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- Steps inherit the activity_sets read pattern.
CREATE POLICY "steps_ta_read" ON public.steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_sets ss
      JOIN public.day_schedules ds ON ds.schedule_id = ss.schedule_id
      JOIN public.care_team_members ctm ON ctm.child_id = ds.child_id
      WHERE ss.set_id = steps.set_id
      AND ctm.email = auth.email()
      AND ctm.role = 'school_ta'
      AND ctm.accepted_at IS NOT NULL
    )
  );

-- Index for the carer lookups (RLS hits this on every TA query)
CREATE INDEX IF NOT EXISTS idx_care_team_members_email_role_accepted
  ON public.care_team_members (email, role)
  WHERE accepted_at IS NOT NULL;
