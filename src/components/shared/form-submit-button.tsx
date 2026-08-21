"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  loading?: boolean;

  children: React.ReactNode;
}

function FormSubmitButton({
  loading,
  children,
}: Props) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className="min-w-[140px] gap-2"
    >
      {loading && (
        <Loader2
          size={16}
          className="animate-spin"
        />
      )}

      {children}
    </Button>
  );
}

export default FormSubmitButton;