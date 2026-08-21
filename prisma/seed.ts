import {
  PrismaClient,
  Role,
  SubscriptionPlan,
  ActivationCodeStatus,
  CategoryType,
  DietaryType,
  MenuItemStatus,
  SpiceLevel,
  InventoryItemType,
  InventoryUnit,
  InventoryMode,
  InventoryTransactionType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const RESTAURANT = {
  name: "Kitchen Diaries Demo Restaurant",
  email: "demo@kitchendiaries.local",
  phone: "9999999999",
  address: "Kolkata, West Bengal, India",
};

const DEMO_PASSWORD = "Demo@12345";

const USERS = [
  {
    name: "Demo Owner",
    email: "owner@kitchendiaries.local",
    role: Role.OWNER,
  },
  {
    name: "Demo Manager",
    email: "manager@kitchendiaries.local",
    role: Role.MANAGER,
  },
  {
    name: "Demo Cashier",
    email: "cashier@kitchendiaries.local",
    role: Role.CASHIER,
  },
  {
    name: "Demo Steward",
    email: "steward@kitchendiaries.local",
    role: Role.STEWARD,
  },
  {
    name: "Demo Kitchen",
    email: "kitchen@kitchendiaries.local",
    role: Role.KITCHEN,
  },
  {
    name: "Demo Store Keeper",
    email: "store@kitchendiaries.local",
    role: Role.STORE_KEEPER,
  },
] as const;

const DEMO_CODES = [
  { code: "KD-DEMO-PRO-12M", plan: SubscriptionPlan.PRO, durationMonths: 12, priceAmount: 7999 },
  { code: "KD-DEMO-BASIC-12M", plan: SubscriptionPlan.BASIC, durationMonths: 12, priceAmount: 4999 },
] as const;

async function main() {
  console.log("");
  console.log("======================================");
  console.log("KITCHEN DIARIES FRESH DEMO SEED");
  console.log("======================================");
  console.log("");

  /*
   * --------------------------------------------------
   * 1. CLEAN DATABASE
   * --------------------------------------------------
   *
   * This seed is intended to run after:
   *
   *   npx prisma db push --force-reset
   *
   * Therefore we do not perform a dangerous global
   * delete here.
   */

  /*
   * --------------------------------------------------
   * 2. RESTAURANT
   * --------------------------------------------------
   */

  const restaurant = await prisma.restaurant.create({
    data: {
      name: RESTAURANT.name,
      email: RESTAURANT.email,
      phone: RESTAURANT.phone,
      address: RESTAURANT.address,

      currency: "INR",
      timezone: "Asia/Kolkata",

      businessDayStartHour: 4,
      defaultTaxRate: 5,

      orderPrefix: "ORD",
      billPrefix: "BILL",
      receiptPrefix: "RCPT",

      isActive: true,
    },
  });

  console.log(`✓ Restaurant: ${restaurant.name}`);

  /*
   * --------------------------------------------------
   * 3. USERS
   * --------------------------------------------------
   */

  const password = await bcrypt.hash(
    DEMO_PASSWORD,
    12,
  );

  const users = new Map<Role, string>();

  for (const user of USERS) {
    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password,
        role: user.role,
        isActive: true,
        restaurantId: restaurant.id,
      },
    });

    users.set(user.role, created.id);

    console.log(
      `✓ ${user.role}: ${user.email}`,
    );
  }

  /*
   * --------------------------------------------------
   * 4. CATEGORIES
   * --------------------------------------------------
   */

  const categories = [
    {
      name: "Starters",
      slug: "starters",
      type: CategoryType.STARTER,
      dietaryType: DietaryType.VEG,
    },
    {
      name: "Main Course",
      slug: "main-course",
      type: CategoryType.MAIN_COURSE,
      dietaryType: DietaryType.NON_VEG,
    },
    {
      name: "Rice & Noodles",
      slug: "rice-noodles",
      type: CategoryType.FOOD,
      dietaryType: DietaryType.VEG,
    },
    {
      name: "Breads",
      slug: "breads",
      type: CategoryType.FOOD,
      dietaryType: DietaryType.VEG,
    },
    {
      name: "Desserts",
      slug: "desserts",
      type: CategoryType.DESSERT,
      dietaryType: DietaryType.VEG,
    },
    {
      name: "Beverages",
      slug: "beverages",
      type: CategoryType.BEVERAGE,
      dietaryType: DietaryType.VEG,
    },
  ];

  const categoryMap = new Map<string, string>();

  for (const category of categories) {
    const created = await prisma.category.create({
      data: {
        ...category,
        restaurantId: restaurant.id,
        isActive: true,
      },
    });

    categoryMap.set(
      category.slug,
      created.id,
    );
  }

  console.log(
    `✓ Categories: ${categories.length}`,
  );

  /*
   * --------------------------------------------------
   * 5. MENU ITEMS
   * --------------------------------------------------
   */

  const menuItems = [
    {
      name: "Paneer Tikka",
      slug: "paneer-tikka",
      shortCode: "PT",
      price: 249,
      costPrice: 90,
      category: "starters",
      dietaryType: DietaryType.VEG,
      spiceLevel: SpiceLevel.MEDIUM,
    },
    {
      name: "Butter Chicken",
      slug: "butter-chicken",
      shortCode: "BC",
      price: 329,
      costPrice: 135,
      category: "main-course",
      dietaryType: DietaryType.NON_VEG,
      spiceLevel: SpiceLevel.MEDIUM,
    },
    {
      name: "Veg Hakka Noodles",
      slug: "veg-hakka-noodles",
      shortCode: "VHN",
      price: 229,
      costPrice: 75,
      category: "rice-noodles",
      dietaryType: DietaryType.VEG,
      spiceLevel: SpiceLevel.MEDIUM,
    },
    {
      name: "Garlic Naan",
      slug: "garlic-naan",
      shortCode: "GN",
      price: 69,
      costPrice: 20,
      category: "breads",
      dietaryType: DietaryType.VEG,
      spiceLevel: SpiceLevel.NONE,
    },
    {
      name: "Gulab Jamun",
      slug: "gulab-jamun",
      shortCode: "GJ",
      price: 129,
      costPrice: 30,
      category: "desserts",
      dietaryType: DietaryType.VEG,
      spiceLevel: SpiceLevel.NONE,
    },
    {
      name: "Mango Lassi",
      slug: "mango-lassi",
      shortCode: "ML",
      price: 149,
      costPrice: 45,
      category: "beverages",
      dietaryType: DietaryType.VEG,
      spiceLevel: SpiceLevel.NONE,
    },
    {
      name: "Masala Chai",
      slug: "masala-chai",
      shortCode: "MC",
      price: 59,
      costPrice: 15,
      category: "beverages",
      dietaryType: DietaryType.VEG,
      spiceLevel: SpiceLevel.NONE,
    },
    {
      name: "Fresh Lime Soda",
      slug: "fresh-lime-soda",
      shortCode: "FLS",
      price: 109,
      costPrice: 25,
      category: "beverages",
      dietaryType: DietaryType.VEGAN,
      spiceLevel: SpiceLevel.NONE,
    },
  ];

  const menuMap = new Map<string, string>();

  for (const item of menuItems) {
    const categoryId =
      categoryMap.get(item.category);

    if (!categoryId) {
      throw new Error(
        `Missing category: ${item.category}`,
      );
    }

    const created =
      await prisma.menuItem.create({
        data: {
          name: item.name,
          slug: item.slug,
          shortCode: item.shortCode,

          price: item.price,
          costPrice: item.costPrice,

          categoryId,
          restaurantId: restaurant.id,

          dietaryType: item.dietaryType,
          spiceLevel: item.spiceLevel,

          status: MenuItemStatus.AVAILABLE,

          taxRate: 5,

          preparationTime: 10,

          isFeatured: true,
          isRecommended: true,

          inventoryMode:
            InventoryMode.NONE,

          isActive: true,
        },
      });

    menuMap.set(
      item.slug,
      created.id,
    );
  }

  console.log(
    `✓ Menu items: ${menuItems.length}`,
  );

  /*
   * --------------------------------------------------
   * 6. ADDONS
   * --------------------------------------------------
   */

  const addons = [
    {
      name: "Extra Cheese",
      price: 40,
    },
    {
      name: "Butter Topping",
      price: 25,
    },
    {
      name: "Extra Gravy",
      price: 30,
    },
    {
      name: "Extra Paneer",
      price: 60,
    },
    {
      name: "Ice Cream Scoop",
      price: 50,
    },
  ];

  for (let index = 0; index < addons.length; index++) {
    await prisma.addon.create({
      data: {
        name: addons[index].name,
        price: addons[index].price,
        sortOrder: index,
        restaurantId: restaurant.id,
        isActive: true,
      },
    });
  }

  console.log(
    `✓ Addons: ${addons.length}`,
  );

  /*
   * --------------------------------------------------
   * 7. INVENTORY CATEGORIES
   * --------------------------------------------------
   */

  const inventoryCategories = [
    "Vegetables",
    "Dairy",
    "Meat",
    "Grains",
    "Beverages",
    "Packaging",
  ];

  const inventoryCategoryMap =
    new Map<string, string>();

  for (const name of inventoryCategories) {
  const slug = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "-");

  const created =
    await prisma.inventoryCategory.create({
      data: {
        name,
        slug,
        restaurantId: restaurant.id,
        isActive: true,
      },
    });

  inventoryCategoryMap.set(
    name,
    created.id,
  );
}

  console.log(
    `✓ Inventory categories: ${inventoryCategories.length}`,
  );

  /*
   * --------------------------------------------------
   * 8. INVENTORY ITEMS
   * --------------------------------------------------
   */

  const inventoryItems = [
    {
      name: "Paneer",
      code: "RM-PANEER",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 20,
      cost: 320,
      category: "Dairy",
    },
    {
      name: "Chicken",
      code: "RM-CHICKEN",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 30,
      cost: 260,
      category: "Meat",
    },
    {
      name: "Milk",
      code: "RM-MILK",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.LITRE,
      stock: 50,
      cost: 65,
      category: "Dairy",
    },
    {
      name: "Noodles",
      code: "RM-NOODLES",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 20,
      cost: 110,
      category: "Grains",
    },
    {
      name: "Flour",
      code: "RM-FLOUR",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 50,
      cost: 55,
      category: "Grains",
    },
    {
      name: "Tea",
      code: "RM-TEA",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 5,
      cost: 420,
      category: "Beverages",
    },
    {
      name: "Mango Pulp",
      code: "RM-MANGO",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 15,
      cost: 180,
      category: "Beverages",
    },
    {
      name: "Cooking Oil",
      code: "RM-OIL",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.LITRE,
      stock: 30,
      cost: 145,
      category: "Vegetables",
    },
    {
      name: "Fresh Lime",
      code: "RM-LIME",
      type: InventoryItemType.RAW_MATERIAL,
      unit: InventoryUnit.KILOGRAM,
      stock: 10,
      cost: 120,
      category: "Vegetables",
    },
  ];

  for (const item of inventoryItems) {
   await prisma.inventoryItem.create({
  data: {
    name: item.name,
    code: item.code,

    type: item.type,
    unit: item.unit,

    currentStock: 0,
    averageCost: item.cost,

    minimumStock: 5,
    reorderLevel: 5,

    categoryId:
      inventoryCategoryMap.get(
        item.category,
      ),

    restaurantId: restaurant.id,

    isActive: true,
  },
});
  }

  console.log(
    `✓ Inventory items: ${inventoryItems.length}`,
  );

  /*
   * --------------------------------------------------
   * 9. OPENING STOCK LEDGER
   * --------------------------------------------------
   */

  const seededInventory = await prisma.inventoryItem.findMany({
    where: { restaurantId: restaurant.id },
  });

  for (const item of seededInventory) {
    const source = inventoryItems.find((entry) => entry.code === item.code);
    if (!source) continue;

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { currentStock: source.stock },
    });

    await prisma.inventoryTransaction.create({
      data: {
        transactionNumber: `OPEN-${source.code}-${restaurant.id.slice(-8)}`,
        idempotencyKey: `seed-opening-${source.code}`,
        type: InventoryTransactionType.OPENING_STOCK,
        quantityChange: source.stock,
        stockBefore: 0,
        stockAfter: source.stock,
        unit: source.unit,
        unitCost: source.cost,
        totalCost: source.stock * source.cost,
        reason: "Initial desktop seed stock",
        referenceType: "SEED",
        businessDate: new Date(),
        inventoryItemId: item.id,
        restaurantId: restaurant.id,
        createdById: users.get(Role.OWNER)!,
      },
    });
  }

  console.log(
    `✓ Opening stock transactions: ${seededInventory.length}`,
  );

  /*
   * --------------------------------------------------
   * 10. RECIPES
   * --------------------------------------------------
   */

  const inventoryByCode = new Map(
    seededInventory.map((item) => [item.code, item]),
  );

  const recipeDefinitions = [
    {
      menu: "paneer-tikka",
      items: [
        ["RM-PANEER", 0.15, InventoryUnit.KILOGRAM],
        ["RM-OIL", 0.02, InventoryUnit.LITRE],
      ],
    },
    {
      menu: "butter-chicken",
      items: [
        ["RM-CHICKEN", 0.25, InventoryUnit.KILOGRAM],
        ["RM-MILK", 0.05, InventoryUnit.LITRE],
        ["RM-OIL", 0.02, InventoryUnit.LITRE],
      ],
    },
    {
      menu: "veg-hakka-noodles",
      items: [
        ["RM-NOODLES", 0.15, InventoryUnit.KILOGRAM],
        ["RM-OIL", 0.02, InventoryUnit.LITRE],
      ],
    },
    {
      menu: "garlic-naan",
      items: [
        ["RM-FLOUR", 0.12, InventoryUnit.KILOGRAM],
        ["RM-OIL", 0.01, InventoryUnit.LITRE],
      ],
    },
    {
      menu: "mango-lassi",
      items: [
        ["RM-MILK", 0.2, InventoryUnit.LITRE],
        ["RM-MANGO", 0.1, InventoryUnit.KILOGRAM],
      ],
    },
    {
      menu: "masala-chai",
      items: [
        ["RM-MILK", 0.15, InventoryUnit.LITRE],
        ["RM-TEA", 0.005, InventoryUnit.KILOGRAM],
      ],
    },
    {
      menu: "fresh-lime-soda",
      items: [
        ["RM-LIME", 0.05, InventoryUnit.KILOGRAM],
      ],
    },
  ] as const;

  let recipeCount = 0;

  for (const definition of recipeDefinitions) {
    const menuItemId = menuMap.get(definition.menu);
    if (!menuItemId) continue;

    const recipe = await prisma.recipe.create({
      data: {
        name: `${definition.menu.replaceAll("-", " ")} recipe`,
        menuItemId,
        restaurantId: restaurant.id,
        isActive: true,
      },
    });

    for (let index = 0; index < definition.items.length; index += 1) {
      const [code, quantity, unit] = definition.items[index];
      const inventoryItem = inventoryByCode.get(code);
      if (!inventoryItem) continue;

      await prisma.recipeItem.create({
        data: {
          recipeId: recipe.id,
          inventoryItemId: inventoryItem.id,
          quantity,
          unit,
          sortOrder: index,
        },
      });
    }

    recipeCount += 1;
  }

  console.log(`✓ Recipes: ${recipeCount}`);

  /*
   * --------------------------------------------------
   * 11. CUSTOMERS
   * --------------------------------------------------
   */

  const customers = [
    {
      name: "Rahul Sharma",
      phone: "9000000001",
      email: "rahul.demo@example.com",
    },
    {
      name: "Priya Das",
      phone: "9000000002",
      email: "priya.demo@example.com",
    },
    {
      name: "Amit Roy",
      phone: "9000000003",
      email: "amit.demo@example.com",
    },
    {
      name: "Sneha Sen",
      phone: "9000000004",
      email: "sneha.demo@example.com",
    },
  ];


  console.log(
    `✓ Customers: ${customers.length}`,
  );

  /*
   * --------------------------------------------------
   * 12. DEMO LICENSES
   * --------------------------------------------------
   *
   * Both demo tenants start without a bound device. The
   * first successful login validates the code and binds the
   * current browser/device key atomically. Demo licenses allow
   * up to 10 active devices.
   */

  for (const demoCode of DEMO_CODES.slice(0, 1)) {
    const codeHash = crypto
      .createHash("sha256")
      .update(demoCode.code.trim().toUpperCase(), "utf8")
      .digest("hex");

    await prisma.activationCode.create({
      data: {
        codeHash,
        status: ActivationCodeStatus.AVAILABLE,
        plan: demoCode.plan,
        durationMonths: demoCode.durationMonths,
        maxDevices: 10,
        priceAmount: demoCode.priceAmount,
        currency: "INR",
        restaurantId: restaurant.id,
      },
    });
  }

  const basicRestaurant = await prisma.restaurant.create({
    data: {
      name: "Kitchen Diaries Basic Demo",
      email: "basic.demo@kitchendiaries.local",
      phone: "9999999998",
      address: "Kolkata, West Bengal, India",
      currency: "INR",
      timezone: "Asia/Kolkata",
      businessDayStartHour: 4,
      defaultTaxRate: 5,
      orderPrefix: "BORD",
      billPrefix: "BBILL",
      receiptPrefix: "BRCPT",
      isActive: true,
    },
  });

  const basicPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
  await prisma.user.create({
    data: {
      name: "Basic Demo Owner",
      email: "basic.owner@kitchendiaries.local",
      password: basicPassword,
      role: Role.OWNER,
      isActive: true,
      restaurantId: basicRestaurant.id,
    },
  });

  const basicCode = DEMO_CODES[1];
  const basicCodeHash = crypto
    .createHash("sha256")
    .update(basicCode.code.trim().toUpperCase(), "utf8")
    .digest("hex");

  await prisma.activationCode.create({
    data: {
      codeHash: basicCodeHash,
      status: ActivationCodeStatus.AVAILABLE,
      plan: basicCode.plan,
      durationMonths: basicCode.durationMonths,
      maxDevices: 10,
      priceAmount: basicCode.priceAmount,
      currency: "INR",
      restaurantId: basicRestaurant.id,
    },
  });

  console.log("✓ Demo licenses: BASIC 12M + PRO 12M");
  /*
   * --------------------------------------------------
   * 13. SUMMARY
   * --------------------------------------------------
   */

  console.log("");
  console.log("======================================");
  console.log("DEMO ENVIRONMENT READY");
  console.log("======================================");
  console.log("");
  console.log("Restaurant:");
  console.log("  Kitchen Diaries Demo Restaurant");
  console.log("");
  console.log("Owner login:");
  console.log("  owner@kitchendiaries.local");
  console.log(`  ${DEMO_PASSWORD}`);
  console.log("");
  console.log("Demo accounts:");
  console.log("  PRO 12M  owner@kitchendiaries.local / Demo@12345 / KD-DEMO-PRO-12M");
  console.log("  BASIC 12M  basic.owner@kitchendiaries.local / Demo@12345 / KD-DEMO-BASIC-12M");
  console.log("");
  console.log("Subscription activation:");
  console.log("  Codes are consumed on first successful device validation.");
  console.log("");
  console.log("Device:");
  console.log("  Created during real activation");
  console.log("  This laptop");
  console.log("");
  console.log("Historical orders:");
  console.log("  0");
  console.log("");
  console.log("Historical bills:");
  console.log("  0");
  console.log("");
  console.log("======================================");
}

main()
  .catch((error) => {
    console.error("");
    console.error("❌ DEMO SEED FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });