import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;

  className?: string;
}

function FormGrid({
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "grid gap-5 md:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export default FormGrid;