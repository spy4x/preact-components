/// <reference lib="deno.unstable" />
// `lint.ts` declares its own slice of Deno's lint types, because a published module may not
// reference the unstable library. This file is not published, so it may, and `deno check` holds
// that slice to Deno's real `Deno.lint.Plugin` through `satisfies` below.
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import uiText from "./lint.ts"

const plugin = uiText satisfies Deno.lint.Plugin

/** Each `ui-text/no-literal` finding in `source` (a `.tsx` file), as `message @ flagged text`. */
function flagged(source: string): string[] {
  return Deno.lint.runPlugin(plugin, "screen.tsx", source).map((d) =>
    `${d.message} @ ${source.slice(d.range[0], d.range[1])}`
  )
}

describe("ui-text/no-literal", () => {
  it("is the plugin ui-text, a name deno lint accepts, with the one rule no-literal", () => {
    expect(plugin.name).toBe("ui-text")
    expect(plugin.name).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(Object.keys(plugin.rules)).toEqual(["no-literal"])
  })

  it("flags JSX text with a letter in it, in any script", () => {
    expect(flagged(`export const a = <main><h1>Welcome back</h1><i>مرحبا</i></main>`)).toEqual([
      `Text "Welcome back" is not translated @ Welcome back`,
      `Text "مرحبا" is not translated @ مرحبا`,
    ])
  })

  it("flags a string or template literal written as a child", () => {
    expect(flagged(`export const a = (n: number) => <p>{"Saved"}{\`Count \${n}\`}</p>`)).toEqual([
      `Text "Saved" is not translated @ {"Saved"}`,
      `Text "Count" is not translated @ {\`Count \${n}\`}`,
    ])
  })

  it("flags a literal aria-label, title, placeholder, alt and label, on elements and components", () => {
    const source = `export const a = <form>
      <input aria-label="Name" title={"Your name"} placeholder={\`Search\`} />
      <img alt="A cat" />
      <Field label="Email" />
    </form>`
    expect(flagged(source)).toEqual([
      `The aria-label attribute "Name" is not translated @ aria-label="Name"`,
      `The title attribute "Your name" is not translated @ title={"Your name"}`,
      `The placeholder attribute "Search" is not translated @ placeholder={\`Search\`}`,
      `The alt attribute "A cat" is not translated @ alt="A cat"`,
      `The label attribute "Email" is not translated @ label="Email"`,
    ])
  })

  it("leaves other attributes, translated values and text with no letter alone", () => {
    const source = `export const a = (t: (k: string) => string, n: number) => <p
      class="text-sm" data-e2e="total" id="sum" aria-label={t("total")} title={t(\`x\`)} alt="">
      {t("total")} — {n} · 42 % (…) {" "} {"/"} {\`\${n}\`}
    </p>`
    expect(flagged(source)).toEqual([])
  })

  it("leaves text in an element marked translate=no, or inside one, alone", () => {
    const source = `export const a = <p>
      <span translate="no">Seed</span>
      <code translate={"no"}><b>deno task check</b></code>
      <abbr translate="no" title="Hypertext Markup Language">HTML</abbr>
    </p>`
    expect(flagged(source)).toEqual([])
  })

  it("still flags text whose element is marked translate=yes", () => {
    expect(flagged(`export const a = <span translate="yes">Seed</span>`)).toEqual([
      `Text "Seed" is not translated @ Seed`,
    ])
  })

  it("leaves a literal after an ignore comment in JSX braces alone, on its line or the next", () => {
    const source = `export const a = <main>
      {/* deno-lint-ignore ui-text/no-literal */}
      <p>Ignored</p>
      <p>{/* deno-lint-ignore ui-text/no-literal */}Same line</p>
      <hr />
      <p>Two lines down</p>
    </main>`
    expect(flagged(source)).toEqual([`Text "Two lines down" is not translated @ Two lines down`])
  })

  it("does not take another rule's ignore comment as its own", () => {
    const source = `export const a = <main>
      {/* deno-lint-ignore no-explicit-any */}
      <p>Flagged</p>
    </main>`
    expect(flagged(source)).toEqual([`Text "Flagged" is not translated @ Flagged`])
  })

  it("leaves the code inside style and script elements alone", () => {
    const source = `export const a = <head>
      <style>{\`.a { color: red }\`}</style>
      <script>{"window.ready = true"}</script>
    </head>`
    expect(flagged(source)).toEqual([])
  })

  it("cuts a long text to 40 characters in the message", () => {
    const text = "This sentence is far too long to quote whole in a message"
    expect(flagged(`export const a = <p>${text}</p>`)).toEqual([
      `Text "This sentence is far too long to quote …" is not translated @ ${text}`,
    ])
  })
})
