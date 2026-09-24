import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { CsvColumn } from "./csv.ts"
import { type ExportRunProps, runExport } from "./export-run.ts"

interface Row {
  id: number
  name: string
}

const columns: CsvColumn<Row>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
]

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
    const props: ExportRunProps<Row> = {
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
    const props: ExportRunProps<Row> = {
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
    const props: ExportRunProps<Row> = {
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
    const props: ExportRunProps<Row> = { columns, rows: [], fileName: "rows.csv" }

    const result = await runExport(props, resultLabel, errorLabel, undefined, download)

    expect(result).toEqual({ ok: true, announcement: "Exported 0 row(s)" })
    expect(calls[0].text).toBe("ID,Name\r\n")
  })

  it("downloads nothing, calls onError, and announces errorLabel when getRows rejects", async () => {
    const { download, calls } = fakeDownload()
    const errors: unknown[] = []
    const boom = new Error("boom")
    const props: ExportRunProps<Row> = {
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
    const props: ExportRunProps<Row> = {
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
    const props: ExportRunProps<Row> = {
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
    const props: ExportRunProps<Row> = {
      columns,
      getRows: () => Promise.reject(new Error("boom")),
      fileName: "rows.csv",
    }

    await expect(runExport(props, resultLabel, errorLabel, undefined, download)).resolves.toEqual(
      { ok: false, announcement: errorLabel },
    )
  })
})
