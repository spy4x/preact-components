/**
 * Playwright specs for the guide as a whole: axe-core on every page, in both palettes, with the
 * contrast rule in a spec of its own; and the contrast rule on every hovered row and item, in the
 * light, dark and ink palettes.
 *
 * Each page is scanned as it loads, with its hovered rows forced on. Nothing that opens is scanned:
 * no dialog, menu, popover, error state or toast. A green scan says nothing about those; a
 * package's own spec runs axe on an open state (`new AxeBuilder({ page }).include(selector)`).
 *
 * @module
 */
import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import { type GuidePageId, guidePageIds } from "@spy4x/preact-ui-guide/registry"
import type { Spec } from "./runner.ts"

/** How many elements fail one rule on one page: `[light, dark]`. */
type KnownCount = readonly [light: number, dark: number]

/**
 * How many elements break each axe rule on each page today, per palette. They were found when axe
 * first ran (#667); each entry that is left says beside it why it stays (#674).
 *
 * The count is exact. One more failing element fails the page's spec, and so does one fewer, so a
 * fix lowers its number in the same change and the list can only shrink. A rule that is not
 * listed for a page allows no failing element there.
 */
const KNOWN_VIOLATIONS: Record<GuidePageId, Readonly<Record<string, KnownCount>>> = {
  overview: {},
  // Found once the stage's dots stopped hiding the text on it (#695). Light: `MoneyDisplay`'s
  // negative amount, red-600 on the canvas at 4.33:1, and the disabled `FileInput` zone's two lines;
  // dark: the zone's hint alone. A disabled control is exempt from the contrast rule, which axe
  // cannot tell from the zone's markup; the amount is a `ui/` fix of its own.
  ui: { "color-contrast": [3, 1] },
  icons: {},
  // The `bg-scrim` swatch draws its label on the scrim over the light canvas, at 4.28:1. No
  // component puts text on that scrim: the Lightbox's labels sit on `bg-scrim-strong`.
  theme: { "color-contrast": [1, 0] },
  charts: {},
  map: {},
  // All three come from the page showing whole-page components several times inside one page,
  // which an app does not do. `Shell` and `RailShell` each own the page's `<main>`, correct on an
  // app's page, and their cards put two more inside the guide's own: both nested, and three in
  // all. `AuthForm` names its `<form>` after its mode, and its card mounts it several times in the
  // same two modes. The components are right, and a card cannot take a landmark off what it
  // mounts, so these stay until the owner decides whether the shells may render a `div` in place
  // of `<main>` and `AuthForm` may take a form name of its own.
  system: {
    "landmark-main-is-top-level": [2, 2],
    "landmark-no-duplicate-main": [1, 1],
    // The unnamed `<main>` regions as one group, then the forms named "Sign in" and "Sign up".
    "landmark-unique": [3, 3],
  },
  crud: {},
}

/** Text partly covered by another element: axe cannot see the colour under the covered part. */
const OBSCURED = "color-contrast: elmPartiallyObscured"
/** Text with another element over it. */
const OVERLAPPED = "color-contrast: bgOverlap"
/** Text too short for axe to be sure it is text, which it leaves undecided when it reads low. */
const SHORT = "color-contrast: shortTextContent"
/** A glyph drawn as a character outside the basic plane, which axe does not read as text. */
const GLYPH = "color-contrast: nonBmp"

/**
 * How many elements axe could not decide on, per page, rule and reason, and per palette. The reason
 * is axe's own `messageKey` (or the check's id when it gives none). The count is a ceiling: one
 * more undecided element fails the page's spec, and a pair that is not listed allows none. One
 * fewer does not fail, unlike `KNOWN_VIOLATIONS`, because whether axe can decide on an element
 * hangs on font metrics: CI's browser decides on the header's version pill, which this machine's
 * leaves undecided on every page. The spec's result names each pair held below its ceiling.
 *
 * The guide's dotted stage is scanned without its dots (`STAGE_DOTS`), so the text on it is
 * decided before these are counted.
 */
