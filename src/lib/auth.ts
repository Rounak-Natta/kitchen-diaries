import bcrypt from "bcryptjs";
import jwt, {
  type JwtPayload,
  type Secret,
} from "jsonwebtoken";

import { Role } from "@prisma/client";

import {
  AUTH_SESSION_TTL_SECONDS,
  createOfflineLease,
  type OfflineLease,
} from "./auth/offline-lease";

export {
  AUTH_SESSION_TTL_SECONDS,
  createOfflineLease,
  getOfflineAccessStatus,
  type OfflineAccessStatus,
  type OfflineLease,
} from "./auth/offline-lease";

const JWT_ISSUER = "kitchen-diaries";
const JWT_AUDIENCE = "kitchen-diaries-app";

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET is not defined.");
  }

  if (secret.length < 32) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters.",
    );
  }

  return secret;
}

const JWT_SECRET: Secret = getJwtSecret();

export interface AuthUser {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: Role;
  lastValidatedAt?: string;
  offlineWarningAt?: string;
  offlineGraceUntil?: string;
}

export async function hashPassword(
  password: string,
): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

function isRole(
  value: unknown,
): value is Role {
  return (
    typeof value === "string" &&
    Object.values(Role).includes(
      value as Role,
    )
  );
}

function isValidAuthPayload(
  value: string | JwtPayload,
): value is JwtPayload & AuthUser {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.restaurantId === "string" &&
    value.restaurantId.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.email === "string" &&
    value.email.length > 0 &&
    isRole(value.role)
  );
}

export function generateToken(
  payload: AuthUser,
  lease: OfflineLease = createOfflineLease(),
): string {
  return jwt.sign(
    {
      ...payload,
      lastValidatedAt: lease.lastValidatedAt,
      offlineWarningAt: lease.offlineWarningAt,
      offlineGraceUntil: lease.offlineGraceUntil,
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: AUTH_SESSION_TTL_SECONDS,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: payload.id,
    },
  );
}

export function verifyToken(
  token: string,
): AuthUser | null {
  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET,
      {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );

    if (!isValidAuthPayload(decoded)) {
      return null;
    }

    const issuedAt =
      typeof decoded.iat === "number"
        ? new Date(decoded.iat * 1000)
        : new Date();

    const fallbackLease =
      createOfflineLease(issuedAt);

    return {
      id: decoded.id,
      restaurantId: decoded.restaurantId,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      lastValidatedAt:
        typeof decoded.lastValidatedAt === "string"
          ? decoded.lastValidatedAt
          : fallbackLease.lastValidatedAt,
      offlineWarningAt:
        typeof decoded.offlineWarningAt === "string"
          ? decoded.offlineWarningAt
          : fallbackLease.offlineWarningAt,
      offlineGraceUntil:
        typeof decoded.offlineGraceUntil === "string"
          ? decoded.offlineGraceUntil
          : fallbackLease.offlineGraceUntil,
    };
  } catch {
    return null;
  }
}
