import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;

  className?: string;
}

function TableShell({
  children,
  className,
}: Props) {
  return (
    <section
      className={cn(
        [
          "overflow-hidden",
          "rounded-2xl",
          "border border-border",
          "bg-card",
        ],
        className
      )}
    >
      {children}
    </section>
  );
}

export default TableShell;