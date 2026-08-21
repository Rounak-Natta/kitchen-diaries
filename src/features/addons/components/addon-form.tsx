// features/addons/components/addon-form.tsx
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
  price: z.number().min(0, "Price must be >= 0"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initialData?: any;
  onSuccess?: () => void;
}

export function AddonForm({ initialData, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      price: initialData?.price || 0,
    },
  });

  async function onSubmit(data: FormData) {
    const method = initialData ? "PATCH" : "POST";
    const url = initialData ? `/api/addons/${initialData.id}` : "/api/addons";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      await queryClient.invalidateQueries({ queryKey: ["addons"] });
      toast.success(initialData ? "Addon updated" : "Addon created");
      startTransition(() => onSuccess?.());
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-teal-500 focus:bg-white focus:outline-none";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name</label>
        <input {...register("name")} className={inputClass} />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">Price (₹)</label>
        <input type="number" step="0.01" {...register("price", { valueAsNumber: true })} className={inputClass} />
        {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onSuccess} className="border border-gray-200">Cancel</Button>
        <Button type="submit" disabled={isPending} className="bg-teal-700 hover:bg-teal-800">
          {initialData ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}