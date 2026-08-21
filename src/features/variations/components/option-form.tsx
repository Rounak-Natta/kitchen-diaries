// features/variations/components/option-form.tsx
"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  name: z.string().min(2, "Name too short"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be >= 0"),
  sortOrder: z.number().int().min(0), 
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  variationGroupId: string;
  initialData?: any;
  onSuccess?: () => void;
}

export function OptionForm({ variationGroupId, initialData, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price ?? 0,
      sortOrder: initialData?.sortOrder ?? 0, 
      isDefault: initialData?.isDefault ?? false,
      isActive: initialData?.isActive ?? true,
    },
  });

  async function onSubmit(data: FormData) {
    const method = initialData ? "PATCH" : "POST";
    const url = initialData ? `/api/variation-options/${initialData.id}` : "/api/variation-options";
    const payload = { ...data, variationGroupId };
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      await queryClient.invalidateQueries({ queryKey: ["variations"] });
      toast.success(initialData ? "Option updated" : "Option added");
      startTransition(() => onSuccess?.());
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-teal-500 focus:bg-white focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Option Name *</label>
        <input {...register("name")} className={inputClass} placeholder="e.g., Small, Extra Cheese" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">Description (optional)</label>
        <textarea {...register("description")} rows={2} className={inputClass} placeholder="e.g., Add a cheesy crust" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Extra Price (₹)</label>
          <input
            type="number"
            step="0.01"
            {...register("price", { setValueAs: (v) => (v === "" ? 0 : parseFloat(v as string)) })}
            className={inputClass}
          />
          {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Sort Order</label>
          <input
            type="number"
            {...register("sortOrder", { setValueAs: (v) => (v === "" ? 0 : parseInt(v as string, 10)) })}
            className={inputClass}
            placeholder="0"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isDefault")} className="h-4 w-4 rounded border-gray-300" />
          Set as default option
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-gray-300" />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess} className="border border-gray-200">Cancel</Button>
        <Button type="submit" disabled={isPending} className="bg-teal-700 hover:bg-teal-800">{initialData ? "Save" : "Add Option"}</Button>
      </div>
    </form>
  );
}