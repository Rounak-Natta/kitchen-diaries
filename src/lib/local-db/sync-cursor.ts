export interface SyncCursor {
  createdAt: string;
  id: string;
}

export function encodeSyncCursor(cursor: SyncCursor): string {
  const json = JSON.stringify(cursor);
  if (typeof btoa === "function") return btoa(json);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeSyncCursor(value: string): SyncCursor | null {
  try {
    const json = typeof atob === "function"
      ? atob(value)
      : Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SyncCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    // Backward-compatible timestamp cursors from older clients.
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : { createdAt: date.toISOString(), id: "" };
  }
}
