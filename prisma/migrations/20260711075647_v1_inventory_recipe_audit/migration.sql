
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'STEWARD', 'KITCHEN', 'STORE_KEEPER');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('FOOD', 'BEVERAGE', 'DESSERT', 'STARTER', 'MAIN_COURSE', 'SNACK', 'COMBO');

-- CreateEnum
CREATE TYPE "DietaryType" AS ENUM ('VEG', 'NON_VEG', 'EGG', 'VEGAN', 'JAIN');

-- CreateEnum
CREATE TYPE "MenuItemStatus" AS ENUM ('AVAILABLE', 'OUT_OF_STOCK', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SpiceLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'BILLED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('NOT_DEDUCTED', 'DEDUCTED', 'PARTIALLY_RESTORED', 'RESTORED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('RAW_MATERIAL', 'FINISHED_PRODUCT', 'PACKAGING', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('GRAM', 'KILOGRAM', 'MILLILITRE', 'LITRE', 'PIECE', 'PACKET', 'BOX', 'BOTTLE', 'CAN', 'PORTION');

-- CreateEnum
CREATE TYPE "InventoryMode" AS ENUM ('NONE', 'RECIPE', 'DIRECT');

-- CreateEnum
CREATE TYPE "RecipeAdjustmentType" AS ENUM ('ADD', 'REPLACE', 'REMOVE');

-- CreateEnum
CREATE TYPE "RecipeSource" AS ENUM ('BASE_RECIPE', 'VARIATION', 'ADDON', 'DIRECT');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('OPENING_STOCK', 'STOCK_IN', 'STOCK_OUT', 'SALE_CONSUMPTION', 'WASTAGE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RESTORE', 'CUSTOMER_RETURN', 'REVERSAL');

-- CreateEnum
CREATE TYPE "WastageReason" AS ENUM ('EXPIRED', 'SPOILED', 'DAMAGED', 'PREPARATION_LOSS', 'COOKING_LOSS', 'ORDER_CANCELLED', 'STAFF_MEAL', 'SPILLAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "WastageStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ORDER', 'BILL', 'RECEIPT', 'INVENTORY_TRANSACTION', 'WASTAGE', 'REFUND', 'EXPORT');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('ORDERS', 'BILLS', 'PAYMENTS', 'SALES_REPORT', 'INVENTORY', 'INVENTORY_LEDGER', 'RECIPES', 'WASTAGE', 'AUDIT_LOG', 'FULL_DATA');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "businessDayStartHour" INTEGER NOT NULL DEFAULT 4,
    "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "orderPrefix" TEXT NOT NULL DEFAULT 'ORD',
    "billPrefix" TEXT NOT NULL DEFAULT 'BILL',
    "receiptPrefix" TEXT NOT NULL DEFAULT 'RCPT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STEWARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "CategoryType" NOT NULL,
    "dietaryType" "DietaryType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "shortCode" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "comparePrice" DECIMAL(10,2),
    "costPrice" DECIMAL(10,2),
    "taxRate" DECIMAL(5,2),
    "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false,
    "sku" TEXT,
    "barcode" TEXT,
    "preparationTime" INTEGER,
    "calories" INTEGER,
    "status" "MenuItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "spiceLevel" "SpiceLevel" NOT NULL DEFAULT 'NONE',
    "dietaryType" "DietaryType" NOT NULL,
    "inventoryMode" "InventoryMode" NOT NULL DEFAULT 'NONE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "directInventoryItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VariationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "variationGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VariationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemVariation" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "variationGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemAddon" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "orderType" "OrderType" NOT NULL DEFAULT 'DINE_IN',
    "tableNumber" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "inventoryStatus" "InventoryStatus" NOT NULL DEFAULT 'NOT_DEDUCTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "serviceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deliveryCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "packagingCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "businessDate" DATE,
    "confirmedAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "billedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "inventoryDeductedAt" TIMESTAMP(3),
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemName" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "variationPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "addonPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "variationOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemAddon" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "idempotencyKey" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledById" TEXT,
    "orderType" "OrderType" NOT NULL,
    "tableNumber" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "serviceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deliveryCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "packagingCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "changeReturned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dueAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "businessDate" DATE,
    "paidAt" TIMESTAMP(3),
    "inventoryPostedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "menuItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "categoryName" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "addonPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "variationPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "costAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grossMarginPct" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "variationName" TEXT,
    "addonNames" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItemIngredient" (
    "id" TEXT NOT NULL,
    "billItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "inventoryTransactionId" TEXT,
    "sourceType" "RecipeSource" NOT NULL,
    "sourceName" TEXT,
    "inventoryItemName" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItemIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillPayment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tenderedAmount" DECIMAL(10,2),
    "referenceNo" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillRefund" (
    "id" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceNo" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "type" "InventoryItemType" NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "currentStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "categoryId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "type" "InventoryTransactionType" NOT NULL,
    "quantityChange" DECIMAL(14,3) NOT NULL,
    "stockBefore" DECIMAL(14,3) NOT NULL,
    "stockAfter" DECIMAL(14,3) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "businessDate" DATE,
    "inventoryItemId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "orderId" TEXT,
    "billId" TEXT,
    "billItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "menuItemId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationRecipeItem" (
    "id" TEXT NOT NULL,
    "variationOptionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "adjustmentType" "RecipeAdjustmentType" NOT NULL DEFAULT 'ADD',
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit" "InventoryUnit" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariationRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddonRecipeItem" (
    "id" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddonRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wastage" (
    "id" TEXT NOT NULL,
    "wastageNumber" TEXT NOT NULL,
    "status" "WastageStatus" NOT NULL DEFAULT 'DRAFT',
    "businessDate" DATE,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "restaurantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wastage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WastageItem" (
    "id" TEXT NOT NULL,
    "wastageId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "inventoryTransactionId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "reason" "WastageReason" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WastageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "exportNumber" TEXT NOT NULL,
    "type" "ExportType" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "requestedById" TEXT,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSequence" (
    "id" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "businessDate" DATE NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "restaurantId" TEXT NOT NULL,

    CONSTRAINT "BusinessSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_email_key" ON "Restaurant"("email");

-- CreateIndex
CREATE INDEX "Restaurant_isActive_idx" ON "Restaurant"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_restaurantId_idx" ON "User"("restaurantId");

-- CreateIndex
CREATE INDEX "User_restaurantId_role_idx" ON "User"("restaurantId", "role");

-- CreateIndex
CREATE INDEX "User_restaurantId_isActive_idx" ON "User"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "Category_restaurantId_isActive_idx" ON "Category"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Category_restaurantId_slug_key" ON "Category"("restaurantId", "slug");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_sku_idx" ON "MenuItem"("restaurantId", "sku");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_barcode_idx" ON "MenuItem"("restaurantId", "barcode");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_isActive_idx" ON "MenuItem"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_status_idx" ON "MenuItem"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_directInventoryItemId_idx" ON "MenuItem"("directInventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_restaurantId_slug_key" ON "MenuItem"("restaurantId", "slug");

-- CreateIndex
CREATE INDEX "VariationGroup_restaurantId_isActive_idx" ON "VariationGroup"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VariationGroup_restaurantId_slug_key" ON "VariationGroup"("restaurantId", "slug");

-- CreateIndex
CREATE INDEX "VariationOption_variationGroupId_isActive_idx" ON "VariationOption"("variationGroupId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VariationOption_variationGroupId_name_key" ON "VariationOption"("variationGroupId", "name");

-- CreateIndex
CREATE INDEX "MenuItemVariation_menuItemId_idx" ON "MenuItemVariation"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemVariation_variationGroupId_idx" ON "MenuItemVariation"("variationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemVariation_menuItemId_variationGroupId_key" ON "MenuItemVariation"("menuItemId", "variationGroupId");

-- CreateIndex
CREATE INDEX "Addon_restaurantId_isActive_idx" ON "Addon"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Addon_restaurantId_name_key" ON "Addon"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "MenuItemAddon_menuItemId_idx" ON "MenuItemAddon"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemAddon_addonId_idx" ON "MenuItemAddon"("addonId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemAddon_menuItemId_addonId_key" ON "MenuItemAddon"("menuItemId", "addonId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_restaurantId_businessDate_idx" ON "Order"("restaurantId", "businessDate");

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_createdAt_idx" ON "Order"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_restaurantId_orderType_createdAt_idx" ON "Order"("restaurantId", "orderType", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdById_createdAt_idx" ON "Order"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_idempotencyKey_key" ON "Order"("restaurantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "OrderItem_variationOptionId_idx" ON "OrderItem"("variationOptionId");

-- CreateIndex
CREATE INDEX "OrderItemAddon_orderItemId_idx" ON "OrderItemAddon"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItemAddon_addonId_idx" ON "OrderItemAddon"("addonId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_receiptNumber_key" ON "Bill"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_orderId_key" ON "Bill"("orderId");

-- CreateIndex
CREATE INDEX "Bill_restaurantId_createdAt_idx" ON "Bill"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_restaurantId_businessDate_idx" ON "Bill"("restaurantId", "businessDate");

-- CreateIndex
CREATE INDEX "Bill_restaurantId_paymentStatus_createdAt_idx" ON "Bill"("restaurantId", "paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_restaurantId_status_createdAt_idx" ON "Bill"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_orderId_idx" ON "Bill"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_restaurantId_idempotencyKey_key" ON "Bill"("restaurantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillItem_orderItemId_key" ON "BillItem"("orderItemId");

-- CreateIndex
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");

-- CreateIndex
CREATE INDEX "BillItem_menuItemId_idx" ON "BillItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BillItemIngredient_inventoryTransactionId_key" ON "BillItemIngredient"("inventoryTransactionId");

-- CreateIndex
CREATE INDEX "BillItemIngredient_billItemId_idx" ON "BillItemIngredient"("billItemId");

-- CreateIndex
CREATE INDEX "BillItemIngredient_inventoryItemId_idx" ON "BillItemIngredient"("inventoryItemId");

-- CreateIndex
CREATE INDEX "BillPayment_billId_createdAt_idx" ON "BillPayment"("billId", "createdAt");

-- CreateIndex
CREATE INDEX "BillPayment_method_createdAt_idx" ON "BillPayment"("method", "createdAt");

-- CreateIndex
CREATE INDEX "BillPayment_recordedById_createdAt_idx" ON "BillPayment"("recordedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_billId_idempotencyKey_key" ON "BillPayment"("billId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillRefund_refundNumber_key" ON "BillRefund"("refundNumber");

-- CreateIndex
CREATE INDEX "BillRefund_billId_createdAt_idx" ON "BillRefund"("billId", "createdAt");

-- CreateIndex
CREATE INDEX "BillRefund_createdById_createdAt_idx" ON "BillRefund"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillRefund_billId_idempotencyKey_key" ON "BillRefund"("billId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryCategory_restaurantId_isActive_idx" ON "InventoryCategory"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_restaurantId_slug_key" ON "InventoryCategory"("restaurantId", "slug");

-- CreateIndex
CREATE INDEX "InventoryItem_restaurantId_isActive_idx" ON "InventoryItem"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "InventoryItem_restaurantId_type_idx" ON "InventoryItem"("restaurantId", "type");

-- CreateIndex
CREATE INDEX "InventoryItem_restaurantId_currentStock_idx" ON "InventoryItem"("restaurantId", "currentStock");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_restaurantId_code_key" ON "InventoryItem"("restaurantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_restaurantId_barcode_key" ON "InventoryItem"("restaurantId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_transactionNumber_key" ON "InventoryTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "InventoryTransaction_restaurantId_createdAt_idx" ON "InventoryTransaction"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_restaurantId_businessDate_idx" ON "InventoryTransaction"("restaurantId", "businessDate");

-- CreateIndex
CREATE INDEX "InventoryTransaction_restaurantId_type_createdAt_idx" ON "InventoryTransaction"("restaurantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryItemId_createdAt_idx" ON "InventoryTransaction"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_orderId_idx" ON "InventoryTransaction"("orderId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_billId_idx" ON "InventoryTransaction"("billId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_billItemId_idx" ON "InventoryTransaction"("billItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_restaurantId_idempotencyKey_key" ON "InventoryTransaction"("restaurantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_menuItemId_key" ON "Recipe"("menuItemId");

-- CreateIndex
CREATE INDEX "Recipe_restaurantId_isActive_idx" ON "Recipe"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "RecipeItem_inventoryItemId_idx" ON "RecipeItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_recipeId_inventoryItemId_key" ON "RecipeItem"("recipeId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "VariationRecipeItem_inventoryItemId_idx" ON "VariationRecipeItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "VariationRecipeItem_variationOptionId_inventoryItemId_key" ON "VariationRecipeItem"("variationOptionId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "AddonRecipeItem_inventoryItemId_idx" ON "AddonRecipeItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AddonRecipeItem_addonId_inventoryItemId_key" ON "AddonRecipeItem"("addonId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Wastage_wastageNumber_key" ON "Wastage"("wastageNumber");

-- CreateIndex
CREATE INDEX "Wastage_restaurantId_createdAt_idx" ON "Wastage"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Wastage_restaurantId_businessDate_idx" ON "Wastage"("restaurantId", "businessDate");

-- CreateIndex
CREATE INDEX "Wastage_restaurantId_status_createdAt_idx" ON "Wastage"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WastageItem_inventoryTransactionId_key" ON "WastageItem"("inventoryTransactionId");

-- CreateIndex
CREATE INDEX "WastageItem_wastageId_idx" ON "WastageItem"("wastageId");

-- CreateIndex
CREATE INDEX "WastageItem_inventoryItemId_idx" ON "WastageItem"("inventoryItemId");

-- CreateIndex
CREATE INDEX "WastageItem_reason_idx" ON "WastageItem"("reason");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_createdAt_idx" ON "AuditLog"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_module_createdAt_idx" ON "AuditLog"("restaurantId", "module", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_action_createdAt_idx" ON "AuditLog"("restaurantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DataExport_exportNumber_key" ON "DataExport"("exportNumber");

-- CreateIndex
CREATE INDEX "DataExport_restaurantId_createdAt_idx" ON "DataExport"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExport_restaurantId_status_createdAt_idx" ON "DataExport"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DataExport_requestedById_createdAt_idx" ON "DataExport"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessSequence_restaurantId_businessDate_idx" ON "BusinessSequence"("restaurantId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSequence_restaurantId_documentType_businessDate_key" ON "BusinessSequence"("restaurantId", "documentType", "businessDate");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_directInventoryItemId_fkey" FOREIGN KEY ("directInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationGroup" ADD CONSTRAINT "VariationGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationOption" ADD CONSTRAINT "VariationOption_variationGroupId_fkey" FOREIGN KEY ("variationGroupId") REFERENCES "VariationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemVariation" ADD CONSTRAINT "MenuItemVariation_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemVariation" ADD CONSTRAINT "MenuItemVariation_variationGroupId_fkey" FOREIGN KEY ("variationGroupId") REFERENCES "VariationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemAddon" ADD CONSTRAINT "MenuItemAddon_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemAddon" ADD CONSTRAINT "MenuItemAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variationOptionId_fkey" FOREIGN KEY ("variationOptionId") REFERENCES "VariationOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAddon" ADD CONSTRAINT "OrderItemAddon_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAddon" ADD CONSTRAINT "OrderItemAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemIngredient" ADD CONSTRAINT "BillItemIngredient_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemIngredient" ADD CONSTRAINT "BillItemIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemIngredient" ADD CONSTRAINT "BillItemIngredient_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRefund" ADD CONSTRAINT "BillRefund_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRefund" ADD CONSTRAINT "BillRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationRecipeItem" ADD CONSTRAINT "VariationRecipeItem_variationOptionId_fkey" FOREIGN KEY ("variationOptionId") REFERENCES "VariationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationRecipeItem" ADD CONSTRAINT "VariationRecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddonRecipeItem" ADD CONSTRAINT "AddonRecipeItem_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddonRecipeItem" ADD CONSTRAINT "AddonRecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageItem" ADD CONSTRAINT "WastageItem_wastageId_fkey" FOREIGN KEY ("wastageId") REFERENCES "Wastage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageItem" ADD CONSTRAINT "WastageItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WastageItem" ADD CONSTRAINT "WastageItem_inventoryTransactionId_fkey" FOREIGN KEY ("inventoryTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSequence" ADD CONSTRAINT "BusinessSequence_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
