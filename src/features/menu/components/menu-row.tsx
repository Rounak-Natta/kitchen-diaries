// features/menu/components/menu-row.tsx
"use client";
import { memo, useState } from "react";
import { Clock3, Flame, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MenuModal } from "./menu-modal";
import { MenuForm } from "./menu-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface Props {
  menu: any;
  categories: any[];
  variations: any[];
  addons: any[];
}

export const MenuRow = memo(({ menu, categories, variations, addons }: Props) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast.success("Menu item deleted");
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const handleEdit = async () => {
    try {
      const res = await fetch(`/api/menu/${menu.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setEditData(json.data);
      setOpenEdit(true);
    } catch (err: any) {
      toast.error("Failed to load menu data");
    }
  };

  const spiceIcon = menu.spiceLevel !== "NONE" ? <Flame className="h-3.5 w-3.5 text-orange-500" /> : null;

  return (
    <>
      <MenuModal open={openEdit} onClose={() => { setOpenEdit(false); setEditData(null); }} title="Edit Menu Item">
        {editData && (
          <MenuForm
            initialData={editData}
            categories={categories}
            variations={variations}
            addons={addons}
            onSuccess={() => { setOpenEdit(false); setEditData(null); }}
          />
        )}
      </MenuModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Menu Item"
        description={`Delete "${menu.name}"? This will remove it from all orders and bills.`}
        onConfirm={() => { deleteMutation.mutate(menu.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="grid min-w-[1150px] grid-cols-[2fr_120px_120px_120px_100px_130px] items-center px-6 py-4 transition hover:bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
            {menu.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{menu.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{menu.category?.name || "No category"}</p>
          </div>
        </div>
        <div className="text-sm font-semibold text-primary">₹{menu.price.toFixed(0)}</div>
        <div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{menu.dietaryType?.replace("_", " ")}</span></div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">{spiceIcon}{menu.spiceLevel !== "NONE" ? menu.spiceLevel : "-"}</div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{menu.preparationTime || 0}m</div>
        <div className="flex items-center gap-2">
          <button onClick={handleEdit} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background transition hover:bg-muted" title="Edit">
            <Pencil size={16} />
          </button>
          <button onClick={() => setDeleteTarget(menu)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background transition hover:bg-red-50" title="Delete">
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      </div>
    </>
  );
});