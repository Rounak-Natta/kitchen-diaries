"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { localDb } from "@/lib/local-db/db";
import { clearLocalSession } from "@/lib/local-db/session";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout(): Promise<void> {
    if (loading) return;

    try {
      setLoading(true);

      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => undefined);
    } finally {
      // Never leave an offline authorization lease behind on a shared POS device.
      await clearLocalSession().catch(() => undefined);
      await localDb.syncMetadata.delete("localSubscription").catch(() => undefined);

      router.replace("/login");
      router.refresh();
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="btn-primary min-w-[140px] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
