import { useSignal } from "@preact/signals"
import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"
import { Isolated } from "./bdi.tsx"
import { EmptyState } from "./empty-state.tsx"
import { ErrorSummary, type ErrorSummaryItem } from "./error-summary.tsx"
import { Field } from "./field.tsx"
import { useLabels } from "./i18n.tsx"
import { Select, type SelectOption } from "./input.tsx"
import { StatusMark } from "./status-mark.tsx"
import { Table } from "./table.tsx"

/** One thing the app reads from each row of a file, such as a date or an amount. */
export interface ImportField {
  /** The field's key in {@link ColumnMap} and in each preview row's `values`. */
  key: string
  /** The field's name, such as `"Date"`. */
  label: string
  /** Draws the required star, and shows a message while the field is on "Not in this file". */
  required?: boolean
  /** End-aligns the field's preview column with tabular figures: amounts, quantities. */
  numeric?: boolean
}

/** Which column of the file each field reads: a field key to a column index, or `null`. */
export type ColumnMap = Record<string, number | null>

/** One way the app reads the file, such as its separator, with the app's guess chosen. */
export interface ImportSetting {
  /** The setting's key, passed back to `onSettingsChange`. */
  key: string
  /** The setting's name, such as `"Separator"`. */
  label: string
  /** The chosen option's value. */
  value: string
  /** The choices. */
  options: SelectOption[]
  /** What is wrong with the file read this way, such as `"Only one column found."`. */
  error?: string
}

/** One row of the file as the app read it. */
export interface ImportPreviewRow {
  /** The row's line in the file, as a spreadsheet numbers it. */
  line: number
  /** Each mapped field's value as the app read it, already formatted (`"3 Nov 2026"`). */
  values: Record<string, string>
  /** Why the app cannot import the row, each a sentence. */
  errors?: readonly string[]
}

/** Every English word an {@link ImportMapper} draws, each one replaceable. */
export interface ImportMapperLabels {
  /** The settings group's legend. */
  settingsHeading: string
  /** The line under that legend. */
  settingsHelp: string
  /** The columns group's legend. */
  columnsHeading: string
  /** A field select's empty choice. */
  notInFile: string
  /** A column's name when it has no header text, given its 1-based number. */
  column: (number: number) => string
  /** A column's name when another column has the same header. */
  columnNamed: (name: string, number: number) => string
  /** The line under a field's select, given its column's first values. */
  sample: (values: string) => string
  /** That line when the column's first values are all empty. */
  sampleEmpty: string
  /** A required field's message while it is on "Not in this file". */
  requiredMissing: string
  /** The note under a field whose column another field reads too, given that field's name. */
  duplicate: (field: string) => string
  /** The preview's title. */
  previewHeading: string
  /** The line under that title, given how many rows the preview shows. */
  previewHelp: (count: number) => string
  /** That line when the file's whole row count is known. */
  previewHelpOf: (count: number, total: number) => string
  /** The header of the preview's first column. */
  line: string
  /** The summary's button for a row, given its line. */
  lineNumber: (line: number) => string
  /** The word beside a row the app cannot import. */
  problem: string
  /** What an empty preview cell shows. */
  emptyCell: string
  /** The summary's title, given the rows with a problem and the rows shown. */
  summaryProblems: (count: number, total: number) => string
  /** The line above the preview when no row has a problem. */
  summaryClean: (count: number) => string
  /** Announced while the app reads the file again. */
  pending: string
  /** Announced once it is done. */
  updated: string
  /** The preview's place when the file has no rows. */
  noRows: string
  /** The line after it, while there are settings to change. */
  noRowsHelp: string
}

/** The English defaults of {@link ImportMapperLabels}. */
export const defaultImportMapperLabels: ImportMapperLabels = {
  settingsHeading: "File settings",
  settingsHelp: "We guessed these from the file. Change one if the preview looks wrong.",
  columnsHeading: "Columns",
  notInFile: "Not in this file",
  column: (number) => `Column ${number}`,
  columnNamed: (name, number) => `${name} (column ${number})`,
  sample: (values) => `First values: ${values}`,
  sampleEmpty: "This column is empty in the first rows.",
  requiredMissing: "Choose the column that holds this.",
  duplicate: (field) => `Also chosen for ${field}.`,
  previewHeading: "Preview",
  previewHelp: (count) =>
    count === 1
      ? "The first row, as it will be imported."
      : `The first ${count} rows, as they will be imported.`,
  previewHelpOf: (count, total) =>
    count === 1
      ? `The first row of ${total}, as it will be imported.`
      : `The first ${count} of ${total} rows, as they will be imported.`,
  line: "Line",
  lineNumber: (line) => `Line ${line}`,
  problem: "Problem",
  emptyCell: "Empty",
  summaryProblems: (count, total) =>
    count === 1
      ? `${count} of ${total} rows has a problem`
      : `${count} of ${total} rows have a problem`,
  summaryClean: (count) =>
    count === 1 ? "No problems in this row." : `No problems in these ${count} rows.`,
  pending: "Reading the file again…",
  updated: "Preview updated.",
  noRows: "This file has no rows to import.",
  noRowsHelp: "If it does have rows, check the file settings above.",
}

