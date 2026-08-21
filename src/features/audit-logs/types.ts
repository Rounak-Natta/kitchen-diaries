export interface AuditLogFiltersInput {
  from?: string;
  to?: string;

  module?: string;
  action?: string;
  userId?: string;
  query?: string;

  page?: number;
}

export interface AuditLogRangeDto {
  from: string;
  to: string;
  dayCount: number;
  warning: string | null;
}

export interface AuditLogUserOptionDto {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuditLogListItemDto {
  id: string;

  module: string;
  action: string;

  entityType: string | null;
  entityId: string | null;

  reason: string | null;
  requestId: string | null;

  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;

  hasOldData: boolean;
  hasNewData: boolean;

  createdAt: string;
}

export interface AuditLogListResultDto {
  range: AuditLogRangeDto;

  filters: {
    module: string;
    action: string;
    userId: string;
    query: string;
    page: number;
  };

  options: {
    modules: string[];
    actions: string[];
    users: AuditLogUserOptionDto[];
  };

  rows: AuditLogListItemDto[];

  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

export interface AuditLogDetailDto {
  id: string;

  module: string;
  action: string;

  entityType: string | null;
  entityId: string | null;

  reason: string | null;

  oldData: string | null;
  newData: string | null;

  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;

  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;

  createdAt: string;
}