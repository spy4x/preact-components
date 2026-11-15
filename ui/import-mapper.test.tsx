import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type ImportField, ImportMapper, type ImportMapperProps } from "./import-mapper.tsx"

const FIELDS: ImportField[] = [
  { key: "date", label: "Date", required: true },
  { key: "amount", label: "Amount", numeric: true },
  { key: "payee", label: "Payee" },
]

const noop = () => {}

/** The mapper with a three-column file, every field mapped, and one clean preview row. */
function draw(props: Partial<ImportMapperProps> = {}): string {
  return render(
    <ImportMapper
      id="imp"
      header={["Booking date", "Amount", "Payee"]}
      sample={[["03.11.2026", "-4,20", "Coffee Corner"], ["04.11.2026", "2.450,00", ""]]}
      fields={FIELDS}
      value={{ date: 0, amount: 1, payee: 2 }}
      onChange={noop}
      preview={[{ line: 2, values: { date: "3 Nov 2026", amount: "-€4.20", payee: "Coffee" } }]}
      {...props}
    />,
  )
}

/** The `<select>` of one field, its options included. */
function selectOf(html: string, key: string): string {
  const match = new RegExp(`<select[^>]*id="imp-${key}"[^>]*>.*?</select>`).exec(html)
  if (!match) throw new Error(`no select for ${key}`)
  return match[0]
}

/** The ids a field's select names in `aria-describedby`. */
function describedBy(html: string, key: string): string[] {
  return /aria-describedby="([^"]*)"/.exec(selectOf(html, key))?.[1].split(" ") ?? []
}

