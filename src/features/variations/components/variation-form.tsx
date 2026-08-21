// features/variations/components/variation-form.tsx
"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

// Schema without .default() to avoid optional type mismatch
const schema = z.object({
  name: z.string().min(2, "Name too short"),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initialData?: any;
  onSuccess?: () => void;
}

export function VariationForm({ initialData, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  async function onSubmit(data: FormData) {
    const method = initialData ? "PATCH" : "POST";
    const url = initialData ? `/api/variations/${initialData.id}` : "/api/variations";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      await queryClient.invalidateQueries({ queryKey: ["variations"] });
      toast.success(initialData ? "Variation updated" : "Variation created");
      startTransition(() => onSuccess?.());
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-teal-500 focus:bg-white focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name *</label>
        <input {...register("name")} className={inputClass} placeholder="e.g., Size, Toppings, Crust" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">Description (optional)</label>
        <textarea {...register("description")} rows={3} className={inputClass} placeholder="e.g., Choose your preferred size" />
      </div>
      <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
        <span className="text-sm font-medium">Active</span>
        <input type="checkbox" {...register("isActive")} className="h-5 w-5 accent-teal-600" />
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess} className="border border-gray-200">Cancel</Button>
        <Button type="submit" disabled={isPending} className="bg-teal-700 hover:bg-teal-800">{initialData ? "Save" : "Create"}</Button>
      </div>
    </form>
  );
}