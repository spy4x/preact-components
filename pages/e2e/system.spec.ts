/** Playwright specs for `system/` components, on the guide's system page. */
import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
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

/** The `useRouteAnnouncer` demo's page region, its heading, and the tab title it sets. */
const ROUTE_PAGE = `[data-e2e="route-demo-page"]`
const ROUTE_HEADING = `${ROUTE_PAGE} h1`

/** Press one of the route demo's controls. */
const routeControl = (page: Page, name: string) => page.locator(`[data-e2e="route-demo-${name}"]`)

/** Start a list of every element that takes focus from now on: `heading`, `page`, or its hook. */
function recordFocus(page: Page): Promise<void> {
  return page.evaluate((region) => {
    const scope = globalThis as { focusLog?: string[] }
    const log: string[] = scope.focusLog = []
    document.addEventListener("focusin", (event) => {
      const target = event.target as HTMLElement
      log.push(
        target.matches(`${region} h1`)
          ? "heading"
          : target.matches(region)
          ? "page"
          : target.getAttribute("data-e2e") ?? target.tagName,
      )
    })
  }, ROUTE_PAGE)
}

/** Wait for the tab title, which the hook writes just before it decides on focus. */
async function routeShown(page: Page, title: string): Promise<string[]> {
  await page.waitForFunction((wanted) => document.title === wanted, title)
  return page.evaluate(() => (globalThis as { focusLog?: string[] }).focusLog ?? [])
}

export const specs: readonly Spec[] = [
  {
    name: "useRouteAnnouncer with keepPageFocus: a page that focuses its own field as it opens " +
      "keeps focus there, the heading never takes focus, and the tab title is still set",
    pageId: "system",
    run: async (page) => {
      await routeControl(page, "keep-page-focus").check()
      await recordFocus(page)
      await routeControl(page, "go-search").click()
      const log = await routeShown(page, "Search — route demo")
      await routeControl(page, "search").and(page.locator(":focus")).waitFor()
      if (!log.includes("route-demo-search")) throw new Error(`the field never took focus: ${log}`)
      if (log.includes("heading") || log.includes("page")) {
        throw new Error(`focus went through the heading: ${log}`)
      }
      await page.locator(`${ROUTE_HEADING}:not([tabindex])`).waitFor()
      return `focus went to ${log.join(", ")}`
    },
  },
  {
    name: "useRouteAnnouncer without keepPageFocus: a page that focuses its own field as it " +
      "opens loses focus to the heading, and the tab title is set",
    pageId: "system",
    run: async (page) => {
      await recordFocus(page)
      await routeControl(page, "go-search").click()
      const log = await routeShown(page, "Search — route demo")
      await page.locator(ROUTE_HEADING).and(page.locator(":focus")).waitFor()
      if (log.join() !== "route-demo-go-search,route-demo-search,heading") {
        throw new Error(`focus went to ${log}`)
      }
      return `focus went to ${log.join(", ")}`
    },
  },
  {
    name: "useRouteAnnouncer with keepPageFocus: focus that stayed on a control inside the page " +
      "through the route change goes to the new page's heading",
    pageId: "system",
    run: async (page) => {
      await routeControl(page, "keep-page-focus").check()
      await routeControl(page, "go-settings").click()
      await page.locator(ROUTE_PAGE).and(page.locator(":focus")).waitFor()
      await recordFocus(page)
      await routeControl(page, "in-page").click()
      const log = await routeShown(page, "Inbox — route demo")
      await page.locator(ROUTE_HEADING).and(page.locator(":focus")).waitFor()
      if (log.join() !== "route-demo-in-page,heading") throw new Error(`focus went to ${log}`)
      return `focus went to ${log.join(", ")}`
    },
  },
  {
    name: "useRouteAnnouncer with keepPageFocus: focus put on the page region itself during the " +
      "route change goes to the new page's heading",
    pageId: "system",
    run: async (page) => {
      await routeControl(page, "keep-page-focus").check()
      await routeControl(page, "go-settings").click()
      await page.locator(ROUTE_PAGE).and(page.locator(":focus")).waitFor()
      // The page shows its new path before the hook's effect runs, so this stands in for a page
      // that focuses its own region as it opens.
      await page.locator(ROUTE_PAGE).evaluate((region) => {
        new MutationObserver(() => (region as HTMLElement).focus()).observe(region, {
          childList: true,
          characterData: true,
          subtree: true,
        })
      })
      await recordFocus(page)
      await routeControl(page, "go-inbox").click()
      const log = await routeShown(page, "Inbox — route demo")
      await page.locator(ROUTE_HEADING).and(page.locator(":focus")).waitFor()
      if (log.join() !== "route-demo-go-inbox,page,heading") {
        throw new Error(`focus went to ${log}`)
      }
      return `focus went to ${log.join(", ")}`
    },
  },
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
