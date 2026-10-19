import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  AUTO_DARK_ATTRIBUTE,
  AUTO_DARK_SOURCES,
  autoDarkRegion,
  type AutoDarkSource,
  declarationsOf,
  REGION_END,
  REGION_START,
  withAutoDark,
} from "./auto-dark.ts"

/** A stylesheet's dark block, and the region the generator should write beside it. */
const FIXTURE: AutoDarkSource = {
  file: "fixture.css",
  darkSelector: ".dark",
  autoSelector: "[data-theme-auto]",
  extra: ["color-scheme: dark"],
}

describe("the auto-dark regions", () => {
  for (const source of AUTO_DARK_SOURCES) {
    it(`keep ${source.file} exactly what auto-dark.ts writes from its dark blocks`, async () => {
      const css = await Deno.readTextFile(new URL(source.file, import.meta.url))
      expect(css).toContain(REGION_START)
      expect(css).toContain(REGION_END)
      expect(css).toBe(withAutoDark(css, source))
    })
  }

  it("copy every dark token of tokens.css under the marker, the dark query and the tokens layer", async () => {
    const css = await Deno.readTextFile(new URL("./tokens.css", import.meta.url))
    const region = css.slice(css.indexOf(REGION_START), css.indexOf(REGION_END))
    const darkBody = css.slice(
      css.indexOf("  .dark {"),
      css.indexOf("  }", css.indexOf("  .dark {")),
    )
    expect(region).toContain(
      `@media (prefers-color-scheme: dark) {\n    [${AUTO_DARK_ATTRIBUTE}] {`,
    )
    for (const declaration of declarationsOf(darkBody.slice(darkBody.indexOf("{") + 1))) {
      expect(region).toContain(`${declaration};`)
    }
    expect(region).toContain("color-scheme: dark;")
    // Inside the tokens layer, as `.dark` is: before the layer's closing brace.
    const layerStart = css.indexOf("@layer theme.preact-tokens {")
    expect(layerStart).toBeLessThan(css.indexOf(REGION_START))
    expect(css.indexOf(REGION_END)).toBeLessThan(css.lastIndexOf("}"))
  })

  it("copy both of ink's blocks, the layered one inside the tokens layer again", async () => {
    const css = await Deno.readTextFile(new URL("./ink.css", import.meta.url))
    const region = css.slice(css.indexOf(REGION_START), css.indexOf(REGION_END))
    const selector = `[${AUTO_DARK_ATTRIBUTE}][data-theme="ink"]`
    expect(region.split(`${selector} {`).length).toBe(3)
    expect(region).toContain("--color-canvas: oklch(0.15 0.012 260);")
    expect(region).toMatch(
      new RegExp(
        String.raw`@layer theme\.preact-tokens \{\s*@media \(prefers-color-scheme: dark\) \{\s*` +
          String.raw`\[data-theme-auto\]\[data-theme="ink"\] \{\s*` +
          String.raw`--color-primary-muted: var\(--color-accent-400\);`,
      ),
    )
  })
})

describe("autoDarkRegion", () => {
  it("writes the dark block's declarations under the marker, without its comments", () => {
    const css =
      `.dark {\n  /* why */\n  --a: red; /* tone */\n  --b: color-mix(in oklab,\n    red 30%, transparent);\n}\n` +
      `${REGION_START}\n${REGION_END}\n`
    expect(autoDarkRegion(css, FIXTURE)).toBe(
      "@media (prefers-color-scheme: dark) {\n" +
        "  [data-theme-auto] {\n" +
        "    color-scheme: dark;\n" +
        "    --a: red;\n" +
        "    --b: color-mix(in oklab, red 30%, transparent);\n" +
        "  }\n" +
        "}",
    )
  })

  it("wraps a copy in the layer its dark block sits in when the region sits outside it", () => {
    const css = `@layer one {\n  .dark {\n    --a: red;\n  }\n}\n${REGION_START}\n${REGION_END}\n`
    expect(autoDarkRegion(css, { ...FIXTURE, extra: [] })).toBe(
      "@layer one {\n" +
        "  @media (prefers-color-scheme: dark) {\n" +
        "    [data-theme-auto] {\n" +
        "      --a: red;\n" +
        "    }\n" +
        "  }\n" +
        "}",
    )
  })

  it("does not wrap a copy in the layer the region already sits in", () => {
    const css =
      `@layer one {\n  .dark {\n    --a: red;\n  }\n  ${REGION_START}\n  ${REGION_END}\n}\n`
    expect(autoDarkRegion(css, { ...FIXTURE, extra: [] })).toBe(
      "@media (prefers-color-scheme: dark) {\n  [data-theme-auto] {\n    --a: red;\n  }\n}",
    )
  })

  it("refuses a stylesheet without the region markers or without the dark block", () => {
    expect(() => autoDarkRegion(".dark { --a: red; }", FIXTURE)).toThrow("region markers")
    expect(() => autoDarkRegion(`.light { --a: red; }\n${REGION_START}\n${REGION_END}`, FIXTURE))
      .toThrow("has no .dark block")
  })
})

describe("withAutoDark", () => {
  it("replaces whatever the region held, indented to the marker", () => {
    const css =
      `@layer one {\n  .dark {\n    --a: blue;\n  }\n  ${REGION_START}\n  stale\n  ${REGION_END}\n}\n`
    expect(withAutoDark(css, { ...FIXTURE, extra: [] })).toBe(
      `@layer one {\n  .dark {\n    --a: blue;\n  }\n  ${REGION_START}\n` +
        "  @media (prefers-color-scheme: dark) {\n" +
        "    [data-theme-auto] {\n" +
        "      --a: blue;\n" +
        "    }\n" +
        "  }\n" +
        `  ${REGION_END}\n}\n`,
    )
  })
})
