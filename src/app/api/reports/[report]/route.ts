import { NextResponse } from "next/server";

import {
  buildCsv,
  type CsvValue,
} from "@/features/reports/lib/csv";

import type {
  ReportRangeInput,
} from "@/features/reports/lib/report-range";

import {
  getReportsDashboard,
} from "@/features/reports/queries/report-queries";

import {
  getAuthUser,
} from "@/lib/api-auth";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/rbac";

interface RouteContext {
  params: Promise<{
    report: string;
  }>;
}

type SupportedReport =
  | "sales"
  | "payments"
  | "inventory"
  | "wastage"
  | "profit";

const SUPPORTED_REPORTS: readonly SupportedReport[] = [
  "sales",
  "payments",
  "inventory",
  "wastage",
  "profit",
];

function isSupportedReport(
  value: string,
): value is SupportedReport {
  return SUPPORTED_REPORTS.includes(
    value as SupportedReport,
  );
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized.",
    },
    {
      status: 401,
    },
  );
}

function forbidden(
  message = "You do not have permission to export reports.",
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status: 403,
    },
  );
}

function notFound(
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status: 404,
    },
  );
}

function serverError(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Failed to export report.",
    },
    {
      status: 500,
    },
  );
}

function csvResponse(
  csv: string,
  filename: string,
): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type":
        "text/csv; charset=utf-8",

      "Content-Disposition":
        `attachment; filename="${filename}"`,

      "Cache-Control":
        "no-store, max-age=0",

      Pragma: "no-cache",

      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function getRangeInput(
  request: Request,
): ReportRangeInput {
  const url = new URL(
    request.url,
  );

  const range: ReportRangeInput = {};

  const from =
    url.searchParams.get("from");

  const to =
    url.searchParams.get("to");

  if (from !== null) {
    range.from = from;
  }

  if (to !== null) {
    range.to = to;
  }

  return range;
}

function buildSalesCsv(
  data: Awaited<
    ReturnType<typeof getReportsDashboard>
  >,
): string {
  const rows: CsvValue[][] =
    data.salesRows.map(
      (row) => [
        row.businessDate,
        row.billNumber,
        row.receiptNumber,
        row.orderNumber,
        row.customerName,
        row.billStatus,
        row.paymentStatus,
        row.grossSales,
        row.refundedAmount,
        row.netSales,
        row.amountPaid,
        row.dueAmount,
        row.taxAmount,
        row.discountAmount,
        row.createdByName,
        row.createdAt,
      ],
    );

  return buildCsv(
    [
      "Business Date",
      "Bill Number",
      "Receipt Number",
      "Order Number",
      "Customer",
      "Bill Status",
      "Payment Status",
      "Gross Sales",
      "Refunded Amount",
      "Net Sales",
      "Amount Paid",
      "Due Amount",
      "Tax",
      "Discount",
      "Created By",
      "Created At",
    ],
    rows,
  );
}

function buildPaymentsCsv(
  data: Awaited<
    ReturnType<typeof getReportsDashboard>
  >,
): string {
  const rows: CsvValue[][] =
    data.paymentRows.map(
      (row) => [
        row.createdAt,
        row.direction,
        row.documentNumber,
        row.billNumber,
        row.orderNumber,
        row.method,
        row.amount,
        row.signedAmount,
        row.referenceNo,
        row.description,
        row.recordedByName,
      ],
    );

  return buildCsv(
    [
      "Created At",
      "Type",
      "Document Number",
      "Bill Number",
      "Order Number",
      "Method",
      "Amount",
      "Signed Amount",
      "Reference Number",
      "Description",
      "Recorded By",
    ],
    rows,
  );
}

