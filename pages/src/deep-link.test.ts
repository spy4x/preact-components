/**
 * The deep-link mapping, which is the only part of this page with logic worth testing without a
 * browser: everything else in `src/` is a component the build prerenders and the checks render.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { catalogueNames, catalogueSections } from "@spy4x/preact-ui-guide/registry"
import { componentFromFragment, demoElementId, demoSlug, demoUrl } from "./deep-link.ts"

/** Names in the shape `ui/` exports them. */
const NAMES = ["Badge", "CopyButton", "OnOffButtons", "ToggleSwitch"] as const

describe("demoSlug", () => {
  it("kebab-cases a camel-cased export name", () => {
    expect(demoSlug("ToggleSwitch")).toBe("toggle-switch")
  })

  it("splits every word of a multi-word name", () => {
    expect(demoSlug("OnOffButtons")).toBe("on-off-buttons")
  })

  it("leaves a single-word name alone", () => {
    expect(demoSlug("Badge")).toBe("badge")
  })
})

describe("demoElementId", () => {
  it("names the card the catalogue renders", () => {
    expect(demoElementId("ToggleSwitch")).toBe("demo-ToggleSwitch")
  })
})

describe("componentFromFragment", () => {
  it("resolves the slug the navigation writes", () => {
    expect(componentFromFragment("#toggle-switch", NAMES)).toBe("ToggleSwitch")
  })

  it("resolves the export name", () => {
    expect(componentFromFragment("#ToggleSwitch", NAMES)).toBe("ToggleSwitch")
  })

  it("resolves the card's own id", () => {
    expect(componentFromFragment("#demo-ToggleSwitch", NAMES)).toBe("ToggleSwitch")
  })

  it("accepts a fragment with no leading hash", () => {
    expect(componentFromFragment("on-off-buttons", NAMES)).toBe("OnOffButtons")
  })

  it("ignores case and surrounding whitespace", () => {
    expect(componentFromFragment("  #TOGGLE-SWITCH  ", NAMES)).toBe("ToggleSwitch")
  })

  it("returns undefined for a section anchor the browser can handle itself", () => {
    expect(componentFromFragment("#icons", NAMES)).toBeUndefined()
  })

  it("returns undefined for a component that does not exist", () => {
    expect(componentFromFragment("#BadgePill", NAMES)).toBeUndefined()
  })

  it("returns undefined for an empty fragment", () => {
    expect(componentFromFragment("#", NAMES)).toBeUndefined()
  })

  it("returns undefined rather than throwing on a malformed escape", () => {
    expect(componentFromFragment("#%E0%A4%A", NAMES)).toBeUndefined()
  })
})

describe("the catalogue's own names", () => {
  it("gives every card a slug of its own", () => {
    // The navigation writes one fragment per card, so two names that slugify the same would leave a
    // chip pointing at another component's card. Read off the registry rather than a fixture: the
    // catalogue grew past `ui/` and will grow again.
    const slugs = catalogueNames.map(demoSlug)
    expect(new Set(slugs).size, "two catalogue names share a slug").toBe(slugs.length)
  })

  it("resolves every chip's fragment back to its own component", () => {
    for (const name of catalogueNames) {
      expect(componentFromFragment(`#${demoSlug(name)}`, catalogueNames), name).toBe(name)
    }
  })

  it("addresses a card for every name its sections render", () => {
    // What the build asserts against the prerendered HTML, checked here without a build: the chips
    // and the cards are keyed off the same list.
    const sectionNames = catalogueSections.flatMap((section) => section.names)
    expect([...sectionNames].sort()).toEqual([...catalogueNames].sort())
  })
})

describe("demoUrl", () => {
  it("builds the link that goes into an issue thread", () => {
    expect(demoUrl("https://spy4x.github.io", "/preact-components/", "ToggleSwitch")).toBe(
      "https://spy4x.github.io/preact-components/#toggle-switch",
    )
  })
})
