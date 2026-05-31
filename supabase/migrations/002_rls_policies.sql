-- ============================================================
-- RoutineStars — Migration 002: Row Level Security Policies
-- CRITICAL: Child data must ONLY be accessible to their linked parent.
-- Quality Rule 2: All database queries must use Supabase RLS.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_completions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_rewards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockout_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Get current user's internal user_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id FROM public.users WHERE user_id = auth.uid()
$$;

-- ============================================================
-- HELPER FUNCTION: Check if current user is parent of child
-- Used in many RLS policies below.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_parent_of(p_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.child_profiles
    WHERE profile_id = p_child_id
    AND parent_id = auth.uid()
  )
$$;

-- ============================================================
-- USERS — own row only
-- ============================================================
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- PARENT PROFILES — own profile only
-- ============================================================
CREATE POLICY "parent_profiles_own" ON public.parent_profiles
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- CHILD PROFILES
-- Parents can CRUD their own children.
-- Children can read their own profile.
-- ============================================================
CREATE POLICY "child_profiles_parent_all" ON public.child_profiles
  FOR ALL USING (parent_id = auth.uid());

CREATE POLICY "child_profiles_child_read" ON public.child_profiles
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- ACTIVITY SETS
-- Everyone can read default (non-custom) sets.
-- Parents can CRUD custom sets they created.
-- ============================================================
CREATE POLICY "activity_sets_default_read" ON public.activity_sets
  FOR SELECT USING (is_custom = FALSE OR created_by_parent_id = auth.uid());

CREATE POLICY "activity_sets_custom_insert" ON public.activity_sets
  FOR INSERT WITH CHECK (is_custom = TRUE AND created_by_parent_id = auth.uid());

CREATE POLICY "activity_sets_custom_update" ON public.activity_sets
  FOR UPDATE USING (is_custom = TRUE AND created_by_parent_id = auth.uid());

CREATE POLICY "activity_sets_custom_delete" ON public.activity_sets
  FOR DELETE USING (is_custom = TRUE AND created_by_parent_id = auth.uid());

-- ============================================================
-- STEPS — readable by all authenticated users (steps are not sensitive)
-- Custom step modification requires parent ownership of parent set
-- ============================================================
CREATE POLICY "steps_read_all" ON public.steps
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "steps_write_custom" ON public.steps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.activity_sets
      WHERE set_id = steps.set_id
      AND is_custom = TRUE
      AND created_by_parent_id = auth.uid()
    )
  );

-- ============================================================
-- DAY SCHEDULES
-- Parents can CRUD schedules for their children.
-- Children can read their own schedules (published only).
-- ============================================================
CREATE POLICY "day_schedules_parent_all" ON public.day_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = day_schedules.child_id
      AND parent_id = auth.uid()
    )
  );

CREATE POLICY "day_schedules_child_read" ON public.day_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = day_schedules.child_id
      AND user_id = auth.uid()
    )
    AND is_published = TRUE
  );

-- ============================================================
-- SCHEDULED SETS
-- Parents: full access for their children's schedules.
-- Children: read + status update (IN_PROGRESS, AWAITING_APPROVAL) only.
-- ============================================================
CREATE POLICY "scheduled_sets_parent_all" ON public.scheduled_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.day_schedules ds
      JOIN public.child_profiles cp ON cp.profile_id = ds.child_id
      WHERE ds.schedule_id = scheduled_sets.schedule_id
      AND cp.parent_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_sets_child_read" ON public.scheduled_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.day_schedules ds
      JOIN public.child_profiles cp ON cp.profile_id = ds.child_id
      WHERE ds.schedule_id = scheduled_sets.schedule_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "scheduled_sets_child_update_status" ON public.scheduled_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.day_schedules ds
      JOIN public.child_profiles cp ON cp.profile_id = ds.child_id
      WHERE ds.schedule_id = scheduled_sets.schedule_id
      AND cp.user_id = auth.uid()
    )
  );

-- ============================================================
-- COMPLETIONS
-- Parents: full access for their children.
-- Children: insert + read their own.
-- ============================================================
CREATE POLICY "completions_parent_all" ON public.completions
  FOR ALL USING (public.is_parent_of(child_id));

CREATE POLICY "completions_child_insert" ON public.completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = completions.child_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "completions_child_read" ON public.completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = completions.child_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================
-- STEP COMPLETIONS
-- Parents: read their children's step completions.
-- Children: insert + read their own.
-- ============================================================
CREATE POLICY "step_completions_parent_read" ON public.step_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.completions c
      WHERE c.completion_id = step_completions.completion_id
      AND public.is_parent_of(c.child_id)
    )
  );

CREATE POLICY "step_completions_child_all" ON public.step_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.completions c
      JOIN public.child_profiles cp ON cp.profile_id = c.child_id
      WHERE c.completion_id = step_completions.completion_id
      AND cp.user_id = auth.uid()
    )
  );

-- ============================================================
-- REWARDS — readable by all authenticated users
-- ============================================================
CREATE POLICY "rewards_read_all" ON public.rewards
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- CHILD REWARDS
-- Parents: read their children's rewards.
-- Children: read own rewards. Insert via Edge Function only.
-- ============================================================
CREATE POLICY "child_rewards_parent_read" ON public.child_rewards
  FOR SELECT USING (public.is_parent_of(child_id));

CREATE POLICY "child_rewards_child_read" ON public.child_rewards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = child_rewards.child_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================
-- LOCKOUT EVENTS
-- Parents: full access for their children.
-- Children: read only.
-- ============================================================
CREATE POLICY "lockout_events_parent_all" ON public.lockout_events
  FOR ALL USING (public.is_parent_of(child_id));

CREATE POLICY "lockout_events_child_read" ON public.lockout_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles
      WHERE profile_id = lockout_events.child_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS — each user sees only their own
-- ============================================================
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (recipient_user_id = auth.uid());
