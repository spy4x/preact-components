/**
 * The library's components join their classes instead of merging them (#471): `join` from
 * `@spy4x/preact-cn/join` keeps every class it is given, so `tailwind-merge` stays out of every
 * browser bundle that renders them. The price is that two utilities of one group — `px-3` and
 * `px-6`, `text-muted` and `text-foreground` — can both reach an element, and then the stylesheet's
 * order decides between them, not the order they were written in.
 *
 * So no element the guide renders may carry two such utilities: every card's demo, and the guide's
 * own pages, are rendered, and each `class` attribute is passed through `tailwind-merge`, which
 * knows Tailwind's groups. Anything it would drop is a conflict. A demo that replaces one of a
 * component's own utilities marks the replacement important (`max-w-2xl!`), which is what the
 * library tells an app to do; `tailwind-merge` keeps an important utility beside a plain one.
 *
 * A state no server render reaches (an option row under the pointer, an open popover) is not seen
 * here; the component's own tests hold those.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { twMerge } from "tailwind-merge"
import { UIGuide } from "./+index.tsx"
import { catalogueNames, demoRegistry } from "./registry.ts"

/** The text of every `class` attribute in `html`, with the renderer's entities decoded. */
function classAttributes(html: string): string[] {
  return [...html.matchAll(/\sclass="([^"]*)"/g)].map(([, value]) =>
    (value ?? "").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">").replaceAll("&amp;", "&")
  )
}

/**
 * The utilities in `classes` that `tailwind-merge` would drop because a later one of the same
 * group replaces it. A class repeated verbatim is not a conflict and is not reported.
 *
 * @param classes One `class` attribute.
 * @returns The dropped utilities, in order; empty when the attribute is conflict-free.
 */
function conflictingClasses(classes: string): string[] {
  const kept = new Set(twMerge(classes).split(/\s+/))
  return [...new Set(classes.split(/\s+/).filter(Boolean))].filter((name) => !kept.has(name))
}

/** Every conflict in `html`, as `"<dropped> in <attribute>"`. */
function conflictsIn(html: string): string[] {
  return classAttributes(html).flatMap((classes) =>
    conflictingClasses(classes).map((name) => `${name} in "${classes}"`)
  )
}

describe("no element the guide renders carries two utilities of one group", () => {
  it("finds none in any card's demo", () => {
    const found = catalogueNames.flatMap((name) =>
      conflictsIn(render(<>{demoRegistry[name].render()}</>)).map((conflict) =>
        `${name}: ${conflict}`
      )
    )
    expect([...new Set(found)]).toEqual([])
  })

  it("finds none on the guide's own pages", () => {
    expect([...new Set(conflictsIn(render(<UIGuide />)))]).toEqual([])
  })
})

describe("conflictingClasses", () => {
  it("reports the earlier of two utilities of one group", () => {
    expect(conflictingClasses("flex gap-3 gap-6")).toEqual(["gap-3"])
  })

  it("keeps an important replacement beside the plain utility", () => {
    expect(conflictingClasses("max-w-md max-w-2xl!")).toEqual([])
  })

  it("does not count a class repeated verbatim", () => {
    expect(conflictingClasses("gap-2 flex gap-2")).toEqual([])
  })
})
