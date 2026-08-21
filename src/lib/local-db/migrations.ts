import { LOCAL_DB_VERSION, localDb } from "./db";

const MIGRATION_KEY = "local-db-migration";

export interface MigrationResult { version: number; applied: boolean; error?: string; }

export async function runLocalMigrations(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];
  await localDb.open();

  for (let version = 1; version <= LOCAL_DB_VERSION; version++) {
    const id = `${MIGRATION_KEY}:${version}`;
    const existing = await localDb.localMigrations.get(id);
    if (existing) { results.push({ version, applied: false }); continue; }

    try {
      await localDb.localMigrations.put({
        id, version, appliedAt: new Date().toISOString(),
      });
      results.push({ version, applied: true });
    } catch (error) {
      results.push({ version, applied: false, error: error instanceof Error ? error.message : "Migration failed." });
      throw error;
    }
  }
  await localDb.syncMetadata.put({
    key: "localSchemaVersion",
    value: String(LOCAL_DB_VERSION),
  });
  return results;
}

export async function getLocalSchemaVersion(): Promise<number> {
  const record = await localDb.syncMetadata.get("localSchemaVersion");
  return Number(record?.value ?? 0);
}

export async function resetLocalDatabase(): Promise<void> {
  await localDb.close();
  await localDb.delete();
  await localDb.open();
}
