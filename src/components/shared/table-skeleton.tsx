function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-[1050px] grid-cols-[2.2fr_1fr_1fr_1fr_1.4fr_120px] items-center gap-4 px-6 py-4"
        >
          {/* NAME */}
          <div className="flex items-center gap-3">
            <div className="size-11 animate-pulse rounded-2xl bg-muted" />

            <div className="space-y-2">
              <div className="h-4 w-[140px] animate-pulse rounded-full bg-muted" />

              <div className="h-3 w-[180px] animate-pulse rounded-full bg-muted" />
            </div>
          </div>

          {/* TYPE */}
          <div className="h-4 w-[90px] animate-pulse rounded-full bg-muted" />

          {/* DIETARY */}
          <div className="h-8 w-[100px] animate-pulse rounded-full bg-muted" />

          {/* STATUS */}
          <div className="h-8 w-[90px] animate-pulse rounded-full bg-muted" />

          {/* SLUG */}
          <div className="h-4 w-[140px] animate-pulse rounded-full bg-muted" />

          {/* ACTIONS */}
          <div className="flex justify-end gap-2">
            <div className="size-10 animate-pulse rounded-2xl bg-muted" />

            <div className="size-10 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableSkeleton;