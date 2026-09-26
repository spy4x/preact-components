import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Button, buttonClasses } from "./button.tsx"

describe("Button", () => {
  it("defaults to a primary button that does not submit a form", () => {
    const html = render(<Button>Save</Button>)

    expect(html).toContain('type="button"')
    expect(html).toContain("bg-purple-900")
    expect(html).toContain("Save")
  })

  it("swaps the palette per variant", () => {
    expect(render(<Button variant="outline">Cancel</Button>)).toContain(
      "border-gray-300",
    )
    expect(render(<Button variant="danger">Delete</Button>)).toContain("bg-red-600")
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
    expect(html).toContain("bg-purple-900")
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
