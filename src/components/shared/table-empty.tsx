import { Inbox } from "lucide-react";

interface Props {
  title?: string;

  description?: string;
}

function TableEmpty({
  title = "No data found",
  description = "There is nothing available right now.",
}: Props) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-muted">
        <Inbox
          size={28}
          className="text-muted-foreground"
        />
      </div>

      <h3 className="text-lg font-semibold tracking-tight">
        {title}
      </h3>

      <p className="text-muted mt-2 max-w-sm">
        {description}
      </p>
    </div>
  );
}

export default TableEmpty;