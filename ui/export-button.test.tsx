import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  ExportButton,
  type ExportButtonColumn,
  type ExportButtonProps,
  runExport,
} from "./export-button.tsx"

interface Row {
  id: number
  name: string
}

const columns: ExportButtonColumn<Row>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
]

describe("ExportButton", () => {
  it("carries the default label", () => {
    const html = render(<ExportButton columns={columns} rows={[]} fileName="rows.csv" />)

    expect(html).toContain("Export")
  })

  it("takes a custom label", () => {
    const html = render(
      <ExportButton columns={columns} rows={[]} fileName="rows.csv" label="Download CSV" />,
    )

    expect(html).toContain("Download CSV")
    expect(html).not.toContain(">Export<")
  })

  it("renders a native button, not busy at rest", () => {
    const html = render(<ExportButton columns={columns} rows={[]} fileName="rows.csv" />)

    expect(html).toContain("<button")
    // Never the native `disabled` attribute — see the component's own doc for why `aria-disabled`
    // is used instead, so a busy export never drops focus to `<body>`. `aria-disabled="true"` is
    // checked as an exact attribute rather than a loose substring, since the button's own
    // `variant="outline"` utilities legitimately contain the text "aria-disabled:" (Tailwind's
    // state-variant classes) even when the attribute itself is absent, as it is here at rest.
    expect(html).not.toContain('disabled=""')
    expect(html).not.toContain('aria-disabled="true"')
  })

  it("renders an always-present, initially empty live region", () => {
    const html = render(<ExportButton columns={columns} rows={[]} fileName="rows.csv" />)

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    // Empty at render time: nothing has been exported yet, so there is nothing to announce.
    expect(html).toMatch(/role="status"[^>]*>\s*<\/span>/)
  })

  it("appends a caller class to the button", () => {
    const html = render(
      <ExportButton columns={columns} rows={[]} fileName="rows.csv" class="w-full" />,
    )

    expect(html).toContain("w-full")
  })

  it("accepts getRows in place of rows", () => {
    const html = render(
      <ExportButton
        columns={columns}
        getRows={() => [{ id: 1, name: "Ada" }]}
        fileName="rows.csv"
      />,
    )

    expect(html).toContain("Export")
  })
})

/** Records every call, in order, without touching a real `Blob` or object URL. */
function fakeDownload(): {
  download: (response: Response, filename: string) => Promise<void>
  calls: Array<{ filename: string; text: string }>
} {
  const calls: Array<{ filename: string; text: string }> = []
  return {
    calls,
    download: async (response, filename) => {
      calls.push({ filename, text: await response.text() })
    },
  }
}

const resultLabel = (rowCount: number) => `Exported ${rowCount} row(s)`
const errorLabel = "Could not export the file."

describe("runExport", () => {
  it("writes rows and downloads once, announcing the row count", async () => {
    const { download, calls } = fakeDownload()
    const props: ExportButtonProps<Row> = {
      columns,
      rows: [{ id: 1, name: "Ada" }],
      fileName: "rows.csv",
    }

    const result = await runExport(props, resultLabel, errorLabel, undefined, download)

    expect(result).toEqual({ ok: true, announcement: "Exported 1 row(s)" })
    expect(calls).toHaveLength(1)
    expect(calls[0].filename).toBe("rows.csv")
    expect(calls[0].text).toContain("1,Ada")
  })

  it("calls a synchronous getRows and downloads its result", async () => {
    const { download, calls } = fakeDownload()
    const props: ExportButtonProps<Row> = {
      columns,
      getRows: () => [{ id: 1, name: "Ada" }, { id: 2, name: "Bo" }],
      fileName: "rows.csv",
    }

    const result = await runExport(props, resultLabel, errorLabel, undefined, download)

    expect(result).toEqual({ ok: true, announcement: "Exported 2 row(s)" })
    expect(calls).toHaveLength(1)
  })

  it("awaits an asynchronous getRows before downloading", async () => {
    const { download, calls } = fakeDownload()
    const props: ExportButtonProps<Row> = {
      columns,
      getRows: () => Promise.resolve([{ id: 1, name: "Ada" }]),
      fileName: "rows.csv",
    }

    const result = await runExport(props, resultLabel, errorLabel, undefined, download)

    expect(result).toEqual({ ok: true, announcement: "Exported 1 row(s)" })
    expect(calls).toHaveLength(1)
  })

  it("downloads a header-only file for zero rows", async () => {
    const { download, calls } = fakeDownload()
    const props: ExportButtonProps<Row> = { columns, rows: [], fileName: "rows.csv" }

    const result = await runExport(props, resultLabel, errorLabel, undefined, download)

    expect(result).toEqual({ ok: true, announcement: "Exported 0 row(s)" })
    expect(calls[0].text).toBe("ID,Name\r\n")
  })

  it("downloads nothing, calls onError, and announces errorLabel when getRows rejects", async () => {
    const { download, calls } = fakeDownload()
    const errors: unknown[] = []
    const boom = new Error("boom")
    const props: ExportButtonProps<Row> = {
      columns,
      getRows: () => Promise.reject(boom),
      fileName: "rows.csv",
    }

    const result = await runExport(
      props,
      resultLabel,
      errorLabel,
      (error) => errors.push(error),
      download,
    )

    expect(result).toEqual({ ok: false, announcement: errorLabel })
    expect(calls).toEqual([])
    expect(errors).toEqual([boom])
  })

  it("downloads nothing, calls onError, and announces errorLabel when getRows throws synchronously", async () => {
    const { download, calls } = fakeDownload()
    const errors: unknown[] = []
    const boom = new Error("boom")
    const props: ExportButtonProps<Row> = {
      columns,
      getRows: () => {
        throw boom
      },
      fileName: "rows.csv",
    }

    const result = await runExport(
      props,
      resultLabel,
      errorLabel,
      (error) => errors.push(error),
      download,
    )

    expect(result).toEqual({ ok: false, announcement: errorLabel })
    expect(calls).toEqual([])
    expect(errors).toEqual([boom])
  })

  it("calls onError when the download itself fails, not only when getRows fails", async () => {
    const errors: unknown[] = []
    const boom = new Error("disk full")
    const props: ExportButtonProps<Row> = {
      columns,
      rows: [{ id: 1, name: "Ada" }],
      fileName: "rows.csv",
    }

    const result = await runExport(
      props,
      resultLabel,
      errorLabel,
      (error) => errors.push(error),
      () => Promise.reject(boom),
    )

    expect(result).toEqual({ ok: false, announcement: errorLabel })
    expect(errors).toEqual([boom])
  })

  it("stays silent when no onError port is given", async () => {
    const { download } = fakeDownload()
    const props: ExportButtonProps<Row> = {
      columns,
      getRows: () => Promise.reject(new Error("boom")),
      fileName: "rows.csv",
    }

    await expect(runExport(props, resultLabel, errorLabel, undefined, download)).resolves.toEqual(
      { ok: false, announcement: errorLabel },
    )
  })
})