function buildInventoryCsv(
  data: Awaited<
    ReturnType<typeof getReportsDashboard>
  >,
): string {
  const rows: CsvValue[][] =
    data.inventoryRows.map(
      (row) => [
        row.name,
        row.code,
        row.categoryName,
        row.unit,
        row.currentStock,
        row.minimumStock,
        row.reorderLevel,
        row.averageCost,
        row.stockValue,
        row.status,
      ],
    );

  return buildCsv(
    [
      "Item Name",
      "Code",
      "Category",
      "Unit",
      "Current Stock",
      "Minimum Stock",
      "Reorder Level",
      "Average Cost",
      "Stock Value",
      "Status",
    ],
    rows,
  );
}

function buildWastageCsv(
  data: Awaited<
    ReturnType<typeof getReportsDashboard>
  >,
): string {
  const rows: CsvValue[][] =
    data.wastageRows.map(
      (row) => [
        row.businessDate,
        row.wastageNumber,
        row.inventoryItemName,
        row.inventoryItemCode,
        row.reason,
        row.quantity,
        row.unit,
        row.unitCost,
        row.totalCost,
        row.createdByName,
        row.approvedByName,
        row.postedAt,
      ],
    );

  return buildCsv(
    [
      "Business Date",
      "Wastage Number",
      "Inventory Item",
      "Item Code",
      "Reason",
      "Quantity",
      "Unit",
      "Unit Cost",
      "Total Cost",
      "Created By",
      "Approved By",
      "Posted At",
    ],
    rows,
  );
}

function buildProfitCsv(
  data: Awaited<
    ReturnType<typeof getReportsDashboard>
  >,
): string {
  const rows: CsvValue[][] =
    data.profitRows.map(
      (row) => [
        row.businessDate,
        row.billNumber,
        row.orderNumber,
        row.itemName,
        row.categoryName,
        row.quantity,
        row.billedNetSales,
        row.allocatedRefund,
        row.adjustedNetSales,
        row.costAmount,
        row.grossProfit,
        row.grossMarginPercent,
      ],
    );

  return buildCsv(
    [
      "Business Date",
      "Bill Number",
      "Order Number",
      "Item",
      "Category",
      "Quantity",
      "Billed Net Sales",
      "Allocated Refund",
      "Adjusted Net Sales",
      "Cost",
      "Gross Profit",
      "Gross Margin Percent",
    ],
    rows,
  );
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const user =
      await getAuthUser();

    if (!user) {
      return unauthorized();
    }

    if (
      !hasPermission(
        user.role,
        PERMISSIONS.REPORTS_EXPORT,
      )
    ) {
      return forbidden();
    }

    if (!user.restaurantId) {
      return forbidden(
        "No restaurant is assigned to this user.",
      );
    }

    const { report } =
      await context.params;

    if (
      !isSupportedReport(report)
    ) {
      return notFound(
        "Unsupported report type.",
      );
    }

    const canViewProfit =
      hasPermission(
        user.role,
        PERMISSIONS.PROFIT_ANALYTICS_READ,
      );

    if (
      report === "profit" &&
      !canViewProfit
    ) {
      return forbidden(
        "You do not have permission to export profit information.",
      );
    }

    const rangeInput =
      getRangeInput(request);

    const data =
      await getReportsDashboard(
        user.restaurantId,
        rangeInput,
        canViewProfit,
      );

    const filename =
      `${report}-report-${data.range.from}-to-${data.range.to}.csv`;

    switch (report) {
      case "sales":
        return csvResponse(
          buildSalesCsv(data),
          filename,
        );

      case "payments":
        return csvResponse(
          buildPaymentsCsv(data),
          filename,
        );

      case "inventory":
        return csvResponse(
          buildInventoryCsv(data),
          filename,
        );

      case "wastage":
        return csvResponse(
          buildWastageCsv(data),
          filename,
        );

      case "profit":
        return csvResponse(
          buildProfitCsv(data),
          filename,
        );
    }
  } catch (error: unknown) {
    console.error(
      "GET /api/reports/[report] error:",
      error,
    );

    return serverError();
  }
}