const KNOWN_INCOMPLETE: Record<GuidePageId, Readonly<Record<string, KnownCount>>> = {
  // On every page: the version pill in the guide's header.
  overview: { [OBSCURED]: [1, 1] },
  ui: {
    // `CommandPalette`'s two option groups, an `li` in the `group` role, which axe allows on an
    // `li` only while it is hidden.
    "aria-allowed-role: aria-allowed-role": [2, 2],
    // The header's version pill, the install command in its scroll region and three captions of
    // a scroll-snap row.
    [OBSCURED]: [5, 5],
    // Key symbols in `Kbd` (Command, Shift, Option, the arrows) and three disclosure chevrons.
    [GLYPH]: [9, 9],
    // A one-character `Kbd` key that axe measured below the ratio and left undecided.
    [SHORT]: [1, 1],
  },
  icons: { [OBSCURED]: [1, 1] },
  // The header's version pill and eight months of the `.pc-scrollbar` card's scrolling row.
  theme: { [OBSCURED]: [9, 9] },
  // The header's version pill, and a `LineChart` reference line's label.
  charts: { [OBSCURED]: [1, 1], [OVERLAPPED]: [1, 1] },
  // The header's version pill; seven pieces of the Map card's text that axe finds another element
  // over; and the zoom control's minus sign.
  map: { [OBSCURED]: [1, 1], [OVERLAPPED]: [7, 7], [GLYPH]: [1, 1] },
  // The header's version pill, seven lines of the `RailShell` demo's scrolling page and a code
  // block in its scroll region.
  system: { [OBSCURED]: [9, 9] },
  crud: { [OBSCURED]: [1, 1] },
}

/**
 * The guide's demo stage, whose 1px dots are a `radial-gradient` background. axe cannot read a
 * colour under a gradient, so with the dots on it decided no text drawn on the stage: over 400
 * elements on the `ui` page alone. The dots are decoration a reader does not read text against, so
 * the scans take them off and measure the text on the stage's own colour. An undecided
 * `bgGradient` result left after that is a real gradient, and is counted like any other.
 */
const STAGE_DOTS = `[class*="bg-[radial-gradient(var(--color-border-subtle)_1px"]`

/** Why axe could not decide on one element: its `messageKey`, or the check's id without one. */
type AxeNode = Awaited<ReturnType<AxeBuilder["analyze"]>>["incomplete"][number]["nodes"][number]
function undecidedReason(node: AxeNode): string {
  const checks = [...node.any, ...node.all, ...node.none]
  const keyed = checks.find((check) => typeof check.data?.messageKey === "string")
  return keyed ? keyed.data.messageKey : checks[0]?.id ?? "unknown"
}

/**
 * What a page draws after hydration, which axe has to wait for: scanned too early, the page has
 * less on it, or has it half drawn. A page with no entry is complete once it has hydrated.
 */
const READY: Partial<Record<GuidePageId, (page: Page) => Promise<unknown>>> = {
  // The Map mounts Leaflet in an effect and fades each tile in. `verify` points it at a local
  // tile on the preview server, so the tiles load with no network.
  map: (page) =>
    page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll("#demo-Map img.leaflet-tile")]
      return tiles.length > 0 && tiles.every((tile) =>
        tile.classList.contains("leaflet-tile-loaded") && getComputedStyle(tile).opacity === "1"
      )
    }),
}

/**
 * An element whose contrast another spec measures, so the page's contrast scan leaves it out. A
 * page with no entry is scanned whole.
 */
const CONTRAST_ELSEWHERE: Partial<Record<GuidePageId, string>> = {
  // The Map's credit line is opaque and lies over tiles Leaflet blends with `plus-lighter`. axe
  // 4.13 has no formula for that blend mode: it throws on this one element and then reports no
  // contrast for the whole page. `map.spec.ts` measures the line with the tiles kept away.
  map: '#demo-Map [data-e2e="map-attribution"]',
}

/** The rule a page's scan is split on: it takes about half the time of the whole scan. */
const CONTRAST = "color-contrast"

/**
 * Which half of a page's rules one spec runs. The ui page's scan took 46 to 53 seconds at a load
 * average near 40, too close to a spec's 60-second limit once specs run side by side, and the
 * contrast rule was about half of it (#696). Two halves run in parallel and each has room.
 */
type Half = "contrast" | "rest"

/**
 * One page in one palette, for one half of axe's rules: each rule fails on exactly as many
 * elements as is known, and on none when the rule is not listed; and axe leaves no more elements
 * undecided, per rule and reason, than `KNOWN_INCOMPLETE` lists for that half.
 */
