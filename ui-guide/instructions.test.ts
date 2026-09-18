import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { definedClasses, documentedClasses, removedClasses } from "./instructions.tsx"

/**
 * The theme's real stylesheet, read from the sibling package.
 *
 * Read-only: this is the one place the catalogue reaches outside its own directory, and it is what
 * turns "does the guide document a class that exists?" from a code review question into a test.
 */
const presetCss = await Deno.readTextFile(new URL("../theme/preset.css", import.meta.url))

const documented = Object.values(documentedClasses).flat()
const defined = definedClasses(presetCss)

describe("catalogue class documentation", () => {
  it("documents a class the theme defines", () => {
    expect(documented.length).toBeGreaterThan(0)
    for (const name of documented) {
      expect(defined.has(name), `.${name} is documented but not defined in theme/preset.css`)
        .toBe(true)
    }
  })

  it("documents no class twice", () => {
    expect(new Set(documented).size).toBe(documented.length)
  })

  it("does not bring back the classes the theme dropped", () => {
    // `.btn-sm` and `.h6` had zero usages in the product they came from; only that product's
    // ui-guide referenced them, which is how they outlived the CSS. This is the regression guard.
    for (const name of Object.keys(removedClasses)) {
      expect(documented, `.${name} is documented again`).not.toContain(name)
      expect(defined.has(name), `.${name} is defined again`).toBe(false)
    }
  })

  it("is not fooled by a class name that only appears in a preset comment", () => {
    // `preset.css` explains the removal of `.h6` and `.btn-sm` in prose. A substring search over the
    // file would count those mentions as definitions, so `definedClasses` strips comments first.
    expect(presetCss).toContain(".h6")
    expect(presetCss).toContain(".btn-sm")
    expect(defined.has("h6")).toBe(false)
    expect(defined.has("btn-sm")).toBe(false)
  })

  it("reads both utility blocks and plain selectors", () => {
    expect(defined.has("btn-primary"), "@utility btn-primary").toBe(true)
    // `.theme-base` is a plain selector in @layer base, not a Tailwind utility.
    expect(defined.has("theme-base"), ".theme-base").toBe(true)
    // `.map-marker` is only ever a descendant selector.
    expect(defined.has("map-marker"), ".status-on .map-marker").toBe(true)
  })
})
