/**
 * Tests the normalisation and comparison logic `provenance.ts` runs against the four downloaded
 * icon packs, without downloading anything itself: every fixture here is a hand-written SVG or JSX
 * fragment, so this suite is deterministic and runs under `deno task test` like every other suite
 * in this package. Only `runProvenanceCheck` itself (network, npm packages) is left untested here —
 * `deno task --cwd icons provenance` is how that half is proven, by hand, against the real packs.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import {
  extractElements,
  formatRef,
  glyphKeys,
  normalizeElement,
  normalizePathData,
  parsePathData,
  PathParseError,
  repoGlyphs,
  roundNumber,
  skeletonSimilarity,
} from "./provenance.ts"

describe("roundNumber", () => {
  it("treats different formattings of the same value as equal", () => {
    expect(roundNumber("2.0")).toBe(roundNumber("2"))
    expect(roundNumber("2.00")).toBe(roundNumber("2"))
    expect(roundNumber(".5")).toBe(roundNumber("0.5"))
    expect(roundNumber("-0")).toBe("0")
  })

  it("rounds to 4 decimal places rather than comparing full precision", () => {
    expect(roundNumber("1.12345")).toBe(roundNumber("1.12346"))
    expect(roundNumber("1.1234")).not.toBe(roundNumber("1.1235"))
  })

  it("passes non-numeric text through trimmed instead of throwing", () => {
    expect(roundNumber("  z  ")).toBe("z")
  })
})

describe("normalizePathData", () => {
  it("tokenises regardless of spaces, commas or no separator at all", () => {
    const spaced = normalizePathData("M 12 9 L 13 10")
    const commas = normalizePathData("M12,9L13,10")
    const packed = normalizePathData("M12 9L13 10")
    expect(spaced.canonical).toBe(commas.canonical)
    expect(spaced.canonical).toBe(packed.canonical)
  })

  it("keeps command case, because it is absolute vs relative, not formatting", () => {
    expect(normalizePathData("M1 1L2 2").skeleton).toBe("ML")
    expect(normalizePathData("m1 1l2 2").skeleton).toBe("ml")
    expect(normalizePathData("M1 1L2 2").skeleton).not.toBe(normalizePathData("m1 1l2 2").skeleton)
  })

  it("separates a flag digit from a following signed number", () => {
    // This package's own Heroicons v2 arcs write it this way: `…0 0 1-2.247…` is flag, flag,
    // sweep-flag, then a negative x — the minus sign is what breaks the run even under a plain
    // number regex. The case a regex cannot handle — two flags running into a positive number, with
    // no sign to break on — is the next test.
    const { canonical } = normalizePathData("a2.25 2.25 0 0 1-2.247 2.118")
    expect(canonical).toBe("a 2.25 2.25 0 0 1 -2.247 2.118")
  })

  it("reads run-together arc flags as two single digits, not one multi-digit number", () => {
    // The reviewer's example (verdict on #232): a plain letters-and-numbers regex reads "11-18" as
    // the numbers 11 and -18 — two arguments instead of the large-arc-flag, sweep-flag and dx the
    // grammar says it is. Also Heroicons v1's actual shape for `trending-up`/`trending-down` and
    // several Heroicons v2 24/outline files written in the older compact form (`briefcase`, `clock`,
    // `currency-dollar`, `squares-2x2`, `key`, `sun`), which is why the earlier version of this
    // check reported real Heroicons matches as "no match".
    const { canonical } = normalizePathData("a9 9 0 11-18 0")
    expect(canonical).toBe("a 9 9 0 1 1 -18 0")
  })

  it("reads a bare coordinate pair after M as an implicit L, and repeats other commands too", () => {
    // "m0-8-8 8-4-4-6 6" (Heroicons v1's actual `trending-up`) has one `m` and three bare coordinate
    // pairs after it; the grammar says each of those is an implicit `l`. Compare against the same
    // shape written with the `l`s explicit — they must produce the same skeleton and canonical form,
    // or the two would wrongly compare as different shapes.
    const implicit = normalizePathData("m0-8-8 8-4-4-6 6")
    const explicit = normalizePathData("m0-8l-8 8l-4-4l-6 6")
    expect(implicit.skeleton).toBe("mlll")
    expect(implicit.canonical).toBe(explicit.canonical)
    expect(implicit.skeleton).toBe(explicit.skeleton)
  })

  it("treats z and Z as the same command", () => {
    // Closepath has no absolute/relative distinction, unlike every other letter pair this module
    // treats as meaningfully different (the "keeps command case" test above).
    const lower = normalizePathData("M1 1L2 2z")
    const upper = normalizePathData("M1 1L2 2Z")
    expect(lower.skeleton).toBe("MLZ")
    expect(lower.skeleton).toBe(upper.skeleton)
    expect(lower.canonical).toBe(upper.canonical)
  })

  it("only reports a skeleton difference when the command letters differ", () => {
    const a = normalizePathData("M1 1L2 2Z")
    const b = normalizePathData("M9.5 -3L100 42.125Z")
    expect(a.skeleton).toBe(b.skeleton)
    expect(a.canonical).not.toBe(b.canonical)
  })

  it("degrades one unparseable path to a skeleton that cannot match anything, instead of throwing", () => {
    const { canonical, skeleton } = normalizePathData("Q not a number")
    expect(() => normalizePathData("Q not a number")).not.toThrow()
    expect(skeleton.startsWith("unparsed:")).toBe(true)
    expect(canonical.startsWith("unparsed:")).toBe(true)
  })

  it("reads an exponent, and does not mistake a bare e for the start of one", () => {
    // The SVG number grammar allows scientific notation, even though no pack file or glyph in this
    // set happens to use it (checked: no `d` or `points` anywhere in the four packs or +index.tsx
    // contains one). Covered anyway, because the parser claims to follow the grammar in full, not
    // only the part real inputs so far have exercised.
    expect(normalizePathData("M1e2 3").canonical).toBe("M 100 3")
    expect(normalizePathData("M1e-2 3").canonical).toBe("M 0.01 3")
    // "e" with no digits after it is not an exponent marker — SVG allows a bare command letter `e`
    // nowhere, but a malformed or hand-edited `d` could still end a number right before one; the
    // parser should read the number and let the next token fail on its own rather than swallowing
    // the "e" into a broken exponent.
    expect(() => normalizePathData("M1 2e")).not.toThrow()
  })
})

describe("parsePathData", () => {
  it("parses each command's exact argument count, per the SVG grammar", () => {
    expect(parsePathData("M1 2")).toEqual([{ cmd: "M", args: [1, 2] }])
    expect(parsePathData("H5")).toEqual([{ cmd: "H", args: [5] }])
    expect(parsePathData("V5")).toEqual([{ cmd: "V", args: [5] }])
    expect(parsePathData("C1 2 3 4 5 6")).toEqual([{ cmd: "C", args: [1, 2, 3, 4, 5, 6] }])
    expect(parsePathData("S1 2 3 4")).toEqual([{ cmd: "S", args: [1, 2, 3, 4] }])
    expect(parsePathData("Q1 2 3 4")).toEqual([{ cmd: "Q", args: [1, 2, 3, 4] }])
    expect(parsePathData("T1 2")).toEqual([{ cmd: "T", args: [1, 2] }])
    expect(parsePathData("Z")).toEqual([{ cmd: "Z", args: [] }])
  })

  it("rejects data that does not start with a command letter", () => {
    expect(() => parsePathData("1 2 3")).toThrow(PathParseError)
  })

  it("rejects an unknown command letter", () => {
    expect(() => parsePathData("B1 2")).toThrow(PathParseError)
  })

  it("rejects a flag argument that is not 0 or 1", () => {
    expect(() => parsePathData("a1 1 0 2 0 1 1")).toThrow(PathParseError)
  })
})

describe("normalizeElement", () => {
  it("ignores attribute order and presentation attributes on rect/circle/line", () => {
    const a = normalizeElement("rect", { width: "20", height: "5", x: "2", y: "3", rx: "1" })
    const b = normalizeElement("rect", {
      x: "2",
      y: "3",
      rx: "1",
      width: "20",
      height: "5",
      class: "opacity-25",
      fill: "currentColor",
    })
    expect(a.canonical).toBe(b.canonical)
    expect(a.skeleton).toBe(b.skeleton)
  })

  it("normalises polyline/polygon points the same way path data is normalised", () => {
    const a = normalizeElement("polyline", { points: "21 8 21 21 3 21 3 8" })
    const b = normalizeElement("polyline", { points: "21,8 21,21 3,21 3,8" })
    expect(a.canonical).toBe(b.canonical)
  })

  it("distinguishes elements by which numeric attributes are present", () => {
    const withRadius = normalizeElement("rect", {
      x: "0",
      y: "0",
      width: "1",
      height: "1",
      rx: "2",
    })
    const without = normalizeElement("rect", { x: "0", y: "0", width: "1", height: "1" })
    expect(withRadius.skeleton).not.toBe(without.skeleton)
  })
})

describe("extractElements", () => {
  it("reads self-closed and paired tags the same way", () => {
    const selfClosed = extractElements(
      `<rect width="20" height="5" x="2" y="3" rx="1" />` +
        `<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />`,
    )
    const paired = extractElements(
      `<rect x="2" y="3" width="20" height="5" rx="1"></rect>` +
        `<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>`,
    )
    expect(glyphKeys(selfClosed)).toEqual(glyphKeys(paired))
  })

  it("reads an opening tag whose attributes span several lines, as deno fmt wraps them", () => {
    const wrapped = extractElements(`
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
      />
    `)
    expect(wrapped).toHaveLength(1)
    expect(wrapped[0].canonical).toBe("circle:cx=12,cy=12,r=10")
  })

  it("never matches a closing tag as an element of its own", () => {
    const elements = extractElements(`<path d="M1 1L2 2" stroke-linecap="round"></path>`)
    expect(elements).toHaveLength(1)
  })
})

describe("glyphKeys", () => {
  it("compares elements as a set, not a sequence", () => {
    const first = [
      normalizeElement("rect", { x: "1", y: "2", width: "3", height: "4" }),
      normalizeElement("path", { d: "M1 1L2 2" }),
    ]
    const reordered = [
      normalizeElement("path", { d: "M1 1L2 2" }),
      normalizeElement("rect", { x: "1", y: "2", width: "3", height: "4" }),
    ]
    expect(glyphKeys(first)).toEqual(glyphKeys(reordered))
  })
})

describe("skeletonSimilarity", () => {
  it("scores identical skeletons as 1", () => {
    const elements = [normalizeElement("path", { d: "M1 1L2 2" })]
    expect(skeletonSimilarity(elements, elements)).toBe(1)
  })

  it("scores disjoint skeletons as 0", () => {
    const a = [normalizeElement("path", { d: "M1 1L2 2" })]
    const b = [normalizeElement("rect", { x: "0", y: "0", width: "1", height: "1" })]
    expect(skeletonSimilarity(a, b)).toBe(0)
  })

  it("counts a repeated skeleton once per occurrence, not once per distinct value", () => {
    const twoLines = [
      normalizeElement("line", { x1: "0", y1: "0", x2: "1", y2: "1" }),
      normalizeElement("line", { x1: "2", y1: "2", x2: "3", y2: "3" }),
    ]
    const oneLine = [normalizeElement("line", { x1: "9", y1: "9", x2: "8", y2: "8" })]
    // One of `twoLines`' two elements has a matching skeleton in `oneLine`; the other does not — in
    // both directions. A version that counts "present at all" rather than per-occurrence (a plain
    // set instead of a multiset) gives the right answer, 0.5, in the `(twoLines, oneLine)` direction
    // by coincidence — `oneLine` has only one element to find, so "present" and "how many" agree —
    // but wrongly returns 1 in the `(oneLine, twoLines)` direction, because `oneLine`'s one skeleton
    // is "present" in `twoLines` even though `twoLines` has a second element that does not match it.
    // Both directions are asserted so that bug cannot hide in the one direction that looks right.
    expect(skeletonSimilarity(twoLines, oneLine)).toBe(0.5)
    expect(skeletonSimilarity(oneLine, twoLines)).toBe(0.5)
  })
})

describe("repoGlyphs", () => {
  it("parses name, doc and geometry out of +index.tsx-shaped source", () => {
    const source = `
import type { JSX } from "preact"

export interface IconProps {
  class?: string
}

/** Heroicons v1 outline (stroke-2) · from template. */
export function IconArrowDown(props: IconProps): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class={props.class || "size-6"}>
      <path stroke-linecap="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}
