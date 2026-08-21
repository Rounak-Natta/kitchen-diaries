import PageHeader from "@/components/shared/page-header";

import TableShell from "@/components/shared/table-shell";

import TableSkeleton from "@/components/shared/table-skeleton";

export default function Loading() {
  return (
    <div className="section-gap">
      {/* HEADER */}
      <PageHeader
        title="Categories"
        description="Loading categories..."
      />

      {/* TABLE */}
      <TableShell>
        {/* TOP */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="space-y-2">
            <div className="h-5 w-[180px] animate-pulse rounded-full bg-muted" />

            <div className="h-4 w-[240px] animate-pulse rounded-full bg-muted" />
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className="grid grid-cols-6 gap-4 border-b border-border px-6 py-4">
          {Array.from({
            length: 6,
          }).map((_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded-full bg-muted"
            />
          ))}
        </div>

        {/* ROWS */}
        <TableSkeleton />
      </TableShell>
    </div>
  );
}