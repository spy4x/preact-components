import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Button, buttonClasses } from "./button.tsx"

describe("Button", () => {
  it("defaults to a primary button that does not submit a form", () => {
    const html = render(<Button>Save</Button>)

    expect(html).toContain('type="button"')
    expect(html).toContain("bg-accent-900")
    expect(html).toContain("Save")
  })

  it("swaps the palette per variant", () => {
    expect(render(<Button variant="outline">Cancel</Button>)).toContain(
      "border-control",
    )
    expect(render(<Button variant="danger">Delete</Button>)).toContain("bg-danger-fill")
    expect(render(<Button variant="ghost">More</Button>)).toContain("bg-transparent")
  })

  it("renders a square box for the icon variant", () => {
    const html = render(<Button variant="icon" size="lg" aria-label="Close" />)

    expect(html).toContain("size-10")
    expect(html).toContain('aria-label="Close"')
    expect(html).not.toContain("px-4")
  })

  it("scales the padding with size", () => {
    expect(render(<Button size="sm">S</Button>)).toContain("text-xs")
    expect(render(<Button size="lg">L</Button>)).toContain("text-base")
  })

  it("passes native attributes straight through", () => {
    const html = render(
      <Button type="submit" disabled title="Ship it" data-e2e="submit">
        Go
      </Button>,
    )

    expect(html).toContain('type="submit"')
    expect(html).toContain("disabled")
    expect(html).toContain('title="Ship it"')
    expect(html).toContain('data-e2e="submit"')
  })

  it("appends a caller class instead of replacing the variant", () => {
    const html = render(<Button class="w-full">Wide</Button>)

    expect(html).toContain("w-full")
    expect(html).toContain("bg-accent-900")
  })
})

describe("Button busy", () => {
  it("marks a busy button busy and unavailable without disabling it", () => {
    const html = render(<Button busy>Confirm</Button>)

    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toMatch(/\sdisabled[\s=>]/)
    expect(html).toContain("animate-spin")
    expect(html).toContain("Confirm")
  })

  it("swaps in the busy label while busy", () => {
    const html = render(<Button busy busyLabel="Confirming…">Confirm</Button>)

    expect(html).toContain("Confirming…")
    expect(html).not.toContain(">Confirm<")
  })

  it("renders neither busy mark nor busy label while idle", () => {
    const html = render(<Button busyLabel="Confirming…">Confirm</Button>)

    expect(html).not.toContain("aria-busy")
    expect(html).not.toContain("aria-disabled")
    expect(html).not.toContain("animate-spin")
    expect(html).not.toContain("Confirming…")
    expect(html).toContain("Confirm")
  })

  it("puts the spinner in place of an icon button's icon", () => {
    const html = render(
      <Button variant="icon" busy busyLabel="Deleting…" aria-label="Delete">
        <span class="icon-glyph" />
      </Button>,
    )

    expect(html).toContain("animate-spin")
    expect(html).toContain('aria-label="Delete"')
    expect(html).not.toContain("icon-glyph")
    expect(html).not.toContain("Deleting…")
  })
})

describe("buttonClasses", () => {
  it("merges a caller override over the variant utility", () => {
    const classes = buttonClasses("outline", "md", "rounded-full px-8")

    expect(classes).toContain("rounded-full")
    expect(classes).toContain("px-8")
    expect(classes).not.toContain("rounded-md")
    expect(classes).not.toContain("px-3")
  })

  it("keeps utilities from other groups", () => {
    const classes = buttonClasses("primary", "sm", "mt-2")

    expect(classes).toContain("mt-2")
    expect(classes).toContain("px-2")
  })
})
