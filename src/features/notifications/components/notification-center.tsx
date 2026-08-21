"use client";

import { Bell, CheckCheck, Circle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getLocalSession } from "@/lib/local-db/session";
import {
  findLocalNotificationByDedupeKey,
  listLocalNotifications,
  markAllLocalNotificationsRead,
  markLocalNotificationRead,
} from "@/lib/local-db/notifications";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  dedupeKey: string;
  entityType: string | null;
  entityId: string | null;
  orderId: string | null;
  orderNumber: string | null;
  status: string | null;
  readAt: string | null;
  createdAt: string;
  source: "server" | "local";
}

function relativeTime(value: string) {
  const delta = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.readAt).length,
    [items],
  );

  const loadNotifications = useCallback(async () => {
    const session = await getLocalSession();
    if (!session) return;

    const local = await listLocalNotifications(session.restaurantId);

    let server: NotificationItem[] = [];

    if (navigator.onLine) {
      try {
        const response = await fetch("/api/notifications?limit=30", {
          cache: "no-store",
        });
        const body = await response.json();
        if (body.success && Array.isArray(body.data?.notifications)) {
          server = body.data.notifications.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            title: String(item.title),
            message: String(item.message),
            type: String(item.type),
            dedupeKey: String(item.dedupeKey),
            entityType: typeof item.entityType === "string" ? item.entityType : null,
            entityId: typeof item.entityId === "string" ? item.entityId : null,
            orderId: typeof item.orderId === "string" ? item.orderId : null,
            orderNumber: typeof item.orderNumber === "string" ? item.orderNumber : null,
            status: typeof item.status === "string" ? item.status : null,
            readAt: typeof item.readAt === "string" ? item.readAt : null,
            createdAt: String(item.createdAt),
            source: "server" as const,
          }));
        }
      } catch {
        // Local notifications remain visible while the network is unavailable.
      }
    }

    const localItems: NotificationItem[] = local.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      type: item.type,
      dedupeKey: item.dedupeKey,
      entityType: item.entityType ?? null,
      entityId: item.entityId ?? null,
      orderId: item.orderId ?? null,
      orderNumber: item.orderNumber ?? null,
      status: item.status ?? null,
      readAt: item.readAt ?? null,
      createdAt: item.createdAt,
      source: "local" as const,
    }));

    const merged = new Map<string, NotificationItem>();

    for (const item of localItems) merged.set(item.dedupeKey, item);
    for (const item of server) {
      const existing = merged.get(item.dedupeKey);
      merged.set(item.dedupeKey, {
        ...existing,
        ...item,
        readAt: item.readAt ?? existing?.readAt ?? null,
      });
    }

    setItems(
      Array.from(merged.values())
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 30),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (cancelled) return;
      try {
        await loadNotifications();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadNotifications]);

  async function markRead(item: NotificationItem) {
    setWorkingId(item.dedupeKey);

    try {
      const local = await findLocalNotificationByDedupeKey(item.dedupeKey);

      if (local) await markLocalNotificationRead(local.id);

      if (item.source === "server" && navigator.onLine) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
      }

      setItems((current) =>
        current.map((candidate) =>
          candidate.dedupeKey === item.dedupeKey
            ? { ...candidate, readAt: new Date().toISOString() }
            : candidate,
        ),
      );

      if (item.orderId) {
        setOpen(false);
        router.push(`/orders/${item.orderId}/lifecycle`);
      }
    } finally {
      setWorkingId(null);
    }
  }

  async function markAllRead() {
    const session = await getLocalSession();
    if (!session) return;

    await markAllLocalNotificationsRead(session.restaurantId);

    if (navigator.onLine) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).catch(() => undefined);
    }

    setItems((current) =>
      current.map((item) => ({ ...item, readAt: new Date().toISOString() })),
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
        className="relative flex size-11 items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:bg-muted"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Notifications</h2>
              <p className="text-xs text-muted-foreground">
                {unreadCount ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>

            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications…
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No notifications</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Order lifecycle updates will appear here.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.dedupeKey}
                  type="button"
                  onClick={() => void markRead(item)}
                  disabled={workingId === item.dedupeKey}
                  className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/60 ${
                    item.readAt ? "bg-card" : "bg-primary/[0.04]"
                  }`}
                >
                  <div className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-full ${
                    item.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  }`}>
                    <Circle className={`h-2.5 w-2.5 ${item.readAt ? "" : "fill-current"}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {!item.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {item.orderNumber ? `${item.orderNumber} · ` : ""}{relativeTime(item.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
