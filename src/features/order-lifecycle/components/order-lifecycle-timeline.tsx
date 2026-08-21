"use client";

import { Check, Circle, X } from "lucide-react";

import type { OrderLifecycleDto, OrderLifecycleStatus } from "../types";
import { formatOrderStatus } from "../lib/order-state-machine";

const STEPS: OrderLifecycleStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "BILLED",
  "COMPLETED",
];

const TIME_KEYS: Record<string, keyof OrderLifecycleDto> = {
  CONFIRMED: "confirmedAt",
  PREPARING: "preparingAt",
  READY: "readyAt",
  BILLED: "billedAt",
  COMPLETED: "completedAt",
};

function formatTime(value: unknown) {
  if (typeof value !== "string") return null;
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stateForStep(current: OrderLifecycleStatus, step: OrderLifecycleStatus) {
  if (current === "CANCELLED") return "cancelled";
  const currentIndex = STEPS.indexOf(current);
  const stepIndex = STEPS.indexOf(step);
  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function OrderLifecycleTimeline({ order }: { order: OrderLifecycleDto }) {
  if (order.status === "CANCELLED") {
    return (
      <section className="overflow-hidden rounded-2xl border border-destructive/20 bg-card shadow-sm">
        <div className="border-b border-destructive/10 bg-destructive/5 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Order lifecycle</p>
          <div className="mt-1 flex items-center gap-2">
            <X className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-semibold">Cancelled</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.cancellationReason || "This order was cancelled."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Order lifecycle</p>
          <h2 className="mt-1 text-xl font-semibold">{formatOrderStatus(order.status)}</h2>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Version {order.version}
        </span>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          <div className="flex items-start">
            {STEPS.map((step, index) => {
              const state = stateForStep(order.status, step);
              const timeKey = TIME_KEYS[step];
              const time = timeKey ? formatTime(order[timeKey]) : formatTime(order.createdAt);

              return (
                <div key={step} className="flex min-w-0 flex-1 items-start">
                  <div className="flex min-w-[110px] flex-1 flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <div className={`h-0.5 flex-1 ${index === 0 ? "bg-transparent" : state === "complete" || state === "current" ? "bg-primary" : "bg-border"}`} />
                      <div
                        className={[
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                          state === "complete" ? "border-primary bg-primary text-primary-foreground" : "",
                          state === "current" ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/10" : "",
                          state === "upcoming" ? "border-border bg-background text-muted-foreground" : "",
                        ].join(" ")}
                      >
                        {state === "complete" ? <Check className="h-5 w-5" /> : state === "current" ? <Circle className="h-3 w-3 fill-current" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                      </div>
                      <div className={`h-0.5 flex-1 ${index === STEPS.length - 1 ? "bg-transparent" : state === "complete" ? "bg-primary" : "bg-border"}`} />
                    </div>
                    <p className={`mt-3 text-sm font-semibold ${state === "current" ? "text-primary" : "text-foreground"}`}>
                      {formatOrderStatus(step)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {time ?? "Waiting"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
        <span><strong className="text-foreground">Created:</strong> {new Date(order.createdAt).toLocaleString("en-IN")}</span>
        <span><strong className="text-foreground">Updated:</strong> {new Date(order.updatedAt).toLocaleString("en-IN")}</span>
        {order.status === "READY" && (
          <span className="font-medium text-primary">Ready for billing</span>
        )}
      </div>
    </section>
  );
}
