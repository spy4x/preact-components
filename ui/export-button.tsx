import { downloadResponseAsFile } from "@spy4x/platform/browser/download"
import type { ComponentChildren, JSX } from "preact"
import { useState } from "preact/hooks"
import { Button } from "./button.tsx"
import { type CsvColumn, toCsvBytes } from "./csv.ts"

/** One column of an {@link ExportButton}'s file — see `csv.ts`'s {@link CsvColumn}. */
export type ExportButtonColumn<T> = CsvColumn<T>

interface ExportButtonBaseProps<T> {
  /** Columns to write, in order: the field to read, its header, and how to render its value. */
  columns: ExportButtonColumn<T>[]
  /** File name the browser saves under, extension included, e.g. `"invoices.csv"`. */
  fileName: string
  /** Button content. Defaults to `"Export"`. */
  label?: ComponentChildren
  /**
   * What the live region announces once a download has been handed to the browser, as a function
   * of the row count. Defaults to `` (rowCount) => `Exported ${rowCount} row(s)` ``, pluralised.
   *
   * A function rather than a string for the same reason {@link Pagination}'s `pageLabel` is one:
   * the count's place in the sentence, and its own pluralisation, are a translator's business.
   */
  resultLabel?: (rowCount: number) => string
  /**
   * What the live region announces when `getRows` throws or rejects. Defaults to
   * `"Could not export the file."`.
   */
  errorLabel?: string
  /**
   * Called with the error when `getRows` throws or rejects — a port, the way `GeoButton`'s
   * `onError` is, for a host that wants to log it or route it through its own toast.
   */
  onError?: (error: unknown) => void
  class?: string
}

/**
 * `rows` and `getRows` are mutually exclusive, enforced at the type level rather than by a runtime
 * check: passing both, or neither, is a compile error instead of an ambiguity about which one a
 * caller meant. {@link hasRows} reads the discriminant back out, the same way `data-table.tsx`'s
 * `isDataColumn` tells its own two column shapes apart.
 */
export type ExportButtonProps<T> =
  & ExportButtonBaseProps<T>
  & (
    | { rows: readonly T[]; getRows?: never }
    | { rows?: never; getRows: () => readonly T[] | Promise<readonly T[]> }
  )

/**
 * `true` for props that specify `rows` directly — see {@link ExportButtonProps}'s own doc. A named
 * type predicate rather than an inline `"rows" in props` check: TypeScript narrows a ternary's own
 * condition, but only a predicate's asserted type reliably narrows the *other* branch down to the
 * `getRows` member too, which is what lets that branch call `props.getRows()` with no `!`.
 */
function hasRows<T>(
  props: ExportButtonProps<T>,
): props is ExportButtonBaseProps<T> & { rows: readonly T[]; getRows?: never } {
  return "rows" in props
}

/** Default {@link ExportButtonBaseProps.resultLabel}. */
function defaultResultLabel(rowCount: number): string {
  return `Exported ${rowCount} row${rowCount === 1 ? "" : "s"}`
}

/**
 * Button that downloads `rows` — or the result of `getRows`, called on click — as a CSV file.
 *
 * A native `<button>` (`Button`, `variant="outline"`), so Space and Enter activate it with no
 * extra wiring, and a screen reader announces it the same way it announces any other button.
 *
 * `getRows` may return its array directly or a `Promise` of one: "export everything the filter
 * matches, not just the page on screen" usually means a fetch, and `await`ing a value that is
 * already an array resolves on the spot, so supporting both costs nothing here and a caller with a
 * synchronous slice never has to wrap it in `Promise.resolve`.
 *
 * Zero rows still downloads a file — the header row alone, which is a real, openable CSV rather
 * than nothing happening for a filter that currently matches nothing silently. A `getRows` that
 * throws or rejects downloads nothing: the live region announces `errorLabel` instead of a row
 * count, `onError` is called if given, and the button re-enables for another try.
 *
 * The download itself is `@spy4x/platform/browser/download`'s `downloadResponseAsFile`, handed a
 * `Response` wrapping the written bytes: a helper already reviewed and published, not a second copy
 * of the `Blob`/object-URL/anchor dance built here. It attaches a temporary anchor, clicks it and
 * detaches it in the same task, then revokes the object URL from a timer about five seconds later —
 * revoking in the click's own task has historically cancelled a download still starting.
 * `document`, `URL` and `Blob` are only touched inside the click handler, so the component still
 * server-renders.
 */
export function ExportButton<T>(props: ExportButtonProps<T>): JSX.Element {
  const {
    columns,
    fileName,
    label = "Export",
    resultLabel = defaultResultLabel,
    errorLabel = "Could not export the file.",
    onError,
    class: className,
  } = props
  const [announcement, setAnnouncement] = useState("")
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    setBusy(true)
    try {
      const rows = hasRows(props) ? props.rows : await props.getRows()
      const response = new Response(toCsvBytes(columns, rows), {
        headers: { "content-type": "text/csv;charset=utf-8" },
      })
      await downloadResponseAsFile(response, fileName)
      setAnnouncement(resultLabel(rows.length))
    } catch (error) {
      setAnnouncement(errorLabel)
      onError?.(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" class={className} disabled={busy} onClick={handleClick}>
        <DownloadIcon />
        {label}
      </Button>
      <span role="status" aria-live="polite" class="sr-only">{announcement}</span>
    </>
  )
}

function DownloadIcon(): JSX.Element {
  return (
    <svg
      class="-ml-1 size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12m0 0-4-4m4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}
