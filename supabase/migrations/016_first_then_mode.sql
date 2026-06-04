-- ============================================================
-- Migration 016 — First-Then mode per child profile.
--
-- Phase 5 / Sprint 1, Feature 1.
--
-- First-Then is the most-used ABA visual support: at any moment the
-- child sees only "First X, Then Y" instead of the full day's list.
-- This reduces overwhelm for children who fixate on items further down
-- the schedule or get anxious about volume.
--
-- Parent toggles per-child in Settings → Child Profile. When ON, the
-- child's home screen renders only the current activity + a muted
-- preview of the next one. When OFF (default), the full list shows
-- as before — no behaviour change for existing users.
-- ============================================================

ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS first_then_mode BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.child_profiles.first_then_mode IS
  'When TRUE, the child home screen shows only the current + next activity '
  'instead of the full day. Reduces visual overwhelm for ASD children. '
  'Toggled per-child by the parent in Settings.';
