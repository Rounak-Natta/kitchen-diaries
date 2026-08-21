import {
  InventoryUnit,
  Prisma,
} from "@prisma/client";

interface ConvertibleUnit {
  family: "MASS" | "VOLUME";
  factor: Prisma.Decimal;
}

function getConvertibleUnit(
  unit: InventoryUnit,
): ConvertibleUnit | null {
  switch (unit) {
    case InventoryUnit.GRAM:
      return {
        family: "MASS",
        factor: new Prisma.Decimal(1),
      };

    case InventoryUnit.KILOGRAM:
      return {
        family: "MASS",
        factor: new Prisma.Decimal(1_000),
      };

    case InventoryUnit.MILLILITRE:
      return {
        family: "VOLUME",
        factor: new Prisma.Decimal(1),
      };

    case InventoryUnit.LITRE:
      return {
        family: "VOLUME",
        factor: new Prisma.Decimal(1_000),
      };

    default:
      return null;
  }
}

export function convertInventoryQuantity(
  quantity: Prisma.Decimal,
  fromUnit: InventoryUnit,
  toUnit: InventoryUnit,
): Prisma.Decimal {
  if (fromUnit === toUnit) {
    return quantity.toDecimalPlaces(3);
  }

  const from =
    getConvertibleUnit(fromUnit);

  const to =
    getConvertibleUnit(toUnit);

  if (
    !from ||
    !to ||
    from.family !== to.family
  ) {
    throw new Error(
      `Inventory unit ${fromUnit} cannot be converted to ${toUnit}.`,
    );
  }

  return quantity
    .mul(from.factor)
    .div(to.factor)
    .toDecimalPlaces(3);
}