// features/menu/components/menu-list.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { MenuModal } from "./menu-modal";
import { MenuForm } from "./menu-form";
import { MenuRow } from "./menu-row";
import { MenuSkeleton } from "./menu-skeleton";
import { Pagination } from "@/components/shared/pagination";

const ITEMS_PER_PAGE = 10;

const fetchMenu = async () => {
  const res = await fetch("/api/menu");
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data;
};

const fetchCategories = async () => {
  const res = await fetch("/api/categories");
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data;
};

const fetchVariations = async () => {
  const res = await fetch("/api/variations");
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data;
};

const fetchAddons = async () => {
  const res = await fetch("/api/addons");
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.data;
};

export function MenuList() {
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: menu = [], isLoading: menuLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
    staleTime: 60 * 1000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 60 * 1000,
  });
  const { data: variations = [] } = useQuery({
    queryKey: ["variations"],
    queryFn: fetchVariations,
    staleTime: 60 * 1000,
  });
  const { data: addons = [] } = useQuery({
    queryKey: ["addons"],
    queryFn: fetchAddons,
    staleTime: 60 * 1000,
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return menu.filter((item: any) => item.name.toLowerCase().includes(term));
  }, [menu, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const activeCount = menu.filter((m: any) => m.isActive).length;

  return (
    <>
      <MenuModal open={openCreate} onClose={() => setOpenCreate(false)} title="Create Menu Item">
        <MenuForm
          categories={categories}
          variations={variations}
          addons={addons}
          onSuccess={() => setOpenCreate(false)}
        />
      </MenuModal>

      <section className="surface overflow-hidden rounded-2xl shadow-sm">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/5 via-background to-background border-b border-border/50 px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                <LayoutGrid size={14} /> Menu
              </div>
              <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Menu Management</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Manage your restaurant's food and beverage items.
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Active: {activeCount}
                </span>
                <span className="h-3 w-px bg-border" />
                <span>Total: {filtered.length}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="h-11 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm shadow-sm focus:border-primary focus:outline-none lg:w-72"
                />
              </div>
              <button
                onClick={() => setOpenCreate(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
              >
                <Plus size={17} /> Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="grid min-w-[1150px] grid-cols-[2fr_120px_120px_120px_100px_130px] border-b border-border/60 bg-muted/20 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full bg-primary/20" />
              Name
            </div>
            <div>Price</div>
            <div>Diet</div>
            <div>Spice</div>
            <div>Prep</div>
            <div>Actions</div>
          </div>

          {menuLoading ? (
            Array.from({ length: 4 }).map((_, i) => <MenuSkeleton key={i} />)
          ) : (
            <div className="divide-y divide-border/40">
              {paginated.map((item: any) => (
                <MenuRow
                  key={item.id}
                  menu={item}
                  categories={categories}
                  variations={variations}
                  addons={addons}
                />
              ))}
            </div>
          )}

          {!menuLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <LayoutGrid size={24} className="text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No menu items found</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {search ? "Try a different search term" : "Click 'Add Item' to create one"}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border/60 bg-muted/10 px-6 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </section>
    </>
  );
}