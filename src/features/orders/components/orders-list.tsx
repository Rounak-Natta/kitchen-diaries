"use client";

import {
  useState,
} from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  useQuery,
} from "@tanstack/react-query";
import type {
  LucideIcon,
} from "lucide-react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  ReceiptText,
  ShieldCheck,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import type {
  OrderItemDetailsDto,
  OrderListItemDto,
  OrderStatusValue,
} from "../types";
import { getLocalSession } from "@/lib/local-db/session";
import { listLocalEntities } from "@/lib/local-db/repositories";
import { localDb, type LocalOrder, type LocalOrderItem } from "@/lib/local-db/db";

type OrderTab =
  | "active"
  | "closed";

interface StatusAppearance {
  icon: LucideIcon;
  className: string;
}

interface OrderCardProps {
  order: OrderListItemDto;
  expanded: boolean;
  onToggle: () => void;
  items: OrderItemDetailsDto[];
  itemsLoading: boolean;
  itemsError: boolean;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const STATUS_APPEARANCE: Record<
  OrderStatusValue,
  StatusAppearance
> = {
  PENDING: {
    icon: Clock3,
    className:
      "bg-amber-50 text-amber-700",
  },

  CONFIRMED: {
    icon: CheckCircle2,
    className:
      "bg-blue-50 text-blue-700",
  },

  PREPARING: {
    icon: UtensilsCrossed,
    className:
      "bg-purple-50 text-purple-700",
  },

  READY: {
    icon: CheckCircle2,
    className:
      "bg-green-50 text-green-700",
  },

  BILLED: {
    icon: ReceiptText,
    className:
      "bg-cyan-50 text-cyan-700",
  },

  COMPLETED: {
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-700",
  },

  CANCELLED: {
    icon: XCircle,
    className:
      "bg-red-50 text-red-700",
  },
};

const ORDER_STATUS_VALUES: readonly OrderStatusValue[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "BILLED",
  "COMPLETED",
  "CANCELLED",
];

function toOrderStatus(value: string): OrderStatusValue {
  return ORDER_STATUS_VALUES.includes(value as OrderStatusValue)
    ? (value as OrderStatusValue)
    : "PENDING";
}

function toLocalOrderDto(
  order: LocalOrder,
  createdByName: string,
  totalItems: number,
): OrderListItemDto {
  return {
    id: order.id,
    serverOrderId:
      typeof order.serverOrderId === "string"
        ? order.serverOrderId
        : null,
    orderNumber: order.orderNumber,
    orderType: order.orderType as OrderListItemDto["orderType"],
    status: toOrderStatus(order.status),
    total: Number(order.total),
    createdAt: order.createdAt,
    createdByName,
    totalItems,
    billId: null,
  };
}

interface LocalOrderView {
  dto: OrderListItemDto;
  serverOrderId: string | null;
}

async function getLocalOrders(): Promise<LocalOrderView[]> {
  const session = await getLocalSession();
  if (!session) return [];

  const [localOrders, localItems] = await Promise.all([
    listLocalEntities<LocalOrder>("orders", session.restaurantId),
    listLocalEntities<LocalOrderItem>("orderItems", session.restaurantId),
  ]);

  const itemCounts = new Map<string, number>();
  for (const item of localItems) {
    itemCounts.set(
      item.orderId,
      (itemCounts.get(item.orderId) ?? 0) + Number(item.quantity ?? 0),
    );
  }

  return localOrders
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => ({
      dto: toLocalOrderDto(
        order,
        session.name,
        itemCounts.get(order.id) ?? 0,
      ),
      serverOrderId:
        typeof order.serverOrderId === "string"
          ? order.serverOrderId
          : null,
    }));
}

