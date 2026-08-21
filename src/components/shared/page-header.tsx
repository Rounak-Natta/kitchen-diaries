import { cn } from "@/lib/utils";

interface Props {
  title: string;

  description?: string;

  action?: React.ReactNode;

  className?: string;
}

function PageHeader({
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div>
        <h1 className="text-heading-2">
          {title}
        </h1>

        {description && (
          <p className="text-muted mt-1">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}

export default PageHeader;