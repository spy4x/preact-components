/**
 * `ImportMapper`'s card, spread into the Fields section after `DateTimeField`.
 *
 * The demo is a bank statement of 20 columns, already split into strings the way a CSV reader
 * hands them over. Everything the app owns is faked here in a few lines: reading a date by the
 * chosen format, reading an amount by the chosen decimal mark, the row errors, and a re-read that
 * takes 1.5 s after a setting changes. What only a browser shows (the keyboard order, focus from
 * the summary, the delayed placeholders, no sideways page scroll at 390 px, axe in both palettes)
 * is driven by `pages/e2e/import-mapper.spec.ts`.
 */

import { useSignal } from "@preact/signals"
import {
  type ColumnMap,
  type ImportField,
  ImportMapper,
  type ImportPreviewRow,
  type ImportSetting,
} from "@spy4x/preact-ui"
import { useEffect, useRef } from "preact/hooks"
import type { DemoFragment } from "../registry.ts"
import { DemoNote } from "./demo-note.tsx"

/** The statement's header row: 20 columns, as banks export them. */
const HEADER = [
  "Booking date",
  "Value date",
  "Type",
  "Purpose",
  "Payee",
  "Payee account",
  "Bank code",
  "Amount",
  "Currency",
  "Balance after",
  "Reference",
  "Mandate",
  "Creditor ID",
  "Category",
  "Note",
  "Card",
  "Place",
  "Exchange rate",
  "Fee",
  "Status",
]

/** One statement row: the cells this demo fills, the other columns empty. */
function row(
  date: string,
  type: string,
  purpose: string,
  amount: string,
  balance: string,
  reference = "",
): string[] {
  const cells = Array.from({ length: HEADER.length }, () => "")
  Object.assign(cells, { 0: date, 1: date, 2: type, 3: purpose, 7: amount, 8: "EUR" })
  Object.assign(cells, { 9: balance, 10: reference, 19: "Booked" })
  return cells
}

/**
 * The first rows. Two can't be read on purpose, one purpose is long, and two cells hold markup and
 * a formula, which the preview shows as written.
 */
const ROWS = [
  row("03.11.2026", "Card payment", "COFFEE CORNER 0423", "-4,20", "2.445,80", "RF18 0001"),
  row("04.11.2026", "Transfer", "SALARY NOVEMBER", "2.450,00", "4.895,80", "RF18 0002"),
  row("05.11.2026", "Direct debit", "<b>x</b> MARKET HALL", "-56,13", "4.839,67", "=SUM(A1)"),
  row("05.11.2026", "Transfer", "TO SAVINGS", "n/a", "4.839,67"),
  row("31.02.2026", "Card payment", "BAKERY 12", "-3,20", "4.836,47"),
  row(
    "07.11.2026",
    "Card payment",
    "HARDWARE STORE, ORDER 55-2231, PAID IN 3 PARTS, PART 1 OF 3, SEE THE INVOICE SENT ON 1 NOVEMBER FOR THE FULL LIST OF ITEMS",
    "-1.234,56",
    "3.601,91",
  ),
]

/** What the app reads from each row, with the writer's words. */
const FIELDS: ImportField[] = [
  { key: "date", label: "Date", required: true },
  { key: "description", label: "Description", required: true },
  { key: "amount", label: "Amount", numeric: true },
  { key: "debit", label: "Money out", numeric: true },
  { key: "credit", label: "Money in", numeric: true },
  { key: "currency", label: "Currency" },
  { key: "reference", label: "Reference" },
]

/** The app's guess, as a CSV reader would make it from the header names. */
const GUESS: ColumnMap = {
  date: 0,
  description: 3,
  amount: 7,
  debit: null,
  credit: null,
  currency: 8,
  reference: 10,
}

/** Each date format's pattern, as a reader's guesses name them. */
const DATE_FORMATS: Record<string, RegExp> = {
  "DD.MM.YYYY": /^(?<d>\d{2})\.(?<m>\d{2})\.(?<y>\d{4})$/,
  "DD/MM/YYYY": /^(?<d>\d{2})\/(?<m>\d{2})\/(?<y>\d{4})$/,
  "MM/DD/YYYY": /^(?<m>\d{2})\/(?<d>\d{2})\/(?<y>\d{4})$/,
  "YYYY-MM-DD": /^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/,
}

