import {
  AUTH_SESSION_TTL_SECONDS,
} from "@/lib/auth";

export const AUTH_COOKIE_NAME = "token";

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_SESSION_TTL_SECONDS,
  };
}

export function getExpiredAuthCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
