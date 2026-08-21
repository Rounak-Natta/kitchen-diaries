"use client";

import {
  useMemo,
  useState,
} from "react";
import type {
  ReactNode,
} from "react";
import { Search } from "lucide-react";

import { useCategoryStore } from "../store/use-category";
import type {
  MenuCategoryDto,
  MenuItemDto,
} from "../types";

import {
  MenuItemCard,
} from "./menu-item-card";

interface MenuGridProps {
  menuItems: MenuItemDto[];
  categories: MenuCategoryDto[];
}

interface CategoryChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function MenuGrid({
  menuItems,
  categories,
}: MenuGridProps) {
  const [search, setSearch] =
    useState("");

  const selectedCategoryId =
    useCategoryStore(
      (state) =>
        state.selectedCategoryId,
    );

  const setSelectedCategoryId =
    useCategoryStore(
      (state) =>
        state.setSelectedCategoryId,
    );

  const filteredMenuItems =
    useMemo(() => {
      const searchTerm = search
        .trim()
        .toLowerCase();

      return menuItems.filter(
        (menuItem) => {
          const matchesCategory =
            !selectedCategoryId ||
            menuItem.category.id ===
              selectedCategoryId;

          const matchesSearch =
            !searchTerm ||
            menuItem.name
              .toLowerCase()
              .includes(searchTerm);

          return (
            matchesCategory &&
            matchesSearch
          );
        },
      );
    }, [
      menuItems,
      search,
      selectedCategoryId,
    ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search menu..."
            className="h-10 w-full rounded-full border bg-background pl-9 pr-4 text-sm outline-none transition focus:border-primary"
          />
        </div>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto border-b p-3">
        <CategoryChip
          active={
            selectedCategoryId ===
            null
          }
          onClick={() =>
            setSelectedCategoryId(
              null,
            )
          }
        >
          All
        </CategoryChip>

        {categories.map(
          (category) => (
            <CategoryChip
              key={category.id}
              active={
                selectedCategoryId ===
                category.id
              }
              onClick={() =>
                setSelectedCategoryId(
                  category.id,
                )
              }
            >
              {category.name}
            </CategoryChip>
          ),
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filteredMenuItems.length >
        0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
            {filteredMenuItems.map(
              (menuItem) => (
                <MenuItemCard
                  key={menuItem.id}
                  item={menuItem}
                />
              ),
            )}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            No menu items found.
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </button>
  );
}