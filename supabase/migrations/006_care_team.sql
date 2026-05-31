-- Migration 006: Care team members
-- Allows parents to invite care team members (teachers, therapists, etc.)
-- with view-only or approval roles.

CREATE TABLE IF NOT EXISTS care_team_members (
  member_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  child_id    UUID NOT NULL REFERENCES child_profiles(profile_id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('view_only', 'approver')),
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (parent_id, child_id, email)
);

CREATE INDEX idx_care_team_parent ON care_team_members (parent_id);
CREATE INDEX idx_care_team_child  ON care_team_members (child_id);

-- RLS: parents can only see/manage their own care team rows
ALTER TABLE care_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_manage_care_team"
  ON care_team_members
  FOR ALL
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());
