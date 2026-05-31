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
