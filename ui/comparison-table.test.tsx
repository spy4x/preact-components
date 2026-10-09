import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type ComparisonRow, ComparisonTable } from "./comparison-table.tsx"

const products = ["Our app", "Product A", "Product B"]
const rows: ComparisonRow[] = [
  { capability: "Offline mode", values: ["yes", "partial", "no"] },
  { capability: "Export to CSV", values: ["yes", "yes", "partial"], note: "all fields" },
]
const checkedOn = new Date("2026-10-01T00:00:00Z")

function table(extra: Partial<Parameters<typeof ComparisonTable>[0]> = {}): string {
  return render(
    <ComparisonTable
      caption="How our app compares"
      products={products}
      rows={rows}
      checkedOn={checkedOn}
      method="against each product's public pages."
      fit="Not for teams over fifty."
      {...extra}
    />,
  )
}

/** The `<td>`s of the table body, each as its markup. */
function bodyCells(html: string): string[] {
  return [...html.matchAll(/<td\b[^>]*>(.*?)<\/td>/g)].map((match) => match[1])
}

describe("ComparisonTable", () => {
  it("shows the title above the scrolling box and names the table and the box with it", () => {
    const html = table()
    const title = html.match(/<p id="([^"]+)" [^>]*>How our app compares<\/p>/)
    expect(title).not.toBeNull()
    expect(html.indexOf(title![0])).toBeLessThan(html.indexOf('role="region"'))
    expect(html).toContain(`<div role="region" aria-labelledby="${title![1]}" tabindex="0"`)
    expect(html).toMatch(
      /<table class="[^"]*"><caption class="sr-only">How our app compares<\/caption>/,
    )
  })

  it("heads every column and every row", () => {
    const html = table()
    expect(html.match(/<th scope="col"/g)?.length).toBe(products.length + 1)
    expect(html.match(/<th scope="row"/g)?.length).toBe(rows.length)
  })

  it("gives every cell a text label beside its icon, in the order of the values", () => {
    const cells = bodyCells(table())
    expect(cells.length).toBe(rows.length * products.length)
    const labelOf = (cell: string) => cell.match(/<span class="text-foreground">([^<]+)</)?.[1]
    expect(cells.map(labelOf)).toEqual(["Yes", "Partial", "No", "Yes", "Yes", "Partial"])
    for (const cell of cells) expect(cell).toMatch(/<svg [^>]*aria-hidden="true"/)
  })

  it("draws a legend above the table with each value's label and meaning", () => {
    const html = table()
    const legend = html.match(/<ul aria-label="Legend"[^>]*>(.*?)<\/ul>/)?.[1] ?? ""
    expect(html.indexOf("<ul aria-label")).toBeLessThan(html.indexOf("<table"))
    expect(legend).toMatch(/Yes<\/span><\/span><span [^>]*>built in</)
    expect(legend).toMatch(/Partial<\/span><\/span><span [^>]*>with limits/)
    expect(legend).toMatch(/No<\/span><\/span><span [^>]*>not offered</)
  })

  it("highlights the first product's column and says in words that it is ours", () => {
    const html = table()
    expect(html).toMatch(/<th scope="col" class="[^"]*bg-selected-soft[^"]*" data-ours>Our app/)
    expect(html).toContain(">Ours</span>")
    // In each body row, the first value cell is tinted and no other is.
    const tinted = [...html.matchAll(/<\/th>(<td [^>]*>)/g)].map((match) => match[1])
    expect(tinted.length).toBe(rows.length)
    for (const cell of tinted) expect(cell).toContain("bg-selected-soft")
    expect(html.match(/<td class="[^"]*bg-selected-soft/g)?.length).toBe(rows.length)
  })

  it("dates the method with the locale's long date, in UTC unless told otherwise", () => {
    expect(table()).toContain("Checked on October 1, 2026. against each")
    expect(table({ locale: "de" })).toContain("Checked on 1. Oktober 2026.")
    expect(table({ timeZone: "America/New_York" })).toContain("Checked on September 30, 2026.")
  })

  it("puts the note under its capability and leaves out the fit paragraph when none is given", () => {
    expect(table()).toMatch(/Export to CSV<span [^>]*>all fields<\/span><\/th>/)
    expect(table()).toContain('<dt class="font-semibold text-foreground">Fit</dt>')
    expect(table({ fit: undefined })).not.toContain(">Fit</dt>")
  })

  it("replaces every English word through labels", () => {
    const html = table({
      labels: {
        yes: "Ja",
        partial: "Teilweise",
        no: "Nein",
        yesMeaning: "eingebaut",
        partialMeaning: "eingeschränkt",
        noMeaning: "fehlt",
        legend: "Legende",
        capability: "Funktion",
        ours: "Unseres",
        method: "Methode",
        fit: "Passt nicht für",
        checkedOn: (date) => `Geprüft am ${date}.`,
      },
    })
    for (
      const word of [
        ">Ja<",
        ">Teilweise<",
        ">Nein<",
        ">eingebaut<",
        ">eingeschränkt<",
        ">fehlt<",
        'aria-label="Legende"',
        ">Funktion<",
        ">Unseres<",
        ">Methode<",
        ">Passt nicht für<",
        "Geprüft am October 1, 2026.",
      ]
    ) expect(html).toContain(word)
    expect(html).not.toMatch(/>(Yes|Partial|No|Legend|Capability|Ours|Method|Fit)</)
  })

  it("throws a RangeError for an invalid checkedOn date", () => {
    expect(() => table({ checkedOn: new Date("x") })).toThrow(RangeError)
  })

  it("refuses a row whose values do not match the products one for one", () => {
    expect(() => table({ rows: [{ capability: "Sync", values: ["yes", "no"] }] })).toThrow(
      '"Sync" has 2 values for 3 products',
    )
  })
})
