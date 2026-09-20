/**
 * The class guard: what `theme/preset.css` defines has to be demonstrated, or named with a reason.
 *
 * The coverage rule covers *components* — a component a package exports and no section demonstrates
 * fails `deno task test`, in `coverage.ts`. Nothing covered
 * *classes*, which is how `.btn-sm` and `.h6` outlived their last real caller in the source
 * guide. This suite closes that hole, and it is a test rather than a type because the class list
 * lives in CSS: Tailwind's `@utility` blocks and plain selectors are not a TypeScript union, and
 * deriving one would mean a code-generation step and a generated file in the tree. Reading
 * `preset.css`, rendering the catalogue and comparing the two sets needs neither, and it is the same
 * shape as `instructions.test.ts`, which already checks the opposite direction (*documented* implies
 * *defined*).
 *
 * The demonstrated side is measured from the rendered markup rather than listed here: a hand-kept
 * list is the failure mode this guards against. The excluded side is explicit, with a reason per
 * class, and is checked for staleness in both directions.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { UIGuide } from "./+index.tsx"
import {
  definedClasses,
  demonstratedClasses,
  documentedClasses,
  UNDEMONSTRATED_CLASSES,
} from "./instructions.tsx"
import { catalogueNames, classDemos } from "./registry.ts"

/** The theme's real stylesheet, read from the sibling package. Read-only, as in `instructions.test.ts`. */
const presetCss = await Deno.readTextFile(new URL("../theme/preset.css", import.meta.url))

/** Every class the preset defines. */
const defined = definedClasses(presetCss)

/** Every class the catalogue's rendered markup applies. */
const demonstrated = demonstratedClasses(render(<UIGuide />))

/** Every class the instructions render as text. */
const documented = new Set(Object.values(documentedClasses).flat())

/**
 * The classes this chapter exists for: the table in the issue that added the `forms` and `surfaces`
 * sections, minus the two the theme itself resolved (`.h6` and `.btn-sm` were dropped).
 *
 * A tripwire rather than a second inventory: dropping one of these from the guide has to fail here,
 * because the coverage would otherwise shrink quietly.
 */
const REQUIRED_CLASSES = [
  "input",
  "select",
  "textarea",
  "label",
  "checkbox",
  "radio",
  "btn-input-icon",
  "card",
  "card-header",
  "card-body",
  "card-footer",
  "list-ul",
  "link",
  "scrollbar",
  "kpi",
  "kpi-label",
  "kpi-value",
  "bar",
  "num",
  "text-muted",
  "text-danger",
  "text-success",
  "text-warning",
  "border-control",
  "border-subtle",
  "bg-canvas",
  "bg-surface",
] as const

describe("catalogue class coverage", () => {
  it("demonstrates every class the preset defines, or excludes it with a reason", () => {
    const unaccounted = [...defined]
      .filter((name) => !demonstrated.has(name) && !(name in UNDEMONSTRATED_CLASSES))
      .sort()

    expect(
      unaccounted,
      "defined in theme/preset.css, demonstrated nowhere in the catalogue, and not in " +
        "UNDEMONSTRATED_CLASSES with a reason",
    ).toEqual([])
    // The guard is only worth anything if both sides are non-trivial.
    expect(defined.size).toBeGreaterThan(40)
    expect(demonstrated.size).toBeGreaterThan(30)
  })

  it("demonstrates the classes this chapter was written for", () => {
    for (const name of REQUIRED_CLASSES) {
      expect(defined.has(name), `.${name} is no longer defined by the preset`).toBe(true)
      expect(demonstrated.has(name), `.${name} is demonstrated nowhere`).toBe(true)
    }
  })

  it("keeps no exclusion the guide demonstrates after all", () => {
    // Stale in the other direction: an excluded class that has since been demonstrated is a claim
    // the guide contradicts, and leaving it in would let a real gap hide behind it.
    for (const name of Object.keys(UNDEMONSTRATED_CLASSES)) {
      expect(demonstrated.has(name), `.${name} is excluded and demonstrated`).toBe(false)
    }
  })

  it("excludes no class the preset does not define", () => {
    // What replaces the type the exclusion record cannot have: a class list lives in CSS, so a
    // renamed or mistyped key is caught here instead of by `deno check`.
    for (const name of Object.keys(UNDEMONSTRATED_CLASSES)) {
      expect(defined.has(name), `.${name} is not defined by the preset`).toBe(true)
    }
  })

  it("states a reason for every exclusion", () => {
    for (const [name, reason] of Object.entries(UNDEMONSTRATED_CLASSES)) {
      expect(reason.length, `.${name} has no reason`).toBeGreaterThan(60)
    }
  })

  it("demonstrates only classes the instructions document", () => {
    // The two halves of the theme chapter, tied together: a class the guide applies is one the
    // instructions above it list, so a reader can go from the demo to the inventory.
    const undocumented = [...demonstrated]
      .filter((name) => defined.has(name) && !documented.has(name))
      .sort()

    expect(undocumented, "applied by the catalogue but not listed in documentedClasses").toEqual([])
  })

  it("reads a class in a usage snippet as text rather than as markup", () => {
    // The demonstrated set is read out of `class` attributes; a snippet printed inside
    // `<pre><code>` is escaped text, so a class only ever named in a snippet is not demonstrated.
    const html = render(
      <pre>
        <code>{`<input class="definitely-not-a-class" />`}</code>
      </pre>,
    )

    expect(html).toContain("&quot;")
    expect(demonstratedClasses(html).has("definitely-not-a-class")).toBe(false)
  })
})

describe("class demo cards", () => {
  it("labels each card with the classes its own markup applies, and no others", () => {
    expect(Object.keys(classDemos).length).toBeGreaterThan(0)

    for (const [name, demo] of Object.entries(classDemos)) {
      const html = render(<div>{demo.render()}</div>)
      const applied = demonstratedClasses(html)
      const claimed = new Set(demo.classes)

      // Over-claiming: a chip naming a class the card does not show is documentation that lies.
      const unapplied = demo.classes.filter((className) => !applied.has(className))
      expect(unapplied, `${name} claims classes its markup does not apply`).toEqual([])

      // Under-claiming: a preset class the card applies but does not name in its chips.
      const unclaimed = [...applied]
        .filter((className) => defined.has(className) && !claimed.has(className))
        .sort()
      expect(unclaimed, `${name} applies classes its chips do not name`).toEqual([])
    }
  })

  it("renders a chip per claimed class, under the card's own heading", () => {
    const html = render(<UIGuide />)

    for (const demo of Object.values(classDemos)) {
      expect(html, demo.title).toContain(demo.title)
      for (const className of demo.classes) {
        expect(html, `.${className}`).toContain(`>${`.${className}`}<`)
      }
    }
  })

  it("addresses every class card the way the catalogue addresses a component card", () => {
    // The card id is what the deep links in `pages/` point at, and a class card is a card like any
    // other: `pages/build.ts` asserts a card per entry in `catalogueNames`.
    for (const name of Object.keys(classDemos)) {
      expect(catalogueNames, `${name} has no card id`).toContain(name)
    }
  })
})
