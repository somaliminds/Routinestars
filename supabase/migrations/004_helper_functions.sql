-- ============================================================
-- Migration 004: Helper Functions
-- Created: Sprint 2.2
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Atomic star increment to avoid race conditions
CREATE OR REPLACE FUNCTION public.increment_child_stars(
  p_child_id UUID,
  p_stars     INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.child_profiles
  SET total_stars = total_stars + p_stars
  WHERE profile_id = p_child_id;
END;
$$;
