-- AlterTable
ALTER TABLE "SyncOperation" ADD COLUMN     "baseVersion" INTEGER,
ADD COLUMN     "resultVersion" INTEGER;

-- CreateIndex
CREATE INDEX "SyncOperation_restaurantId_entityType_entityId_idx" ON "SyncOperation"("restaurantId", "entityType", "entityId");