function axeSpec(pageId: GuidePageId, colorScheme: "light" | "dark", half: Half): Spec {
  const which = half === "contrast"
    ? "colour-contrast violation and no new undecided result"
    : "violation of another rule and no new undecided result"
  return {
    name: `axe: the ${pageId} page has no new and no fixed ${which} in the ${colorScheme} palette`,
    pageId,
    colorScheme,
    run: async (page) => {
      // The guide follows the system palette; without this a dark run could scan the light page.
      const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
      if (dark !== (colorScheme === "dark")) {
        throw new Error(`the page is drawn ${dark ? "dark" : "light"}, not ${colorScheme}`)
      }
      await READY[pageId]?.(page)
      await page.addStyleTag({ content: `${STAGE_DOTS} { background-image: none !important; }` })

      const apart = CONTRAST_ELSEWHERE[pageId]
      const builder = new AxeBuilder({ page })
      const { passes, incomplete, violations } =
        await (half === "contrast"
          ? (apart ? builder.exclude(apart) : builder).withRules([CONTRAST])
          : builder.disableRules([CONTRAST])).analyze()
      const known = Object.fromEntries(
        Object.entries(KNOWN_VIOLATIONS[pageId])
          .filter(([rule]) => (rule === CONTRAST) === (half === "contrast")),
      )
      const expected = (rule: string) => known[rule]?.[colorScheme === "light" ? 0 : 1] ?? 0
      const found = new Map(violations.map(({ id, nodes }) => [id, nodes]))

      const problems: string[] = []
      for (const [rule, nodes] of found) {
        if (nodes.length > expected(rule)) {
          problems.push(
            `${rule} fails on ${nodes.length}, known ${expected(rule)}: ` +
              nodes.map((node) => node.target.join(" ")).join(", "),
          )
        }
      }
      for (const rule of Object.keys(known)) {
        const now = found.get(rule)?.length ?? 0
        if (now < expected(rule)) {
          problems.push(
            `${rule} fails on ${now}, known ${expected(rule)}: lower it in KNOWN_VIOLATIONS`,
          )
        }
      }
      // A rule axe could not run comes back as "incomplete" too, with this check on the element
      // it stopped at. It measured nothing, so it must not pass as "nothing found".
      const knownUndecided = Object.fromEntries(
        Object.entries(KNOWN_INCOMPLETE[pageId])
          .filter(([key]) => key.startsWith(`${CONTRAST}: `) === (half === "contrast")),
      )
      const expectedUndecided = (key: string) =>
        knownUndecided[key]?.[colorScheme === "light" ? 0 : 1] ?? 0
      const undecided = new Map<string, string[]>()
      for (const { id, nodes } of incomplete) {
        for (const node of nodes) {
          const crash = [...node.any, ...node.all, ...node.none]
            .find((check) => check.id === "error-occurred")
          if (crash) {
            problems.push(
              `${id} did not run, at ${node.target.join(" ")}: ${JSON.stringify(crash.data)}`,
            )
            continue
          }
          const key = `${id}: ${undecidedReason(node)}`
          undecided.set(key, [...undecided.get(key) ?? [], node.target.join(" ")])
        }
      }
      for (const [key, targets] of undecided) {
        if (targets.length > expectedUndecided(key)) {
          problems.push(
            `undecided ${key} on ${targets.length}, known ${expectedUndecided(key)}: ` +
              targets.join(", "),
          )
        }
      }
      const below = Object.keys(knownUndecided)
        .filter((key) => (undecided.get(key)?.length ?? 0) < expectedUndecided(key))
        .map((key) => `${key} ${undecided.get(key)?.length ?? 0} of ${expectedUndecided(key)}`)
      // Every page has text on it, so a contrast scan that measured none had the rule switched off.
      const measured = passes.find(({ id }) => id === CONTRAST)?.nodes.length ?? 0
      if (half === "contrast" && measured === 0) {
        problems.push("axe measured the contrast of no element")
      }
      if (problems.length > 0) throw new Error(problems.join(" | "))

      const unsettled = [...undecided.values()].reduce((sum, targets) => sum + targets.length, 0)
      const listed = Object.keys(known).filter((rule) => expected(rule) > 0)
        .map((rule) => `${rule} ×${expected(rule)}`)
      return (half === "contrast"
        ? `contrast passes on ${measured} elements`
        : `${passes.length} rules pass`) +
        `, ${unsettled} known undecided` +
        (listed.length > 0 ? `; known and not held: ${listed.join(", ")}` : "") +
        (below.length > 0 ? `; undecided below the ceiling: ${below.join(", ")}` : "")
    },
  }
}

/**
 * How many elements on a page's hovered rows axe could not decide on, per reason, as
 * `[light, dark, ink]`. Exact, both ways, unlike `KNOWN_INCOMPLETE`: the only reason listed is a
 * glyph outside the basic plane, which no font metric changes. A page with no entry allows none.
 */
const KNOWN_HOVER_INCOMPLETE: Partial<
  Record<GuidePageId, Readonly<Record<string, readonly [light: number, dark: number, ink: number]>>>
> = {
  // The three disclosure chevrons, as on the page scan.
  ui: { nonBmp: [3, 3, 3] },
}

/** What a pointer can rest on: an element with a hover background, and every table body row. */
const HOVERED = `[class*="hover:bg-"], tbody tr`

