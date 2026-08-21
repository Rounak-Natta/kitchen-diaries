-- Store pre-activation restaurant/customer details captured by the control plane.
ALTER TABLE "ActivationCode"
  ADD COLUMN "restaurantName" TEXT,
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "customerPhone" TEXT,
  ADD COLUMN "notes" TEXT;

CREATE INDEX "ActivationCode_customerEmail_idx" ON "ActivationCode"("customerEmail");
