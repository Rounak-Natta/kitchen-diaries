-- Kitchen Diaries complete schema hardening
-- Brings the six historical migrations in sync with the current Prisma schema.
-- Safe for a fresh database and additive for an existing database.

-- Subscription plan evolution
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- Sync status evolution
ALTER TYPE "SyncOperationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "SyncOperationStatus" ADD VALUE IF NOT EXISTS 'SYNCING';
ALTER TYPE "SyncOperationStatus" ADD VALUE IF NOT EXISTS 'RETRYING';
ALTER TYPE "SyncOperationStatus" ADD VALUE IF NOT EXISTS 'CONFLICT';

-- Subscription metadata / renewal lifecycle
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "priceAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS "renewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "renewalCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "previousExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "graceUntilAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

ALTER TABLE "Subscription"
  ALTER COLUMN "maxDevices" SET DEFAULT 10;

CREATE INDEX IF NOT EXISTS "Subscription_restaurantId_expiresAt_idx"
  ON "Subscription"("restaurantId", "expiresAt");

-- Device hardening
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "appVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "syncProtocolVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "Device_restaurantId_appVersion_idx"
  ON "Device"("restaurantId", "appVersion");

-- Sync operation hardening
ALTER TABLE "SyncOperation"
  ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "conflictCode" TEXT,
  ADD COLUMN IF NOT EXISTS "conflictPayload" JSONB;

CREATE INDEX IF NOT EXISTS "SyncOperation_restaurantId_updatedAt_id_idx"
  ON "SyncOperation"("restaurantId", "updatedAt", "id");

-- Activation code hardening
ALTER TABLE "ActivationCode"
  ADD COLUMN IF NOT EXISTS "maxDevices" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "priceAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

ALTER TABLE "ActivationCode"
  ALTER COLUMN "maxDevices" SET DEFAULT 10;

-- KOT support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'KOTStatus'
  ) THEN
    CREATE TYPE "KOTStatus" AS ENUM (
      'QUEUED',
      'PREPARING',
      'READY',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "KOT" (
  "id" TEXT NOT NULL,
  "kotNumber" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "tableNumber" TEXT,
  "status" "KOTStatus" NOT NULL DEFAULT 'QUEUED',
  "notes" TEXT,
  "printedAt" TIMESTAMP(3),
  "reprintCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KOT_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KOT_restaurantId_kotNumber_key"
  ON "KOT"("restaurantId", "kotNumber");
CREATE INDEX IF NOT EXISTS "KOT_restaurantId_createdAt_idx"
  ON "KOT"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "KOT_restaurantId_status_idx"
  ON "KOT"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "KOT_orderId_idx"
  ON "KOT"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KOT_orderId_fkey'
  ) THEN
    ALTER TABLE "KOT"
      ADD CONSTRAINT "KOT_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KOT_restaurantId_fkey'
  ) THEN
    ALTER TABLE "KOT"
      ADD CONSTRAINT "KOT_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "KOTItem" (
  "id" TEXT NOT NULL,
  "kotId" TEXT NOT NULL,
  "menuItemId" TEXT,
  "itemName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "variationOptionId" TEXT,
  "addonIds" TEXT[] NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KOTItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KOTItem_kotId_idx"
  ON "KOTItem"("kotId");
CREATE INDEX IF NOT EXISTS "KOTItem_menuItemId_idx"
  ON "KOTItem"("menuItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KOTItem_kotId_fkey'
  ) THEN
    ALTER TABLE "KOTItem"
      ADD CONSTRAINT "KOTItem_kotId_fkey"
      FOREIGN KEY ("kotId") REFERENCES "KOT"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KOTItem_menuItemId_fkey'
  ) THEN
    ALTER TABLE "KOTItem"
      ADD CONSTRAINT "KOTItem_menuItemId_fkey"
      FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KOTItem_variationOptionId_fkey'
  ) THEN
    ALTER TABLE "KOTItem"
      ADD CONSTRAINT "KOTItem_variationOptionId_fkey"
      FOREIGN KEY ("variationOptionId") REFERENCES "VariationOption"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Notification lifecycle hardening
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Notification_restaurantId_userId_severity_createdAt_idx"
  ON "Notification"("restaurantId", "userId", "severity", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_expiresAt_idx"
  ON "Notification"("expiresAt");

-- Control panel shared database table
CREATE TABLE IF NOT EXISTS "ControlAdmin" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ControlAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlAdmin_email_key"
  ON "ControlAdmin"("email");

-- Central event/audit stream used by the control panel.
CREATE TABLE IF NOT EXISTS "SystemEvent" (
  "id" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "source" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "requestId" TEXT,
  "restaurantId" TEXT,
  "deviceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SystemEvent_createdAt_idx"
  ON "SystemEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "SystemEvent_severity_createdAt_idx"
  ON "SystemEvent"("severity", "createdAt");
CREATE INDEX IF NOT EXISTS "SystemEvent_restaurantId_createdAt_idx"
  ON "SystemEvent"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "SystemEvent_deviceId_createdAt_idx"
  ON "SystemEvent"("deviceId", "createdAt");