/**
 * One page in one palette with every row and item that has a hover background drawn hovered: axe
 * finds no text on them below its contrast ratio, and decides on every one.
 *
 * The rows are hovered all at once, through Chromium's forced `:hover` state, because one real
 * pointer move and one scan per row took minutes a page. A forced row is hovered without its
 * children; the colours a row's own hover sets are what is measured. `ink` is the opt-in dark
 * palette, drawn by putting `data-theme="ink"` on the dark page.
 */
function hoverSpec(pageId: GuidePageId, palette: "light" | "dark" | "ink"): Spec {
  return {
    name: `axe: hovered rows on the ${pageId} page keep their text at its contrast ratio in the ` +
      `${palette} palette`,
    pageId,
    colorScheme: palette === "light" ? "light" : "dark",
    run: async (page) => {
      await READY[pageId]?.(page)
      if (palette === "ink") {
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
      }
      await page.addStyleTag({
        content: `${STAGE_DOTS} { background-image: none !important; } ` +
          // A transition would leave a forced row between its two colours when axe reads it.
          `*, *::before, *::after { transition: none !important; }`,
      })
      const before = await page.evaluate((selector) => {
        const rows = [...document.querySelectorAll<HTMLElement>(selector)].filter((row) =>
          row.checkVisibility({ visibilityProperty: true }) &&
          row.getBoundingClientRect().width > 0
        )
        rows.forEach((row, index) => row.setAttribute("data-e2e-hovered", String(index)))
        return rows.map((row) => {
          const style = getComputedStyle(row)
          return `${style.backgroundColor} ${style.color}`
        })
      }, HOVERED)
      if (before.length === 0) throw new Error(`no visible element matches ${HOVERED}`)

      const session = await page.context().newCDPSession(page)
      await session.send("DOM.enable")
      await session.send("CSS.enable")
      const { root } = await session.send("DOM.getDocument", { depth: 0 })
      const { nodeIds } = await session.send("DOM.querySelectorAll", {
        nodeId: root.nodeId,
        selector: "[data-e2e-hovered]",
      })
      await Promise.all(
        nodeIds.map((nodeId) =>
          session.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] })
        ),
      )
      // Only a row whose hover repaints it can read differently from the page scan, so the rest is
      // left out of this one. Without a hover-capable pointer, Tailwind's `hover:` rules do not
      // apply and nothing repaints.
      const changed = await page.evaluate((colours) => {
        let count = 0
        for (const row of document.querySelectorAll<HTMLElement>("[data-e2e-hovered]")) {
          const style = getComputedStyle(row)
          if (
            `${style.backgroundColor} ${style.color}` === colours[Number(row.dataset.e2eHovered)]
          ) {
            continue
          }
          row.setAttribute("data-e2e-repainted", "")
          count++
        }
        return count
      }, before)
      if (changed === 0) {
        throw new Error(`forcing :hover repainted none of ${before.length} rows`)
      }

      const scan = await new AxeBuilder({ page }).withRules(["color-contrast"]).include(
        "[data-e2e-repainted]",
      )
        .analyze()
      const problems = scan.violations.flatMap(({ nodes }) =>
        nodes.map((node) => `${node.target.join(" ")}: ${node.failureSummary ?? ""}`)
      )
      const undecided = new Map<string, string[]>()
      for (const node of scan.incomplete.flatMap(({ nodes }) => nodes)) {
        const reason = undecidedReason(node)
        undecided.set(reason, [...undecided.get(reason) ?? [], node.target.join(" ")])
      }
      const known = KNOWN_HOVER_INCOMPLETE[pageId] ?? {}
      const slot = palette === "light" ? 0 : palette === "dark" ? 1 : 2
      for (const reason of new Set([...undecided.keys(), ...Object.keys(known)])) {
        const targets = undecided.get(reason) ?? []
        const expected = known[reason]?.[slot] ?? 0
        if (targets.length !== expected) {
          problems.push(
            `undecided ${reason} on ${targets.length}, known ${expected} in ` +
              `KNOWN_HOVER_INCOMPLETE: ${targets.join(", ")}`,
          )
        }
      }
      if (problems.length > 0) throw new Error(problems.join(" | "))

      const measured = scan.passes.flatMap(({ nodes }) => nodes).length
      return `${before.length} rows hovered, ${changed} repainted, contrast holds on ` +
        `${measured} elements`
    },
  }
}

export const specs: readonly Spec[] = [
  ...(["light", "dark"] as const).flatMap((colorScheme) =>
    guidePageIds.flatMap((pageId) =>
      (["rest", "contrast"] as const).map((half) => axeSpec(pageId, colorScheme, half))
    )
  ),
  ...(["light", "dark", "ink"] as const).flatMap((palette) =>
    guidePageIds.map((pageId) => hoverSpec(pageId, palette))
  ),
]
