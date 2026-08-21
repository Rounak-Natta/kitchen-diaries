import * as React from "react";

import { cn } from "@/lib/utils";

type Props =
  React.InputHTMLAttributes<HTMLInputElement>;

function Input({
  className,
  ...props
}: Props) {
  return (
    <input
      className={cn(
        [
          "flex h-11 w-full rounded-2xl",
          "border border-slate-200",
          "bg-white",
          "px-4",
          "text-sm font-medium",
          "text-slate-800",
          "shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
          "outline-none",
          "transition-all duration-200",
          "placeholder:text-slate-400",
          "focus:border-primary",
          "focus:ring-4",
          "focus:ring-primary/10",
        ],
        className
      )}
      {...props}
    />
  );
}

export { Input };