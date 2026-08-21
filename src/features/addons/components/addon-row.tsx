// features/addons/components/addon-row.tsx
"use client";

import { memo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AddonModal } from "./addon-modal";
import { AddonForm } from "./addon-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Props {
  addon: any;
}

export const AddonRow = memo(({ addon }: Props) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/addons/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addons"] });
      toast.success("Addon deleted");
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const handleDelete = () => {
    deleteMutation.mutate(addon.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <AddonModal open={openEdit} onClose={() => setOpenEdit(false)} title="Edit Addon">
        <AddonForm initialData={addon} onSuccess={() => setOpenEdit(false)} />
      </AddonModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Addon"
        description={`Delete "${addon.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="grid min-w-[800px] grid-cols-[2fr_140px_120px] items-center px-6 py-3 transition-colors hover:bg-muted/30">
        {/* Name with icon */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {addon.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-foreground">{addon.name}</h3>
            <p className="truncate text-xs text-muted-foreground">Add-on item</p>
          </div>
        </div>

        {/* Price */}
        <div className="text-sm font-semibold text-primary">₹{addon.price.toFixed(0)}</div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpenEdit(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(addon)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  );
});