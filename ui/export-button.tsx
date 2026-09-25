import { cn } from "@preact-components/cn"
import type { ComponentChildren, JSX } from "preact"
import { useRef, useState } from "preact/hooks"
import type { CsvColumn } from "@spy4x/platform/universal/csv"
import { Button } from "./button.tsx"
import { runExport } from "./export-run.ts"

/**
 * One column of an {@link ExportButton}'s file — see `@spy4x/platform/universal/csv`'s
 * {@link CsvColumn}.
 */
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
   * What the live region announces when `getRows` throws or rejects, or when the download itself
   * fails. Defaults to `"Could not export the file."`.
   */
  errorLabel?: string
  /**
   * Called with the error when `getRows` throws or rejects, or when the download itself fails — a
   * port, the way `GeoButton`'s `onError` is, for a host that wants to log it or route it through
   * its own toast.
   */
  onError?: (error: unknown) => void
  class?: string
}

/**
 * `rows` and `getRows` are mutually exclusive, enforced at the type level rather than by a runtime
 * check: passing both, or neither, is a compile error instead of an ambiguity about which one a
 * caller meant. `export-run.ts`'s `hasRows` reads the discriminant back out at runtime, the same
 * way `data-table.tsx`'s `isDataColumn` tells its own two column shapes apart.
 */
export type ExportButtonProps<T> =
  & ExportButtonBaseProps<T>
  & (
    | { rows: readonly T[]; getRows?: never }
    | { rows?: never; getRows: () => readonly T[] | Promise<readonly T[]> }
  )

/** Default {@link ExportButtonBaseProps.resultLabel}. */
function defaultResultLabel(rowCount: number): string {
  return `Exported ${rowCount} row${rowCount === 1 ? "" : "s"}`
}

/**
 * Utilities that make an `aria-disabled` control look and feel disabled — `pagination.tsx`'s own
 * `ariaDisabledClasses`, copied rather than imported: a one-line Tailwind pair is not worth a
 * cross-file dependency between two otherwise unrelated components.
 */
const busyClasses = "aria-disabled:pointer-events-none aria-disabled:opacity-50"

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
 * **Busy is `aria-disabled`, not the native `disabled` attribute** — the same choice
 * `pagination.tsx` makes, and for the same reason: setting `disabled` on a focused button drops
 * focus to `<body>`, measured in the headless Chromium this repository drives, and it stays there
 * once the export finishes. `getRows` is exactly the case a caller reaches for to fetch every
 * matching row rather than only the page on screen, which is also the case most likely to take
 * long enough for a keyboard user to notice their focus is gone. `aria-disabled` leaves focus
 * alone; what it does not do is stop the press, so `handleClick` guards itself — twice, the same
 * belt-and-suspenders `enhanced-form.tsx`'s `busyRef` uses: a `ref` checked and set synchronously
 * before anything async runs, so a real double activation arriving in the same task sees the flag
 * the first press set however far `useState`'s own update has or has not repainted yet, and
 * `busyClasses`' `pointer-events-none` for every press after that first repaint.
 *
 * The live region is cleared, then set, rather than set once directly: a second export with the
 * same row count would otherwise write the exact string already there, which is a no-op diff as
 * far as the DOM is concerned and reaches no screen reader. Clearing first, in its own render,
 * turns that into two real mutations — go quiet, then say it — so a second "Exported 2 rows" is
 * heard as its own announcement rather than silently not happening.
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
    label = "Export",
    resultLabel = defaultResultLabel,
    errorLabel = "Could not export the file.",
    onError,
    class: className,
  } = props
  const [announcement, setAnnouncement] = useState("")
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const announce = (text: string) => {
    setAnnouncement("")
    setTimeout(() => setAnnouncement(text), 0)
  }

  const handleClick = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    const result = await runExport(props, resultLabel, errorLabel, onError)
    announce(result.announcement)
    busyRef.current = false
    setBusy(false)
  }

  return (
    <>
      <Button
        variant="outline"
        class={cn(busyClasses, className)}
        aria-disabled={busy ? "true" : undefined}
        onClick={handleClick}
      >
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
