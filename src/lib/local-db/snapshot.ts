import type { Table } from "dexie";

import { localDb } from "./db";
import { getLocalSession } from "./session";

interface SnapshotResponse {
  success: boolean;
  data?: {
    restaurant: Record<string, unknown> | null;
    categories: Array<Record<string, unknown>>;
    menuItems: Array<Record<string, unknown>>;
    variations: Array<Record<string, unknown>>;
    variationOptions: Array<Record<string, unknown>>;
    addons: Array<Record<string, unknown>>;
    inventoryCategories: Array<Record<string, unknown>>;
    inventoryItems: Array<Record<string, unknown>>;
    recipes: Array<Record<string, unknown>>;
    recipeItems: Array<Record<string, unknown>>;
  };
}

async function replaceTable(
  table: Table<any, any, any>,
  restaurantId: string,
  rows: unknown[],
): Promise<void> {
  await table
    .where("restaurantId")
    .equals(restaurantId)
    .delete();

  if (rows.length > 0) {
    await table.bulkPut(rows);
  }
}

export async function hydrateSnapshot(): Promise<void> {
  if (
    typeof window === "undefined" ||
    !navigator.onLine
  ) {
    return;
  }

  const session = await getLocalSession();

  if (!session) {
    return;
  }

  const response = await fetch(
    "/api/sync/snapshot",
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Snapshot failed with status ${response.status}.`,
    );
  }

  const body =
    (await response.json()) as SnapshotResponse;

  if (!body.success || !body.data) {
    throw new Error(
      "Invalid sync snapshot.",
    );
  }

  const { data } = body;

  await localDb.transaction(
    "rw",
    [
      localDb.restaurants,
      localDb.categories,
      localDb.menuItems,
      localDb.variations,
      localDb.variationOptions,
      localDb.addons,
      localDb.inventoryCategories,
      localDb.inventoryItems,
      localDb.recipes,
      localDb.recipeItems,
      localDb.syncMetadata,
    ],
    async () => {
      if (data.restaurant) {
        await localDb.restaurants.put(
          data.restaurant as never,
        );
      }

      await replaceTable(
        localDb.categories,
        session.restaurantId,
        data.categories,
      );

      await replaceTable(
        localDb.menuItems,
        session.restaurantId,
        data.menuItems,
      );

      await replaceTable(
        localDb.variations,
        session.restaurantId,
        data.variations,
      );

      await replaceTable(
        localDb.variationOptions,
        session.restaurantId,
        data.variationOptions,
      );

      await replaceTable(
        localDb.addons,
        session.restaurantId,
        data.addons,
      );

      await replaceTable(
        localDb.inventoryCategories,
        session.restaurantId,
        data.inventoryCategories,
      );

      await replaceTable(
        localDb.inventoryItems,
        session.restaurantId,
        data.inventoryItems,
      );

      await replaceTable(
        localDb.recipes,
        session.restaurantId,
        data.recipes,
      );

      await replaceTable(
        localDb.recipeItems,
        session.restaurantId,
        data.recipeItems,
      );

      await localDb.syncMetadata.put({
        key: "lastSnapshotAt",
        value: new Date().toISOString(),
      });
    },
  );
}