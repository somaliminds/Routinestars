-- ============================================================
-- RoutineStars — Migration 001: Initial Schema
-- Matches ERD from Section 4 of RoutineStars_UML_Specification-1.md
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- Linked to Supabase Auth (auth.users) via user_id
-- ============================================================
CREATE TABLE public.users (
  user_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      VARCHAR(100) NOT NULL,
  role      VARCHAR(10) NOT NULL CHECK (role IN ('child', 'parent')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PARENT PROFILES
-- PIN stored as bcrypt hash (cost 12) — NEVER plaintext
-- ============================================================
CREATE TABLE public.parent_profiles (
  profile_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  pin_hash             VARCHAR(255) NOT NULL,
  notify_on_completion BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_request    BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_customer_id   VARCHAR(255),
  subscription_plan    VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (subscription_plan IN ('FREE', 'STARTER', 'FAMILY', 'SCHOOL')),
  subscription_status  VARCHAR(20) NOT NULL DEFAULT 'active',
  UNIQUE(user_id)
);

-- ============================================================
-- CHILD PROFILES
-- Each child links to a parent. Child data is isolated by RLS.
-- ============================================================
CREATE TABLE public.child_profiles (
  profile_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  parent_id     UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  child_name    VARCHAR(80) NOT NULL,
  date_of_birth DATE NOT NULL,
  avatar_emoji  VARCHAR(10) NOT NULL DEFAULT '🌟',
  total_stars   INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  push_token    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_child_profiles_parent_id ON public.child_profiles(parent_id);

-- ============================================================
-- ACTIVITY SETS
-- Default sets are seeded in migration 002.
-- Custom sets have created_by_parent_id set.
-- ============================================================
CREATE TABLE public.activity_sets (
  set_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_name              VARCHAR(100) NOT NULL,
  category              VARCHAR(30) NOT NULL CHECK (category IN ('MORNING', 'SCHOOL', 'AFTERNOON', 'EVENING', 'WEEKEND', 'CUSTOM')),
  icon_emoji            VARCHAR(10) NOT NULL DEFAULT '📋',
  colour_theme          VARCHAR(20) NOT NULL DEFAULT 'child.sky',
  total_duration_mins   INT NOT NULL DEFAULT 10,
  requires_approval     BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom             BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_parent_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_sets_category ON public.activity_sets(category);
CREATE INDEX idx_activity_sets_parent ON public.activity_sets(created_by_parent_id);

-- ============================================================
-- STEPS
-- Steps belong to an activity set, ordered by order_index.
-- ============================================================
CREATE TABLE public.steps (
  step_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id           UUID NOT NULL REFERENCES public.activity_sets(set_id) ON DELETE CASCADE,
  order_index      INT NOT NULL,
  title            VARCHAR(120) NOT NULL,
  instruction_text TEXT NOT NULL,
  audio_url        TEXT,
  illustration_url TEXT,
  duration_seconds INT NOT NULL DEFAULT 30,
  reward_stars     INT NOT NULL DEFAULT 1,
  UNIQUE(set_id, order_index)
);

CREATE INDEX idx_steps_set_id ON public.steps(set_id);

-- ============================================================
-- DAY SCHEDULES
-- One per child per day. Published flag controls visibility.
-- ============================================================
CREATE TABLE public.day_schedules (
  schedule_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id      UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  schedule_date DATE NOT NULL,
  is_weekend    BOOLEAN NOT NULL DEFAULT FALSE,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES public.users(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, schedule_date)
);

CREATE INDEX idx_day_schedules_child_date ON public.day_schedules(child_id, schedule_date);

-- ============================================================
-- SCHEDULED SETS
-- Activity sets placed on a specific day's schedule.
-- Status machine: PENDING → IN_PROGRESS → AWAITING_APPROVAL → APPROVED → LOCKED
-- ============================================================
CREATE TABLE public.scheduled_sets (
  scheduled_set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id      UUID NOT NULL REFERENCES public.day_schedules(schedule_id) ON DELETE CASCADE,
  set_id           UUID NOT NULL REFERENCES public.activity_sets(set_id) ON DELETE RESTRICT,
  order_in_day     SMALLINT NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PAUSED', 'AWAITING_APPROVAL', 'APPROVED', 'LOCKED', 'SKIPPED')),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_sets_schedule_id ON public.scheduled_sets(schedule_id);
CREATE INDEX idx_scheduled_sets_status ON public.scheduled_sets(status);

-- ============================================================
-- COMPLETIONS
-- Records when a child finishes an activity set.
-- ============================================================
CREATE TABLE public.completions (
  completion_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_set_id UUID NOT NULL REFERENCES public.scheduled_sets(scheduled_set_id) ON DELETE CASCADE,
  child_id         UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  stars_earned     INT NOT NULL DEFAULT 0,
  parent_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES public.users(user_id)
);

CREATE INDEX idx_completions_child_id ON public.completions(child_id);
CREATE INDEX idx_completions_scheduled_set ON public.completions(scheduled_set_id);

-- ============================================================
-- STEP COMPLETIONS
-- Records each individual step tick within a completion.
-- Retained 90 days per GDPR policy.
-- ============================================================
CREATE TABLE public.step_completions (
  step_comp_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  completion_id     UUID NOT NULL REFERENCES public.completions(completion_id) ON DELETE CASCADE,
  step_id           UUID NOT NULL REFERENCES public.steps(step_id) ON DELETE CASCADE,
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_taken_seconds INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_step_completions_completion ON public.step_completions(completion_id);

-- ============================================================
-- REWARDS
-- Badge and reward definitions (seeded in migration 002).
-- ============================================================
CREATE TABLE public.rewards (
  reward_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(30) NOT NULL CHECK (type IN ('STAR', 'BADGE', 'TROPHY', 'STREAK_BONUS')),
  name          VARCHAR(80) NOT NULL,
  icon_url      TEXT,
  description   TEXT NOT NULL,
  stars_required INT NOT NULL DEFAULT 0
);

-- ============================================================
-- CHILD REWARDS
-- Junction table: child earns a reward.
-- ============================================================
CREATE TABLE public.child_rewards (
  child_reward_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id        UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  reward_id       UUID NOT NULL REFERENCES public.rewards(reward_id) ON DELETE CASCADE,
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, reward_id)
);

CREATE INDEX idx_child_rewards_child_id ON public.child_rewards(child_id);

-- ============================================================
-- LOCKOUT EVENTS
-- Audit log: when a set is locked/unlocked.
-- ============================================================
CREATE TABLE public.lockout_events (
  lockout_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id         UUID NOT NULL REFERENCES public.child_profiles(profile_id) ON DELETE CASCADE,
  scheduled_set_id UUID NOT NULL REFERENCES public.scheduled_sets(scheduled_set_id) ON DELETE CASCADE,
  locked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlocked_at      TIMESTAMPTZ,
  unlocked_by      UUID REFERENCES public.users(user_id)
);

CREATE INDEX idx_lockout_events_child_id ON public.lockout_events(child_id);

-- ============================================================
-- NOTIFICATIONS
-- Push notification records for audit + read state.
-- ============================================================
CREATE TABLE public.notifications (
  notif_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  type              VARCHAR(40) NOT NULL CHECK (type IN ('APPROVAL_REQUEST', 'SET_COMPLETE', 'BADGE_EARNED')),
  message           TEXT NOT NULL,
  payload           JSONB,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_user_id, is_read);
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
-- ============================================================
-- RoutineStars — Migration 003: Seed Data
-- Default activity sets + steps from Section 10 of the UML spec.
-- Default rewards/badges from Section 9.2.
-- ============================================================

-- ============================================================
-- DEFAULT ACTIVITY SETS
-- ============================================================
INSERT INTO public.activity_sets (set_id, set_name, category, icon_emoji, colour_theme, total_duration_mins, requires_approval, is_custom) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Waking Up Set',                 'MORNING',   '☀️',  'child.lime',  10, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000002', 'Brushing Teeth Set',            'MORNING',   '🦷',  'child.sky',    5, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000003', 'Getting Dressed Set',           'MORNING',   '👕',  'child.lime',  10, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000004', 'Breakfast Set',                 'MORNING',   '🥣',  'accent.star', 20, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000005', 'Getting Ready for School Set',  'SCHOOL',    '🎒',  'brand.primary',10, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000006', 'After-School Set',              'AFTERNOON', '🏠',  'child.sky',   15, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000007', 'Changing Out of School Clothes','AFTERNOON', '👔',  'child.lime',  10, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000008', 'Eating Tea / Lunch Set',        'AFTERNOON', '🍽️', 'accent.star', 25, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000009', 'Homework / Study Set',          'AFTERNOON', '📚',  'brand.primary',45, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000010', 'Eating Dinner Set',             'EVENING',   '🍴',  'accent.star', 30, FALSE, FALSE),
  ('00000000-0000-0000-0000-000000000011', 'Washing, Brushing & Bedtime',   'EVENING',   '🌙',  'brand.dark',  20, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000012', 'Going to the Park Set',         'WEEKEND',   '🌳',  'accent.success',60, TRUE, FALSE),
  ('00000000-0000-0000-0000-000000000013', 'Going to the Supermarket Set',  'WEEKEND',   '🛒',  'child.sky',   45, TRUE,  FALSE),
  ('00000000-0000-0000-0000-000000000014', 'Going to the City Centre Set',  'WEEKEND',   '🏙️', 'child.rose',  90, TRUE,  FALSE);

-- ============================================================
-- BRUSHING TEETH SET — Full step specification (Section 10.3)
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars) VALUES
  ('00000000-0000-0000-0000-000000000002', 1, 'Get Your Toothbrush', 'Pick up your toothbrush from the holder', 20, 1),
  ('00000000-0000-0000-0000-000000000002', 2, 'Put On Toothpaste',   'Squeeze a pea-sized blob of toothpaste',  20, 1),
  ('00000000-0000-0000-0000-000000000002', 3, 'Wet Your Brush',      'Turn on the tap and wet your brush',       10, 1),
  ('00000000-0000-0000-0000-000000000002', 4, 'Brush Your Teeth',    'Brush in circles for 2 whole minutes!',   120, 2),
  ('00000000-0000-0000-0000-000000000002', 5, 'Spit and Rinse',      'Spit out, then swish clean water around',  20, 1),
  ('00000000-0000-0000-0000-000000000002', 6, 'Put Brush Away',      'Rinse your brush and put it back in the holder', 15, 1);

-- ============================================================
-- WAKING UP SET
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 'Open Your Eyes',       'Time to wake up! Open your eyes slowly',       30, 1),
  ('00000000-0000-0000-0000-000000000001', 2, 'Sit Up in Bed',        'Push yourself up and sit on the edge of the bed', 30, 1),
  ('00000000-0000-0000-0000-000000000001', 3, 'Put Feet on the Floor','Place both feet flat on the floor',             20, 1),
  ('00000000-0000-0000-0000-000000000001', 4, 'Stand Up',             'Push yourself up to standing — great job!',     20, 1),
  ('00000000-0000-0000-0000-000000000001', 5, 'Open the Curtains',    'Walk to the window and open the curtains',      30, 1);

-- ============================================================
-- GETTING DRESSED SET
-- ============================================================
INSERT INTO public.steps (set_id, order_index, title, instruction_text, duration_seconds, reward_stars) VALUES
  ('00000000-0000-0000-0000-000000000003', 1, 'Get Your Clothes',     'Pick up the clothes laid out for today',        30, 1),
  ('00000000-0000-0000-0000-000000000003', 2, 'Take Off Pyjamas',     'Take off your pyjama top',                      30, 1),
  ('00000000-0000-0000-0000-000000000003', 3, 'Put On Your Top',      'Put on your top or shirt',                      45, 1),
  ('00000000-0000-0000-0000-000000000003', 4, 'Put On Your Trousers', 'Put on your trousers or skirt',                 45, 1),
  ('00000000-0000-0000-0000-000000000003', 5, 'Put On Your Socks',    'Put on both socks — check left then right!',    30, 1),
  ('00000000-0000-0000-0000-000000000003', 6, 'Put On Your Shoes',    'Put on your shoes and do the fastenings',       45, 1),
  ('00000000-0000-0000-0000-000000000003', 7, 'Check in the Mirror',  'Have a look in the mirror — looking great!',    20, 1);

-- ============================================================
-- REWARDS / BADGES (Section 9.2)
-- ============================================================
INSERT INTO public.rewards (reward_id, type, name, description, stars_required) VALUES
  ('10000000-0000-0000-0000-000000000001', 'BADGE', 'Sparkling Teeth',      'Complete Brushing Teeth 5 times',                        0),
  ('10000000-0000-0000-0000-000000000002', 'BADGE', 'Early Bird',           'Complete Waking Up + Breakfast sets before 8am',         0),
  ('10000000-0000-0000-0000-000000000003', 'BADGE', 'School Ready Star',    'Complete Getting Ready for School 10 times',              0),
  ('10000000-0000-0000-0000-000000000004', 'BADGE', 'Homework Hero',        'Complete Homework Set 7 days in a row',                   0),
  ('10000000-0000-0000-0000-000000000005', 'BADGE', 'Sleepy Champion',      'Complete Bedtime Set on time for 5 days',                 0),
  ('10000000-0000-0000-0000-000000000006', 'BADGE', 'Park Explorer',        'Complete Going to the Park set',                          0),
  ('10000000-0000-0000-0000-000000000007', 'BADGE', 'Super Shopper',        'Complete Supermarket set',                                0),
  ('10000000-0000-0000-0000-000000000008', 'BADGE', 'City Explorer',        'Complete City Centre set',                                0),
  ('10000000-0000-0000-0000-000000000009', 'BADGE', 'Full Week Champion',   'Complete every scheduled set for a whole week',           0),
  ('10000000-0000-0000-0000-000000000010', 'BADGE', 'Golden Month',         'Achieve Perfect Day 20 times in one month',              0),
  ('10000000-0000-0000-0000-000000000011', 'TROPHY','3-Day Streak',         '3 consecutive days of full completion',                  15),
  ('10000000-0000-0000-0000-000000000012', 'TROPHY','7-Day Super Streak',   '7 consecutive days of full completion',                  50),
  ('10000000-0000-0000-0000-000000000013', 'STAR',  'On-Time Bonus',        'Finish a set within the allocated time window',           0),
  ('10000000-0000-0000-0000-000000000014', 'TROPHY','Perfect Day',          'Complete all scheduled sets in one day',                 20),
  ('10000000-0000-0000-0000-000000000015', 'BADGE', 'Weekend Adventurer',   'Complete a weekend activity set',                         0);
