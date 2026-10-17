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

/** The `RailShell` card, and one element in it by its `data-e2e`. */
const RAIL = "#demo-RailShell"
const rail = (page: Page, e2e: string) => page.locator(`${RAIL} [data-e2e="${e2e}"]`)

/** Throw unless `locator` is drawn, or unless it is not, naming it by `what`. */
async function expectVisible(locator: Locator, visible: boolean, what: string): Promise<void> {
  if (await locator.isVisible() !== visible) {
    throw new Error(`${what} is ${visible ? "not drawn" : "drawn"}`)
  }
}

/**
 * Run axe over `selector`, colour contrast included, and throw on any violation. `disabledRules`
 * leaves out rules the setup itself breaks, each named with its reason at the call.
 */
async function expectAxeClean(
  page: Page,
  selector: string,
  disabledRules: string[] = [],
): Promise<string> {
  const { violations, passes } = await new AxeBuilder({ page }).include(selector)
    .disableRules(disabledRules).analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map((rule) => `${rule.id}: ${rule.help} (${rule.nodes.length})`).join("; "),
    )
  }
  if (!passes.some((rule) => rule.id === "color-contrast")) {
    throw new Error(`axe did not measure colour contrast in ${selector}`)
  }
  return `${passes.length} axe rules passed`
}

/** The `useRouteAnnouncer` demo's page region, its heading, and the tab title it sets. */
const ROUTE_PAGE = `[data-e2e="route-demo-page"]`
const ROUTE_HEADING = `${ROUTE_PAGE} h1`

/**
 * Click `item` (with `modifiers`, if any) and report whether the page had cancelled the browser's
 * own navigation by the time the click reached the item's last listener. The listener added here
 * runs after the component's own, records `defaultPrevented`, then cancels the click itself, so a
 * modifier click opens no tab and a link left to the browser does not move the guide page.
 */
async function clickCancelled(item: Locator, modifiers: ("Control" | "Meta")[] = []) {
  // Kept on `window`, since choosing an item closes the menu and hides the item before it is read.
  type Watched = typeof globalThis & { e2eClickCancelled?: boolean }
  await item.evaluate((element) => {
    delete (globalThis as Watched).e2eClickCancelled
    element.addEventListener("click", (event) => {
      ;(globalThis as Watched).e2eClickCancelled = event.defaultPrevented
      event.preventDefault()
    }, { once: true })
  })
  await item.click({ modifiers })
  const cancelled = await item.page().evaluate(() => (globalThis as Watched).e2eClickCancelled)
  if (cancelled === undefined) throw new Error("the click never reached the item")
  return cancelled
}

/**
 * Move the `RailShell` card's frame out of the guide to the top level of the body, full width, and
 * return its selector. The guide draws the card inside its own `<main>` and a padded card, where
 * every node is in a landmark and the bar is narrower than the window; an app draws the shell as
 * the page itself, which is what the checks that call this need to see.
 */
