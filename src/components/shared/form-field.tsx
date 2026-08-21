import { cn } from "@/lib/utils";

interface Props {
  label: string;

  error?: string;

  required?: boolean;

  children: React.ReactNode;

  className?: string;
}

function FormField({
  label,
  error,
  required,
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "space-y-2",
        className
      )}
    >
      <label className="text-sm font-medium text-foreground">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;