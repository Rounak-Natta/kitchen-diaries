function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({
        length: 6,
      }).map((_, i) => (
        <div
          key={i}
          className="grid h-[76px] animate-pulse grid-cols-6 items-center gap-4 px-6"
        >
          <div className="h-10 w-10 rounded-2xl bg-muted" />

          <div className="space-y-2">
            <div className="h-4 w-[140px] rounded-full bg-muted" />

            <div className="h-3 w-[180px] rounded-full bg-muted" />
          </div>

          <div className="h-4 w-[90px] rounded-full bg-muted" />

          <div className="h-8 w-[100px] rounded-full bg-muted" />

          <div className="h-4 w-[120px] rounded-full bg-muted" />

          <div className="flex gap-2">
            <div className="h-10 w-10 rounded-2xl bg-muted" />

            <div className="h-10 w-10 rounded-2xl bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableSkeleton;