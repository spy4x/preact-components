/**
 * `ExportButton`'s download logic, split out for unit-testing without a browser.
 *
 * Package-private on purpose: not in `ui/deno.json`'s `exports`, not re-exported from
 * `ui/+index.ts`. `export-button.tsx` imports it by relative path — a helper written to make a
 * component testable is not, by itself, a reason to publish it as API a caller might build on.
 */

import { downloadResponseAsFile } from "@spy4x/platform/browser/download"
import { type CsvColumn, toCsvBytes } from "@spy4x/platform/universal/csv"

/**
 * What {@link runExport} needs from `ExportButton`'s own props.
 *
 * A structural subset of `ExportButtonProps` — `columns`, `fileName`, and the `rows`-or-`getRows`
 * union — not that type itself: importing it from `./export-button.tsx` would make this module
 * import the file that imports this one back. `ExportButtonProps` satisfies this shape with room
 * to spare, so the component passes its own props straight through.
 */
export type ExportRunProps<T> =
  & { columns: CsvColumn<T>[]; fileName: string }
  & (
    | { rows: readonly T[]; getRows?: never }
    | { rows?: never; getRows: () => readonly T[] | Promise<readonly T[]> }
  )

/**
 * `true` for input that specifies `rows` directly — see {@link ExportRunProps}'s own doc. A named
 * type predicate rather than an inline `"rows" in props` check: TypeScript narrows a ternary's own
 * condition, but only a predicate's asserted type reliably narrows the *other* branch down to the
 * `getRows` member too, which is what lets that branch call `props.getRows()` with no `!`.
 */
function hasRows<T>(
  props: ExportRunProps<T>,
): props is ExportRunProps<T> & { rows: readonly T[]; getRows?: never } {
  return "rows" in props
}

/** What {@link runExport} produced: whether the download went through, and what to announce. */
export interface ExportRunResult {
  ok: boolean
  announcement: string
}

/**
 * Resolve `rows` (or call `getRows`), write them as CSV, and hand the result to `download`.
 *
 * Split out of the component so the whole path is unit-testable without a browser: `ExportButton`
 * calls a hook (`useState`), so a component that calls it cannot be invoked outside a render — the
 * same reason `copyable-text.tsx` splits its body out. `download` defaults to the real
 * `downloadResponseAsFile`; a test hands in a fake one instead, which is what proves a rejecting
 * `getRows` downloads nothing without needing a real object URL or a real click.
 *
 * `onError` is called from in here, not left to the caller: a test of this function alone is then a
 * test of the whole "nothing downloads, `onError` runs, the error is announced" contract, rather
 * than only the half a click handler would still owe on its own.
 *
 * @param props The button's own props — `columns`, `rows` or `getRows`, `fileName`.
 * @param resultLabel Success announcement, as a function of the row count.
 * @param errorLabel Failure announcement.
 * @param onError Called with the error on failure — from `getRows`, or from `download` itself.
 * @param download Injected download port; defaults to `downloadResponseAsFile`.
 */
export async function runExport<T>(
  props: ExportRunProps<T>,
  resultLabel: (rowCount: number) => string,
  errorLabel: string,
  onError: ((error: unknown) => void) | undefined,
  download: (response: Response, filename: string) => Promise<void> = downloadResponseAsFile,
): Promise<ExportRunResult> {
  try {
    const rows = hasRows(props) ? props.rows : await props.getRows()
    const response = new Response(toCsvBytes(props.columns, rows), {
      headers: { "content-type": "text/csv;charset=utf-8" },
    })
    await download(response, props.fileName)
    return { ok: true, announcement: resultLabel(rows.length) }
  } catch (error) {
    onError?.(error)
    return { ok: false, announcement: errorLabel }
  }
}
