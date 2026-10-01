import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Card, CardBody, CardFooter, CardHeader } from "./card.tsx"

/**
 * The `class` attribute of the root element.
 *
 * Read off the first opening tag so the helper stays correct when Preact emits other attributes
 * before `class`.
 */
function rootClass(html: string): string {
  const openingTag = /^<[a-z]+([^>]*)>/.exec(html)?.[1] ?? ""
  return / class="([^"]*)"/.exec(openingTag)?.[1] ?? ""
}

describe("Card", () => {
  it("emits only the shipped card class", () => {
    const html = render(<Card>x</Card>)

    expect(rootClass(html)).toBe("pc-card")
    expect(html).toBe('<div class="pc-card">x</div>')
  })

  it("stacks the caller's utilities after the shipped class", () => {
    // `card` is a preset utility `tailwind-merge` does not know, so it never gets merged away; a
    // caller's own Tailwind utility is appended. Overriding a preset declaration is the job of the
    // section-specific classes — see the `CardBody` case below.
    const html = render(<Card class="max-w-md p-6">x</Card>)

    expect(rootClass(html)).toBe("pc-card max-w-md p-6")
  })

  it("passes through id, aria attributes and data-e2e", () => {
    const html = render(
      <Card id="invoice" aria-label="Invoice summary" data-e2e="invoice-card">
        x
      </Card>,
    )

    expect(html).toContain('<div id="invoice" aria-label="Invoice summary" data-e2e="invoice-card"')
    expect(html).toContain('class="pc-card"')
  })

  it("does not invent header, body or footer children", () => {
    const html = render(<Card>x</Card>)

    expect(html).not.toContain("pc-card-header")
    expect(html).not.toContain("pc-card-body")
    expect(html).not.toContain("pc-card-footer")
  })
})

describe("CardHeader", () => {
  it("renders a title and a right-aligned action from the convenience props", () => {
    const html = render(<CardHeader title="Invoices" action={<button type="button">New</button>} />)

    expect(rootClass(html)).toBe("pc-card-header")
    expect(html).toContain('<span class="text-lg font-semibold">Invoices</span>')
    expect(html).toContain(
      `<div class="flex items-center gap-2"><button type="button">New</button></div>`,
    )
  })

  it("never leaks the convenience props into the DOM as attributes", () => {
    const html = render(
      <CardHeader
        title="Invoices"
        action={<button type="button">New</button>}
        headingLevel={2}
      />,
    )

    expect(html).not.toContain("title=")
    expect(html).not.toContain("action=")
    expect(html.toLowerCase()).not.toContain("headinglevel")
  })

  it("draws the title as a heading of the level the caller names, with the span's look", () => {
    for (const level of [2, 3, 4, 5, 6] as const) {
      const html = render(<CardHeader title="Invoices" headingLevel={level} />)

      expect(html).toContain(`<h${level} class="text-lg font-semibold">Invoices</h${level}>`)
      expect(html).not.toContain("<span")
    }
  })

  it("keeps the title a span when no heading level is named, as before the prop existed", () => {
    const html = render(<CardHeader title="Invoices" />)

    expect(html).toContain('<span class="text-lg font-semibold">Invoices</span>')
    expect(html).not.toMatch(/<h[1-6]/)
  })

  it("renders the title alone when no action is given", () => {
    const html = render(<CardHeader title="Invoices" />)

    expect(html).toContain("Invoices")
    expect(html).not.toContain("flex items-center gap-2")
  })

  it("renders raw children instead of the title when children are passed", () => {
    const html = render(
      <CardHeader>
        <h3>Custom</h3>
      </CardHeader>,
    )

    expect(rootClass(html)).toBe("pc-card-header")
    expect(html).toContain("<h3>Custom</h3>")
    expect(html).not.toContain("text-lg font-semibold")
  })

  it("merges a caller class on the header itself", () => {
    expect(rootClass(render(<CardHeader title="Invoices" class="py-2" />))).toBe(
      "pc-card-header py-2",
    )
  })

  it("passes through id and data-e2e", () => {
    const html = render(<CardHeader title="Invoices" id="head" data-e2e="card-head" />)

    expect(html).toContain('id="head"')
    expect(html).toContain('data-e2e="card-head"')
  })
})

describe("CardBody", () => {
  it("emits only the shipped pc-card-body class", () => {
    const html = render(<CardBody>content</CardBody>)

    expect(rootClass(html)).toBe("pc-card-body")
    expect(html).toContain("content")
  })

  it("lets the caller's class win over a conflicting utility", () => {
    expect(rootClass(render(<CardBody class="p-0">content</CardBody>))).toBe("pc-card-body p-0")
  })

  it("passes through data-e2e", () => {
    expect(render(<CardBody data-e2e="card-body">x</CardBody>)).toContain('data-e2e="card-body"')
  })
})

describe("CardFooter", () => {
  it("emits only the shipped pc-card-footer class", () => {
    const html = render(
      <CardFooter>
        <button type="button">Save</button>
      </CardFooter>,
    )

    expect(rootClass(html)).toBe("pc-card-footer")
    expect(html).toContain(`<button type="button">Save</button>`)
  })

  it("lets the caller's class win over a conflicting utility", () => {
    const html = render(<CardFooter class="justify-end">x</CardFooter>)

    expect(rootClass(html)).toBe("pc-card-footer justify-end")
  })
})

describe("Card composition", () => {
  it("renders header, body and footer in order inside one card", () => {
    const html = render(
      <Card class="max-w-md">
        <CardHeader title="Invoices" action={<button type="button">New</button>} />
        <CardBody>No invoices yet.</CardBody>
        <CardFooter>
          <button type="button">Refresh</button>
        </CardFooter>
      </Card>,
    )

    expect(rootClass(html)).toBe("pc-card max-w-md")
    expect(html.indexOf("pc-card-header")).toBeLessThan(html.indexOf("pc-card-body"))
    expect(html.indexOf("pc-card-body")).toBeLessThan(html.indexOf("pc-card-footer"))
    expect(html).toContain("No invoices yet.")
    expect(html).toContain("Refresh")
  })

  it("renders a card that only has children and no sections", () => {
    const html = render(<Card>bare</Card>)

    expect(html).toBe('<div class="pc-card">bare</div>')
  })
})

describe("class composition", () => {
  it("emits the shipped class before the caller's, so a later utility wins", () => {
    const html = render(<CardHeader title="x" class="px-0" />)

    expect(rootClass(html).split(" ")).toEqual(["pc-card-header", "px-0"])
  })
})