async function fetchOrders(): Promise<OrderListItemDto[]> {
  let serverOrders: OrderListItemDto[] = [];

  try {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const body = (await response.json()) as ApiResponse<OrderListItemDto[]>;

    if (response.ok && body.success && Array.isArray(body.data)) {
      serverOrders = body.data;
    } else {
      throw new Error(body.error ?? "Failed to load orders.");
    }
  } catch {
    // Server data is optional for an offline-first order list.
  }

  let localOrders: LocalOrderView[] = [];
  try {
    localOrders = await getLocalOrders();
  } catch {
    // If IndexedDB is unavailable, keep whatever the server returned.
  }

  if (serverOrders.length === 0) {
    return localOrders.map((item) => item.dto);
  }

  if (localOrders.length === 0) {
    return serverOrders;
  }

  const serverIds = new Set(serverOrders.map((order) => order.id));
  const unsyncedLocalOrders = localOrders
    .filter(
      (item) =>
        !serverIds.has(item.dto.id) &&
        !item.serverOrderId,
    )
    .map((item) => item.dto);

  return [...serverOrders, ...unsyncedLocalOrders].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

async function fetchLocalOrderItems(
  orderId: string,
): Promise<OrderItemDetailsDto[]> {
  const session = await getLocalSession();
  if (!session) return [];

  const items = await localDb.orderItems
    .where("orderId")
    .equals(orderId)
    .filter((item) => item.restaurantId === session.restaurantId && !item.deletedAt)
    .toArray();

  return items.map((item) => ({
    id: item.id,
    itemName: String(item.itemName ?? "Item"),
    quantity: Number(item.quantity ?? 0),
    totalPrice: Number(item.totalPrice ?? 0),
    notes: item.notes ? String(item.notes) : null,
    variationName: null,
    addons: [],
  }));
}

async function fetchOrderItems(
  orderId: string,
): Promise<OrderItemDetailsDto[]> {
  try {
    const response = await fetch(`/api/orders/${orderId}/items`, {
      cache: "no-store",
    });

    const body = (await response.json()) as ApiResponse<OrderItemDetailsDto[]>;

    if (response.ok && body.success && Array.isArray(body.data)) {
      return body.data;
    }
  } catch {
    // Fall through to IndexedDB.
  }

  const localItems = await fetchLocalOrderItems(orderId);
  if (localItems.length > 0) return localItems;

  throw new Error("Order items could not be loaded.");
}

function formatLabel(
  value: string,
): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatOrderDate(
  value: string,
): string {
  return format(
    new Date(value),
    "dd MMM yyyy, hh:mm a",
  );
}

export function OrdersList() {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<OrderTab>("active");

  const [
    expandedOrderId,
    setExpandedOrderId,
  ] =
    useState<string | null>(null);

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "orders",
    ],

    queryFn:
      fetchOrders,

    // Orders are operational data. Always fetch fresh data when this page
    // mounts so a newly-created/synced order appears immediately after
    // navigation without requiring a manual browser refresh.
    staleTime:
      0,

    refetchOnMount:
      "always",
  });

  const {
    data: orderItems = [],
    isLoading:
      itemsLoading,
    isError:
      itemsError,
  } = useQuery({
    queryKey: [
      "order-items",
      expandedOrderId,
    ],

    queryFn:
      async () => {
        if (!expandedOrderId) {
          return [];
        }

        return fetchOrderItems(
          expandedOrderId,
        );
      },

    enabled:
      expandedOrderId !==
      null,

    staleTime:
      60_000,
  });

  const activeOrders =
    orders.filter(
      (order) =>
        order.status !==
          "COMPLETED" &&
        order.status !==
          "CANCELLED",
    );

  const closedOrders =
    orders.filter(
      (order) =>
        order.status ===
          "COMPLETED" ||
        order.status ===
          "CANCELLED",
    );

  const displayedOrders =
    activeTab === "active"
      ? activeOrders
      : closedOrders;

  function handleTabChange(
    tab: OrderTab,
  ): void {
    setActiveTab(tab);
    setExpandedOrderId(null);
  }

  function handleToggleOrder(
    orderId: string,
  ): void {
    setExpandedOrderId(
      (
        currentOrderId,
      ) =>
        currentOrderId ===
        orderId
          ? null
          : orderId,
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <p className="font-medium text-destructive">
          Orders could not be
          loaded.
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Refresh the page and try
          again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() =>
            handleTabChange(
              "active",
            )
          }
          className={
            activeTab ===
            "active"
              ? "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              : "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          }
        >
          Active
          <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
            {
              activeOrders.length
            }
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            handleTabChange(
              "closed",
            )
          }
          className={
            activeTab ===
            "closed"
              ? "inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              : "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          }
        >
          Closed
          <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
            {
              closedOrders.length
            }
          </span>
        </button>
      </div>

      {displayedOrders.length ===
      0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed bg-card p-8 text-center">
          <div>
            <p className="font-medium">
              No{" "}
              {activeTab ===
              "active"
              ? "active"
              : "closed"}{" "}
              orders
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Orders will appear
              here when they match
              this status group.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedOrders.map(
            (order) => {
              const isExpanded =
                expandedOrderId ===
                order.id;

              return (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={
                    isExpanded
                  }
                  onToggle={() =>
                    handleToggleOrder(
                      order.id,
                    )
                  }
                  items={
                    isExpanded
                      ? orderItems
                      : []
                  }
                  itemsLoading={
                    isExpanded &&
                    itemsLoading
                  }
                  itemsError={
                    isExpanded &&
                    itemsError
                  }
                />
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
  items,
  itemsLoading,
  itemsError,
}: OrderCardProps) {
  const appearance =
    STATUS_APPEARANCE[order.status] ??
    STATUS_APPEARANCE.PENDING;

  const StatusIcon =
    appearance.icon;

  const mayCreateBill =
    !order.billId &&
    order.status !==
      "BILLED" &&
    order.status !==
      "COMPLETED" &&
    order.status !==
      "CANCELLED";

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          aria-expanded={
            expanded
          }
          aria-controls={`order-items-${order.id}`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left outline-none transition hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${appearance.className}`}
          >
            <StatusIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">
                {
                  order.orderNumber
                }
              </span>

              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {formatLabel(
                  order.orderType,
                )}
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${appearance.className}`}
              >
                {formatLabel(
                  order.status,
                )}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {formatOrderDate(
                order.createdAt,
              )}
              {" · "}
              {
                order.totalItems
              }{" "}
              item
              {order.totalItems ===
              1
                ? ""
                : "s"}

              {order.createdByName
                ? ` · ${order.createdByName}`
                : ""}
            </p>
          </div>

          <ChevronDown
            className={`mr-2 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
              expanded
                ? "rotate-180"
                : ""
            }`}
          />
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 lg:justify-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="min-w-28 text-right text-lg font-bold text-primary">
            {formatCurrency(
              order.total,
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/orders/${order.id}/lifecycle`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition hover:bg-muted"
            >
              <ShieldCheck className="h-4 w-4" />
              Lifecycle
            </Link>

            {mayCreateBill && (
              <Link
                href={`/billing/create/${order.serverOrderId ?? order.id}`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <ReceiptText className="h-4 w-4" />
                Create Bill
              </Link>
            )}

            {order.billId && (
              <Link
                href={`/billing/${order.billId}`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition hover:bg-muted"
              >
                <ReceiptText className="h-4 w-4" />
                View Bill
              </Link>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          id={`order-items-${order.id}`}
          className="space-y-3 border-t bg-muted/10 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              Order Items
            </h3>

            <span className="text-xs text-muted-foreground">
              {
                order.totalItems
              }{" "}
              item
              {order.totalItems ===
              1
                ? ""
                : "s"}
            </span>
          </div>

          {itemsLoading ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : itemsError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              Order items could not
              be loaded.
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              {items.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {
                            item.itemName
                          }
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Quantity:{" "}
                          {
                            item.quantity
                          }
                        </p>

                        {item.variationName && (
                          <p className="mt-1 text-xs font-medium text-primary">
                            Variation:{" "}
                            {
                              item.variationName
                            }
                          </p>
                        )}

                        {item.addons.length >
                          0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add-ons:{" "}
                            {item.addons
                              .map(
                                (
                                  addon,
                                ) =>
                                  addon.name,
                              )
                              .join(
                                ", ",
                              )}
                          </p>
                        )}

                        {item.notes && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            Note:{" "}
                            {
                              item.notes
                            }
                          </p>
                        )}
                      </div>

                      <p className="shrink-0 font-semibold">
                        {formatCurrency(
                          item.totalPrice,
                        )}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              No order items found.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
