import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";

interface Props {
  title: string;

  value: string | number;

  icon?: React.ReactNode;

  description?: string;

  className?: string;
}

function StatsCard({
  title,
  value,
  icon,
  description,
  className,
}: Props) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        className
      )}
    >
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {title}
            </p>

            <h3 className="mt-2 text-3xl font-semibold tracking-tight">
              {value}
            </h3>

            {description && (
              <p className="text-muted mt-2 text-sm">
                {description}
              </p>
            )}
          </div>

          {icon && (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default StatsCard;