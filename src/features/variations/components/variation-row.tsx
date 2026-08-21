"use client";
import { memo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { VariationModal } from "./variation-modal";
import { VariationForm } from "./variation-form";
import { OptionForm } from "./option-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Props {
  variation: any;
}

export const VariationRow = memo(({ variation }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [optionOpen, setOptionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/variations/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variations"] });
      toast.success("Variation deleted");
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const handleDeleteVariation = () => {
    deleteMutation.mutate(variation.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <VariationModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Variation">
        <VariationForm initialData={variation} onSuccess={() => setEditOpen(false)} />
      </VariationModal>
      <VariationModal open={optionOpen} onClose={() => setOptionOpen(false)} title="Add Option">
        <OptionForm variationGroupId={variation.id} onSuccess={() => setOptionOpen(false)} />
      </VariationModal>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Variation"
        description={`Delete "${variation.name}"? This will also delete all its options.`}
        onConfirm={handleDeleteVariation}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="border-b border-border last:border-0">
        <div className="grid min-w-[1100px] grid-cols-[2fr_140px_140px_180px] items-center px-6 py-4 transition hover:bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
              {variation.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{variation.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{variation.description || "No description"}</p>
            </div>
          </div>
          <div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {variation._count?.options || 0} options
            </span>
          </div>
          <div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${variation.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {variation.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOptionOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background transition hover:bg-muted" title="Add option">
              <Plus size={16} />
            </button>
            <button onClick={() => setEditOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background transition hover:bg-muted" title="Edit variation">
              <Pencil size={16} />
            </button>
            <button onClick={() => setDeleteTarget(variation)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background transition hover:bg-red-50" title="Delete variation">
              <Trash2 size={16} className="text-red-500" />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background transition hover:bg-muted">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border bg-muted/10 px-6 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Options</h4>
              <button onClick={() => setOptionOpen(true)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus size={12} /> Add option
              </button>
            </div>
            {variation.options?.length ? (
              <div className="space-y-2">
                {variation.options.map((opt: any) => (
                  <OptionRow key={opt.id} option={opt} variationId={variation.id} />
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                No options yet. Click "Add option"
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
});

// Sub-component for an option row (inline edit/delete)
const OptionRow = memo(({ option, variationId }: { option: any; variationId: string }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/variation-options/${option.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variations"] });
      toast.success("Option deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <>
      <VariationModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Option">
        <OptionForm variationGroupId={variationId} initialData={option} onSuccess={() => setEditOpen(false)} />
      </VariationModal>
      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Option"
        description={`Delete "${option.name}"? This cannot be undone.`}
        onConfirm={() => { deleteMutation.mutate(); setDeleteConfirm(false); }}
        onCancel={() => setDeleteConfirm(false)}
      />
      <div className="grid grid-cols-[2fr_120px_100px] items-center rounded-xl border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-medium">{option.name}</p>
          <p className="text-xs text-muted-foreground">{option.description || "—"}</p>
        </div>
        <div className="text-sm font-semibold text-primary">₹{option.price.toFixed(0)}</div>
        <div className="flex justify-end gap-2">
          {option.isDefault && <span className="text-xs text-primary">Default</span>}
          <button onClick={() => setEditOpen(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <Pencil size={14} />
          </button>
          <button onClick={() => setDeleteConfirm(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  );
});