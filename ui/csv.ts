/**
 * RFC 4180 CSV writer. Plain functions only — no Preact, no DOM — so this module can move to
 * `spy4x/ts-libs` unchanged once the writer half of its CSV module is a release the owner decides
 * to cut; `spy4x/preact-components#141` is the issue that made that call. `ExportButton` is the
 * only caller today, and this stays package-private on purpose: not in `ui/deno.json`'s `exports`,
 * not re-exported from `ui/+index.ts`. Import it only from `./export-button.tsx`.
 */

/** One column of a CSV export: the row field to read, its header text, and how to render a value. */
export interface CsvColumn<T> {
  /** Row field this column reads. */
  key: Extract<keyof T, string>
  /** Header cell text. */
  header: string
  /**
   * Cell text for this field. Defaults to `String(value)`, or `""` for `null`/`undefined`.
   *
   * Takes the raw field value as `unknown` rather than `T[K]`: correlating it exactly to `key`
   * needs either a per-column generic (which cannot be threaded through a plain array without an
   * awkward union of single-column types) or a cast inside every `format` — this pushes the one
   * cast to the caller, who already knows what the field holds.
   */
  format?: (value: unknown, row: T) => string
}

/**
 * Leading characters a spreadsheet reads as the start of a formula, cast wide on purpose.
 *
 * `=`, `+`, `-` and `@` are the four OWASP's CSV-injection guidance names most often; the same
 * guidance also lists a leading tab and a leading carriage return, which Excel treats the same way
 * once the cell is otherwise unquoted. All six are guarded here — a cell that happens to start with
 * a stray tab is rare, but rare is exactly the case a fixed allow-list of "the four symbols" would
 * miss.
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"]

/**
 * Prefix a cell with `'` when it starts with a character a spreadsheet reads as the start of a
 * formula — see {@link FORMULA_PREFIXES}. Every major spreadsheet treats a leading `'` as "force
 * text" and drops it from what is displayed, so the guard is invisible to a reader while it lasts.
 *
 * This is a bare-content guard with no exceptions for a value that only looks dangerous: a column
 * whose `format` produces a plain negative number such as `-5` is guarded exactly like a formula
 * payload that happens to start the same way (`-2+3+cmd|' /C calc'!A1`), and opens as the text
 * `-5` rather than a live number. The alternative — skip the guard when the rest of the cell parses
 * as a plain number — would have let that payload through unguarded too, since "digits after the
 * leading symbol" is a property an attack string can have as easily as a real number can. A caller
 * whose numeric column needs to stay numeric in the opened file routes it around a leading `-` in
 * its own `format` (parentheses for a negative amount, say); the writer does not special-case it.
 */
function guardFormulaInjection(field: string): string {
  return FORMULA_PREFIXES.some((prefix) => field.startsWith(prefix)) ? `'${field}` : field
}

/** Characters whose presence in a cell forces RFC 4180 quoting. */
const NEEDS_QUOTING = /[",\r\n]/

/**
 * Render one field as an RFC 4180 CSV cell: guard it against formula injection, then quote it when
 * it holds a comma, a double quote or a line break, doubling every embedded double quote.
 *
 * Guarding runs first and quoting is decided on the guarded text, but the two never conflict: the
 * `'` the guard adds is not itself a character quoting cares about, and every character quoting
 * does care about survives the guard step unchanged.
 */
export function csvField(raw: string): string {
  const guarded = guardFormulaInjection(raw)
  return NEEDS_QUOTING.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded
}

/** One column's rendered value for one row, before CSV escaping. */
function fieldValue<T>(column: CsvColumn<T>, row: T): string {
  const value = (row as Record<string, unknown>)[column.key]
  if (column.format) return column.format(value, row)
  return value === null || value === undefined ? "" : String(value)
}

/** One data row, rendered and escaped, comma-joined. */
export function csvRow<T>(columns: readonly CsvColumn<T>[], row: T): string {
  return columns.map((column) => csvField(fieldValue(column, row))).join(",")
}

/** The header row, escaped the same way a data row is. */
export function csvHeaderRow<T>(columns: readonly CsvColumn<T>[]): string {
  return columns.map((column) => csvField(column.header)).join(",")
}

/**
 * The line ending this writer emits: `\r\n`, exactly as RFC 4180 §2.1 specifies. Excel reads a
 * bare `\n` too, but a `\r\n` file is unambiguous with every spreadsheet on every platform, which a
 * bare `\n` is not guaranteed to be — RFC 4180 is the one line ending nothing gets to disagree with.
 */
const LINE_ENDING = "\r\n"

/**
 * Render every row as RFC 4180 CSV text: a header row, one line per row of `rows`, each terminated
 * by {@link LINE_ENDING} — including the last line, which the RFC leaves optional but which every
 * row here carries for one uniform rule instead of a special case for the final row.
 *
 * `rows` empty renders the header alone. That is a deliberate default, not an omission: an export
 * of a filtered view that currently matches nothing is still a real, openable file naming its own
 * columns, and a caller who would rather show nothing for zero rows can check its own row count
 * before calling this.
 */
export function toCsvText<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [csvHeaderRow(columns), ...rows.map((row) => csvRow(columns, row))]
  return lines.map((line) => line + LINE_ENDING).join("")
}

/**
 * UTF-8 byte-order mark. Excel opens a BOM-less CSV with the system codepage, which mangles
 * anything outside it; a leading BOM is what tells Excel — and only Excel needs telling, every
 * other reader treats UTF-8 as its default — to read the file as UTF-8 instead.
 */
export const CSV_BYTE_ORDER_MARK = "﻿"

/** {@link toCsvText}, encoded as UTF-8 bytes with a leading {@link CSV_BYTE_ORDER_MARK}. */
export function toCsvBytes<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(CSV_BYTE_ORDER_MARK + toCsvText(columns, rows))
}
