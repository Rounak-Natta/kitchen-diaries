import {
  NextResponse,
} from "next/server";

import {
  AUTH_COOKIE_NAME,
  getExpiredAuthCookieOptions,
} from "@/lib/auth-cookie";

export const dynamic =
  "force-dynamic";

export async function POST(): Promise<Response> {
  const response =
    NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );

  response.cookies.set(
    AUTH_COOKIE_NAME,
    "",
    getExpiredAuthCookieOptions(),
  );

  return response;
}