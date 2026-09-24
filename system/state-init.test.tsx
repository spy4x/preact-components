import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  readStateInit,
  StateInit,
  type StateInitElementLike,
  stateInitText,
} from "./state-init.tsx"

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

  it("throws an error naming StateInit for undefined, rather than crashing inside .replace", () => {
    expect(() => stateInitText(undefined)).toThrow(/StateInit/)
  })

  it("throws an error naming StateInit for a function, rather than crashing inside .replace", () => {
    expect(() => stateInitText(() => {})).toThrow(/StateInit/)
  })

  it("throws an error naming StateInit for a Symbol, rather than crashing inside .replace", () => {
    expect(() => stateInitText(Symbol("x"))).toThrow(/StateInit/)
  })

  it("throws an error naming StateInit for a value containing a BigInt", () => {
    expect(() => stateInitText({ big: 1n })).toThrow(/StateInit/)
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
  /** A fake `<script type="application/json">`, the shape `StateInit` itself renders. */
  function scriptElement(textContent: string | null): StateInitElementLike {
    return {
      tagName: "SCRIPT",
      getAttribute: (name) => (name === "type" ? "application/json" : null),
      textContent,
    }
  }

  /** A fake element that is not `StateInit`'s own script — same id, wrong shape. */
  function otherElement(textContent: string | null): StateInitElementLike {
    return {
      tagName: "DIV",
      getAttribute: () => null,
      textContent,
    }
  }

  /** A `StateInitSourceLike` holding one element at most, the way `document` would for one page. */
  function source(
    id: string,
    element: StateInitElementLike,
  ): { getElementById(wanted: string): StateInitElementLike | null } {
    return {
      getElementById: (wanted) => (wanted === id ? element : null),
    }
  }

  it("returns undefined when no element with that id exists", () => {
    expect(readStateInit("state-init", source("something-else", scriptElement("1"))))
      .toBeUndefined()
  })

  it("returns undefined when the element has no text content", () => {
    expect(readStateInit("state-init", source("state-init", scriptElement("")))).toBeUndefined()
  })

  it("returns undefined for text that is not valid JSON, rather than throwing", () => {
    expect(readStateInit("state-init", source("state-init", scriptElement("{not json"))))
      .toBeUndefined()
  })

  it("parses the element's text content back into the original value", () => {
    const value = { a: 1, b: ["x", "y"] }
    expect(
      readStateInit("state-init", source("state-init", scriptElement(JSON.stringify(value)))),
    ).toEqual(value)
  })

  it("reads from a custom id when given one", () => {
    expect(readStateInit("my-state", source("my-state", scriptElement("42")))).toBe(42)
  })

  it("ignores a non-script element carrying StateInit's own id", () => {
    const value = { a: 1 }
    expect(
      readStateInit("state-init", source("state-init", otherElement(JSON.stringify(value)))),
    ).toBeUndefined()
  })
})
