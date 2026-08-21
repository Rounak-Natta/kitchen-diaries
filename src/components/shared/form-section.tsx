import { cn } from "@/lib/utils";

interface Props {
  title?: string;

  description?: string;

  children: React.ReactNode;

  className?: string;
}

function FormSection({
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "space-y-5",
        className
      )}
    >
      {(title ||
        description) && (
        <div>
          {title && (
            <h3 className="text-base font-semibold tracking-tight">
              {title}
            </h3>
          )}

          {description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}

export default FormSection;