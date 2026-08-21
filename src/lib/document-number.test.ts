import { DocumentType } from "@prisma/client";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildDocumentNumber,
} from "./document-number";

const businessDate = new Date(
  "2026-07-11T00:00:00.000Z",
);

describe("buildDocumentNumber", () => {
  it.each([
    [
      DocumentType.ORDER,
      "ORD-20260711-0001",
    ],
    [
      DocumentType.BILL,
      "BILL-20260711-0001",
    ],
    [
      DocumentType.RECEIPT,
      "RCPT-20260711-0001",
    ],
    [
      DocumentType.INVENTORY_TRANSACTION,
      "INV-20260711-0001",
    ],
    [
      DocumentType.WASTAGE,
      "WST-20260711-0001",
    ],
    [
      DocumentType.REFUND,
      "REF-20260711-0001",
    ],
  ])(
    "formats %s correctly",
    (documentType, expected) => {
      expect(
        buildDocumentNumber({
          documentType,
          businessDate,
          sequenceValue: 1,
        }),
      ).toBe(expected);
    },
  );

  it("pads numbers to four digits", () => {
    expect(
      buildDocumentNumber({
        documentType: DocumentType.ORDER,
        businessDate,
        sequenceValue: 42,
      }),
    ).toBe("ORD-20260711-0042");
  });

  it("rejects more than 9,999 documents per type per day", () => {
    expect(() =>
      buildDocumentNumber({
        documentType: DocumentType.ORDER,
        businessDate,
        sequenceValue: 10_000,
      }),
    ).toThrow(
      "Daily document sequence exceeded 9999.",
    );
  });
});