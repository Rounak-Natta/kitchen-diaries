import {
  localDb,
  type DocumentNumberRangeRecord,
} from "./db";

export interface SaveDocumentNumberRangeInput {
  id: string;

  deviceId: string;
  restaurantId: string;

  documentType: string;
  businessDate: string;

  startValue: number;
  endValue: number;
  nextValue: number;
}

export async function saveDocumentNumberRange(
  input: SaveDocumentNumberRangeInput,
): Promise<void> {
  const record: DocumentNumberRangeRecord = {
    id: input.id,

    deviceId:
      input.deviceId,

    restaurantId:
      input.restaurantId,

    documentType:
      input.documentType,

    businessDate:
      input.businessDate,

    startValue:
      input.startValue,

    endValue:
      input.endValue,

    nextValue:
      input.nextValue,

    createdAt:
      new Date().toISOString(),
  };

  await localDb.documentNumberRanges.put(
    record,
  );
}

export async function getDocumentNumberRange(
  id: string,
): Promise<DocumentNumberRangeRecord | undefined> {
  return localDb.documentNumberRanges.get(
    id,
  );
}

export async function getAvailableDocumentNumberRange(
  deviceId: string,
  documentType: string,
  businessDate: string,
): Promise<DocumentNumberRangeRecord | undefined> {
  return localDb.documentNumberRanges
    .where(
      "[deviceId+documentType+businessDate]",
    )
    .equals([
      deviceId,
      documentType,
      businessDate,
    ])
    .filter(
      (range) =>
        range.nextValue <=
        range.endValue,
    )
    .first();
}
export async function allocateNextDocumentNumber(
  deviceId: string,
  documentType: string,
  businessDate: string,
): Promise<number | null> {
  return localDb.transaction(
    "rw",
    localDb.documentNumberRanges,
    async () => {
      const range =
        await getAvailableDocumentNumberRange(
          deviceId,
          documentType,
          businessDate,
        );

      if (!range) {
        return null;
      }

      const allocatedNumber =
        range.nextValue;

      range.nextValue += 1;

      await localDb.documentNumberRanges.put(
        range,
      );

      return allocatedNumber;
    },
  );
}