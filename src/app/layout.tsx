import type { Metadata } from "next";

import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "@/app/globals.css";

import { QueryProvider } from "@/components/providers/query-provider";
import { ToasterProvider } from "@/components/providers/toaster-provider";
import { SyncBootstrap } from "@/components/sync/sync-bootstrap";
import { PwaRegister } from "@/components/pwa-register";
import { BugReporter } from "@/components/observability/bug-reporter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KD POS",
    template: "%s | KD POS",
  },

  description:
    "Kitchen Diaries restaurant management and POS system.",
  manifest: "/manifest.json",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={inter.variable}
    >
      <body suppressHydrationWarning className="min-h-screen bg-background font-sans text-foreground antialiased">
        <QueryProvider>

          <PwaRegister />
          <BugReporter />
          <SyncBootstrap />

          {children}

          <ToasterProvider />
        </QueryProvider>

        <SpeedInsights />
      </body>
    </html>
  );
}