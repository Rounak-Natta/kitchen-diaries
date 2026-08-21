import { subHours } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
export const BUSINESS_DAY_START_HOUR = 4;

/**
 * Returns the restaurant business date as YYYY-MM-DD.
 *
 * The business day starts at 4:00 AM Asia/Kolkata.
 * Therefore, 12:00 AM through 3:59 AM belongs to the
 * previous business date.
 */
export function getBusinessDateKey(
  at: Date = new Date(),
): string {
  if (Number.isNaN(at.getTime())) {
    throw new Error("A valid date is required.");
  }

  const shiftedDate = subHours(
    at,
    BUSINESS_DAY_START_HOUR,
  );

  return formatInTimeZone(
    shiftedDate,
    BUSINESS_TIME_ZONE,
    "yyyy-MM-dd",
  );
}

/**
 * Returns a UTC-midnight Date for storage in Prisma @db.Date.
 */
export function getBusinessDate(
  at: Date = new Date(),
): Date {
  const key = getBusinessDateKey(at);

  return new Date(`${key}T00:00:00.000Z`);
}

export function formatBusinessDateForDocument(
  businessDate: Date,
): string {
  if (Number.isNaN(businessDate.getTime())) {
    throw new Error("A valid business date is required.");
  }

  return businessDate
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
}