export type CsvValue =
  | string
  | number
  | boolean
  | null
  | undefined;

function escapeCsvValue(
  value: CsvValue,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replaceAll(
      '"',
      '""',
    )}"`;
  }

  return text;
}

export function buildCsv(
  headers: readonly string[],
  rows: readonly CsvValue[][],
): string {
  const lines = [
    headers
      .map(escapeCsvValue)
      .join(","),

    ...rows.map((row) =>
      row
        .map(escapeCsvValue)
        .join(","),
    ),
  ];

  /*
   * UTF-8 BOM improves Excel
   * compatibility for ₹ and Indian text.
   */
  return `\uFEFF${lines.join(
    "\r\n",
  )}`;
}