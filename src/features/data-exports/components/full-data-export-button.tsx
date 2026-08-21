"use client";

import {
  Download,
  Loader2,
} from "lucide-react";
import {
  useState,
  useTransition,
} from "react";
import {
  useRouter,
} from "next/navigation";

function getResponseFilename(
  disposition:
    | string
    | null,
): string {
  if (!disposition) {
    return "kitchen-diaries-backup.json";
  }

  const utf8Match =
    disposition.match(
      /filename\*=UTF-8''([^;]+)/i,
    );

  if (utf8Match?.[1]) {
    return decodeURIComponent(
      utf8Match[1],
    );
  }

  const quotedMatch =
    disposition.match(
      /filename="([^"]+)"/i,
    );

  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  return "kitchen-diaries-backup.json";
}

export function FullDataExportButton() {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  function handleExport(): void {
    if (pending) {
      return;
    }

    const confirmed =
      window.confirm(
        "Generate a complete restaurant backup? The file may contain customer, billing, inventory and audit data.",
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    startTransition(
      async () => {
        try {
          const response =
            await fetch(
              "/api/data-exports/full",
              {
                method:
                  "POST",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          if (!response.ok) {
            const payload =
              (await response
                .json()
                .catch(
                  () => null,
                )) as
                | {
                    error?:
                      string;
                  }
                | null;

            throw new Error(
              payload?.error ??
                "The backup could not be generated.",
            );
          }

          const blob =
            await response.blob();

          const fileName =
            getResponseFilename(
              response.headers.get(
                "content-disposition",
              ),
            );

          const downloadUrl =
            URL.createObjectURL(
              blob,
            );

          const anchor =
            document.createElement(
              "a",
            );

          anchor.href =
            downloadUrl;

          anchor.download =
            fileName;

          anchor.style.display =
            "none";

          document.body.appendChild(
            anchor,
          );

          anchor.click();
          anchor.remove();

          URL.revokeObjectURL(
            downloadUrl,
          );

          router.refresh();
        } catch (
          error: unknown
        ) {
          setErrorMessage(
            error instanceof
              Error
              ? error.message
              : "The backup could not be generated.",
          );
        }
      },
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={
          handleExport
        }
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}

        {pending
          ? "Generating Backup…"
          : "Download Full Backup"}
      </button>

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}