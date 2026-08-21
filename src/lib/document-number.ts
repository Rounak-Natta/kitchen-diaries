import {
  DocumentType,
  type Prisma,
} from "@prisma/client";
import {
  formatBusinessDateForDocument,
} from "./business-date";

const SEQUENCE_WIDTH = 4;
const MAX_DAILY_SEQUENCE = 9_999;

const DOCUMENT_PREFIXES = {
  [DocumentType.ORDER]: "ORD",
  [DocumentType.BILL]: "BILL",
  [DocumentType.RECEIPT]: "RCPT",
  [DocumentType.INVENTORY_TRANSACTION]: "INV",
  [DocumentType.WASTAGE]: "WST",
  [DocumentType.REFUND]: "REF",
  [DocumentType.EXPORT]: "EXP",
} satisfies Record<DocumentType, string>;

export interface BuildDocumentNumberInput {
  documentType: DocumentType;
  businessDate: Date;
  sequenceValue: number;
}

export interface NextDocumentNumberInput {
  restaurantId: string;
  documentType: DocumentType;
  businessDate: Date;
}

function validateBusinessDate(
  businessDate: Date,
): void {
  if (
    Number.isNaN(
      businessDate.getTime(),
    )
  ) {
    throw new Error(
      "A valid business date is required.",
    );
  }
}

function validateSequenceValue(
  sequenceValue: number,
): void {
  if (
    !Number.isInteger(sequenceValue) ||
    sequenceValue < 1
  ) {
    throw new Error(
      "Document sequence must be a positive integer.",
    );
  }

  if (
    sequenceValue >
    MAX_DAILY_SEQUENCE
  ) {
    throw new Error(
      `Daily document sequence exceeded ${MAX_DAILY_SEQUENCE}.`,
    );
  }
}

/**
 * Pure formatter.
 *
 * Examples:
 * ORD-20260711-0001
 * BILL-20260711-0001
 */
export function buildDocumentNumber(
  input: BuildDocumentNumberInput,
): string {
  validateBusinessDate(
    input.businessDate,
  );

  validateSequenceValue(
    input.sequenceValue,
  );

  const prefix =
    DOCUMENT_PREFIXES[
      input.documentType
    ];

  const datePart =
    formatBusinessDateForDocument(
      input.businessDate,
    );

  const sequencePart =
    input.sequenceValue
      .toString()
      .padStart(
        SEQUENCE_WIDTH,
        "0",
      );

  return `${prefix}-${datePart}-${sequencePart}`;
}

/**
 * Allocates the next sequence inside an existing
 * Prisma transaction.
 *
 * This must be called from the same transaction that
 * creates the order, bill, receipt, wastage, or refund.
 */
export async function nextDocumentNumber(
  transaction: Prisma.TransactionClient,
  input: NextDocumentNumberInput,
): Promise<string> {
  const restaurantId =
    input.restaurantId.trim();

  if (!restaurantId) {
    throw new Error(
      "Restaurant ID is required for document numbering.",
    );
  }

  validateBusinessDate(
    input.businessDate,
  );

  const sequence =
    await transaction.businessSequence.upsert({
      where: {
        restaurantId_documentType_businessDate:
          {
            restaurantId,
            documentType:
              input.documentType,
            businessDate:
              input.businessDate,
          },
      },

      create: {
        restaurantId,
        documentType:
          input.documentType,
        businessDate:
          input.businessDate,
        lastValue: 1,
      },

      update: {
        lastValue: {
          increment: 1,
        },
      },

      select: {
        lastValue: true,
      },
    });

  return buildDocumentNumber({
    documentType:
      input.documentType,

    businessDate:
      input.businessDate,

    sequenceValue:
      sequence.lastValue,
  });
}