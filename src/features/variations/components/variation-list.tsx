"use client";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { VariationModal } from "./variation-modal";
import { VariationForm } from "./variation-form";
import { VariationRow } from "./variation-row";
import { VariationSkeleton } from "./variation-skeleton";
import { Pagination } from "@/components/shared/pagination";

const ITEMS_PER_PAGE = 10;

const fetchVariations = async () => {
  const res = await fetch("/api/variations");
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data;
};

export function VariationList() {
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { data: variations = [], isLoading } = useQuery({
    queryKey: ["variations"],
    queryFn: fetchVariations,
    staleTime: 60 * 1000,
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return variations.filter((v: any) => v.name.toLowerCase().includes(term));
  }, [variations, search]);

  useEffect(() => setCurrentPage(1), [search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <VariationModal open={openCreate} onClose={() => setOpenCreate(false)} title="Create Variation">
        <VariationForm onSuccess={() => setOpenCreate(false)} />
      </VariationModal>

      <section className="surface overflow-hidden rounded-2xl shadow-sm">
        <div className="relative bg-gradient-to-r from-primary/5 via-background to-background border-b border-border/50 px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                <LayoutGrid size={14} /> Variations
              </div>
              <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Variation Management</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Manage size, toppings, crust types, etc.</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary"></span>
                  Active: {variations.filter((v: any) => v.isActive).length}
                </span>
                <span className="h-3 w-px bg-border"></span>
                <span>Total: {filtered.length}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variation..." className="h-11 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm shadow-sm focus:border-primary focus:outline-none lg:w-72" />
              </div>
              <button onClick={() => setOpenCreate(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98]">
                <Plus size={17} /> Add Variation
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[1100px] grid-cols-[2fr_140px_140px_180px] border-b border-border/60 bg-muted/20 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded-full bg-primary/20"></span> Name</div>
            <div>Options</div><div>Status</div><div className="text-right">Actions</div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border/40">
              {Array.from({ length: 4 }).map((_, i) => <VariationSkeleton key={i} />)}
            </div>
          ) : (
            <div>
              {paginated.map((variation: any) => <VariationRow key={variation.id} variation={variation} />)}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <LayoutGrid size={24} className="text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No variations found</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {search ? "Try a different search term" : "Click 'Add Variation' to create one"}
              </p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-border/60 bg-muted/10 px-6 py-3">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </section>
    </>
  );
}