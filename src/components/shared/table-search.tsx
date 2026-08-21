"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

interface Props {
  value: string;

  onChange: (
    value: string
  ) => void;

  placeholder?: string;
}

function TableSearch({
  value,
  onChange,
  placeholder = "Search...",
}: Props) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
      />

      <Input
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
        className="w-full pl-11 lg:w-[260px]"
      />
    </div>
  );
}

export default TableSearch;