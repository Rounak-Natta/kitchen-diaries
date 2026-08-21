import {
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export function GET(): Response {
  return NextResponse.json(
    {
      status: "ok",

      service:
        "kitchen-diaries",

      timestamp:
        new Date().toISOString(),

      uptimeSeconds:
        Math.floor(
          process.uptime(),
        ),
    },
    {
      status: 200,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}