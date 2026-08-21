"use client";

import {
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onEdit: () => void;

  onDelete: () => void;
};

function TableActions({
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="secondary"
        onClick={onEdit}
        className="size-8"
      >
        <Pencil size={15} />
      </Button>

      <Button
        size="icon"
        variant="destructive"
        onClick={onDelete}
        className="size-8"
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}

export default TableActions;