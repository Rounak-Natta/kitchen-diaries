// features/categories/components/category-form.tsx (updated)
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query"; // ✅ import
import { Button } from "@/components/ui/button";
import { Utensils, Coffee, IceCream, Pizza, Soup, Popcorn, Package, Leaf, Drumstick, Egg, Vegan, Flower } from "lucide-react";

// Define schema directly (no .default() to avoid TS issues)
const formSchema = z.object({
  name: z.string().min(2, "Too short").max(50, "Too long"),
  description: z.string().max(200).optional(),
  type: z.enum(["FOOD", "BEVERAGE", "DESSERT", "STARTER", "MAIN_COURSE", "SNACK", "COMBO"]),
  dietaryType: z.enum(["VEG", "NON_VEG", "EGG", "VEGAN", "JAIN"]),
  isActive: z.boolean(),
  slug: z.string().optional(), // only for edit
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  mode: "create" | "edit";
  initialData?: any;
  onSuccess?: () => void;
}

const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-teal-500 focus:bg-white focus:outline-none";

const typeIcons = {
  FOOD: <Utensils size={16} />,
  BEVERAGE: <Coffee size={16} />,
  DESSERT: <IceCream size={16} />,
  STARTER: <Pizza size={16} />,
  MAIN_COURSE: <Soup size={16} />,
  SNACK: <Popcorn size={16} />,
  COMBO: <Package size={16} />,
};

const dietaryIcons = {
  VEG: <Leaf size={16} />,
  NON_VEG: <Drumstick size={16} />,
  EGG: <Egg size={16} />,
  VEGAN: <Vegan size={16} />,
  JAIN: <Flower size={16} />,
};

export function CategoryForm({ mode, initialData, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient(); // ✅ get query client

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      slug: initialData?.slug || "",
      description: initialData?.description || "",
      type: initialData?.type || "FOOD",
      dietaryType: initialData?.dietaryType || "VEG",
      isActive: initialData?.isActive ?? true,
    },
  });

  const selectedType = watch("type");
  const selectedDietary = watch("dietaryType");

  async function onSubmit(values: FormValues) {
    const method = mode === "create" ? "POST" : "PUT";
    const url = mode === "create" ? "/api/categories" : `/api/categories/${initialData.id}`;

    // For create mode, remove slug (auto-generated on server)
    if (mode === "create") delete (values as any).slug;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");

      // ✅ Invalidate categories query to refetch fresh data
      await queryClient.invalidateQueries({ queryKey: ["categories"] });

      toast.success(mode === "create" ? "Category created" : "Category updated");
      startTransition(() => onSuccess?.());
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  }

  // ... rest of the JSX unchanged (same as before)
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Name *</label>
          <input {...register("name")} className={inputClass} />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>
        {mode === "edit" && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Slug</label>
            <input {...register("slug")} className={inputClass} />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <div className="relative">
            <select {...register("type")} className={inputClass}>
              {Object.keys(typeIcons).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              {typeIcons[selectedType] || <Utensils size={16} />}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Dietary</label>
          <div className="relative">
            <select {...register("dietaryType")} className={inputClass}>
              {Object.keys(dietaryIcons).map((diet) => (
                <option key={diet} value={diet}>{diet}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              {dietaryIcons[selectedDietary] || <Leaf size={16} />}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <textarea rows={3} {...register("description")} className={inputClass} />
      </div>
      <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
        <span className="text-sm font-medium">Active</span>
        <input type="checkbox" {...register("isActive")} className="h-5 w-5 accent-teal-600" />
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess} className="border border-gray-200 hover:bg-gray-50">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="bg-teal-700 text-white hover:bg-teal-800">
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </div>
    </form>
  );
}