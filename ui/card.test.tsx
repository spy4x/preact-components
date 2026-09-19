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

    expect(rootClass(html)).toBe("card")
    expect(html).toBe('<div class="card">x</div>')
  })

  it("stacks the caller's utilities after the shipped class", () => {
    // `card` is a preset utility `tailwind-merge` does not know, so it never gets merged away; a
    // caller's own Tailwind utility is appended. Overriding a preset declaration is the job of the
    // section-specific classes — see the `CardBody` case below.
    const html = render(<Card class="max-w-md p-6">x</Card>)

    expect(rootClass(html)).toBe("card max-w-md p-6")
  })

  it("passes through id, aria attributes and data-e2e", () => {
    const html = render(
      <Card id="invoice" aria-label="Invoice summary" data-e2e="invoice-card">
        x
      </Card>,
    )

    expect(html).toContain('<div id="invoice" aria-label="Invoice summary" data-e2e="invoice-card"')
    expect(html).toContain('class="card"')
  })

  it("does not invent header, body or footer children", () => {
    const html = render(<Card>x</Card>)

    expect(html).not.toContain("card-header")
    expect(html).not.toContain("card-body")
    expect(html).not.toContain("card-footer")
  })
})

describe("CardHeader", () => {
  it("renders a title and a right-aligned action from the convenience props", () => {
    const html = render(<CardHeader title="Invoices" action={<button type="button">New</button>} />)

    expect(rootClass(html)).toBe("card-header")
    expect(html).toContain('<span class="text-lg font-semibold">Invoices</span>')
    expect(html).toContain(
      `<div class="flex items-center gap-2"><button type="button">New</button></div>`,
    )
  })

  it("never leaks the convenience props into the DOM as attributes", () => {
    const html = render(<CardHeader title="Invoices" action={<button type="button">New</button>} />)

    expect(html).not.toContain("title=")
    expect(html).not.toContain("action=")
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

    expect(rootClass(html)).toBe("card-header")
    expect(html).toContain("<h3>Custom</h3>")
    expect(html).not.toContain("text-lg font-semibold")
  })

  it("merges a caller class on the header itself", () => {
    expect(rootClass(render(<CardHeader title="Invoices" class="py-2" />))).toBe(
      "card-header py-2",
    )
  })

  it("passes through id and data-e2e", () => {
    const html = render(<CardHeader title="Invoices" id="head" data-e2e="card-head" />)

    expect(html).toContain('id="head"')
    expect(html).toContain('data-e2e="card-head"')
  })
})

describe("CardBody", () => {
  it("emits only the shipped card-body class", () => {
    const html = render(<CardBody>content</CardBody>)

    expect(rootClass(html)).toBe("card-body")
    expect(html).toContain("content")
  })

  it("lets the caller's class win over a conflicting utility", () => {
    expect(rootClass(render(<CardBody class="p-0">content</CardBody>))).toBe("card-body p-0")
  })

  it("passes through data-e2e", () => {
    expect(render(<CardBody data-e2e="card-body">x</CardBody>)).toContain('data-e2e="card-body"')
  })
})

describe("CardFooter", () => {
  it("emits only the shipped card-footer class", () => {
    const html = render(
      <CardFooter>
        <button type="button">Save</button>
      </CardFooter>,
    )

    expect(rootClass(html)).toBe("card-footer")
    expect(html).toContain(`<button type="button">Save</button>`)
  })

  it("lets the caller's class win over a conflicting utility", () => {
    const html = render(<CardFooter class="justify-end">x</CardFooter>)

    expect(rootClass(html)).toBe("card-footer justify-end")
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

    expect(rootClass(html)).toBe("card max-w-md")
    expect(html.indexOf("card-header")).toBeLessThan(html.indexOf("card-body"))
    expect(html.indexOf("card-body")).toBeLessThan(html.indexOf("card-footer"))
    expect(html).toContain("No invoices yet.")
    expect(html).toContain("Refresh")
  })

  it("renders a card that only has children and no sections", () => {
    const html = render(<Card>bare</Card>)

    expect(html).toBe('<div class="card">bare</div>')
  })
})

describe("class composition", () => {
  it("emits the shipped class before the caller's, so a later utility wins", () => {
    const html = render(<CardHeader title="x" class="px-0" />)

    expect(rootClass(html).split(" ")).toEqual(["card-header", "px-0"])
  })
})
