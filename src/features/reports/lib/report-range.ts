import {
  getBusinessDate,
} from "@/lib/business-date";

export interface ReportRangeInput {
  from?: string;
  to?: string;
}

export interface ResolvedReportRange {
  from: string;
  to: string;

  dayCount: number;
  warning: string | null;

  businessFromDate: Date;
  businessToExclusiveDate: Date;

  transactionStartUtc: Date;
  transactionEndExclusiveUtc: Date;
}

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const MAX_REPORT_DAYS = 366;

function dateToKey(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

function addUtcDays(
  date: Date,
  days: number,
): Date {
  const result =
    new Date(date);

  result.setUTCDate(
    result.getUTCDate() + days,
  );

  return result;
}

function parseDateKey(
  value:
    | string
    | undefined,
): Date | null {
  if (
    !value ||
    !DATE_PATTERN.test(value)
  ) {
    return null;
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    ) ||
    dateToKey(parsed) !== value
  ) {
    return null;
  }

  return parsed;
}

function getInclusiveDayCount(
  from: Date,
  to: Date,
): number {
  const milliseconds =
    to.getTime() -
    from.getTime();

  return (
    Math.floor(
      milliseconds /
        86_400_000,
    ) + 1
  );
}

function getTransactionBoundary(
  businessDate: string,
): Date {
  /*
   * Business day begins at 04:00
   * Asia/Kolkata.
   */
  return new Date(
    `${businessDate}T04:00:00+05:30`,
  );
}

function getDefaultRange(): {
  fromDate: Date;
  toDate: Date;
} {
  const currentBusinessDate =
    getBusinessDate(
      new Date(),
    );

  const toDate =
    new Date(
      `${dateToKey(
        currentBusinessDate,
      )}T00:00:00.000Z`,
    );

  return {
    fromDate:
      addUtcDays(
        toDate,
        -29,
      ),

    toDate,
  };
}

export function resolveReportRange(
  input: ReportRangeInput,
): ResolvedReportRange {
  const defaultRange =
    getDefaultRange();

  let fromDate =
    parseDateKey(
      input.from,
    );

  let toDate =
    parseDateKey(
      input.to,
    );

  let warning:
    string | null = null;

  if (!fromDate) {
    fromDate =
      defaultRange.fromDate;

    if (input.from) {
      warning =
        "The selected start date was invalid. The default range was used.";
    }
  }

  if (!toDate) {
    toDate =
      defaultRange.toDate;

    if (input.to) {
      warning =
        "The selected end date was invalid. The default range was used.";
    }
  }

  let dayCount =
    getInclusiveDayCount(
      fromDate,
      toDate,
    );

  if (
    dayCount <= 0 ||
    dayCount >
      MAX_REPORT_DAYS
  ) {
    fromDate =
      defaultRange.fromDate;

    toDate =
      defaultRange.toDate;

    dayCount =
      getInclusiveDayCount(
        fromDate,
        toDate,
      );

    warning =
      "Reports support a maximum range of 366 days. The default 30-day range was used.";
  }

  const from =
    dateToKey(fromDate);

  const to =
    dateToKey(toDate);

  const nextBusinessDate =
    dateToKey(
      addUtcDays(
        toDate,
        1,
      ),
    );

  return {
    from,
    to,
    dayCount,
    warning,

    businessFromDate:
      fromDate,

    businessToExclusiveDate:
      addUtcDays(
        toDate,
        1,
      ),

    transactionStartUtc:
      getTransactionBoundary(
        from,
      ),

    transactionEndExclusiveUtc:
      getTransactionBoundary(
        nextBusinessDate,
      ),
  };
}