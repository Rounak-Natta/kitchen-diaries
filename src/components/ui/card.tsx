import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>

function Card({
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--radius)+6px)] border border-border bg-card shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "p-5 md:p-6",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardContent };