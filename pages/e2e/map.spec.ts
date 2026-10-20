/** Playwright specs for `map/`, on the guide's map page. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Page } from "playwright-core"
import { MAP_PAGE_MARKERS } from "../src/map-page/page.tsx"
import type { Spec } from "./runner.ts"

const TILE = /map-demo\/tile\.png/
const ATTRIBUTION = `#demo-Map [data-e2e="map-attribution"]`

export const specs: readonly Spec[] = [
  {
    name: "Map: the attribution passes axe's colour contrast in the dark palette when no tile " +
      "has loaded",
    pageId: "map",
    colorScheme: "dark",
    run: async (page) => {
      // The runner's page already drew its tiles; load it again with every tile request refused,
      // which is also what a reader sees when the tile server is down.
      await page.route(TILE, (route) => route.abort())
      const asked = page.waitForRequest(TILE)
      await page.reload()
      await page.locator(`html[data-hydrated="true"]`).waitFor()
      await asked
      await page.locator("#demo-Map .leaflet-container").waitFor()
      await page.locator(ATTRIBUTION).waitFor()

      const { passes, violations, incomplete } = await new AxeBuilder({ page })
        .include(ATTRIBUTION).withRules(["color-contrast"]).analyze()

      const state = await page.evaluate(() => ({
        dark: document.documentElement.classList.contains("dark"),
        loaded: document.querySelectorAll("#demo-Map img.leaflet-tile-loaded").length,
      }))
      if (!state.dark) throw new Error("the page is drawn light, not dark")
      if (state.loaded > 0) throw new Error(`${state.loaded} tiles loaded; none should have`)

      const said = (results: typeof passes) =>
        results.flatMap(({ nodes }) => nodes).map((node) =>
          [...node.any, ...node.all, ...node.none].map((check) => check.message).join(" ")
        ).join(" ")
      // Neither a failure nor "cannot tell": axe has to measure the pair and pass it.
      if (violations.length > 0) throw new Error(said(violations))
      if (incomplete.length > 0) throw new Error(`axe could not decide: ${said(incomplete)}`)
      if (passes.length !== 1 || passes[0].nodes.length !== 1) {
        throw new Error("axe did not check the attribution")
      }
      return said(passes)
    },
  },
  // #855: the status in words, and pins that survive a marker update.
  {
    name: "Map: a focused pin keeps focus when markers change, and takes its new status in place",
    pageId: "map",
    run: async (page) => {
      const card = page.locator("#demo-Map")
      const pin = card.locator(`[data-marker-id="warehouse"]`)
      await pin.and(page.locator(`[aria-label="Paris warehouse, off"]`)).waitFor()
      await pin.focus()
      const before = await pin.elementHandle()
      // A click event alone: a real click would move focus to the button.
      await card.locator(`[data-e2e="map-toggle-paris"]`).dispatchEvent("click")
      await pin.and(page.locator(`[aria-label="Paris warehouse, on"]`)).waitFor()
      const state = await pin.evaluate((element, old) => ({
        same: element === old,
        focused: element === document.activeElement,
        active: document.activeElement?.getAttribute("data-marker-id") ?? "(none)",
        status: element.firstElementChild?.className ?? "",
      }), before)
      if (!state.same) throw new Error("the warehouse pin was replaced by a new element")
      if (!state.focused) throw new Error(`focus moved to ${state.active}`)
      if (state.status !== "status-on") throw new Error(`the pin is coloured "${state.status}"`)
      return `same element, focused, ${state.status}`
    },
  },
  {
    name: "Map: every pin's accessible name says its label and its status",
    pageId: "map",
    run: async (page) => {
      const card = page.locator("#demo-Map")
      const names = ["London depot, on", "Paris warehouse, off", "Berlin outpost, status unknown"]
      for (const name of names) {
        await card.getByRole("button", { name, exact: true }).waitFor()
      }
      return names.join(" | ")
    },
  },
  {
    name: "Map: the plain list says each place and its status, in order, to assistive tech",
    pageId: "map",
    run: async (page) => {
      const rows = await listRows(page, "#demo-Map")
      const expected = [
        "London depot, on",
        "Paris warehouse, off",
        "Berlin outpost, status unknown",
      ]
      if (JSON.stringify(rows) !== JSON.stringify(expected)) {
        throw new Error(`the list reads ${rows.join(" | ") || "(nothing)"}`)
      }
      return rows.join(" | ")
    },
  },
  {
    name: "Map: a hydrated server-rendered Map lists the same places with their status",
    pageId: "map",
    run: async (page) => {
      await page.goto(new URL("map-demo/", page.url()).href)
      await page.locator(`html[data-hydrated="true"]`).waitFor()
      await page.locator(`[data-e2e="map-box"] .leaflet-marker-icon`)
        .nth(MAP_PAGE_MARKERS.length - 1).waitFor()
      const words = { on: "on", off: "off", unknown: "status unknown" }
      const expected = MAP_PAGE_MARKERS.map((marker) =>
        `${marker.label}, ${words[marker.status ?? "unknown"]}`
      )
      const rows = await listRows(page, "body")
      if (JSON.stringify(rows) !== JSON.stringify(expected)) {
        throw new Error(`the list reads ${rows.join(" | ") || "(nothing)"}`)
      }
      return rows.join(" | ")
    },
  },
]

/**
 * The rows of the marker list under `scope` as the accessibility tree reads them, so a row, or the
 * status text in it, hidden from assistive tech is missing here.
 */
async function listRows(page: Page, scope: string): Promise<string[]> {
  const list = page.locator(`${scope} [data-e2e="map-marker-list"] ul`)
  await list.waitFor()
  const snapshot = await list.ariaSnapshot()
  // The snapshot puts a space between the label's text node and the status span's: "depot , on".
  return [...snapshot.matchAll(/^\s*- listitem: (.+)$/gm)].map(([, text]) =>
    text.trim().replace(/\s+,/g, ",")
  )
}
