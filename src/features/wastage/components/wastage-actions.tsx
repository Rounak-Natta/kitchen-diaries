"use client";

import {
  useState,
  useTransition,
} from "react";
import {
  Ban,
  Loader2,
  Send,
} from "lucide-react";
import {
  useRouter,
} from "next/navigation";

import {
  cancelWastage,
  postWastage,
} from "../actions/wastage-actions";
import type {
  WastageStatusValue,
} from "../types";

interface WastageActionsProps {
  wastageId: string;
  status: WastageStatusValue;
  canPost: boolean;
  canCancel: boolean;
}

export function WastageActions({
  wastageId,
  status,
  canPost,
  canCancel,
}: WastageActionsProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  function handlePost(): void {
    if (
      pending ||
      status !== "DRAFT"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Post this wastage and deduct inventory stock?",
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result =
        await postWastage(
          wastageId,
        );

      if (!result.success) {
        setErrorMessage(
          result.error,
        );

        return;
      }

      router.refresh();
    });
  }

  function handleCancel(): void {
    if (
      pending ||
      cancellationReason
        .trim().length < 3
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        status === "POSTED"
          ? "Cancel this posted wastage and restore its inventory?"
          : "Cancel this wastage draft?",
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      const result =
        await cancelWastage(
          wastageId,
          {
            cancellationReason:
              cancellationReason.trim(),
          },
        );

      if (!result.success) {
        setErrorMessage(
          result.error,
        );

        return;
      }

      router.refresh();
    });
  }

  if (
    status === "CANCELLED"
  ) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">
        Wastage Actions
      </h2>

      <div className="mt-4 space-y-4">
        {status === "DRAFT" &&
          canPost && (
            <button
              type="button"
              onClick={handlePost}
              disabled={pending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}

              Post and Deduct Stock
            </button>
          )}

        {canCancel && (
          <div className="rounded-lg border p-4">
            <label
              htmlFor="cancellation-reason"
              className="text-sm font-medium"
            >
              Cancellation Reason
            </label>

            <textarea
              id="cancellation-reason"
              value={
                cancellationReason
              }
              rows={3}
              maxLength={500}
              disabled={pending}
              onChange={(event) =>
                setCancellationReason(
                  event.target.value,
                )
              }
              className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />

            <button
              type="button"
              onClick={handleCancel}
              disabled={
                pending ||
                cancellationReason
                  .trim().length < 3
              }
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-destructive text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}

              {status === "POSTED"
                ? "Cancel and Restore Stock"
                : "Cancel Draft"}
            </button>
          </div>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}