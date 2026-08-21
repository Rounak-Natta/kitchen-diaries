"use client";

import type {
  MenuCategoryDto,
  MenuItemDto,
} from "../types";

import { useEffect, useState } from "react";
import { localDb } from "@/lib/local-db/db";
import { hydrateSnapshot } from "@/lib/local-db/snapshot";
import { getLocalSession } from "@/lib/local-db/session";
import { CartSheet } from "./cart-sheet";
import {
  MenuGrid,
} from "./menu-grid";

interface OrderLayoutProps {
  menuItems: MenuItemDto[];
  categories: MenuCategoryDto[];
}

export function OrderLayout({
  menuItems: initialMenuItems,
  categories: initialCategories,
}: OrderLayoutProps) {
  const [menuItems, setMenuItems] = useState(initialMenuItems);
  const [categories, setCategories] = useState(initialCategories);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getLocalSession();
      if (!session || cancelled) return;

      let [localCategories, localItems] = await Promise.all([
        localDb.categories.where("restaurantId").equals(session.restaurantId).toArray(),
        localDb.menuItems.where("restaurantId").equals(session.restaurantId).toArray(),
      ]);

      /*
       * First-time POS startup can race the background sync
       * bootstrap. If the local menu is empty and internet is
       * available, hydrate the snapshot immediately and then
       * read the freshly persisted IndexedDB records.
       */
      if (localItems.length === 0 && navigator.onLine) {
        try {
          await hydrateSnapshot();
          [localCategories, localItems] = await Promise.all([
            localDb.categories.where("restaurantId").equals(session.restaurantId).toArray(),
            localDb.menuItems.where("restaurantId").equals(session.restaurantId).toArray(),
          ]);
        } catch {
          // The caller still has the server-provided props as a fallback.
        }
      }

      if (cancelled) return;

      if (cancelled || !localItems.length) return;

      const variationOptions = await localDb.variationOptions.where("restaurantId").equals(session.restaurantId).toArray();
      const addons = await localDb.addons.where("restaurantId").equals(session.restaurantId).toArray();
      const variationGroups = await localDb.variations.where("restaurantId").equals(session.restaurantId).toArray();

      const categoryById = new Map(localCategories.map((category) => [category.id, category]));
      const groupById = new Map(variationGroups.map((group) => [group.id, group]));
      const optionsByGroup = new Map<string, typeof variationOptions>();
      for (const option of variationOptions) {
        const current = optionsByGroup.get(option.variationGroupId) ?? [];
        current.push(option);
        optionsByGroup.set(option.variationGroupId, current);
      }

      const localMenu = localItems.filter((item) => !item.deletedAt && item.isActive !== false).map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        category: {
          id: String(item.categoryId),
          name: String(categoryById.get(String(item.categoryId))?.name ?? "Uncategorized"),
        },
        variations: Array.isArray(item.variations)
          ? (item.variations as Array<{ variationGroupId?: string; variationGroup?: { id: string; name: string } }>).map((link) => {
              const groupId = link.variationGroupId ?? link.variationGroup?.id;
              const group = groupId ? groupById.get(groupId) : undefined;
              return {
                variationGroup: {
                  id: groupId ?? group?.id ?? "",
                  name: String(group?.name ?? link.variationGroup?.name ?? "Options"),
                  options: (groupId ? optionsByGroup.get(groupId) ?? [] : []).map((option) => ({
                    id: option.id,
                    name: option.name,
                    price: Number(option.price ?? 0),
                    isDefault: Boolean(option.isDefault),
                  })),
                },
              };
            })
          : [],
        addons: Array.isArray(item.addons)
          ? (item.addons as Array<{ addonId?: string; addon?: { id: string; name: string; price: number } }>).map((link) => {
              const addon = link.addonId ? addons.find((candidate) => candidate.id === link.addonId) : link.addon;
              return { addon: { id: addon?.id ?? "", name: String(addon?.name ?? "Addon"), price: Number(addon?.price ?? 0) } };
            })
          : [],
      }));
      if (!cancelled) {
        setCategories(localCategories.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, name: item.name })));
        setMenuItems(localMenu);
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="grid min-h-[calc(100dvh-4rem)] gap-3 bg-muted/20 p-3 xl:h-[calc(100dvh-4rem)] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="min-h-[32rem] overflow-hidden rounded-xl border bg-card shadow-sm xl:min-h-0">
        <MenuGrid
          menuItems={menuItems}
          categories={categories}
        />
      </section>

      <aside className="min-h-[32rem] overflow-hidden rounded-xl border bg-card shadow-sm xl:min-h-0">
        <CartSheet />
      </aside>
    </main>
  );
}