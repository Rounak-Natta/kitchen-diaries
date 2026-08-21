import type {
  ExportFormat,
  ExportStatus,
  ExportType,
} from "@prisma/client";

export interface DataExportHistoryItemDto {
  id: string;
  exportNumber: string;

  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;

  fileName: string | null;
  fileUrl: string | null;
  errorMessage: string | null;

  requestedByName: string | null;
  requestedByEmail: string | null;

  sha256: string | null;
  totalRows: number | null;
  rowCounts: Record<string, number> | null;

  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FullDataExportManifest {
  schemaVersion: number;

  exportNumber: string;
  exportType: "FULL_DATA";
  format: "JSON";

  generatedAt: string;

  restaurantId: string;

  requestedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  };

  security: {
    passwordHashesIncluded: false;
    omittedFields: string[];
  };

  rowCounts: Record<string, number>;
  totalRows: number;
}

export interface FullDataExportSnapshot {
  manifest: FullDataExportManifest;

  data: Record<
    string,
    unknown
  >;
}