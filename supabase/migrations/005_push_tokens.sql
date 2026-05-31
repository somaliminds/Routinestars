-- ============================================================
-- Migration 005: Push Notification Token Storage
-- Created: Sprint 2.4
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Add expo_push_token column to parent_profiles
ALTER TABLE public.parent_profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Index for fast lookup when sending notifications
CREATE INDEX IF NOT EXISTS idx_parent_profiles_push_token
  ON public.parent_profiles (expo_push_token)
  WHERE expo_push_token IS NOT NULL;
