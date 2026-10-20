import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { blockDeclarations } from "./auto-dark.ts"
import { frameSelector, themePreviewCss } from "./theme-preview.ts"

const read = (file: string) => Deno.readTextFile(new URL(file, import.meta.url))
const LAYER = "@layer theme.preact-tokens"

/** The declarations of the frame rule for `theme` in `css`, as property → value, in order. */
function frameRule(css: string, theme: "dark" | "light"): Array<[string, string]> {
  return blockDeclarations(css, frameSelector(theme), [LAYER]).map((declaration) => {
    const colon = declaration.indexOf(":")
    return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()]
  })
}

/** What a property resolves to in a rule: the last declaration wins. */
function valueIn(rule: Array<[string, string]>, property: string): string | undefined {
  return rule.findLast(([name]) => name === property)?.[1]
}

/** `tokens.css`'s own block as property → value. */
function tokenBlock(css: string, header: string): Array<[string, string]> {
  return blockDeclarations(css, header, [LAYER]).map((declaration) => {
    const colon = declaration.indexOf(":")
    return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()]
  })
}

describe("theme-preview.css", () => {
  it("is what theme-preview.ts writes from tokens.css", async () => {
    const written = themePreviewCss(await read("./tokens.css"))
    // The committed file is `deno fmt`ed after it is written; compare without whitespace runs.
    const squash = (css: string) => css.replace(/\s+/g, " ").trim()
    expect(squash(await read("./theme-preview.css"))).toBe(squash(written))
  })

  it("declares every light token on the light frame, with its light value", async () => {
    const tokens = await read("./tokens.css")
    const rule = frameRule(themePreviewCss(tokens), "light")

    expect(valueIn(rule, "color-scheme")).toBe("light")
    for (const [property, value] of tokenBlock(tokens, ":root")) {
      expect(valueIn(rule, property), property).toBe(value)
    }
  })

  it("declares every token on the dark frame, with the dark value where .dark sets one", async () => {
    const tokens = await read("./tokens.css")
    const rule = frameRule(themePreviewCss(tokens), "dark")
    const dark = new Map(tokenBlock(tokens, ".dark"))

    expect(valueIn(rule, "color-scheme")).toBe("dark")
    expect(dark.size).toBeGreaterThan(0)
    for (const [property, value] of tokenBlock(tokens, ":root")) {
      expect(valueIn(rule, property), property).toBe(dark.get(property) ?? value)
    }
    for (const [property, value] of dark) expect(valueIn(rule, property), property).toBe(value)
  })

  it("matches only a preview's own frame, while its own radio is checked", () => {
    expect(frameSelector("light")).toBe(
      `[data-theme-preview]:has(> fieldset [data-theme-preview-choice="light"]:checked) > ` +
        `[data-theme-preview-frame]`,
    )
  })

  it("redeclares the accent scale on both frames, inside the same support check", async () => {
    const tokens = await read("./tokens.css")
    const supports = tokens.match(/@supports \(color: oklch\(from red[^{]*\{/)?.[0].slice(0, -1)
      .trim()
    if (supports === undefined) throw new Error("tokens.css has no accent-scale @supports block")
    const scale = blockDeclarations(
      themePreviewCss(tokens),
      `${frameSelector("dark")},\n  ${frameSelector("light")}`,
      [LAYER, supports],
    )

    expect(scale).toEqual(blockDeclarations(tokens, ":root", [LAYER, supports]))
    expect(scale.some((declaration) => declaration.startsWith("--color-accent-600:"))).toBe(true)
  })
})
