import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { CopyButton, copyToClipboard } from "./copy-button.tsx"

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

describe("copyToClipboard", () => {
  it("routes the text through the injected port", () => {
    const copied: string[] = []

    copyToClipboard("invoice-42", (text) => {
      copied.push(text)
    })

    expect(copied).toEqual(["invoice-42"])
  })

  it("awaits nothing when the port is async", () => {
    const copied: string[] = []

    copyToClipboard("async-value", (text) => {
      copied.push(text)
      return Promise.resolve()
    })

    expect(copied).toEqual(["async-value"])
  })
})