/** The settings, with the guess chosen and examples in every option. */
function settingsFor(values: Record<string, string>, columns: number): ImportSetting[] {
  return [
    {
      key: "separator",
      label: "Separator",
      value: values.separator,
      options: [
        { value: ";", label: "Semicolon" },
        { value: ",", label: "Comma" },
        { value: "\t", label: "Tab" },
      ],
      error: columns === 1 ? "Only one column found. Try another separator." : undefined,
    },
    {
      key: "header",
      label: "First row",
      value: values.header,
      options: [{ value: "names", label: "Column names" }, { value: "data", label: "Data" }],
    },
    {
      key: "dateFormat",
      label: "Date format",
      value: values.dateFormat,
      options: [
        { value: "DD.MM.YYYY", label: "Day.month.year (03.11.2026)" },
        { value: "DD/MM/YYYY", label: "Day/month/year (03/11/2026)" },
        { value: "MM/DD/YYYY", label: "Month/day/year (11/03/2026)" },
        { value: "YYYY-MM-DD", label: "Year-month-day (2026-11-03)" },
      ],
    },
    {
      key: "decimal",
      label: "Decimal mark",
      value: values.decimal,
      options: [{ value: ",", label: "Comma (1.234,56)" }, {
        value: ".",
        label: "Point (1,234.56)",
      }],
    },
  ]
}

/** The file read with these settings: its header and rows, split by the chosen separator. */
function readFile(settings: Record<string, string>) {
  const lines = [HEADER, ...ROWS]
  const split = settings.separator === ";" ? lines : lines.map((cells) => [cells.join(";")])
  return settings.header === "names"
    ? { header: split[0], rows: split.slice(1), firstLine: 2 }
    : { header: null, rows: split, firstLine: 1 }
}

/** A date in the chosen format, written for a person, or why it can't be read. */
function readDate(text: string, format: string): string | Error {
  const parts = DATE_FORMATS[format].exec(text.trim())?.groups
  const date = parts && new Date(Date.UTC(+parts.y, +parts.m - 1, +parts.d))
  if (!parts || !date || date.getUTCDate() !== +parts.d || date.getUTCMonth() !== +parts.m - 1) {
    return new Error(`The date "${text}" doesn't exist. Check Date format in File settings.`)
  }
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date)
}

/** An amount in the chosen decimal mark, written for a person, or why it can't be read. */
function readAmount(text: string, decimal: string, currency: string): string | Error {
  const group = decimal === "," ? "." : ","
  const plain = text.trim().replaceAll(group, "").replace(decimal, ".")
  if (!/^-?\d+(\.\d+)?$/.test(plain)) {
    const hint = decimal === "." && text.includes(",")
      ? " If your bank writes amounts like this, set Decimal mark to Comma."
      : ""
    return new Error(`Can't read "${text}" as an amount.${hint}`)
  }
  // A decimal string, never a float: Intl formats the digits as written.
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "EUR" })
    .format(plain as Intl.StringNumericLiteral)
}

/** The preview the app would show: each mapped field read, and each row's errors. */
function readPreview(
  rows: readonly (readonly string[])[],
  firstLine: number,
  map: ColumnMap,
  settings: Record<string, string>,
): ImportPreviewRow[] {
  return rows.map((cells, index) => {
    const values: Record<string, string> = {}
    const errors: string[] = []
    const cell = (key: string) => map[key] === null ? undefined : cells[map[key]!] ?? ""
    for (const field of FIELDS) {
      const text = cell(field.key)
      if (text === undefined) continue
      let read: string | Error = text
      if (field.key === "date") read = readDate(text, settings.dateFormat)
      else if (field.numeric && text !== "") {
        read = readAmount(text, settings.decimal, cell("currency") ?? "")
      } else if (field.key === "description" && text === "") {
        read = new Error("The description is empty.")
      }
      if (read instanceof Error) errors.push(read.message)
      else values[field.key] = read
    }
    return { line: firstLine + index, values, errors }
  })
}

