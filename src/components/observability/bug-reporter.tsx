"use client";

import { useEffect } from "react";

import { getStoredLocalSession } from "@/lib/local-db/session";

type ClientBugSource =
  | "CLIENT_RUNTIME"
  | "UNHANDLED_REJECTION"
  | "NEXT_ERROR_BOUNDARY"
  | "NEXT_GLOBAL_ERROR"
  | "CLIENT_CONSOLE";

interface ClientBugReport {
  source: ClientBugSource;
  message: string;
  stack?: string;
  path?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

interface QueuedClientBug extends ClientBugReport {
  id: string;
}

const QUEUE_KEY = "kd:user-bug-queue:v1";
const MAX_QUEUE_SIZE = 50;
const recentFingerprints = new Map<string, number>();

function safeMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || value.name;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "Unknown client error";
  }
}

function safeStack(value: unknown): string | undefined {
  return value instanceof Error ? value.stack?.slice(0, 12_000) : undefined;
}

function readQueue(): QueuedClientBug[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedClientBug[]).slice(-MAX_QUEUE_SIZE) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedClientBug[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Error reporting must never interrupt POS usage.
  }
}

function enqueue(report: ClientBugReport): void {
  const queue = readQueue();
  queue.push({ ...report, id: crypto.randomUUID() });
  writeQueue(queue);
}

function shouldDeduplicate(report: ClientBugReport): boolean {
  const fingerprint = `${report.source}|${report.path ?? ""}|${report.message}|${report.stack?.split("\n")[1] ?? ""}`;
  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint) ?? 0;
  recentFingerprints.set(fingerprint, now);

  for (const [key, seenAt] of recentFingerprints) {
    if (now - seenAt > 60_000) recentFingerprints.delete(key);
  }

  return now - lastSeen < 15_000;
}

async function sendReport(report: ClientBugReport): Promise<boolean> {
  if (!navigator.onLine) return false;

  try {
    // Bug reporting must still work when IndexedDB itself is broken. Reading
    // the local session is therefore best-effort; the API can identify the
    // authenticated user/restaurant from the secure session cookie.
    const session = await getStoredLocalSession().catch(() => null);
    const response = await fetch("/api/client-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        ...report,
        deviceId: session?.deviceId,
        metadata: {
          online: navigator.onLine,
          language: navigator.language,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          ...report.metadata,
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function reportUserBug(
  source: ClientBugSource,
  error: unknown,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const report: ClientBugReport = {
    source,
    message: safeMessage(error).slice(0, 2_000),
    stack: safeStack(error),
    path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    occurredAt: new Date().toISOString(),
    metadata,
  };

  if (shouldDeduplicate(report)) return;

  if (!(await sendReport(report))) {
    enqueue(report);
  }
}

async function flushQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const queue = readQueue();
  if (!queue.length) return;

  const remaining: QueuedClientBug[] = [];

  for (const report of queue) {
    const { id: _id, ...payload } = report;
    if (!(await sendReport(payload))) {
      remaining.push(report);
      break;
    }
  }

  if (remaining.length) {
    const firstRemainingId = remaining[0]?.id;
    const index = queue.findIndex((item) => item.id === firstRemainingId);
    writeQueue(index >= 0 ? queue.slice(index) : remaining);
  } else {
    writeQueue([]);
  }
}

export function BugReporter(): null {
  useEffect(() => {
    const originalConsoleError = console.error.bind(console);
    const consoleErrorWrapper = (...args: unknown[]) => {
      originalConsoleError(...args);

      const message = args
        .map((value) => safeMessage(value))
        .filter(Boolean)
        .join(" ")
        .slice(0, 2_000);

      // Browser extensions can add attributes such as `cz-shortcut-listen`
      // before React hydrates. That is not an application bug and should not
      // pollute the restaurant bug log.
      if (/cz-shortcut-listen/i.test(message)) {
        return;
      }

      // Capture recoverable React/Next errors (including real hydration
      // warnings) that may never reach window.onerror or an error boundary.
      if (/(hydration|error|failed|exception|prisma|sync)/i.test(message)) {
        void reportUserBug("CLIENT_CONSOLE", new Error(message), {
          consoleArguments: args.slice(0, 6).map((value) => safeMessage(value).slice(0, 1_000)),
        });
      }
    };

    console.error = consoleErrorWrapper;

    const onError = (event: ErrorEvent) => {
      void reportUserBug(
        "CLIENT_RUNTIME",
        event.error ?? event.message,
        {
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      );
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      void reportUserBug("UNHANDLED_REJECTION", event.reason);
    };

    const onOnline = () => {
      void flushQueue();
    };

    const onOperationalBug = (event: Event) => {
      const detail = (event as CustomEvent<{
        source?: ClientBugSource;
        error?: unknown;
        metadata?: Record<string, unknown>;
      }>).detail;

      if (!detail) return;

      void reportUserBug(
        detail.source ?? "CLIENT_RUNTIME",
        detail.error ?? "Unknown operational error",
        detail.metadata,
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("online", onOnline);
    window.addEventListener("kd:user-bug", onOperationalBug);
    void flushQueue();

    return () => {
      if (console.error === consoleErrorWrapper) {
        console.error = originalConsoleError;
      }
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("kd:user-bug", onOperationalBug);
    };
  }, []);

  return null;
}
