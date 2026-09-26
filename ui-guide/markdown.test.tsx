import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { InlineMarkdown, inlineTokens } from "./markdown.tsx"

describe("inline Markdown", () => {
  it("turns a backtick pair into code and keeps the text around it", () => {
    expect(inlineTokens("Use `cn()` here.")).toEqual([
      { kind: "text", text: "Use " },
      { kind: "code", text: "cn()" },
      { kind: "text", text: " here." },
    ])
  })

  it("turns a double-star pair into strong text", () => {
    expect(inlineTokens("a **bold** word")).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", text: "bold" },
      { kind: "text", text: " word" },
    ])
  })

  it("reads nothing inside a code span as Markdown", () => {
    expect(inlineTokens("`a **b** c`")).toEqual([{ kind: "code", text: "a **b** c" }])
  })

  it("keeps an unmatched backtick as the literal character", () => {
    expect(inlineTokens("a ` stray")).toEqual([{ kind: "text", text: "a ` stray" }])
  })

  it("renders code spans as <code> and leaves no backtick on the page", () => {
    const html = render(<InlineMarkdown text="Import `tokens.css` before **the preset**." />)

    expect(html).toContain(">tokens.css</code>")
    expect(html).toContain("<strong")
    expect(html).not.toContain("`")
  })
})
