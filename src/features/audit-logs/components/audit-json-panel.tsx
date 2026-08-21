interface AuditJsonPanelProps {
  title: string;
  value: string | null;
  emptyMessage: string;
}

export function AuditJsonPanel({
  title,
  value,
  emptyMessage,
}: AuditJsonPanelProps) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b p-4">
        <h2 className="font-semibold">
          {title}
        </h2>
      </div>

      {value ? (
        <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-5 text-xs leading-6 text-slate-100">
          {value}
        </pre>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}