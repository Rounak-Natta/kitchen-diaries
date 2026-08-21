// features/categories/components/category-row.tsx
"use client";

import { memo } from "react";
import TableActions from "@/components/shared/table-actions";
import {
  Utensils, Coffee, IceCream, Pizza, Soup, Popcorn, Package,
  Leaf, Drumstick, Egg, Vegan, Flower, CheckCircle, XCircle,
} from "lucide-react";

// Type configuration (icon + colors)
export const typeConfig = {
  FOOD: { icon: <Utensils size={14} />, color: "#16a34a", bg: "#dcfce7" },
  BEVERAGE: { icon: <Coffee size={14} />, color: "#d97706", bg: "#fef3c7" },
  DESSERT: { icon: <IceCream size={14} />, color: "#db2777", bg: "#fce7f3" },
  STARTER: { icon: <Pizza size={14} />, color: "#ea580c", bg: "#ffedd5" },
  MAIN_COURSE: { icon: <Soup size={14} />, color: "#2563eb", bg: "#dbeafe" },
  SNACK: { icon: <Popcorn size={14} />, color: "#7c3aed", bg: "#ede9fe" },
  COMBO: { icon: <Package size={14} />, color: "#0f172a", bg: "#f1f5f9" },
} as const;

export const dietaryConfig = {
  VEG: { icon: <Leaf size={12} />, color: "#15803d", bg: "#dcfce7", label: "Veg" },
  NON_VEG: { icon: <Drumstick size={12} />, color: "#b91c1c", bg: "#fee2e2", label: "Non-Veg" },
  EGG: { icon: <Egg size={12} />, color: "#ca8a04", bg: "#fef9c3", label: "Egg" },
  VEGAN: { icon: <Vegan size={12} />, color: "#0d9488", bg: "#ccfbf1", label: "Vegan" },
  JAIN: { icon: <Flower size={12} />, color: "#9333ea", bg: "#f3e8ff", label: "Jain" },
} as const;

interface CategoryRowProps {
  category: any;
  onEdit: (category: any) => void;
  onDelete: (category: any) => void;
}

export const CategoryRow = memo(({ category, onEdit, onDelete }: CategoryRowProps) => {
  const type = typeConfig[category.type as keyof typeof typeConfig] || typeConfig.FOOD;
  const dietary = dietaryConfig[category.dietaryType as keyof typeof dietaryConfig] || dietaryConfig.VEG;

  return (
<div className="grid min-h-[82px] min-w-[1100px] grid-cols-[2.2fr_0.8fr_0.9fr_0.9fr_1.2fr_110px] items-center gap-4 border-b border-border px-6 py-3 hover:bg-muted/40">      {/* Name + description */}
      <div className="flex items-center gap-3">
<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">       
   {category.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
  <h3
    className="truncate text-sm font-medium text-foreground"
    title={category.name}
  >
    {category.name}
  </h3>

  <p
    className="line-clamp-1 text-xs text-muted-foreground"
    title={category.description}
  >
    {category.description || "—"}
  </p>
</div>
      </div>

      {/* Type with icon */}
      <div className="flex items-center gap-1.5 text-sm">
        <div
          className="flex size-6 items-center justify-center rounded-full"
          style={{ backgroundColor: type.bg }}
        >
          <span style={{ color: type.color }}>{type.icon}</span>
        </div>
        <span className="font-medium">{category.type}</span>
      </div>

      {/* Dietary badge with icon */}
      <div>
        <div
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium"
          style={{ backgroundColor: dietary.bg, color: dietary.color }}
        >
          {dietary.icon}
          {dietary.label}
        </div>
      </div>

      {/* Status badge */}
      <div>
        {category.isActive ? (
          <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle size={12} /> Active
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <XCircle size={12} /> Inactive
          </div>
        )}
      </div>

      {/* Slug */}
      <div className="truncate font-mono text-sm text-muted-foreground">{category.slug}</div>

      {/* Actions */}
      <div className="flex justify-end">
        <TableActions onEdit={() => onEdit(category)} onDelete={() => onDelete(category)} />
      </div>
    </div>
  );
});

CategoryRow.displayName = "CategoryRow";