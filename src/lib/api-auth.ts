import {
  cookies,
  headers,
} from "next/headers";

import {
  verifyToken,
  type AuthUser,
} from "@/lib/auth";

import {
  AUTH_COOKIE_NAME,
} from "@/lib/auth-cookie";

import {
  prisma,
} from "@/lib/prisma";

function extractBearerToken(
  authorization: string | null,
): string | undefined {
  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    return undefined;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  return token || undefined;
}

function extractCookieToken(
  cookieHeader: string | null,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (
    const rawCookie of cookieHeader.split(";")
  ) {
    const cookie =
      rawCookie.trim();

    const separator =
      cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name =
      cookie.slice(
        0,
        separator,
      );

    if (
      name !==
      AUTH_COOKIE_NAME
    ) {
      continue;
    }

    const value =
      cookie.slice(
        separator + 1,
      );

    if (!value) {
      return undefined;
    }

    try {
      return decodeURIComponent(
        value,
      );
    } catch {
      return value;
    }
  }

  return undefined;
}

export async function getAuthUser(
  request?: Request,
): Promise<AuthUser | null> {
  let token:
    | string
    | undefined;

  // ====================================================
  // EXPLICIT REQUEST
  // ====================================================

  if (request) {
    token =
      extractBearerToken(
        request.headers.get(
          "authorization",
        ),
      );

    if (!token) {
      token =
        extractCookieToken(
          request.headers.get(
            "cookie",
          ),
        );
    }

    /*
     * IMPORTANT:
     *
     * When a Request was explicitly supplied,
     * do NOT fall back to next/headers().
     *
     * This makes API routes deterministic and
     * allows direct route-handler integration tests.
     */
  } else {
    // ==================================================
    // NEXT SERVER REQUEST CONTEXT
    // ==================================================

    const headersList =
      await headers();

    token =
      extractBearerToken(
        headersList.get(
          "authorization",
        ),
      );

    if (!token) {
      const cookieStore =
        await cookies();

      token =
        cookieStore.get(
          AUTH_COOKIE_NAME,
        )?.value;
    }
  }

  // ====================================================
  // NO TOKEN
  // ====================================================

  if (!token) {
    return null;
  }

  // ====================================================
  // VERIFY TOKEN
  // ====================================================

  const tokenUser =
    verifyToken(
      token,
    );

  if (!tokenUser) {
    return null;
  }

  // ====================================================
  // LOAD USER
  // ====================================================

  try {
    const databaseUser =
      await prisma.user.findUnique({
        where: {
          id:
            tokenUser.id,
        },

        select: {
          id:
            true,

          name:
            true,

          email:
            true,

          role:
            true,

          isActive:
            true,

          restaurantId:
            true,

          restaurant: {
            select: {
              isActive:
                true,
            },
          },
        },
      });

    if (
      !databaseUser ||
      !databaseUser.isActive ||
      !databaseUser.restaurant.isActive
    ) {
      return null;
    }

    return {
      id:
        databaseUser.id,

      restaurantId:
        databaseUser.restaurantId,

      name:
        databaseUser.name,

      email:
        databaseUser.email,

      role:
        databaseUser.role,
    };
  } catch (
    error: unknown
  ) {
    console.error(
      "GET_AUTH_USER_DATABASE_ERROR:",
      error,
    );

    return null;
  }
}