async function railFrameAtTopLevel(page: Page): Promise<string> {
  await rail(page, "rail-shell-column").evaluate((column) => {
    const frame = column.parentElement
    if (!frame) throw new Error("the column has no frame around it")
    frame.id = "e2e-rail-frame"
    document.body.append(frame)
  })
  return "body > #e2e-rail-frame"
}

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
  {
    name:
      "RailShell below md: a control tabbed to near the bottom of the window scrolls into view " +
      "above the sticky tab bar instead of staying hidden behind it",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const bar = page.locator(`#demo-RailShell [data-e2e="rail-shell-tabbar"]`)
      const target = page.locator(`[data-e2e="rail-shell-demo-focus-target"]`)
      const checkbox = page.locator(`[data-e2e="rail-shell-demo-route-links"]`)
      // The demo scrolls inside a 600 px box; an app's shell scrolls the window. Lift the box's
      // bounds so the window scrolls the shell, and add the last control of the page after its
      // last line, as a form's last button or a "Danger zone" would sit.
      await page.evaluate(() => {
        const frame = document.querySelector<HTMLElement>(`[data-e2e="rail-shell-demo"]`)
        if (!frame) throw new Error("the RailShell demo frame is missing")
        // Its classes also move the tab bar's scroll padding from the root to the frame; dropping
        // them gives the root back the padding an app's shell gets.
        frame.className = ""
        // The guide scrolls smoothly; an instant scroll lets the box be read right after focus.
        document.documentElement.style.scrollBehavior = "auto"
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = "Last control"
        button.setAttribute("data-e2e", "rail-shell-demo-focus-target")
        document.querySelector(`[data-e2e="rail-shell-demo-last-line"]`)?.after(button)
      })
      await checkbox.focus()
      // Scroll the window so the control's bottom edge sits 10 px above the window's, which is
      // behind the 65 px bar, then reach it from the checkbox with Tab as a keyboard user would.
      await target.evaluate((element) => {
        const { bottom } = element.getBoundingClientRect()
        globalThis.scrollBy({ top: bottom - (globalThis.innerHeight - 10), behavior: "instant" })
      })
      await page.keyboard.press("Tab")
      await target.and(page.locator(":focus")).waitFor()
      const [box, barBox] = await Promise.all([target.boundingBox(), bar.boundingBox()])
      if (!box || !barBox) throw new Error("the control or the tab bar is not drawn")
      if (box.y + box.height > barBox.y) {
        throw new Error(
          `the focused control ends at y ${
            box.y + box.height
          }, under the tab bar from y ${barBox.y}`,
        )
      }
      await page.setViewportSize({ width: 1280, height: 844 })
      const wide = await page.evaluate(() =>
        getComputedStyle(document.documentElement).scrollPaddingBottom
      )
      if (wide !== "auto") throw new Error(`from md up the root keeps scroll padding ${wide}`)
      return `focused control ends at y ${box.y + box.height}, bar starts at y ${barBox.y}`
    },
  },
  {
    name: "RailShell from lg: a labelled sidebar of 240 px with sidebarTop above the items, " +
      "sidebarBottom at its foot, and an item's counter spoken in its name",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = rail(page, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const box = await column.boundingBox()
      if (!box || Math.abs(box.width - 240) > 1) throw new Error(`the column is ${box?.width} wide`)
      await expectVisible(rail(page, "rail-shell-demo-switcher-sidebar"), true, "the wide switcher")
      await expectVisible(rail(page, "rail-shell-demo-switcher-rail"), false, "the rail switcher")
      await expectVisible(
        // The first match is the label; the second, the rail's tooltip, is not drawn from lg.
        rail(page, "rail-shell-rail").getByText("Notes", { exact: true }).first(),
        true,
        "the Notes label",
      )
      const [top, nav, bottom, frame] = await Promise.all([
        rail(page, "rail-shell-demo-switcher-sidebar").boundingBox(),
        rail(page, "rail-shell-rail").boundingBox(),
        rail(page, "rail-shell-demo-account-menu-sidebar").boundingBox(),
        rail(page, "rail-shell-demo").boundingBox(),
      ])
      if (!top || !nav || !bottom || !frame) throw new Error("a slot or the list is not drawn")
      if (top.y + top.height > nav.y) throw new Error("the top slot is not above the items")
      if (bottom.y < nav.y + nav.height) throw new Error("the bottom slot is not below the items")
      if (frame.y + frame.height - (bottom.y + bottom.height) > 16) {
        throw new Error(
          `the bottom slot ends ${frame.y + frame.height - (bottom.y + bottom.height)} px above ` +
            `the column's foot`,
        )
      }
      // The tab bar and the closed overlay are not drawn at this width, so the rail's is the one.
      const notes = rail(page, "rail-shell-rail").getByRole("link", { name: "Notes, 3 unread" })
      await notes.waitFor({ state: "visible" })
      return `column ${box.width} px; slots at y ${top.y} and ${bottom.y}`
    },
  },
  {
    name: "RailShell from md to lg: a 72 px icon rail whose label shows as a tooltip on focus " +
      "and hides on Escape, each slot in its rail form, and the list scrolling above the bottom slot",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 900, height: 900 })
      const column = rail(page, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const box = await column.boundingBox()
      if (!box || Math.abs(box.width - 72) > 1) throw new Error(`the rail is ${box?.width} wide`)
      await expectVisible(rail(page, "rail-shell-demo-switcher-rail"), true, "the rail switcher")
      await expectVisible(rail(page, "rail-shell-demo-switcher-sidebar"), false, "the wide one")
      await expectVisible(
        rail(page, "rail-shell-demo-account-menu-rail"),
        true,
        "the avatar account menu",
      )
      // A 420 px frame is shorter than the rail's entries, as a phone held sideways is: the list
      // scrolls between the slots instead of running under the bottom one.
      await rail(page, "rail-shell-demo").evaluate((frame) => {
        frame.style.height = "420px"
        frame.style.setProperty("--rail-shell-height", "420px")
      })
      const [list, foot] = await Promise.all([
        rail(page, "rail-shell-rail").boundingBox(),
        rail(page, "rail-shell-bottom").boundingBox(),
      ])
      if (!list || !foot || list.y + list.height > foot.y + 1) {
        throw new Error(`the list ends at y ${list && list.y + list.height}, below ${foot?.y}`)
      }
      // The last entry, scrolled to, ends above the bottom slot instead of under it.
      const last = rail(page, "rail-shell-rail").locator(`[data-e2e="rail-shell-entry"]`).last()
      await last.scrollIntoViewIfNeeded()
      const [lastBox, footNow] = await Promise.all([
        last.boundingBox(),
        rail(page, "rail-shell-bottom").boundingBox(),
      ])
      if (!lastBox || !footNow || lastBox.y + lastBox.height > footNow.y + 1) {
        throw new Error(
          `the last entry ends at y ${lastBox && lastBox.y + lastBox.height}, under the bottom ` +
            `slot at ${footNow?.y}`,
        )
      }
      const notes = page.locator(`${RAIL} [data-e2e="rail-shell-rail"]`).getByRole("link", {
        name: "Notes, 3 unread",
        exact: true,
      })
      const tip = notes.locator(`[data-e2e="rail-shell-tooltip"]`)
      await expectVisible(tip, false, "the tooltip before focus")
      await notes.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await tip.waitFor({ state: "visible" })
      const [tipBox, entryBox] = await Promise.all([tip.boundingBox(), notes.boundingBox()])
      if (!tipBox || !entryBox) throw new Error("the tooltip or its entry is not drawn")
      const tipMiddle = tipBox.y + tipBox.height / 2
      const entryMiddle = entryBox.y + entryBox.height / 2
      if (
        Math.abs(tipBox.x - (entryBox.x + entryBox.width)) > 1 ||
        Math.abs(tipMiddle - entryMiddle) > 1
      ) {
        throw new Error(
          `the tooltip is at ${tipBox.x},${tipMiddle}, not beside the entry's right edge ` +
            `${entryBox.x + entryBox.width},${entryMiddle}`,
        )
      }
      await page.keyboard.press("Escape")
      await tip.waitFor({ state: "hidden" })
      await page.keyboard.press("Tab")
      const next = page.locator(`${RAIL} [data-e2e="rail-shell-rail"] :focus`)
      await next.locator(`[data-e2e="rail-shell-tooltip"]`).waitFor({ state: "visible" })
      return `rail ${box.width} px; tooltip at x ${tipBox.x}`
    },
  },
  {
    name: "RailShell below md: the last tab, an avatar named with its count, opens an overlay " +
      "holding both slots, and closing it returns focus to the tab",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const more = page.locator(RAIL).getByRole("button", { name: "Account, 3 unread" })
      await more.scrollIntoViewIfNeeded()
      await more.click()
      const dialog = rail(page, "rail-shell-dialog")
      await dialog.waitFor({ state: "visible" })
      await expectVisible(
        rail(page, "rail-shell-demo-switcher-overlay"),
        true,
        "the switcher in the overlay",
      )
      await expectVisible(
        rail(page, "rail-shell-demo-account-menu-overlay"),
        true,
        "the account menu in the overlay",
      )
      await expectVisible(
        rail(page, "rail-shell-demo-notifications-overlay"),
        true,
        "notifications in the overlay",
      )
      const [top, list, bottom] = await Promise.all([
        rail(page, "rail-shell-overlay-top").boundingBox(),
        dialog.getByRole("link", { name: "Settings" }).boundingBox(),
        rail(page, "rail-shell-overlay-bottom").boundingBox(),
      ])
      if (!top || !list || !bottom || !(top.y < list.y && list.y < bottom.y)) {
        throw new Error("the overlay is not top slot, overflow items, bottom slot in that order")
      }
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "hidden" })
      await more.and(page.locator(":focus")).waitFor()
      return "slots shown in the overlay; focus back on the last tab"
    },
  },
  {
    name: "RailShell: the sidebar with its slots passes axe at lg, colour contrast included",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      return await expectAxeClean(page, `${RAIL} [data-e2e="rail-shell-column"]`)
    },
  },
  {
    name:
      "RailShell as the page frame: no content of the sidebar's slots sits outside a landmark, " +
      "at 1440 and 900 px and in the phone overlay",
    pageId: "system",
    run: async (page) => {
      const FRAME = await railFrameAtTopLevel(page)
      const frame = page.locator(FRAME)
      // The guide's own `<main>` stays on the page beside the shell's, which an app never has.
      const disabled = ["landmark-no-duplicate-main"]
      const results: string[] = []
      for (const width of [1440, 900]) {
        await page.setViewportSize({ width, height: 900 })
        results.push(`${width} px: ${await expectAxeClean(page, FRAME, disabled)}`)
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await frame.locator(`[data-e2e="rail-shell-more"]`).click()
      await frame.locator(`[data-e2e="rail-shell-dialog"]`).waitFor({ state: "visible" })
      results.push(`overlay: ${await expectAxeClean(page, FRAME, disabled)}`)
      return results.join("; ")
    },
  },
  {
    name: "RailShell below md: a nine-letter tab label fits its tab at 390 px, " +
      "and every tab stays a 44 px target",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const bar = page.locator(`${await railFrameAtTopLevel(page)} [data-e2e="rail-shell-tabbar"]`)
      await bar.scrollIntoViewIfNeeded()
      // The window's scrollbar takes its width off the page, so the bar is a little narrower than
      // 390 px here than on a phone, whose scrollbar overlays the page: a stricter test, not a
      // looser one. It must still span the whole page, not a card inside it.
      const barWidth = (await bar.boundingBox())?.width
      const pageWidth = await page.evaluate(() => document.documentElement.clientWidth)
      if (barWidth !== pageWidth || pageWidth > 390) {
        throw new Error(`the bar is ${barWidth} px wide on a page of ${pageWidth} px`)
      }
      const label = bar.getByRole("link", { name: "Dashboard" }).getByText("Dashboard")
      const fit = await label.evaluate((element) => ({
        scroll: element.scrollWidth,
        client: element.clientWidth,
      }))
      if (fit.scroll > fit.client) {
        throw new Error(`"Dashboard" is clipped: ${fit.scroll} px of text in ${fit.client} px`)
      }
      const targets = bar.locator(`a, button`)
      const count = await targets.count()
      if (count !== 5) throw new Error(`the bar holds ${count} tabs, not five`)
      for (let index = 0; index < count; index++) {
        const box = await targets.nth(index).boundingBox()
        if (!box || box.width < 44 || box.height < 44) {
          throw new Error(`tab ${index + 1} is ${box?.width} by ${box?.height} px`)
        }
      }
      return `"Dashboard" needs ${fit.scroll} px and has ${fit.client} px; five tabs of 44 px or more`
    },
  },
  {
    name: "RailShell: the icon rail with its slots passes axe in dark mode",
    pageId: "system",
    colorScheme: "dark",
    run: async (page) => {
      await page.setViewportSize({ width: 900, height: 900 })
      return await expectAxeClean(page, `${RAIL} [data-e2e="rail-shell-column"]`)
    },
  },
  {
    name: "AccountMenu: the menu opens upward, marks the current theme as a checked radio item, " +
      "and choosing another reports it",
    pageId: "system",
    run: async (page) => {
      const card = page.locator(`[data-e2e="account-menu-demo"]`)
      const trigger = card.locator(`[data-e2e="account-menu-button"]`)
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()
      const menu = card.getByRole("menu")
      await menu.waitFor({ state: "visible" })
      const [menuBox, triggerBox] = await Promise.all([menu.boundingBox(), trigger.boundingBox()])
      if (!menuBox || !triggerBox || menuBox.y + menuBox.height > triggerBox.y + 1) {
        throw new Error("the menu does not open above its trigger")
      }
      const radio = (name: string) => menu.getByRole("menuitemradio", { name, exact: true })
      if (await radio("System").getAttribute("aria-checked") !== "true") {
        throw new Error("System is not the checked theme")
      }
      if (await radio("Dark").getAttribute("aria-checked") !== "false") {
        throw new Error("Dark is checked before it was chosen")
      }
      await expectAxeClean(page, `[data-e2e="account-menu-demo"]`)
      await radio("Dark").click()
      await menu.waitFor({ state: "hidden" })
      await card.locator(`[data-e2e="account-menu-demo-theme"]`).filter({ hasText: "dark" })
        .waitFor()
      await trigger.click()
      if (await radio("Dark").getAttribute("aria-checked") !== "true") {
        throw new Error("Dark is not checked after it was chosen")
      }
      return "opened upward; Dark chosen and checked"
    },
  },
  {
    name:
      "AccountMenu: a plain click on a link item calls navigate instead of following the link, " +
      "and a Ctrl-click leaves the link to the browser",
    pageId: "system",
    run: async (page) => {
      const card = page.locator(`[data-e2e="account-menu-demo"]`)
      const trigger = card.locator(`[data-e2e="account-menu-button"]`)
      const route = card.locator(`[data-e2e="account-menu-demo-route"]`)
      const profile = card.getByRole("menuitem", { name: "Profile", exact: true })
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()
      if (await clickCancelled(profile, ["Control"])) {
        throw new Error("a Ctrl-click on Profile cancelled the browser's own navigation")
      }
      if (await route.textContent() !== "none") {
        throw new Error(`a Ctrl-click on Profile called navigate: ${await route.textContent()}`)
      }
      if (!await profile.isVisible()) await trigger.click()
      const before = page.url()
      if (!await clickCancelled(profile)) {
        throw new Error("a plain click on Profile left the browser to follow the link")
      }
      await route.filter({ hasText: "#account-profile" }).waitFor()
      if (page.url() !== before) throw new Error(`the page moved to ${page.url()}`)
      return "Ctrl-click left to the browser; plain click routed to #account-profile"
    },
  },
  {
    name: "Shell: a plain click on a user-menu link goes through navigate",
    pageId: "system",
    run: async (page) => {
      const shell = page.locator(`[data-e2e="shell-demo"]`)
      const trigger = shell.locator(`[data-e2e="shell-user-menu-button"]`)
      await trigger.scrollIntoViewIfNeeded()
      await trigger.click()
      const profile = shell.getByRole("menuitem", { name: "Your profile", exact: true })
      if (!await clickCancelled(profile)) {
        throw new Error("a plain click on Your profile left the browser to follow the link")
      }
      await shell.locator(`[data-e2e="shell-demo-path"]`).filter({ hasText: /^\/profile$/ })
        .waitFor()
      return "Your profile routed to /profile"
    },
  },
]
