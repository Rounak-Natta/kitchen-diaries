"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ChefHat,
  Check,
  CloudOff,
  Download,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";

const features = [
  {
    icon: ReceiptText,
    title: "Billing",
    text: "Create bills quickly and keep every order moving.",
  },
  {
    icon: ChefHat,
    title: "Kitchen",
    text: "Send clear KOTs and keep the kitchen in sync.",
  },
  {
    icon: PackageCheck,
    title: "Inventory",
    text: "Know what you have, what is moving and what needs attention.",
  },
  {
    icon: BarChart3,
    title: "Insights",
    text: "Understand sales and operations without digging through reports.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Take orders",
    text: "Table, takeaway or counter.",
  },
  {
    number: "02",
    title: "Send to kitchen",
    text: "KOTs move instantly to the right workflow.",
  },
  {
    number: "03",
    title: "Bill & collect",
    text: "Close orders without unnecessary steps.",
  },
  {
    number: "04",
    title: "See your day",
    text: "Understand what happened at a glance.",
  },
];

export default function HomePage() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true
    ) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      window.location.href = "/login";
      return;
    }

    // @ts-expect-error beforeinstallprompt event
    await installPrompt.prompt();

    // @ts-expect-error beforeinstallprompt event
    await installPrompt.userChoice;

    setInstallPrompt(null);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f9f8] text-slate-950">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Kitchen Diaries"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[#0f766e] text-white shadow-sm">
            <ChefHat className="size-5" strokeWidth={2.1} />
          </span>

          <span>
            <span className="block text-[15px] font-bold tracking-tight">
              Kitchen Diaries
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Restaurant operations
            </span>
          </span>
        </Link>

        {/* Only customer-facing action */}
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-5 text-xs font-semibold text-white transition hover:bg-[#0f766e]"
        >
          Login
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {/* =====================================================
          HERO
      ====================================================== */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:pb-28 lg:pt-28">
        <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#0f766e]/10 bg-white px-3.5 py-2 text-[10px] font-semibold text-[#0f766e] shadow-sm">
              <Sparkles className="size-3.5" />
              Built for restaurants
            </div>

            <h1 className="max-w-2xl text-[clamp(3.2rem,7vw,5.8rem)] font-semibold leading-[0.94] tracking-[-0.07em]">
              Your restaurant.
              <span className="block text-[#0f766e]">Simplified.</span>
            </h1>

            <p className="mt-7 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">
              Kitchen Diaries brings orders, KOT, billing, inventory and
              business insights into one simple workspace.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-7 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(15,118,110,.18)] transition hover:-translate-y-0.5 hover:bg-[#0b655e]"
              >
                Login to Kitchen Diaries
                <ArrowRight className="size-4" />
              </Link>

              {!installed && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Download className="size-4" />
                  Install Kitchen Diaries
                </button>
              )}
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-2">
                <Check className="size-3.5 text-[#0f766e]" />
                Fast billing
              </span>

              <span className="inline-flex items-center gap-2">
                <Check className="size-3.5 text-[#0f766e]" />
                Kitchen workflow
              </span>

              <span className="inline-flex items-center gap-2">
                <Check className="size-3.5 text-[#0f766e]" />
                Offline ready
              </span>
            </div>
          </div>

          {/* =================================================
              PRODUCT PREVIEW
          ================================================== */}
          <div className="relative">
            <div className="absolute -inset-8 rounded-[50px] bg-[#65c7bd]/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,.10)]">
              {/* Browser bar */}
              <div className="flex h-12 items-center justify-between border-b border-slate-100 px-5">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-slate-200" />
                  <span className="size-2 rounded-full bg-slate-200" />
                  <span className="size-2 rounded-full bg-slate-200" />
                </div>

                <span className="text-[10px] font-medium text-slate-400">
                  Kitchen Diaries
                </span>

                <div className="size-4" />
              </div>

              <div className="grid min-h-[430px] grid-cols-[74px_1fr]">
                {/* Sidebar */}
                <aside className="border-r border-slate-100 bg-[#fafcfc] p-3">
                  <div className="mb-8 grid size-9 place-items-center rounded-xl bg-[#0f766e] text-white">
                    <ChefHat className="size-4" />
                  </div>

                  <div className="space-y-3">
                    {[ReceiptText, ChefHat, PackageCheck, BarChart3].map(
                      (Icon, index) => (
                        <div
                          key={index}
                          className={`grid size-9 place-items-center rounded-xl ${
                            index === 0
                              ? "bg-[#e8f6f4] text-[#0f766e]"
                              : "text-slate-300"
                          }`}
                        >
                          <Icon className="size-4" />
                        </div>
                      ),
                    )}
                  </div>
                </aside>

                {/* Dashboard */}
                <div className="bg-white p-5 sm:p-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Today
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Good morning
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[9px] font-semibold text-emerald-700">
                        Ready
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-7 grid grid-cols-3 gap-3">
                    {[
                      ["₹48.2k", "Sales"],
                      ["126", "Orders"],
                      ["94%", "KOT"],
                    ].map(([value, label]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-slate-100 bg-[#fafcfc] p-3.5"
                      >
                        <p className="text-lg font-semibold tracking-tight">
                          {value}
                        </p>
                        <p className="mt-1 text-[9px] font-medium text-slate-400">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Order list */}
                  <div className="mt-5 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-[10px] font-semibold">Live orders</p>
                      <p className="text-[9px] font-medium text-[#0f766e]">
                        View all
                      </p>
                    </div>

                    {[
                      ["#1042", "Table 06", "Preparing"],
                      ["#1041", "Table 12", "Ready"],
                      ["#1040", "Takeaway", "Preparing"],
                    ].map(([order, table, status]) => (
                      <div
                        key={order}
                        className="flex items-center justify-between border-b border-slate-50 px-4 py-3 last:border-0"
                      >
                        <div>
                          <p className="text-[10px] font-semibold">{order}</p>
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            {table}
                          </p>
                        </div>

                        <span className="rounded-full bg-[#e8f6f4] px-2.5 py-1 text-[8px] font-semibold text-[#0f766e]">
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          INSTALL STRIP
      ====================================================== */}
      <section className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f6f4] text-[#0f766e]">
              <Download className="size-5" />
            </div>

            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Keep Kitchen Diaries ready on your device.
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                Install it once and open it like an app whenever you need it.
              </p>
            </div>
          </div>

          {!installed ? (
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white transition hover:bg-[#0f766e]"
            >
              <Download className="size-3.5" />
              Install now
            </button>
          ) : (
            <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-5 text-xs font-semibold text-emerald-700">
              <Check className="size-3.5" />
              Installed
            </span>
          )}
        </div>
      </section>

      {/* =====================================================
          FEATURES
      ====================================================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#0f766e]">
            Everything in one place
          </p>

          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            The work your restaurant does every day.
          </h2>

          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Nothing unnecessary. Just the tools your team needs to keep service
            moving.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="rounded-[24px] border border-slate-200/80 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,.06)]"
              >
                <div className="grid size-11 place-items-center rounded-2xl bg-[#e8f6f4] text-[#0f766e]">
                  <Icon className="size-5" strokeWidth={1.8} />
                </div>

                <h3 className="mt-7 text-sm font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {feature.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* =====================================================
          WORKFLOW
      ====================================================== */}
      <section className="bg-[#111827]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#65c7bd]">
              One simple flow
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
              From order to close.
            </h2>

            <p className="mt-5 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
              Your team should not need to think about the software. Kitchen
              Diaries keeps the process straightforward.
            </p>
          </div>

          <div className="mt-14 grid border-t border-white/10 md:grid-cols-4">
            {workflow.map((item) => (
              <div
                key={item.number}
                className="border-b border-white/10 py-7 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
              >
                <span className="text-xs font-bold text-[#65c7bd]">
                  {item.number}
                </span>

                <h3 className="mt-5 text-base font-semibold text-white">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY KD
      ====================================================== */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-[#e8f6f4] text-[#0f766e]">
              <CloudOff className="size-6" />
            </div>

            <h2 className="mt-7 max-w-xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              Your restaurant should keep working.
            </h2>

            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
              Connectivity should not stop your team from taking orders,
              preparing bills or serving customers.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                icon: WifiOff,
                title: "Keep working when connectivity drops",
                text: "Your core restaurant workflow stays available.",
              },
              {
                icon: ShieldCheck,
                title: "Give staff the right access",
                text: "Role-based access keeps operations controlled.",
              },
              {
                icon: Users,
                title: "Designed around restaurant teams",
                text: "Simple enough for daily use across the team.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600">
                    <Icon className="size-4" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
      ====================================================== */}
      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[30px] bg-[#0f766e] px-6 py-14 text-center sm:px-10 sm:py-18">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
            Kitchen Diaries
          </p>

          <h2 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
            Spend less time managing software.
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
            Keep your restaurant moving with one simple operating system.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
            >
              Login to Kitchen Diaries
              <ArrowRight className="size-4" />
            </Link>

            {!installed && (
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <Download className="size-4" />
                Install Kitchen Diaries
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          FOOTER
      ====================================================== */}
      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} Kitchen Diaries. Restaurant operations,
          simplified.
        </p>

        {/* The ONLY admin link */}
        <a
          href="https://kd-admin-theta.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit font-medium text-slate-400 transition hover:text-slate-600"
        >
          Admin
        </a>
      </footer>
    </main>
  );
}