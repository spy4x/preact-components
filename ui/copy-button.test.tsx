import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options } from "preact"
import { render } from "preact-render-to-string"
import { CopyButton } from "./copy-button.tsx"

describe("CopyButton", () => {
  it("renders an icon-only button when no label is given", () => {
    const html = render(<CopyButton textToCopy="abc" />)

    expect(html).toContain("size-9")
    expect(html).toContain('aria-label="Copy"')
  })

  it("renders an outlined button with the label text when a title is given", () => {
    const html = render(<CopyButton textToCopy="abc" title="Copy link" />)

    expect(html).toContain("border-gray-300")
    expect(html).toContain("Copy link")
    expect(html).not.toContain('aria-label="Copy"')
  })

  it("takes a custom label for tooltip and accessible name", () => {
    const html = render(<CopyButton textToCopy="abc" copyLabel="Copy API key" />)

    expect(html).toContain('title="Copy API key"')
    expect(html).toContain('aria-label="Copy API key"')
  })

  it("shows the clipboard glyph before anything is copied", () => {
    expect(render(<CopyButton textToCopy="abc" />)).toContain("<rect")
  })

  it("defaults to type button", () => {
    expect(render(<CopyButton textToCopy="abc" />)).toContain('type="button"')
  })

  it("appends a caller class", () => {
    expect(render(<CopyButton textToCopy="abc" class="ml-2" />)).toContain("ml-2")
  })
})

describe("CopyButton's copy port", () => {
  it("hands its text to the caller's port when clicked", () => {
    // No DOM here: the `<button>`'s click handler is read off the element tree as it is created.
    const copied: string[] = []
    let click: (() => void) | undefined
    const previous = options.vnode
    options.vnode = (vnode) => {
      const props = vnode.props as { onClick?: () => void }
      if (vnode.type === "button" && props.onClick) click = props.onClick
      previous?.(vnode)
    }
    try {
      render(
        <CopyButton textToCopy="deno add jsr:@std/path" copy={(text) => void copied.push(text)} />,
      )
    } finally {
      options.vnode = previous
    }

    click?.()

    expect(click).toBeDefined()
    expect(copied).toEqual(["deno add jsr:@std/path"])
  })
})
