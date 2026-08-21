import { localDb } from "./db";

const BACKUP_VERSION = 1;

const tableNames = [
  "restaurants","categories","menuItems","variations","variationOptions","addons",
  "orders","orderItems","orderItemVariations","orderItemAddons","kots","kotItems","bills","payments",
  "inventoryCategories","inventoryItems","inventoryTransactions","recipes","recipeItems",
  "wastages","wastageItems","syncOutbox","syncMetadata","syncCursor","syncAppliedOperations",
  "localMigrations","syncEntities","documentNumberRanges",
] as const;

export interface LocalBackup {
  format: "kitchen-diaries-local-backup";
  version: number;
  createdAt: string;
  schemaVersion: number;
  tables: Record<string, unknown[]>;
}

export async function createLocalBackup(): Promise<LocalBackup> {
  const tables: Record<string, unknown[]> = {};
  for (const table of tableNames) {
    const value = await (localDb as unknown as Record<string, { toArray: () => Promise<unknown[]> }>)[table]?.toArray();
    tables[table] = value ?? [];
  }
  const schemaVersion = Number((await localDb.syncMetadata.get("localSchemaVersion"))?.value ?? 0);
  return { format: "kitchen-diaries-local-backup", version: BACKUP_VERSION, createdAt: new Date().toISOString(), schemaVersion, tables };
}

export async function validateLocalBackup(backup: unknown): Promise<boolean> {
  if (!backup || typeof backup !== "object") return false;
  const value = backup as Partial<LocalBackup>;
  return value.format === "kitchen-diaries-local-backup" && value.version === BACKUP_VERSION && !!value.tables;
}

export async function restoreLocalBackup(backup: LocalBackup): Promise<void> {
  if (!(await validateLocalBackup(backup))) throw new Error("Invalid Kitchen Diaries backup.");
  const targets = tableNames
    .map((name) => (localDb as unknown as Record<string, unknown>)[name])
    .filter(Boolean) as never[];
  await localDb.transaction("rw", targets, async () => {
    for (const table of tableNames) {
      const target = (localDb as unknown as Record<string, { clear: () => Promise<void>; bulkPut: (records: unknown[]) => Promise<void> }>)[table];
      if (!target) continue;
      await target.clear();
      const rows = backup.tables[table] ?? [];
      if (rows.length) await target.bulkPut(rows);
    }
  });
}
