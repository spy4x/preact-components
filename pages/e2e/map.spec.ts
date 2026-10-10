/** Playwright specs for `map/`, on the guide's map page. */
import { AxeBuilder } from "@axe-core/playwright"
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
]
