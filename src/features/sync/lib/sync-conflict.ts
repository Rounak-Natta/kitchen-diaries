// ======================================================
// SYNC CONFLICT
// ======================================================

export interface SyncConflict {
  operationId: string;

  entityType: string;

  entityId: string;

  baseVersion: number | null;

  currentVersion: number;

  reason: string;
}

// ======================================================
// CONFLICT ERROR
// ======================================================

export class SyncConflictError
  extends Error
{
  readonly conflict:
    SyncConflict;

  constructor(
    conflict: SyncConflict,
  ) {
    super(
      conflict.reason,
    );

    this.name =
      "SyncConflictError";

    this.conflict =
      conflict;
  }
}