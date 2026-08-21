import { Inbox } from "lucide-react";

interface Props {
  title?: string;

  description?: string;

  action?: React.ReactNode;
}

function EmptyState({
  title = "No data found",
  description = "There is nothing here yet.",
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-muted">
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

      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;