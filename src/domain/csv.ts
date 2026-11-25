export type CsvValue = string | number | boolean | null | undefined

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 CSV with a header row and CRLF line endings, as spreadsheets expect. */
export function toCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, CsvValue>>): string {
  const lines = [columns.map(cell).join(',')]
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','))
  // A byte-order mark makes Excel read UTF-8 (₹, ≥, names) correctly.
  return `﻿${lines.join('\r\n')}\r\n`
}