describe("ImportMapper", () => {
  it("lists Not in this file first, then every column by its header", () => {
    const options = [
      ...selectOf(draw(), "date").matchAll(/<option(?: selected)? value(?:="([^"]*)")?>([^<]*)</g),
    ]
      .map(([, value, label]) => `${value ?? ""}=${label}`)
    expect(options).toEqual(["=Not in this file", "0=Booking date", "1=Amount", "2=Payee"])
  })

  it("names a column by its number when the file has no header or the cell is blank", () => {
    const headerless = draw({ header: null })
    expect(selectOf(headerless, "date")).toContain('<option value="2">Column 3</option>')
    const blank = draw({ header: ["Booking date", " ", "Payee"] })
    expect(selectOf(blank, "date")).toContain('<option value="1">Column 2</option>')
  })

  it("adds the column number to two columns with the same header", () => {
    const html = draw({ header: ["Amount", "Amount", "Payee"] })
    expect(selectOf(html, "date")).toContain('value="0">Amount (column 1)</option>')
    expect(selectOf(html, "date")).toContain('<option value="1">Amount (column 2)</option>')
  })

  it("lists every column of a sample row wider than the header", () => {
    const html = draw({ header: ["A"], sample: [["1", "2", "3"]] })
    expect(selectOf(html, "date")).toContain('<option value="2">Column 3</option>')
  })

  it("ties the chosen column's first non-empty values to its select", () => {
    const html = draw()
    expect(describedBy(html, "payee")).toEqual(["imp-payee-hint"])
    expect(html).toContain(
      '<p id="imp-payee-hint" class="mt-2 truncate text-sm text-muted md:col-start-3 md:row-start-1 md:mt-0 md:pt-3">First values: <bdi>Coffee Corner</bdi></p>',
    )
    expect(html).toContain("First values: <bdi>03.11.2026, 04.11.2026</bdi>")
  })

  it("says so when the chosen column is empty in the sample", () => {
    const html = draw({ sample: [["03.11.2026", "-4,20", ""]] })
    expect(html).toContain('id="imp-payee-hint"')
    expect(html).toMatch(/id="imp-payee-hint"[^>]*>This column is empty in the first rows\.</)
  })

  it("shows the built-in message under a required field on Not in this file", () => {
    const html = draw({ value: { date: null, amount: 1, payee: 2 } })
    expect(describedBy(html, "date")).toEqual(["imp-date-error"])
    expect(selectOf(html, "date")).toContain('aria-invalid="true"')
    expect(html).toMatch(/<p id="imp-date-error"[^>]*>Choose the column that holds this\.<\/p>/)
  })

  it("shows nothing under an optional field on Not in this file", () => {
    const html = draw({ value: { date: 0, amount: 1, payee: null } })
    expect(describedBy(html, "payee")).toEqual([])
    expect(html).not.toContain('id="imp-payee-')
  })

  it("shows an app's error under its field, named by the select, over the built-in one", () => {
    const html = draw({
      value: { date: null, amount: null, payee: 2 },
      errors: {
        date: "Dates must be in one column.",
        amount: "Choose an Amount column, or both Money out and Money in.",
      },
    })
    expect(describedBy(html, "amount")).toEqual(["imp-amount-error"])
    expect(html).toMatch(
      /<p id="imp-amount-error"[^>]*>Choose an Amount column, or both Money out and Money in\.<\/p>/,
    )
    expect(html).toMatch(/<p id="imp-date-error"[^>]*>Dates must be in one column\.<\/p>/)
    expect(html).not.toContain("Choose the column that holds this.")
  })

  it("notes a column another field reads too, naming that field", () => {
    const html = draw({ value: { date: 0, amount: 1, payee: 1 } })
    expect(describedBy(html, "payee")).toEqual(["imp-payee-duplicate", "imp-payee-hint"])
    expect(html).toMatch(/<p id="imp-payee-duplicate"[^>]*>Also chosen for Amount\.<\/p>/)
    expect(html).toMatch(/<p id="imp-amount-duplicate"[^>]*>Also chosen for Payee\.<\/p>/)
    expect(html).not.toContain('id="imp-date-duplicate"')
  })

  it("marks a required field with a star a screen reader skips, and requires its select", () => {
    const html = draw()
    expect(html).toContain(
      '<label for="imp-date" class="pc-label md:pt-3">Date<span aria-hidden="true" class="ms-1 text-danger">*</span></label>',
    )
    expect(selectOf(html, "date")).toContain("required")
    expect(selectOf(html, "payee")).not.toContain("required")
  })

  it("draws each setting as a labelled select with its value chosen and its error tied", () => {
    const html = draw({
      settings: [{
        key: "separator",
        label: "Separator",
        value: ",",
        options: [{ value: ";", label: "Semicolon" }, { value: ",", label: "Comma" }],
        error: "Only one column found.",
      }],
    })
    expect(html).toContain("<legend")
    expect(html).toContain('<label for="imp-setting-separator" class="pc-label">Separator</label>')
    const select = /<select[^>]*id="imp-setting-separator"[^>]*>/.exec(html)?.[0] ?? ""
    expect(select).toContain('aria-describedby="imp-setting-separator-error"')
    expect(html).toMatch(/<p id="imp-setting-separator-error"[^>]*>Only one column found\.<\/p>/)
  })

  it("draws no settings group without settings", () => {
    expect(draw()).not.toContain("File settings")
  })

  it("shows a problem row's line, the icon, the word and each error under it", () => {
    const html = draw({
      preview: [
        { line: 2, values: { date: "3 Nov 2026", amount: "-€4.20" } },
        {
          line: 7,
          values: { date: "5 Nov 2026" },
          errors: ['Can\'t read "n/a" as an amount.', "The payee is empty."],
        },
      ],
    })
    const problemRow = /<th scope="row" id="imp-line-7"[^>]*>(.*?)<\/th>/.exec(html)?.[1] ?? ""
    expect(problemRow).toMatch(/^<span[^>]*>7<span/)
    expect(problemRow).toContain("<svg")
    expect(problemRow).toContain("Problem")
    expect(html).toContain(
      "<li>Can't read &quot;n/a&quot; as an amount.</li><li>The payee is empty.</li>",
    )
    // In the dark palette a hovered note takes red-300: red-400 reads 3.6:1 on the hover fill.
    expect(html).toMatch(
      /<td colspan="4" class="pt-0! text-danger dark:\[tr:hover>&amp;\]:text-red-300">/,
    )
    const cleanRow = /<th scope="row" id="imp-line-2"[^>]*>(.*?)<\/th>/.exec(html)?.[1] ?? ""
    expect(cleanRow).not.toContain("Problem")
    expect(cleanRow).not.toContain("<svg")
  })

  it("lists the problem rows above the preview with the count in its title", () => {
    const html = draw({
      preview: [
        { line: 2, values: {} },
        { line: 7, values: {}, errors: ["Bad date."] },
      ],
    })
    expect(html).toContain(">1 of 2 rows has a problem</p>")
    expect(html).toMatch(/<button[^>]*>Line 7<\/button>/)
    expect(html).not.toContain("No problems in these")
  })

  it("says there are no problems above a clean preview", () => {
    expect(draw()).toContain('<p class="text-sm text-muted">No problems in this row.</p>')
  })

  it("renders cell text literally, never as markup or a formula", () => {
    const html = draw({
      header: ["<b>x</b>", "=SUM(A1)", "Payee"],
      sample: [["<b>x</b>", "=SUM(A1)", "<img src=x onerror=alert(1)>"]],
      preview: [{ line: 2, values: { date: "<b>x</b>", amount: "=SUM(A1)" } }],
    })
    expect(html).not.toContain("<b>x</b>")
    expect(html).not.toContain("<img")
    expect(html).toContain('<option value="0">&lt;b>x&lt;/b></option>')
    expect(html).toContain(">&lt;b>x&lt;/b></bdi>")
    expect(html).toContain(">=SUM(A1)</bdi>")
    expect(html).toContain("First values: <bdi>&lt;img src=x onerror=alert(1)></bdi>")
  })

  it("leaves a field on Not in this file out of the preview, and end-aligns a numeric one", () => {
    const html = draw({ value: { date: 0, amount: 1, payee: null } })
    const head = /<thead[^>]*>(.*?)<\/thead>/.exec(html)?.[1] ?? ""
    expect([...head.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((cell) => cell[1])).toEqual([
      "Line",
      "Date",
      "Amount",
    ])
    expect(head).toContain('<th scope="col" class="text-end">Amount</th>')
    expect(html).toContain(
      '<td class="text-end tabular-nums whitespace-nowrap"><bdi class="block max-w-[32ch] break-words">-€4.20</bdi></td>',
    )
  })

  it("shows Empty in a cell the app read nothing from", () => {
    const html = draw({ preview: [{ line: 2, values: { date: "3 Nov 2026" } }] })
    expect(html).toContain('<span class="text-muted">Empty</span>')
  })

  it("names the preview with how many rows it shows out of the file's", () => {
    expect(draw({ rowCount: 340 })).toContain(
      '<caption id="',
    )
    expect(draw({ rowCount: 340 })).toContain(
      ">Preview. The first row of 340, as it will be imported.</caption>",
    )
    expect(draw()).toContain(">Preview. The first row, as it will be imported.</caption>")
  })

  it("draws an empty state instead of the preview when the file has no rows", () => {
    const html = draw({ sample: [], preview: [] })
    expect(html).toContain("This file has no rows to import.")
    expect(html).not.toContain("<table")
  })

  it("marks the preview busy and keeps every select enabled while pending", () => {
    const html = draw({ pending: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain("disabled")
    expect(html).toContain(">Reading the file again…</p>")
  })

  it("announces nothing on the first render", () => {
    expect(draw()).toContain(
      '<p role="status" class="sr-only" data-e2e="import-mapper-status"></p>',
    )
  })

  it("takes any word from labels", () => {
    const html = draw({ value: { date: null, amount: 1, payee: 2 }, labels: { notInFile: "None" } })
    expect(selectOf(html, "date")).toContain("<option selected value>None</option>")
  })
})
