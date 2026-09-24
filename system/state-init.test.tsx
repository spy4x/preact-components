import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { readStateInit, StateInit, stateInitText } from "./state-init.tsx"

describe("stateInitText", () => {
  it("round-trips a value containing </script>, <!--, U+2028 and U+2029 unchanged", () => {
    const value = {
      note: "</script><!--  end",
      list: ["</script>", "  "],
    }
    const text = stateInitText(value)
    expect(text).not.toContain("</script>")
    expect(JSON.parse(text)).toEqual(value)
  })

  it("escapes < the same way SEOHead's own jsonLdText does", () => {
    expect(stateInitText({ a: "<b>" })).toBe(JSON.stringify({ a: "<b>" }).replace(/</g, "\\u003c"))
  })
})

describe("StateInit", () => {
  it("renders a script carrying the escaped JSON, with no wrapper element", () => {
    const html = render(<StateInit data={{ hello: "world" }} />)
    expect(html).toBe(
      '<script type="application/json" id="state-init">{"hello":"world"}</script>',
    )
  })

  it("defaults its id to state-init and takes an override", () => {
    expect(render(<StateInit data={1} />)).toContain('id="state-init"')
    expect(render(<StateInit data={1} id="my-state" />)).toContain('id="my-state"')
  })

  it("never lets a </script> in the data close the element early", () => {
    const html = render(<StateInit data={{ evil: "</script><script>alert(1)</script>" }} />)
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).toMatch(/^<script[^>]*>.*<\/script>$/)
  })
})

describe("readStateInit", () => {
  /** A `StateInitSourceLike` holding one element at most, the way `document` would for one page. */
  function source(
    id: string,
    textContent: string | null,
  ): { getElementById(wanted: string): { textContent: string | null } | null } {
    return {
      getElementById: (wanted) => (wanted === id ? { textContent } : null),
    }
  }

  it("returns undefined when no element with that id exists", () => {
    expect(readStateInit("state-init", source("something-else", "1"))).toBeUndefined()
  })

  it("returns undefined when the element has no text content", () => {
    expect(readStateInit("state-init", source("state-init", ""))).toBeUndefined()
  })

  it("returns undefined for text that is not valid JSON, rather than throwing", () => {
    expect(readStateInit("state-init", source("state-init", "{not json"))).toBeUndefined()
  })

  it("parses the element's text content back into the original value", () => {
    const value = { a: 1, b: ["x", "y"] }
    expect(readStateInit("state-init", source("state-init", JSON.stringify(value)))).toEqual(value)
  })

  it("reads from a custom id when given one", () => {
    expect(readStateInit("my-state", source("my-state", "42"))).toBe(42)
  })
})
