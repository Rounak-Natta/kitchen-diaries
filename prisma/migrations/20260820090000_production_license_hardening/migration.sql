-- Production license hardening: custom plan, license pricing, shared subscription metadata.
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "priceAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

ALTER TABLE "ActivationCode"
  ADD COLUMN IF NOT EXISTS "priceAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

CREATE INDEX IF NOT EXISTS "Subscription_restaurantId_expiresAt_idx"
  ON "Subscription"("restaurantId", "expiresAt");
