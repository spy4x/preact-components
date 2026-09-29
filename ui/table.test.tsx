import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { VNode } from "preact"
import { render } from "preact-render-to-string"
import { Table, type TableProps } from "./table.tsx"

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
    expect(countOccurrences(html, "hover:bg-hover")).toBe(2)
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

  it("renders no caption for null or false, the other two ways a condition says nothing", () => {
    // A caller writing `caption={title && title}` gets false, not "", when title is empty; one
    // writing `caption={title ?? null}` gets null. Neither should leave an empty <caption> behind.
    for (const caption of [null, false] as const) {
      const html = render(<Table headerSlot={header} bodySlots={[]} caption={caption} />)
      expect(html).not.toContain("<caption")
    }
  })

  it("keys each body row by its bodyKeys entry, not by its position", () => {
    const keys = bodyRowKeys({
      headerSlot: header,
      bodySlots: cells("Grace", "Ada"),
      bodyKeys: ["grace", 7],
    })

    expect(keys).toEqual(["grace", 7])
  })

  it("keys body rows by position when no bodyKeys are given, as it always did", () => {
    const keys = bodyRowKeys({
      headerSlot: header,
      bodySlots: cells("Grace", "Ada", "Hedy"),
    })

    expect(keys).toEqual([0, 1, 2])
  })

  it("renders the same markup with bodyKeys as without", () => {
    const bodySlots = cells("Grace", "Ada")

    expect(render(<Table headerSlot={header} bodySlots={bodySlots} bodyKeys={["g", "a"]} />))
      .toBe(render(<Table headerSlot={header} bodySlots={bodySlots} />))
  })

  it("throws when bodyKeys does not give every body row exactly one key", () => {
    for (const bodyKeys of [["only-one"], ["a", "b", "c"]]) {
      expect(() => Table({ headerSlot: header, bodySlots: cells("Grace", "Ada"), bodyKeys }))
        .toThrow("bodyKeys has")
    }
  })
})

/**
 * One body slot per name, each a single `<td>`. The cell's own key only quiets `jsx-key`: it is
 * the `<tr>` around it whose key these tests read.
 */
function cells(...names: string[]) {
  return names.map((name) => <td key={name}>{name}</td>)
}

/**
 * The Preact key of every `<tr>` inside the `<tbody>` `Table` returns, read off the vnode tree —
 * a key never reaches rendered HTML, so a string render cannot show which one a row got.
 */
function bodyRowKeys(props: TableProps): unknown[] {
  const tbody = findElement(Table(props), "tbody")
  if (!tbody) throw new Error("Table rendered no <tbody>")
  const rows = [tbody.props.children].flat(Infinity) as VNode[]
  return rows.map((row) => row.key)
}

function findElement(node: unknown, type: string): VNode<{ children?: unknown }> | undefined {
  for (const candidate of Array.isArray(node) ? node.flat(Infinity) : [node]) {
    if (typeof candidate !== "object" || candidate === null || !("type" in candidate)) continue
    const vnode = candidate as VNode<{ children?: unknown }>
    if (vnode.type === type) return vnode
    const nested = findElement(vnode.props.children, type)
    if (nested) return nested
  }
  return undefined
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
