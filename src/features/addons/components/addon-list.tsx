"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Package } from "lucide-react";

import { AddonModal } from "./addon-modal";
import { AddonForm } from "./addon-form";
import { AddonRow } from "./addon-row";
import { AddonSkeleton } from "./addon-skeleton";

import { Pagination } from "@/components/shared/pagination";

const ITEMS_PER_PAGE = 10;

interface Addon {
  id: string;
  name: string;
  price: number;
  createdAt: string | Date;
  isActive?: boolean;
}

const fetchAddons = async (): Promise<Addon[]> => {
  const res = await fetch("/api/addons");

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message);
  }

  return json.data;
};

export function AddonList() {
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: addons = [],
    isLoading,
  } = useQuery<Addon[]>({
    queryKey: ["addons"],
    queryFn: fetchAddons,
    staleTime: 60 * 1000,
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();

    return addons.filter((addon) =>
      addon.name.toLowerCase().includes(term)
    );
  }, [addons, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(
    filtered.length / ITEMS_PER_PAGE
  );

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE;

  const paginated = filtered.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  return (
    <>
      <AddonModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Create Addon"
      >
        <AddonForm
          onSuccess={() => setOpenCreate(false)}
        />
      </AddonModal>

      <section className="surface overflow-hidden rounded-2xl shadow-sm">
        <div className="relative border-b border-border/50 bg-gradient-to-r from-primary/5 via-background to-background px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                <Package size={14} />
                Add-ons
              </div>

              <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                Addon Management
              </h1>

              <p className="mt-1.5 text-sm text-muted-foreground">
                Manage your menu extras –
                cheese, sauces, toppings and
                more.
              </p>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Active:{" "}
                  {
                    addons.filter(
                      (a) =>
                        a.isActive !== false
                    ).length
                  }
                </span>

                <span className="h-3 w-px bg-border" />

                <span>
                  Total: {filtered.length}
                </span>
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
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search addons..."
                  className="h-11 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm shadow-sm lg:w-72"
                />
              </div>

              <button
                onClick={() =>
                  setOpenCreate(true)
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus size={17} />
                Add Addon
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[800px] grid-cols-[2fr_140px_120px] border-b bg-muted/20 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Name</div>

            <div>Price (₹)</div>

            <div className="text-right">
              Actions
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y">
              {Array.from({
                length: 4,
              }).map((_, i) => (
                <AddonSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {paginated.map((addon) => (
                <AddonRow
                  key={addon.id}
                  addon={addon}
                />
              ))}
            </div>
          )}

          {!isLoading &&
            filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Package
                  size={40}
                  className="mb-4 text-muted-foreground"
                />

                <p className="font-medium">
                  No addons found
                </p>

                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Try another search."
                    : "Create your first addon."}
                </p>
              </div>
            )}
        </div>

        {totalPages > 1 && (
          <div className="border-t bg-muted/10 px-6 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={
                setCurrentPage
              }
            />
          </div>
        )}
      </section>
    </>
  );
}