export interface ImportMapperProps {
  /**
   * The root's id. A field's select is `${id}-${field.key}` and a setting's
   * `${id}-setting-${setting.key}`, so a page can focus the first one with an error. Defaults to a
   * generated id.
   */
  id?: string
  /** The file's column names, or `null` when its first row is data. */
  header: readonly string[] | null
  /** The file's first rows, as text. */
  sample: readonly (readonly string[])[]
  /** What the app reads from each row, in the order the person checks them. */
  fields: readonly ImportField[]
  /** Which column each field reads; a field left out is on "Not in this file". */
  value: ColumnMap
  /** Called when a field's select changes: its key, and the column index or `null`. */
  onChange: (key: string, column: number | null) => void
  /** A field key to a message for rules only the app knows. Wins over the built-in message. */
  errors?: Readonly<Record<string, string | undefined>>
  /** How the app reads the file, each with its guess chosen. Left out, no settings group. */
  settings?: readonly ImportSetting[]
  /** Called when a setting changes; the app reads the file again. */
  onSettingsChange?: (key: string, value: string) => void
  /** The first rows as the app read them with the current map and settings. */
  preview: readonly ImportPreviewRow[]
  /** How many data rows the whole file has, for the preview's line. */
  rowCount?: number
  /** The app is reading the file again: the preview shows placeholders after 300 ms. */
  pending?: boolean
  /** Replaces any of the English words; see {@link ImportMapperLabels}. */
  labels?: Partial<ImportMapperLabels>
  class?: string
}

/** How long a re-read may take before the preview shows placeholders, so a fast one never flashes. */
const SKELETON_DELAY_MS = 300

/** How many of a column's first values the line under its select shows. */
const SAMPLE_VALUES = 3

/**
 * The step of an import where a person says which column of their file holds what, checked
 * against the first rows as the app read them.
 *
 * Three groups, top to bottom: the file settings (separator, date format, …) with the app's guesses
 * chosen, one native select per field listing the file's columns with "Not in this file" first,
 * and a preview of the first rows. Under each select, the chosen column's first values. A row the
 * app cannot import shows its line, an icon and the word "Problem", and its errors in words under
 * it; a summary above the preview lists those rows, and its buttons move focus to them.
 *
 * It never reads a file: the app parses it, guesses, and passes text in, and every cell renders
 * as text. A required field on "Not in this file" shows "Choose the column that holds this." unless
 * `errors` holds a message for it.
 *
 * @param props The file's text, the fields, the map and the preview, see {@link ImportMapperProps}.
 * @returns The settings, the columns and the preview.
 */
