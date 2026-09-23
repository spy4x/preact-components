import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Table } from "./table.tsx"

const header = (
  <tr>
    <th>Name</th>
  </tr>
)

describe("Table", () => {
  it("renders one body row per slot", () => {
    const html = render(
      <Table
        headerSlot={header}
        bodySlots={[
          <tr key="a">
            <td>Ada</td>
          </tr>,
          <tr key="b">
            <td>Grace</td>
          </tr>,
        ]}
      />,
    )

    expect(html).toContain("Ada")
    expect(html).toContain("Grace")
    expect(countOccurrences(html, "hover:bg-gray-50")).toBe(2)
  })

  it("omits the footer when no slot is given", () => {
    expect(render(<Table headerSlot={header} bodySlots={[]} />)).not.toContain("<tfoot")
  })

  it("renders the footer inside a tfoot", () => {
    const html = render(
      <Table
        headerSlot={header}
        bodySlots={[]}
        footerSlot={
          <tr>
            <td>Total</td>
          </tr>
        }
      />,
    )

    expect(html).toContain("<tfoot")
    expect(html).toContain("Total")
  })

  it("stamps the e2e attribute on every body row", () => {
    const html = render(
      <Table
        headerSlot={header}
        bodySlots={[
          <tr key="a">
            <td>Ada</td>
          </tr>,
          <tr key="b">
            <td>Grace</td>
          </tr>,
        ]}
        rowDataE2E="invoice-row"
      />,
    )

    expect(countOccurrences(html, 'data-e2e="invoice-row"')).toBe(2)
  })

  it("puts the header cells in the thead", () => {
    const html = render(<Table headerSlot={header} bodySlots={[]} />)

    expect(html).toContain("<thead")
    expect(html).toContain("Name")
  })

  it("scrolls horizontally instead of overflowing the page", () => {
    expect(render(<Table headerSlot={header} bodySlots={[]} />)).toContain("overflow-x-auto")
  })

  it("appends a caller class to the wrapper", () => {
    const html = render(<Table headerSlot={header} bodySlots={[]} class="mt-8" />)

    expect(html).toContain("mt-8")
    expect(html).toContain("overflow-x-auto")
  })

  it("renders no caption at all when none is given", () => {
    expect(render(<Table headerSlot={header} bodySlots={[]} />)).not.toContain("<caption")
  })

  it("renders the caption before the header, with its own class", () => {
    const html = render(
      <Table headerSlot={header} bodySlots={[]} caption="Invoices" captionClass="sr-only" />,
    )

    expect(html).toContain('<caption class="sr-only">Invoices</caption>')
    expect(html.indexOf("<caption")).toBeLessThan(html.indexOf("<thead"))
  })

  it("renders a falsy but present caption, rather than a stray text node", () => {
    // `caption && <caption>…</caption>` would have rendered a bare "0" here instead of a
    // <caption> element — caller-supplied content, however falsy, is not "no caption".
    const html = render(<Table headerSlot={header} bodySlots={[]} caption={0} />)

    expect(html).toContain("<caption>0</caption>")
    // The bug this guards: `caption && <caption>…</caption>` renders the falsy caption itself —
    // a bare "0" text node right before <thead> — instead of a <caption> element around it.
    expect(html).not.toContain(">0<thead")
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
