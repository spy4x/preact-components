import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ExportButton, type ExportButtonColumn } from "./export-button.tsx"

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

  it("renders a native, enabled button", () => {
    const html = render(<ExportButton columns={columns} rows={[]} fileName="rows.csv" />)

    expect(html).toContain("<button")
    // Not `disabled` bare — the button's own `variant="outline"` utilities legitimately contain
    // the substring "disabled:" (Tailwind's state-variant classes), so this checks for the real
    // HTML attribute Preact would emit for a disabled button rather than a loose substring match.
    expect(html).not.toContain('disabled=""')
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