export function ImportMapper(
  {
    id: idProp,
    header,
    sample,
    fields,
    value,
    onChange,
    errors,
    settings = [],
    onSettingsChange,
    preview,
    rowCount,
    pending = false,
    labels,
    class: className,
  }: ImportMapperProps,
): JSX.Element {
  const words = useLabels("ImportMapper", defaultImportMapperLabels, labels, {
    column: ["number"],
    columnNamed: ["name", "number"],
    sample: ["values"],
    duplicate: ["field"],
    previewHelp: ["count"],
    previewHelpOf: ["count", "total"],
    lineNumber: ["line"],
    summaryProblems: ["count", "total"],
    summaryClean: ["count"],
  })
  const generatedId = useId()
  const id = idProp ?? generatedId
  const slow = useSignal(false)
  // Whether a re-read has started, so the first render announces nothing.
  const reread = useRef(false)
  if (pending) reread.current = true

  useEffect(() => {
    if (!pending) {
      slow.value = false
      return
    }
    const timer = setTimeout(() => slow.value = true, SKELETON_DELAY_MS)
    return () => clearTimeout(timer)
  }, [pending])

  const options = columnOptions(header, sample, words)
  const columnOf = (key: string) => value[key] ?? null
  const mapped = fields.filter((field) => columnOf(field.key) !== null)
  const problems = preview.filter((row) => (row.errors?.length ?? 0) > 0)
  const lineId = (line: number) => `${id}-line-${line}`

  const summaryItems: ErrorSummaryItem[] = problems.map((row) => ({
    key: String(row.line),
    label: words.lineNumber(row.line),
    message: row.errors!.join(" "),
  }))

  const bodySlots: JSX.Element[] = []
  const bodyKeys: string[] = []
  if (pending && slow.value) {
    for (let index = 0; index < (preview.length || 3); index++) {
      bodyKeys.push(`skeleton-${index}`)
      bodySlots.push(
        <>
          {[undefined, ...mapped].map((field) => (
            <td key={field?.key ?? ""} aria-hidden="true">
              <div class="h-4 w-12 animate-pulse rounded bg-track motion-reduce:animate-none" />
            </td>
          ))}
        </>,
      )
    }
  } else {
    for (const row of preview) {
      const rowErrors = row.errors ?? []
      bodyKeys.push(`row-${row.line}`)
      bodySlots.push(
        <>
          <th
            scope="row"
            id={lineId(row.line)}
            tabIndex={-1}
            class="whitespace-nowrap text-start font-normal tabular-nums focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          >
            <span class="inline-flex items-center gap-2">
              {row.line}
              {rowErrors.length > 0 && <StatusMark status="known-issue" label={words.problem} />}
            </span>
          </th>
          {mapped.map((field) => {
            const text = row.values[field.key] ?? ""
            return (
              <td
                key={field.key}
                class={field.numeric ? "text-end tabular-nums whitespace-nowrap" : "min-w-[16ch]"}
              >
                {text === ""
                  ? <span class="text-muted">{words.emptyCell}</span>
                  : <bdi class="block max-w-[32ch] break-words">{text}</bdi>}
              </td>
            )
          })}
        </>,
      )
      if (rowErrors.length > 0) {
        bodyKeys.push(`note-${row.line}`)
        // The dark palette's danger, red-400, reads 3.6:1 on a hovered row's gray-700, so a hovered
        // note takes red-300 (5.4:1), as a highlighted danger item in a Dropdown does.
        bodySlots.push(
          <td colSpan={mapped.length + 1} class="pt-0! text-danger dark:[tr:hover>&]:text-red-300">
            <ul class="sticky start-6 max-w-[calc(100cqi-3rem)] list-none wrap-anywhere">
              {rowErrors.map((error, index) => <li key={index}>{error}</li>)}
            </ul>
          </td>,
        )
      }
    }
  }

  const previewLine = rowCount !== undefined && rowCount > preview.length
    ? words.previewHelpOf(preview.length, rowCount)
    : words.previewHelp(preview.length)
  const live = pending ? words.pending : reread.current ? words.updated : ""

  return (
    <div id={id} class={cn("flex flex-col gap-8", className)}>
      {settings.length > 0 && (
        <fieldset class="min-w-0">
          <legend class="text-sm font-medium text-foreground">{words.settingsHeading}</legend>
          <p class="mt-1 text-sm text-muted">{words.settingsHelp}</p>
          <div class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {settings.map((setting) => (
              <Field
                key={setting.key}
                id={`${id}-setting-${setting.key}`}
                label={setting.label}
                error={setting.error}
                class="min-w-0"
              >
                <Select
                  options={setting.options}
                  value={setting.value}
                  onChange={(event) => onSettingsChange?.(setting.key, event.currentTarget.value)}
                />
              </Field>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset class="min-w-0">
        <legend class="text-sm font-medium text-foreground">{words.columnsHeading}</legend>
        <div class="mt-4 flex flex-col gap-6 md:gap-4">
          {fields.map((field) => {
            const selectId = `${id}-${field.key}`
            const column = columnOf(field.key)
            const error = errors?.[field.key] ||
              (field.required && column === null ? words.requiredMissing : undefined)
            const sharing = column === null
              ? []
              : fields.filter((other) => other !== field && columnOf(other.key) === column)
            const values = column === null ? [] : firstValues(sample, column)
            const errorId = error ? `${selectId}-error` : undefined
            const duplicateId = sharing.length > 0 ? `${selectId}-duplicate` : undefined
            const hintId = column === null ? undefined : `${selectId}-hint`
            return (
              <div
                key={field.key}
                class="md:grid md:grid-cols-[12rem_20rem_minmax(0,1fr)] md:items-start md:gap-x-4"
              >
                <label for={selectId} class="pc-label md:pt-3">
                  {field.label}
                  {field.required && <span aria-hidden="true" class="ms-1 text-danger">*</span>}
                </label>
                <Select
                  id={selectId}
                  class="mt-2 md:col-start-2 md:mt-0"
                  options={options}
                  placeholder={words.notInFile}
                  value={column === null ? "" : String(column)}
                  required={field.required}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={[errorId, duplicateId, hintId].filter(Boolean).join(" ") ||
                    undefined}
                  onChange={(event) => {
                    const chosen = event.currentTarget.value
                    onChange(field.key, chosen === "" ? null : Number(chosen))
                  }}
                />
                {errorId && (
                  <p
                    id={errorId}
                    class="mt-2 text-sm text-danger md:col-start-2"
                    aria-live="polite"
                  >
                    {error}
                  </p>
                )}
                {duplicateId && (
                  <p id={duplicateId} class="mt-2 text-sm text-muted md:col-start-2">
                    {words.duplicate(sharing.map((other) => other.label).join(", "))}
                  </p>
                )}
                {hintId && (
                  <p
                    id={hintId}
                    class="mt-2 truncate text-sm text-muted md:col-start-3 md:row-start-1 md:mt-0 md:pt-3"
                  >
                    {values.length > 0
                      ? <Isolated message={words.sample} value={values.join(", ")} />
                      : words.sampleEmpty}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      <div class="flex min-w-0 flex-col gap-4">
        <p role="status" class="sr-only" data-e2e="import-mapper-status">{live}</p>
        {preview.length === 0 && !pending
          ? (
            <EmptyState
              description={settings.length > 0
                ? `${words.noRows} ${words.noRowsHelp}`
                : words.noRows}
            />
          )
          : (
            <>
              <ErrorSummary
                title={words.summaryProblems(problems.length, preview.length)}
                items={summaryItems}
                onSelect={(item) => {
                  const cell = document.getElementById(lineId(Number(item.key)))
                  cell?.focus()
                  cell?.scrollIntoView({ block: "nearest", inline: "start" })
                }}
              />
              {problems.length === 0 && !pending && (
                <p class="text-sm text-muted">{words.summaryClean(preview.length)}</p>
              )}
              <div aria-busy={pending ? "true" : undefined} class="@container min-w-0">
                <p class="text-sm font-medium text-foreground" aria-hidden="true">
                  {words.previewHeading}
                </p>
                <p class="mt-1 text-sm text-muted" aria-hidden="true">{previewLine}</p>
                <Table
                  class="mt-4 min-h-0"
                  caption={`${words.previewHeading}. ${previewLine}`}
                  captionClass="sr-only"
                  headerSlot={
                    <>
                      <th scope="col" class="text-start">{words.line}</th>
                      {mapped.map((field) => (
                        <th
                          key={field.key}
                          scope="col"
                          class={field.numeric ? "text-end" : "text-start"}
                        >
                          {field.label}
                        </th>
                      ))}
                    </>
                  }
                  bodySlots={bodySlots}
                  bodyKeys={bodyKeys}
                />
              </div>
            </>
          )}
      </div>
    </div>
  )
}

/**
 * The options of a field's select: one per column of the widest of the header and the sample
 * rows, named by its header text, by its number when it has none, and by both when two columns
 * share a header.
 */
function columnOptions(
  header: readonly string[] | null,
  sample: readonly (readonly string[])[],
  words: ImportMapperLabels,
): SelectOption[] {
  const width = Math.max(header?.length ?? 0, ...sample.map((row) => row.length))
  const names = Array.from({ length: width }, (_, index) => header?.[index]?.trim() ?? "")
  const seen = new Map<string, number>()
  for (const name of names) if (name) seen.set(name, (seen.get(name) ?? 0) + 1)
  return names.map((name, index) => ({
    value: index,
    label: !name
      ? words.column(index + 1)
      : seen.get(name)! > 1
      ? words.columnNamed(name, index + 1)
      : name,
  }))
}

/** A column's first non-empty values in the sample, at most {@link SAMPLE_VALUES}. */
function firstValues(sample: readonly (readonly string[])[], column: number): string[] {
  return sample.map((row) => row[column]?.trim() ?? "").filter(Boolean).slice(0, SAMPLE_VALUES)
}
