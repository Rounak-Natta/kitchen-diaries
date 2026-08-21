import {
  Prisma,
} from "@prisma/client";

export function stringifyExportJson(
  value: unknown,
): string {
  return JSON.stringify(
    value,
    (
      _key,
      currentValue: unknown,
    ) => {
      if (
        typeof currentValue ===
        "bigint"
      ) {
        return currentValue.toString();
      }

      if (
        Prisma.Decimal.isDecimal(
          currentValue,
        )
      ) {
        return currentValue.toString();
      }

      return currentValue;
    },
    2,
  );
}