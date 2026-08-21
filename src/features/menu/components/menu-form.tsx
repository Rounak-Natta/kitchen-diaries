// features/menu/components/menu-form.tsx (fully corrected)
"use client";
import { useTransition, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { menuSchema, MenuSchema } from "../schemas/menu.schema";
import { DietaryType, MenuItemStatus, SpiceLevel } from "@prisma/client";

interface Props {
  initialData?: any;
  categories: { id: string; name: string }[];
  variations: { id: string; name: string }[];
  addons: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function MenuForm({ initialData, categories, variations, addons, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  // Extract variationIds and addonIds from initialData
  const [selectedVariations, setSelectedVariations] = useState<string[]>(
    initialData?.variations?.map((v: any) => v.variationGroupId) || []
  );
  const [selectedAddons, setSelectedAddons] = useState<string[]>(
    initialData?.addons?.map((a: any) => a.addonId) || []
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MenuSchema>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      shortCode: initialData?.shortCode ?? "",
      imageUrl: initialData?.imageUrl ?? "",
      price: initialData?.price ?? 0,
      comparePrice: initialData?.comparePrice ?? undefined,
      costPrice: initialData?.costPrice ?? undefined,
      sku: initialData?.sku ?? "",
      barcode: initialData?.barcode ?? "",
      preparationTime: initialData?.preparationTime ?? 0,
      calories: initialData?.calories ?? undefined,
      categoryId: initialData?.categoryId ?? "",
      dietaryType: initialData?.dietaryType ?? DietaryType.VEG,
      spiceLevel: initialData?.spiceLevel ?? SpiceLevel.NONE,
      status: initialData?.status ?? MenuItemStatus.AVAILABLE,
      isFeatured: initialData?.isFeatured ?? false,
      isRecommended: initialData?.isRecommended ?? false,
      isActive: initialData?.isActive ?? true,
      sortOrder: initialData?.sortOrder ?? 0,
    },
  });

  // Reset form when initialData changes (important for edit)
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name ?? "",
        description: initialData.description ?? "",
        shortCode: initialData.shortCode ?? "",
        imageUrl: initialData.imageUrl ?? "",
        price: initialData.price ?? 0,
        comparePrice: initialData.comparePrice ?? undefined,
        costPrice: initialData.costPrice ?? undefined,
        sku: initialData.sku ?? "",
        barcode: initialData.barcode ?? "",
        preparationTime: initialData.preparationTime ?? 0,
        calories: initialData.calories ?? undefined,
        categoryId: initialData.categoryId ?? "",
        dietaryType: initialData.dietaryType ?? DietaryType.VEG,
        spiceLevel: initialData.spiceLevel ?? SpiceLevel.NONE,
        status: initialData.status ?? MenuItemStatus.AVAILABLE,
        isFeatured: initialData.isFeatured ?? false,
        isRecommended: initialData.isRecommended ?? false,
        isActive: initialData.isActive ?? true,
        sortOrder: initialData.sortOrder ?? 0,
      });
      setSelectedVariations(initialData.variations?.map((v: any) => v.variationGroupId) || []);
      setSelectedAddons(initialData.addons?.map((a: any) => a.addonId) || []);
    }
  }, [initialData, reset]);

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-teal-500 focus:bg-white focus:outline-none";

  const onSubmit = async (data: MenuSchema) => {
    const method = initialData ? "PATCH" : "POST";
    const url = initialData ? `/api/menu/${initialData.id}` : "/api/menu";
    const payload = {
      ...data,
      variationIds: selectedVariations,
      addonIds: selectedAddons,
    };
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast.success(initialData ? "Menu updated" : "Menu created");
      startTransition(() => onSuccess?.());
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Name *</label>
          <input {...register("name")} className={inputClass} placeholder="Butter Chicken" />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Category *</label>
          <select {...register("categoryId")} className={inputClass}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Price (₹) *</label>
          <input
            type="number"
            step="0.01"
            {...register("price", { setValueAs: (v) => (v === "" ? 0 : parseFloat(v as string)) })}
            className={inputClass}
          />
          {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Compare Price</label>
          <input
            type="number"
            step="0.01"
            {...register("comparePrice", { setValueAs: (v) => (v === "" ? undefined : parseFloat(v as string)) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Prep Time (min)</label>
          <input
            type="number"
            {...register("preparationTime", { setValueAs: (v) => (v === "" ? 0 : parseInt(v as string, 10)) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Calories</label>
          <input
            type="number"
            {...register("calories", { setValueAs: (v) => (v === "" ? undefined : parseInt(v as string, 10)) })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Dietary Type</label>
          <select {...register("dietaryType")} className={inputClass}>
            {Object.values(DietaryType).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Spice Level</label>
          <select {...register("spiceLevel")} className={inputClass}>
            {Object.values(SpiceLevel).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <select {...register("status")} className={inputClass}>
            {Object.values(MenuItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Short Code</label>
          <input {...register("shortCode")} className={inputClass} placeholder="e.g., BCH" />
        </div>
        <div>
          <label className="text-sm font-medium">SKU</label>
          <input {...register("sku")} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea {...register("description")} rows={3} className={inputClass} />
      </div>

      <div>
        <label className="text-sm font-medium">Image URL</label>
        <input {...register("imageUrl")} className={inputClass} placeholder="https://..." />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isFeatured")} className="h-4 w-4 rounded border-gray-300" /> Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isRecommended")} className="h-4 w-4 rounded border-gray-300" /> Recommended
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-gray-300" /> Active
        </label>
      </div>

      {/* Variations */}
      <div>
        <p className="mb-2 text-sm font-medium">Variation Groups</p>
        <div className="flex flex-wrap gap-2">
          {variations.map(v => {
            const active = selectedVariations.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariations(prev => active ? prev.filter(id => id !== v.id) : [...prev, v.id])}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {v.name}
              </button>
            );
          })}
          {variations.length === 0 && <span className="text-sm text-muted-foreground">No variations available</span>}
        </div>
      </div>

      {/* Addons */}
      <div>
        <p className="mb-2 text-sm font-medium">Addons</p>
        <div className="flex flex-wrap gap-2">
          {addons.map(a => {
            const active = selectedAddons.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAddons(prev => active ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                {a.name}
              </button>
            );
          })}
          {addons.length === 0 && <span className="text-sm text-muted-foreground">No addons available</span>}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess} className="border border-gray-200">Cancel</Button>
        <Button type="submit" disabled={isPending} className="bg-teal-700 hover:bg-teal-800">
          {initialData ? "Save Changes" : "Create Menu"}
        </Button>
      </div>
    </form>
  );
}