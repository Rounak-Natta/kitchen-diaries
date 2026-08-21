// features/categories/components/category-list.tsx
"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react"; // ✅ added useEffect
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutGrid, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/page-header";
import TableShell from "@/components/shared/table-shell";
import TableSearch from "@/components/shared/table-search";
import TableEmpty from "@/components/shared/table-empty";
import { CategoryForm } from "./category-form";
import { CategoryModal } from "./category-modal";
import { CategoryRow } from "./category-row";
import { Pagination } from "@/components/shared/pagination"; // ✅ import
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const ITEMS_PER_PAGE = 10; // ✅ pagination constant

const fetchCategories = async () => {
  const res = await fetch("/api/categories");
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data;
};

export function CategoryList() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1); // ✅ pagination state
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  // Filter based on search
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return categories.filter((c: any) => c.name.toLowerCase().includes(term));
  }, [categories, search]);

  // ✅ Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // ✅ Pagination calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCategories = filtered.slice(startIndex, endIndex);

  const handleCreateSuccess = useCallback(() => {
    setOpenCreate(false);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }, [queryClient]);

  const handleEditSuccess = useCallback(() => {
    setSelectedCategory(null);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }, [queryClient]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  return (
    <>
      {/* Create Modal */}
      <CategoryModal open={openCreate} onClose={() => setOpenCreate(false)} title="Create Category">
        <CategoryForm mode="create" onSuccess={handleCreateSuccess} />
      </CategoryModal>

      {/* Edit Modal */}
      <CategoryModal open={!!selectedCategory} onClose={() => setSelectedCategory(null)} title="Edit Category">
        {selectedCategory && <CategoryForm mode="edit" initialData={selectedCategory} onSuccess={handleEditSuccess} />}
      </CategoryModal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        description={`Delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <PageHeader
        title="Categories"
        description={`${filtered.length} total categories`}
        action={
          <div className="flex items-center gap-3">
            <TableSearch value={search} onChange={setSearch} placeholder="Search category..." />
            <Button onClick={() => setOpenCreate(true)} className="gap-2">
              <Plus size={16} /> Add Category
            </Button>
          </div>
        }
      />

      <TableShell>
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutGrid size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Manage restaurant categories</h2>
              <p className="text-xs text-muted-foreground">All available categories</p>
            </div>
          </div>
          {/* Optional: add stats here if you want */}
        </div>

        {/* Table Headers – original design */}
        <div className="grid min-w-[1100px] grid-cols-[2.2fr_0.8fr_0.9fr_0.9fr_1.2fr_110px] gap-4 border-b border-border bg-muted/30 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <div>Name</div>
          <div>Type</div>
          <div>Dietary</div>
          <div>Status</div>
          <div>Slug</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Rows – using paginatedCategories */}
        {!isLoading && (
          <div>
            {paginatedCategories.map((cat: any) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                onEdit={setSelectedCategory}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && <TableEmpty />}

        {/* ✅ Pagination – only show if more than 1 page */}
        {!isLoading && totalPages > 1 && (
          <div className="border-t border-border pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </TableShell>
    </>
  );
}