`
    const glyphs = repoGlyphs(source)
    expect(glyphs).toHaveLength(1)
    expect(glyphs[0].name).toBe("IconArrowDown")
    expect(glyphs[0].doc).toBe("Heroicons v1 outline (stroke-2) · from template.")
    expect(glyphs[0].elements).toHaveLength(1)
    expect(glyphs[0].elements[0].tag).toBe("path")
  })
})

describe("exact vs near vs none — the mutation this check exists to catch", () => {
  // `IconArchive`'s own three elements, byte-identical to `lucide-static@1.47.0`'s `archive.svg`
  // (confirmed by hand and by `deno task --cwd icons provenance`, which reports this pair as an
  // exact match). Standing in for "the pack's copy" and "this package's copy" without a network
  // call: this is the fixture form of the brief's "corrupt a known glyph and watch it move from
  // exact to near" proof, kept as a permanent regression test rather than a one-off console run.
  const archiveMarkup = `<rect width="20" height="5" x="2" y="3" rx="1" />` +
    `<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />` +
    `<path d="M10 12h4" />`

  it("is an exact match when both sides carry the same geometry", () => {
    const ours = extractElements(archiveMarkup)
    const theirs = extractElements(archiveMarkup)
    expect(glyphKeys(ours).canonicalKey).toBe(glyphKeys(theirs).canonicalKey)
  })

  it("degrades to a near match — not an exact one — when one number is corrupted", () => {
    const ours = extractElements(archiveMarkup)
    const corrupted = archiveMarkup.replace('x="2"', 'x="3"')
    const theirs = extractElements(corrupted)
    const oursKeys = glyphKeys(ours)
    const theirsKeys = glyphKeys(theirs)
    expect(oursKeys.canonicalKey).not.toBe(theirsKeys.canonicalKey)
    expect(oursKeys.skeletonKey).toBe(theirsKeys.skeletonKey)
  })

  it("degrades to no match when an element's shape, not just its numbers, changes", () => {
    const ours = extractElements(archiveMarkup)
    // The `rect` becomes a `circle`: same drawing intent, different element entirely.
    const reshaped = archiveMarkup.replace(
      '<rect width="20" height="5" x="2" y="3" rx="1" />',
      '<circle cx="12" cy="12" r="10" />',
    )
    const theirs = extractElements(reshaped)
    const oursKeys = glyphKeys(ours)
    const theirsKeys = glyphKeys(theirs)
    expect(oursKeys.canonicalKey).not.toBe(theirsKeys.canonicalKey)
    expect(oursKeys.skeletonKey).not.toBe(theirsKeys.skeletonKey)
  })
})

describe("formatRef", () => {
  it("names pack, version, style, size and icon name on one line", () => {
    const line = formatRef({
      pack: "Heroicons",
      version: "v1@1.0.6",
      style: "outline",
      size: "24",
      name: "archive",
    })
    expect(line).toBe('Heroicons v1@1.0.6 outline/24 "archive"')
  })
})