function ImportMapperDemo() {
  const map = useSignal<ColumnMap>(GUESS)
  const last = useSignal("nothing yet")
  const settings = useSignal<Record<string, string>>({
    separator: ";",
    header: "names",
    dateFormat: "DD.MM.YYYY",
    decimal: ",",
  })
  // The settings the shown file was read with: a change takes 1.5 s to reach it, as a slow re-read.
  const read = useSignal(settings.value)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const file = readFile(read.value)
  const columns = Math.max(file.header?.length ?? 0, ...file.rows.map((cells) => cells.length))
  // A column the file no longer has is "Not in this file".
  const value = Object.fromEntries(
    Object.entries(map.value).map((
      [key, column],
    ) => [key, column !== null && column < columns ? column : null]),
  )
  const noAmount = value.amount === null && (value.debit === null || value.credit === null)

  return (
    <div class="flex flex-col gap-4">
      <ImportMapper
        id="guide-import"
        header={file.header}
        sample={file.rows}
        fields={FIELDS}
        value={value}
        onChange={(key, column) => {
          map.value = { ...map.value, [key]: column }
          last.value = `${key} → ${column}`
        }}
        errors={{
          amount: noAmount ? "Choose an Amount column, or both Money out and Money in." : undefined,
        }}
        settings={settingsFor(settings.value, columns)}
        onSettingsChange={(key, choice) => {
          settings.value = { ...settings.value, [key]: choice }
          clearTimeout(timer.current)
          timer.current = setTimeout(() => read.value = settings.value, 1500)
        }}
        preview={readPreview(file.rows, file.firstLine, value, read.value)}
        rowCount={340}
        pending={read.value !== settings.value}
      />
      <DemoNote>
        onChange received: <span data-e2e="import-mapper-last">{last.value}</span>
      </DemoNote>
    </div>
  )
}

export const importMapperDemos: DemoFragment = {
  ImportMapper: {
    summary:
      "The step of an import where a person says which column of their file holds what, checked against the first rows as the app read them.",
    wide: true,
    props: [
      {
        name: "header",
        type: "readonly string[] | null",
        description: "The file's column names, or null when its first row is data.",
      },
      {
        name: "sample",
        type: "readonly (readonly string[])[]",
        description: "The first rows, as text. The component never reads a file.",
      },
      {
        name: "fields",
        type: "readonly ImportField[]",
        description: "{ key, label, required?, numeric? } per thing the app reads from a row.",
      },
      {
        name: "value",
        type: "ColumnMap",
        description: "A field key to a column index, or null for “Not in this file”.",
      },
      {
        name: "onChange",
        type: "(key: string, column: number | null) => void",
        description: "Called when a field's select changes.",
      },
      {
        name: "errors",
        type: "Record<string, string | undefined>",
        description:
          "A field key to a message for the app's own rules. Wins over the built-in one for a required field left out.",
      },
      {
        name: "settings",
        type: "readonly ImportSetting[]",
        description: "{ key, label, value, options, error? }: how the file was read, guess chosen.",
      },
      {
        name: "onSettingsChange",
        type: "(key: string, value: string) => void",
        description: "Called when a setting changes; the app reads the file again.",
      },
      {
        name: "preview",
        type: "readonly ImportPreviewRow[]",
        description: "{ line, values, errors? } per row, each value formatted as the app read it.",
      },
      {
        name: "rowCount",
        type: "number",
        description: "The file's whole row count, for the line over the preview.",
      },
      {
        name: "pending",
        type: "boolean",
        default: "false",
        description: "The app is reading again: placeholders after 300 ms, selects stay usable.",
      },
      {
        name: "id",
        type: "string",
        description: "The root's id; a field's select is `${id}-${key}`. Generated when left out.",
      },
      {
        name: "labels",
        type: "Partial<ImportMapperLabels>",
        description: "Replaces any English word the component draws.",
      },
    ],
    snippet: `<ImportMapper
  header={["Booking date", "Purpose", "Amount"]}
  sample={[["03.11.2026", "COFFEE CORNER", "-4,20"]]}
  fields={[
    { key: "date", label: "Date", required: true },
    { key: "amount", label: "Amount", numeric: true },
  ]}
  value={map.value}
  onChange={(key, column) => map.value = { ...map.value, [key]: column }}
  settings={settings}
  onSettingsChange={(key, value) => reread(key, value)}
  preview={[{ line: 2, values: { date: "3 Nov 2026", amount: "-€4.20" } }]}
  rowCount={340}
  pending={reading.value}
/>`,
    render: () => <ImportMapperDemo />,
  },
}
