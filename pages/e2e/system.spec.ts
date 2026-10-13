/** Playwright specs for `system/` components, on the guide's system page. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator } from "playwright-core"
import type { Spec } from "./runner.ts"
import { scrollRegionSpec } from "./scroll-region.ts"

/** The `SavedCopyNotice` card and the live region of the notice mounted in it. */
const SAVED_COPY = "#demo-SavedCopyNotice"
const SAVED_COPY_REGION = `${SAVED_COPY} [role="status"][data-e2e="saved-copy-notice"]`

/**
 * How many times the text inside the region changed since the last call, counting from the first.
 *
 * A screen reader announces a polite region when its text changes, so a change is an announcement
 * and no change is silence. The first call starts the count; attributes are not counted.
 *
 * @param region The live region.
 * @returns The changes seen since the call before this one.
 */
function textChanges(region: Locator): Promise<number> {
  return region.evaluate((element) => {
    const watched = element as HTMLElement & { textChanges?: number }
    if (watched.textChanges === undefined) {
      watched.textChanges = 0
      new MutationObserver((records) => {
        watched.textChanges = (watched.textChanges ?? 0) + records.length
      }).observe(element, { childList: true, characterData: true, subtree: true })
    }
    const seen = watched.textChanges
    watched.textChanges = 0
    return seen
  })
}

export const specs: readonly Spec[] = [
  scrollRegionSpec({
    what: "the SEOHead card's list of tags",
    pageId: "system",
    selector: `#demo-SEOHead [data-e2e="seo-head-tags"]`,
    name: "The tags SEOHead renders",
    key: "ArrowDown",
  }),
  {
    name: "SavedCopyNotice: the live region is in the page before the copy, its text changes " +
      "when the copy arrives, not when the notice renders again, and again for a newer copy",
    pageId: "system",
    run: async (page) => {
      const region = page.locator(SAVED_COPY_REGION)
      const press = (name: string) =>
        page.locator(`${SAVED_COPY} [data-e2e="saved-copy-${name}"]`).click()
      // In the page and empty before any copy: a region that arrives with its text is often silent.
      await region.and(page.locator(":empty")).waitFor({ state: "attached" })
      await textChanges(region)

      await press("lose")
      await region.filter({ hasText: "saved on this device: 14:05." }).waitFor()
      const arrived = await textChanges(region)
      if (arrived === 0) throw new Error("the region's text did not change when the copy arrived")

      // The demo words the same time differently on every later render.
      await press("render")
      await press("render")
      await page.locator(`${SAVED_COPY} [data-e2e="saved-copy-renders"]`)
        .filter({ hasText: "Rendered again 2 times" }).waitFor()
      const rerendered = await textChanges(region)
      const said = await region.innerText()
      if (rerendered !== 0 || !said.includes("saved on this device: 14:05.")) {
        throw new Error(`rendering again changed the region ${rerendered} times, to "${said}"`)
      }

      await press("newer")
      await region.filter({ hasText: "saved on this device: 14:07, render 2." }).waitFor()
      if (await textChanges(region) === 0) throw new Error("a newer copy changed no text")

      await press("reach")
      await region.and(page.locator(":empty")).waitFor({ state: "attached" })
      return `${arrived} text change(s) on arrival, 0 on two more renders`
    },
  },
  {
    name: "SavedCopyNotice: the shown notice passes axe, colour contrast included",
    pageId: "system",
    run: async (page) => {
      await page.locator(`${SAVED_COPY} [data-e2e="saved-copy-lose"]`).click()
      await page.locator(SAVED_COPY_REGION).filter({ hasText: "Saved copy" }).waitFor()
      const { violations, passes } = await new AxeBuilder({ page }).include(SAVED_COPY_REGION)
        .analyze()
      if (violations.length > 0) {
        throw new Error(violations.map((rule) => `${rule.id}: ${rule.help}`).join("; "))
      }
      if (!passes.some((rule) => rule.id === "color-contrast")) {
        throw new Error("axe did not measure the notice's colour contrast")
      }
    },
  },
  {
    name: "Calendar: a month shows its own days and no date of a neighbouring month; the cells " +
      "before the 1st and after the last day are blank",
    pageId: "system",
    run: async (page) => {
      // The guide pins this calendar to March 2026: 31 days in a grid of 42 cells.
      const grid = page.locator(`#demo-Calendar [data-e2e="calendar-interactive"] [role="grid"]`)
      await grid.locator(`[data-calendar-date="2026-03-01"]`).waitFor()
      const cells = await grid.locator(`[role="gridcell"]`).evaluateAll((all) =>
        all.map((cell) => ({
          text: (cell as HTMLElement).innerText.trim(),
          date: cell.querySelector("[data-calendar-date]")?.getAttribute("data-calendar-date"),
        }))
      )
      const shown = cells.filter((cell) => cell.text !== "")
      const strays = shown.filter((cell) => !cell.date?.startsWith("2026-03-"))
      if (strays.length > 0) {
        throw new Error(`cells outside March show ${strays.map((cell) => cell.text).join(", ")}`)
      }
      const numbers = shown.map((cell) => Number(cell.text.slice(0, 2))).join(" ")
      const march = Array.from({ length: 31 }, (_, day) => day + 1).join(" ")
      if (cells.length !== 42 || numbers !== march) {
        throw new Error(`${cells.length} cells, showing ${numbers}`)
      }
      return `${shown.length} days shown, ${cells.length - shown.length} cells blank`
    },
  },
  {
    name: "pageHeading: focus goes to the first h1 inside main and not to an h1 outside it, a " +
      "tabindex the heading has is kept, and without an h1 focus goes to main",
    pageId: "system",
    run: async (page) => {
      const button = page.locator(`[data-e2e="route-demo-page-heading"]`)
      const heading = page.locator("main h1").first()
      const focused = page.locator(":focus")
      await page.evaluate(() => {
        const outside = document.createElement("h1")
        outside.id = "outside-main"
        document.body.prepend(outside)
      })

      await button.click()
      await heading.and(focused).and(page.locator(`[tabindex="-1"]`)).waitFor()
      await page.locator("#outside-main:not([tabindex])").waitFor({ state: "attached" })
      const name = await heading.innerText()

      await heading.evaluate((element) => element.setAttribute("tabindex", "0"))
      await button.focus()
      await button.click()
      await heading.and(focused).and(page.locator(`[tabindex="0"]`)).waitFor()

      await page.evaluate(() => {
        document.querySelectorAll("main h1").forEach((element) => element.remove())
        document.querySelector("main")?.removeAttribute("tabindex")
      })
      await button.click()
      await page.locator("main").first().and(focused).and(page.locator(`[tabindex="-1"]`)).waitFor()
      return `focused the heading "${name}", then main`
    },
  },
]
