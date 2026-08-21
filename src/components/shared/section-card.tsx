import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";

interface Props {
  title?: string;

  description?: string;

  children: React.ReactNode;

  className?: string;

  contentClassName?: string;
}

function SectionCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: Props) {
  return (
    <Card className={className}>
      {(title || description) && (
        <div className="border-b border-border px-5 py-4 md:px-6">
          {title && (
            <h3 className="text-title">
              {title}
            </h3>
          )}

          {description && (
            <p className="text-muted mt-1">
              {description}
            </p>
          )}
        </div>
      )}

      <CardContent
        className={cn(
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

export default SectionCard;