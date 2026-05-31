-- Migration 007: Stripe subscriptions
-- Tracks parent subscription state synced from Stripe webhooks.

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan              TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE','STARTER','FAMILY','SCHOOL')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled','incomplete')),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_customer ON subscriptions (stripe_customer_id);

-- RLS: users can only read their own subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_subscription"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Service role (Edge Functions/webhooks) can write via service role key — no INSERT policy needed for client
