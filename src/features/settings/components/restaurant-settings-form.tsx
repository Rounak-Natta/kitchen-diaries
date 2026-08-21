"use client";

import {
  Loader2,
} from "lucide-react";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  updateRestaurantSettings,
} from "../actions/restaurant-settings-action";
import type {
  RestaurantSettingsDto,
} from "../types";

interface RestaurantSettingsFormProps {
  settings:
    RestaurantSettingsDto;

  canUpdate: boolean;
}

export function RestaurantSettingsForm({
  settings,
  canUpdate,
}: RestaurantSettingsFormProps) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    name,
    setName,
  ] = useState(
    settings.name,
  );

  const [
    email,
    setEmail,
  ] = useState(
    settings.email ?? "",
  );

  const [
    phone,
    setPhone,
  ] = useState(
    settings.phone ?? "",
  );

  const [
    address,
    setAddress,
  ] = useState(
    settings.address ?? "",
  );

  const [
    defaultTaxRate,
    setDefaultTaxRate,
  ] = useState(
    settings.defaultTaxRate.toString(),
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<
    string | null
  >(null);

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    if (
      pending ||
      !canUpdate
    ) {
      return;
    }

    const taxRate =
      Number(
        defaultTaxRate,
      );

    if (
      !Number.isFinite(
        taxRate,
      )
    ) {
      setErrorMessage(
        "Enter a valid default tax rate.",
      );

      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(
      async () => {
        const result =
          await updateRestaurantSettings(
            {
              name,
              email,
              phone,
              address,
              defaultTaxRate:
                taxRate,
            },
          );

        if (!result.success) {
          setErrorMessage(
            result.error,
          );

          return;
        }

        setSuccessMessage(
          result.message,
        );

        router.refresh();
      },
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-6"
    >
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">
          Restaurant Details
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="restaurant-name"
              className="text-sm font-medium"
            >
              Restaurant Name
            </label>

            <input
              id="restaurant-name"
              value={name}
              required
              maxLength={150}
              disabled={
                pending ||
                !canUpdate
              }
              onChange={(
                event,
              ) =>
                setName(
                  event.target
                    .value,
                )
              }
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="restaurant-email"
              className="text-sm font-medium"
            >
              Email
            </label>

            <input
              id="restaurant-email"
              type="email"
              value={email}
              maxLength={254}
              disabled={
                pending ||
                !canUpdate
              }
              onChange={(
                event,
              ) =>
                setEmail(
                  event.target
                    .value,
                )
              }
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="restaurant-phone"
              className="text-sm font-medium"
            >
              Phone
            </label>

            <input
              id="restaurant-phone"
              value={phone}
              maxLength={30}
              disabled={
                pending ||
                !canUpdate
              }
              onChange={(
                event,
              ) =>
                setPhone(
                  event.target
                    .value,
                )
              }
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="restaurant-tax"
              className="text-sm font-medium"
            >
              Default Tax Rate
              (%)
            </label>

            <input
              id="restaurant-tax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={
                defaultTaxRate
              }
              required
              disabled={
                pending ||
                !canUpdate
              }
              onChange={(
                event,
              ) =>
                setDefaultTaxRate(
                  event.target
                    .value,
                )
              }
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="restaurant-address"
              className="text-sm font-medium"
            >
              Address
            </label>

            <textarea
              id="restaurant-address"
              rows={4}
              value={address}
              maxLength={500}
              disabled={
                pending ||
                !canUpdate
              }
              onChange={(
                event,
              ) =>
                setAddress(
                  event.target
                    .value,
                )
              }
              className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">
          System Settings
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          These values remain
          locked in v1 because
          billing, reporting and
          document numbering depend
          on them.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              Currency
            </p>

            <p className="mt-1 font-semibold">
              {settings.currency}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Business Timezone
            </p>

            <p className="mt-1 font-semibold">
              {settings.timezone}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Business Day Start
            </p>

            <p className="mt-1 font-semibold">
              {settings.businessDayStartHour
                .toString()
                .padStart(
                  2,
                  "0",
                )}
              :00
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Order Prefix
            </p>

            <p className="mt-1 font-semibold">
              {settings.orderPrefix}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Bill Prefix
            </p>

            <p className="mt-1 font-semibold">
              {settings.billPrefix}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Receipt Prefix
            </p>

            <p className="mt-1 font-semibold">
              {settings.receiptPrefix}
            </p>
          </div>
        </div>
      </section>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}

      {canUpdate ? (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}

          Save Settings
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">
          You have read-only
          access to restaurant
          settings.
        </p>
      )}
    </form>
  );
}