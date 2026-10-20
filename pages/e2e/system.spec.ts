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

/** The tooltip `Rail` draws beside `entry`, inside the entry's cell. */
const tipOf = (entry: Locator) => entry.locator(`xpath=../*[@data-e2e="rail-shell-tooltip"]`)

/** Throw unless `locator` is drawn, or unless it is not, naming it by `what`. */
async function expectVisible(locator: Locator, visible: boolean, what: string): Promise<void> {
  if (await locator.isVisible() !== visible) {
    throw new Error(`${what} is ${visible ? "not drawn" : "drawn"}`)
  }
}

/** Run axe over `selector`, colour contrast included, and throw on any violation. */
async function expectAxeClean(page: Page, selector: string): Promise<string> {
  const { violations, passes } = await new AxeBuilder({ page }).include(selector).analyze()
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

/** The `Rail` and `AppShell` cards, and one element in either by its `data-e2e`. */
const RAIL_CARD = "#demo-Rail"
const APP = "#demo-AppShell"
const inCard = (page: Page, card: string, e2e: string) =>
  page.locator(`${card} [data-e2e="${e2e}"]`)

/**
 * Make a card's demo frame the whole page, as an app draws its shell: the body's only child, with
 * the frame's own height, scroll box and scroll padding taken off, so the window scrolls the shell
 * and axe sees one `<main>` at the top level.
 */
async function demoFrameAlone(page: Page, card: string): Promise<Locator> {
  await page.locator(`${card} [data-e2e$="-demo"]`).first().evaluate((frame: HTMLElement) => {
    frame.className = ""
    frame.id = "e2e-demo-frame"
    document.body.replaceChildren(frame)
  })
  return page.locator("body > #e2e-demo-frame")
}

/**
 * Switch the `AppShell` card to its admin panel with the connection reconnecting, so the column
 * holds every cell it can draw: the connection, the bell and the tagged account.
 */
async function appShellAdmin(page: Page): Promise<void> {
  await inCard(page, APP, "app-shell-demo-admin").check()
  await inCard(page, APP, "app-shell-demo-connection").selectOption("reconnecting")
  await inCard(page, APP, "app-shell-connection").waitFor({ state: "attached" })
}

/**
 * Axe over the `Rail` card (both variants) and the `AppShell` card (product, then the admin panel
 * reconnecting), each made the whole page, at 390 and 1440 px. Every case is measured before the
 * check fails, so a failure names each case it holds in.
 */
async function shellsAxeClean(page: Page): Promise<string> {
  const results: string[] = []
  const failures: string[] = []
  const measure = async (where: string) => {
    try {
      results.push(`${where}: ${await expectPageAxeClean(page)}`)
    } catch (error) {
      failures.push(`${where}: ${error instanceof Error ? error.message : error}`)
    }
  }
  const cases = [
    [RAIL_CARD, "labels"],
    [RAIL_CARD, "icons"],
    [APP, "product"],
    [APP, "admin"],
  ] as const
  for (const [card, name] of cases) {
    for (const width of [390, 1440]) {
      // Each case starts from a fresh guide page, since the last one replaced the body.
      await page.reload()
      await page.locator(`html[data-hydrated="true"]`).waitFor()
      await page.setViewportSize({ width, height: 900 })
      if (name === "icons") await inCard(page, card, "rail-demo-variant-icons").check()
      if (name === "admin") await appShellAdmin(page)
      await demoFrameAlone(page, card)
      await measure(`${card} ${name} at ${width} px`)
    }
  }
  if (failures.length > 0) throw new Error(failures.join(" | "))
  return results.join("; ")
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
 * Make the `RailShell` card's frame the whole page: the body's only child, full width, and return
 * its locator. The guide draws the card inside its own `<main>` and a padded card, where every node
 * is in a landmark and the bar is narrower than the window; an app draws the shell as the page
 * itself, which is what the checks that call this need to see.
 */
async function railFrameAlone(page: Page): Promise<Locator> {
  await rail(page, "rail-shell-column").evaluate((column) => {
    const frame = column.parentElement
    if (!frame) throw new Error("the column has no frame around it")
    frame.id = "e2e-rail-frame"
    document.body.replaceChildren(frame)
  })
  return page.locator("body > #e2e-rail-frame")
}

/** A palette of the rail checks: ink is the opt-in dark palette, `data-theme="ink"` with `.dark`. */
type RailPalette = "light" | "dark" | "ink"

/**
 * Draw the page in `palette` the way an app that toggles the class itself does: `.dark` on the
 * root (and `data-theme="ink"` for ink), with the root's `color-scheme` left light. The browser
 * then draws its own focus ring near-black, as it does in an app whose person chose Dark while
 * the system is light, so a ring that relies on the browser's colour shows here.
 */
async function drawRailPalette(page: Page, palette: RailPalette): Promise<void> {
  await page.evaluate((palette) => {
    const root = document.documentElement
    root.classList.toggle("dark", palette !== "light")
    if (palette === "ink") root.setAttribute("data-theme", "ink")
    else root.removeAttribute("data-theme")
    root.style.colorScheme = "light"
  }, palette)
}

/**
 * The contrast of each `[element, property, pseudo]` colour against the background of `against`,
 * composited the way the eye sees it: each colour over the one under it. Rounded to two decimals.
 */
function contrastsAgainst(
  against: Locator,
  colours: Record<string, [selector: string, property: string, pseudo?: string]>,
): Promise<Record<string, number>> {
  return against.evaluate((base, colours) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("no 2D canvas to resolve colours with")
    /** A CSS colour as sRGB bytes, painted over `under` when it is not opaque. */
    const bytes = (colour: string, under?: number[]): number[] => {
      context.clearRect(0, 0, 1, 1)
      if (under) {
        context.fillStyle = `rgb(${under[0]} ${under[1]} ${under[2]})`
        context.fillRect(0, 0, 1, 1)
      }
      context.fillStyle = colour
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data]
    }
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((byte) => {
        const v = byte / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: number[], b: number[]) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return Math.round((light + 0.05) / (dark + 0.05) * 100) / 100
    }
    /**
     * The colour `property` names. `focus-ring` is the ring a focused control draws: its outline
     * when it draws one, else the outermost layer of its box-shadow ring, the one the rail meets.
     */
    const colourOf = (style: CSSStyleDeclaration, property: string, name: string): string => {
      if (property !== "focus-ring") return style.getPropertyValue(property)
      if (style.outlineStyle !== "none") return style.outlineColor
      const layers = style.boxShadow.split(/,(?![^(]*\))/).map((layer) => {
        const colour = layer.match(/^\s*((?:rgb|oklch|oklab|lab|color)a?\([^)]*\)|#\w+)/)?.[1]
        const lengths = layer.replace(colour ?? "", "").trim().split(/\s+/).map(parseFloat)
        return { colour, spread: lengths[3] ?? 0 }
      }).filter((layer) => layer.colour && layer.spread > 0)
      if (layers.length === 0) throw new Error(`${name}: the focused control draws no ring`)
      return layers.sort((a, b) => b.spread - a.spread)[0].colour as string
    }
    const backdrop = bytes(getComputedStyle(base).backgroundColor)
    const result: Record<string, number> = {}
    for (const [name, [selector, property, pseudo]] of Object.entries(colours)) {
      const element = selector === ":focus" ? document.activeElement : base.querySelector(selector)
      if (!element) throw new Error(`${name}: nothing matches ${selector}`)
      const style = getComputedStyle(element, pseudo)
      if (pseudo && style.content === "none") throw new Error(`${name}: ${pseudo} is not drawn`)
      result[name] = ratio(bytes(colourOf(style, property, name), backdrop), backdrop)
    }
    return result
  }, colours)
}

/** Throw unless every measured contrast is `minimum` or more, naming the ones that are not. */
function expectContrast(measured: Record<string, number>, minimum: number, where: string): void {
  const low = Object.entries(measured).filter(([, value]) => value < minimum)
  if (low.length > 0) {
    throw new Error(
      `${where}: ${low.map(([name, value]) => `${name} ${value}:1`).join(", ")} below ${minimum}:1`,
    )
  }
}

/**
 * Run axe over the whole page and throw on any violation, or when the page-level `region` rule
 * (content outside every landmark) or colour contrast was not measured. `region` runs only over a
 * whole page, never over an `include`d part, so {@link expectAxeClean} cannot catch it.
 */
async function expectPageAxeClean(page: Page): Promise<string> {
  // The page's own heading is the caller's content, and the demo's page has none of level one.
  const skipped = ["page-has-heading-one"]
  const { violations, passes } = await new AxeBuilder({ page }).disableRules(skipped).analyze()
  if (violations.length > 0) {
    throw new Error(
      violations.map((rule) =>
        `${rule.id}: ${rule.help} (${rule.nodes.map((node) => node.target.join(" ")).join(", ")})`
      ).join("; "),
    )
  }
  for (const rule of ["region", "color-contrast"]) {
    if (!passes.some((passed) => passed.id === rule)) throw new Error(`axe did not run ${rule}`)
  }
  return `${passes.length} axe rules passed`
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

/** The `UnsentChangesDialog` card, one element in it, and the open dialog by its `data-e2e`. */
const UNSENT = `[data-e2e="unsent-demo"]`
const unsentDemo = (page: Page, e2e: string) => page.locator(`${UNSENT} [data-e2e="${e2e}"]`)
const unsentDialog = (page: Page, e2e = "unsent-dialog") =>
  page.locator(
    `dialog[data-e2e="unsent-dialog"]${e2e === "unsent-dialog" ? "" : ` [data-e2e="${e2e}"]`}`,
  )

/** Open the card's dialog from its Sign out button, with or without a change that needs a choice. */
async function openUnsentDialog(page: Page, withConflict = false): Promise<Locator> {
  const trigger = unsentDemo(page, "unsent-demo-sign-out")
  await trigger.scrollIntoViewIfNeeded()
  if (withConflict) await unsentDemo(page, "unsent-demo-conflict").click()
  await trigger.click()
  await unsentDialog(page).waitFor()
  return trigger
}

/** Throw unless the element with `data-e2e="<e2e>"` inside the open dialog has focus. */
async function expectUnsentFocus(page: Page, e2e: string): Promise<void> {
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-e2e"))
  if (focused !== e2e) throw new Error(`focus is on ${focused ?? "nothing named"}, not ${e2e}`)
}

/**
 * Record every distinct text the dialog's live region shows from now on, in order, so a spec can
 * read back what a screen reader was told.
 */
function recordUnsentStatus(page: Page): Promise<void> {
  return unsentDialog(page, "unsent-status").evaluate((element) => {
    const seen: string[] = []
    ;(globalThis as typeof globalThis & { unsentSeen?: string[] }).unsentSeen = seen
    new MutationObserver(() => {
      const text = element.textContent ?? ""
      if (text !== seen.at(-1)) seen.push(text)
    }).observe(element, { childList: true, characterData: true, subtree: true })
  })
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
        // The Rail and AppShell cards' frames hand the root the same override; drop it there too,
        // or their frames would take the root's padding away again.
        for (
          const other of document.querySelectorAll(
            `[data-e2e="rail-demo"], [data-e2e="app-shell-demo"]`,
          )
        ) {
          other.classList.remove("max-md:[:root:has(&)]:scroll-pb-0!")
        }
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
    name: "RailShell at 1440 px: the 72 px column with sidebarTop above the items, " +
      "sidebarBottom at its foot, and an item's counter spoken in its name",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = rail(page, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const box = await column.boundingBox()
      if (!box || Math.abs(box.width - 72) > 1) throw new Error(`the column is ${box?.width} wide`)
      await expectVisible(rail(page, "rail-shell-demo-switcher-rail"), true, "the rail switcher")
      const [top, nav, bottom, frame] = await Promise.all([
        rail(page, "rail-shell-demo-switcher-rail").boundingBox(),
        rail(page, "rail-shell-rail").boundingBox(),
        rail(page, "rail-shell-demo-account-menu-rail").boundingBox(),
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
    name: "RailShell from md: a 72 px icon rail whose label shows as a tooltip 8 px past the " +
      "column on focus and hides on Escape, each slot in its rail form, and the list scrolling " +
      "above the bottom slot",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 900, height: 900 })
      const column = rail(page, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const box = await column.boundingBox()
      if (!box || Math.abs(box.width - 72) > 1) throw new Error(`the rail is ${box?.width} wide`)
      await expectVisible(rail(page, "rail-shell-demo-switcher-rail"), true, "the rail switcher")
      await expectVisible(
        rail(page, "rail-shell-demo-account-menu-rail"),
        true,
        "the avatar account menu",
      )
      // A 420 px frame is shorter than the rail's entries, as a phone held sideways is: the list
      // scrolls between the slots instead of running under the bottom one.
      await rail(page, "rail-shell-demo").evaluate((frame) => {
        frame.style.height = "420px"
        frame.style.setProperty("--rail-height", "420px")
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
      const tip = tipOf(notes)
      await expectVisible(tip, false, "the tooltip before focus")
      await notes.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await tip.waitFor({ state: "visible" })
      const [tipBox, entryBox, columnBox] = await Promise.all([
        tip.boundingBox(),
        notes.boundingBox(),
        column.boundingBox(),
      ])
      if (!tipBox || !entryBox || !columnBox) {
        throw new Error("the tooltip or its entry is not drawn")
      }
      const tipMiddle = tipBox.y + tipBox.height / 2
      const entryMiddle = entryBox.y + entryBox.height / 2
      if (
        Math.abs(tipBox.x - (columnBox.x + columnBox.width + 8)) > 1 ||
        Math.abs(tipMiddle - entryMiddle) > 1
      ) {
        throw new Error(
          `the tooltip is at ${tipBox.x},${tipMiddle}, not 8 px past the column's right edge ` +
            `${columnBox.x + columnBox.width} beside the entry's middle ${entryMiddle}`,
        )
      }
      await page.keyboard.press("Escape")
      await tip.waitFor({ state: "hidden" })
      await page.keyboard.press("Tab")
      const next = page.locator(`${RAIL} [data-e2e="rail-shell-rail"] :focus`)
      await tipOf(next).waitFor({ state: "visible" })
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
    name: "RailShell: the column with its slots passes axe at 1440 px, colour contrast included",
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
      const frame = await railFrameAlone(page)
      const results: string[] = []
      const failures: string[] = []
      // Every place is measured before the check fails, so a failure names each place it holds in.
      const measure = async (place: string) => {
        try {
          results.push(`${place}: ${await expectPageAxeClean(page)}`)
        } catch (error) {
          failures.push(`${place}: ${error instanceof Error ? error.message : error}`)
        }
      }
      for (const width of [1440, 900]) {
        await page.setViewportSize({ width, height: 900 })
        await measure(`${width} px`)
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await frame.locator(`[data-e2e="rail-shell-more"]`).click()
      await frame.locator(`[data-e2e="rail-shell-dialog"]`).waitFor({ state: "visible" })
      await measure("overlay")
      if (failures.length > 0) throw new Error(failures.join(" | "))
      return results.join("; ")
    },
  },
  {
    name: "RailShell below md: a nine-letter tab label fits its tab at 390 px, " +
      "and every tab stays a 44 px target",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const bar = (await railFrameAlone(page)).locator(`[data-e2e="rail-shell-tabbar"]`)
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
      // The focus ring sits 2 px outside a tab and is 2 px wide, so the outer tabs keep 4 px from
      // the page's edges, or their ring is cut off there.
      const first = await targets.first().boundingBox()
      const last = await targets.last().boundingBox()
      if (!first || !last || first.x < 4 || last.x + last.width > pageWidth - 4) {
        throw new Error(
          `the outer tabs leave no room for their focus ring: ${first?.x} px on the ` +
            `left, ${last ? pageWidth - last.x - last.width : undefined} px on the right`,
        )
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
    name: "RailShell: the focus ring of an entry and of the account menu's trigger stands 3:1 or " +
      "more off the rail, as do the primary action's edge and a counter badge, in light, dark " +
      "and ink at 900 and 1440 px, and axe passes there",
    pageId: "system",
    run: async (page) => {
      // Entries ease their colours, the ring's among them; without motion every colour read below
      // is the one that stays, not a step of the transition.
      await page.emulateMedia({ reducedMotion: "reduce" })
      const column = rail(page, "rail-shell-column")
      const failures: string[] = []
      const results: string[] = []
      for (const palette of ["light", "dark", "ink"] as const) {
        await drawRailPalette(page, palette)
        for (const width of [900, 1440]) {
          const where = `${palette} ${width} px`
          await page.setViewportSize({ width, height: 900 })
          await column.scrollIntoViewIfNeeded()
          // Keyboard focus, so `:focus-visible` holds: onto Projects, the first entry not current.
          const entries = column.locator(`[data-e2e="rail-shell-entry"]`)
          await entries.nth(1).focus()
          await page.keyboard.press("Tab")
          const ring = await contrastsAgainst(column, { "entry ring": [":focus", "focus-ring"] })
          await column.locator(`[data-e2e="rail-shell-demo-account-menu-rail"]`).focus()
          await page.keyboard.press("Shift+Tab")
          await page.keyboard.press("Tab")
          const accountRing = await contrastsAgainst(column, {
            "account ring": [":focus", "focus-ring"],
          })
          // The primary action is the first entry. Its edge is its fill, or its border where one is
          // drawn; a border of no width has a colour too, so only a drawn one counts.
          const fills = await contrastsAgainst(column, {
            "primary fill": [`[data-e2e="rail-shell-entry"]`, "background-color"],
            "primary border": [`[data-e2e="rail-shell-entry"]`, "border-top-color"],
            "badge": [`[data-e2e="rail-shell-counter"]`, "background-color"],
          })
          const borderWidth = await entries.first().evaluate((element) =>
            parseFloat(getComputedStyle(element).borderTopWidth)
          )
          const measured = {
            ...ring,
            ...accountRing,
            badge: fills.badge,
            "primary edge": Math.max(
              fills["primary fill"],
              borderWidth >= 1 ? fills["primary border"] : 1,
            ),
          }
          try {
            expectContrast(measured, 3, where)
            await expectAxeClean(page, `${RAIL} [data-e2e="rail-shell-column"]`)
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error))
          }
          results.push(
            `${where}: ${Object.entries(measured).map(([k, v]) => `${k} ${v}`).join(", ")}`,
          )
        }
      }
      if (failures.length > 0) throw new Error(failures.join(" | "))
      return results.join("; ")
    },
  },
  {
    name: "RailShell in the 72 px rail: the current entry is a filled cell with no bar, in a " +
      "different text colour and fill from a hovered entry, in light, dark and ink; under forced " +
      "colours an outline marks it",
    pageId: "system",
    run: async (page) => {
      // The hovered fill eases in; without motion it is read at its end, not on its way there.
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.setViewportSize({ width: 900, height: 900 })
      const column = rail(page, "rail-shell-column")
      const results: string[] = []
      const current = column.locator(`[aria-current="page"]`)
      for (const palette of ["light", "dark", "ink"] as const) {
        await drawRailPalette(page, palette)
        await column.scrollIntoViewIfNeeded()
        const idle = column.getByRole("link", { name: "Stats", exact: true })
        await idle.hover()
        const look = (entry: Locator) =>
          entry.evaluate((element) => {
            const style = getComputedStyle(element)
            return `${style.backgroundColor} / ${style.color}`
          })
        const [hovered, chosen] = await Promise.all([look(idle), look(current)])
        const [hoveredFill, hoveredText] = hovered.split(" / ")
        const [chosenFill, chosenText] = chosen.split(" / ")
        if (hoveredFill === chosenFill || hoveredText === chosenText) {
          throw new Error(`${palette}: the hovered entry (${hovered}) looks like the current one`)
        }
        const bar = await current.evaluate((element) =>
          getComputedStyle(element, "::before").content
        )
        if (bar !== "none" && bar !== "normal") {
          throw new Error(`${palette}: a bar is drawn: ${bar}`)
        }
        results.push(`${palette}: current ${chosen}, hovered ${hovered}`)
      }
      const plain = await current.evaluate((element) => getComputedStyle(element).outlineStyle)
      await page.emulateMedia({ forcedColors: "active" })
      const forced = await current.evaluate((element) => {
        const style = getComputedStyle(element)
        return { style: style.outlineStyle, width: style.outlineWidth }
      })
      if (plain !== "none" || forced.style !== "solid" || forced.width !== "2px") {
        throw new Error(`outline ${plain} normally, ${forced.style} ${forced.width} when forced`)
      }
      results.push(`forced colours: a ${forced.width} ${forced.style} outline`)
      return results.join("; ")
    },
  },
  {
    name: "RailShell in the 72 px rail: after Escape hides a hovered entry's tooltip, hovering " +
      "another entry shows that entry's tooltip",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 900, height: 900 })
      const column = rail(page, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const projects = column.getByRole("link", { name: "Projects", exact: true })
      const stats = column.getByRole("link", { name: "Stats", exact: true })
      const tip = tipOf
      await projects.hover()
      await tip(projects).waitFor({ state: "visible" })
      await page.keyboard.press("Escape")
      await tip(projects).waitFor({ state: "hidden" })
      await stats.hover()
      await tip(stats).waitFor({ state: "visible" })
      return "Stats' tooltip shown after Escape hid Projects'"
    },
  },
  {
    name: "Rail: a tooltip waits 300 ms under a resting pointer and none on keyboard focus, " +
      "Escape hides it, and moving on brings the next one back",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await inCard(page, RAIL_CARD, "rail-demo-variant-icons").check()
      const column = inCard(page, RAIL_CARD, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const tools = column.getByRole("link", { name: "Tools", exact: true })
      const writing = column.getByRole("link", { name: "Writing", exact: true })
      const delay = (entry: Locator) =>
        tipOf(entry).evaluate((tip) => getComputedStyle(tip).transitionDelay)
      await tools.hover()
      await tipOf(tools).waitFor({ state: "visible" })
      const hoverDelay = await delay(tools)
      if (!hoverDelay.split(", ").every((value) => value === "0.3s")) {
        throw new Error(`a hovered cell's tooltip waits ${hoverDelay}, not 0.3s`)
      }
      await page.keyboard.press("Escape")
      await tipOf(tools).waitFor({ state: "hidden" })
      await page.mouse.move(1200, 10)
      await writing.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await tipOf(writing).waitFor({ state: "visible" })
      const focusDelay = await delay(writing)
      if (!focusDelay.split(", ").every((value) => value === "0s")) {
        throw new Error(`a focused cell's tooltip waits ${focusDelay}, not 0s`)
      }
      await page.keyboard.press("Escape")
      await tipOf(writing).waitFor({ state: "hidden" })
      if (!(await writing.evaluate((element) => element === document.activeElement))) {
        throw new Error("Escape moved focus off the cell")
      }
      await page.keyboard.press("Shift+Tab")
      const before = column.locator(`[data-e2e="rail-shell-entry"]:focus`)
      await tipOf(before).waitFor({ state: "visible" })
      return `hover waits ${hoverDelay}, focus ${focusDelay}`
    },
  },
  {
    name: "Rail: an entry with a key shortcut announces it and shows it in its tooltip, and the " +
      "key the demo binds goes there",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await inCard(page, RAIL_CARD, "rail-demo-variant-icons").check()
      const column = inCard(page, RAIL_CARD, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const writing = column.getByRole("link", { name: "Writing", exact: true })
      const shortcuts = await writing.getAttribute("aria-keyshortcuts")
      if (shortcuts !== "W") throw new Error(`Writing announces ${shortcuts}, not W`)
      const work = column.getByRole("link", { name: "Work", exact: true })
      if (await work.getAttribute("aria-keyshortcuts") !== null) {
        throw new Error("Work announces a shortcut it does not have")
      }
      await writing.hover()
      await tipOf(writing).waitFor({ state: "visible" })
      const tip = (await tipOf(writing).textContent())?.trim()
      if (tip !== "Writing (W)") throw new Error(`Writing's tooltip reads ${tip}`)
      await page.mouse.move(1200, 10)
      await page.keyboard.press("w")
      await column.locator(`a[aria-current="page"]`).filter({ hasText: "Writing" }).waitFor()
      return `aria-keyshortcuts ${shortcuts}, tooltip ${tip}`
    },
  },
  {
    name: "Rail: a backdrop tap closes the sheet with no script, through closedby alone",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      // A clone carries the server-rendered attributes and none of the component's listeners, so
      // only the platform can close it.
      await inCard(page, RAIL_CARD, "rail-shell-dialog").evaluate((sheet: HTMLDialogElement) => {
        const clone = sheet.cloneNode(true) as HTMLDialogElement
        clone.id = "e2e-sheet-clone"
        document.body.append(clone)
        clone.showModal()
      })
      const clone = page.locator("#e2e-sheet-clone")
      if (!(await clone.evaluate((sheet: HTMLDialogElement) => sheet.open))) {
        throw new Error("the cloned sheet did not open")
      }
      // The sheet sits at the bottom; the window's top-left corner is backdrop.
      await page.mouse.click(8, 8)
      const open = await clone.evaluate((sheet: HTMLDialogElement) => {
        const open = sheet.open
        sheet.remove()
        return open
      })
      if (open) throw new Error("a backdrop tap left the script-free sheet open")
      return "the script-free sheet closed on a backdrop tap"
    },
  },
  {
    name: "AppShell: the first hover on a cell waits 300 ms too — its tooltip is still hidden " +
      "100 ms in and shown 500 ms in",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = inCard(page, APP, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const projects = column.getByRole("link", { name: "Projects", exact: true })
      // Never hovered before in this page: the tooltip has not been shown once.
      await projects.hover()
      const [early, late] = await tipOf(projects).evaluate(async (tip) => {
        const shown = () => getComputedStyle(tip).visibility === "visible" && tip.checkVisibility()
        await new Promise((resolve) => setTimeout(resolve, 100))
        const early = shown()
        await new Promise((resolve) => setTimeout(resolve, 400))
        return [early, shown()]
      })
      if (early) throw new Error("the first hover showed the tooltip within 100 ms")
      if (!late) throw new Error("the first hover had not shown the tooltip after 500 ms")
      return "hidden at 100 ms, shown at 500 ms"
    },
  },
  {
    name: "RailShell: a switcher in a RailCell gets an entry's tooltip — after 300 ms on a first " +
      "hover, at once on keyboard focus, in the same place, bubble and focus ring",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = rail(page, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const cell = rail(page, "rail-shell-demo-switcher-cell")
      const trigger = rail(page, "rail-shell-demo-switcher-rail")
      const tip = cell.locator(`[data-e2e="rail-shell-tooltip"]`)
      // Never hovered before in this page: the tooltip has not been shown once.
      await trigger.hover()
      const [early, late] = await tip.evaluate(async (element) => {
        const shown = () =>
          getComputedStyle(element).visibility === "visible" && element.checkVisibility()
        await new Promise((resolve) => setTimeout(resolve, 100))
        const early = shown()
        await new Promise((resolve) => setTimeout(resolve, 400))
        return [early, shown()]
      })
      if (early) throw new Error("the switcher's first hover showed its tooltip within 100 ms")
      if (!late) throw new Error("the switcher's first hover had not shown its tooltip at 500 ms")
      await page.keyboard.press("Escape")
      await tip.waitFor({ state: "hidden" })
      await page.mouse.move(1400, 10)

      const look = (locator: Locator) =>
        locator.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const bubble = getComputedStyle(element.firstElementChild as Element)
          return {
            x: box.x,
            delay: getComputedStyle(element).transitionDelay,
            bubble: [
              bubble.backgroundColor,
              bubble.color,
              bubble.fontWeight,
              bubble.boxShadow,
            ].join(" / "),
          }
        })
      const ring = (locator: Locator) =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element)
          return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`
        })
      // An entry eases its colours, its ring's among them, so without motion the rings are read at
      // their end rather than on their way there.
      await page.emulateMedia({ reducedMotion: "reduce" })
      // Keyboard focus, so `:focus-visible` holds, on the switcher and then on the first entry.
      const entry = column.locator(`[data-e2e="rail-shell-entry"]`).first()
      await trigger.focus()
      await page.keyboard.press("Tab")
      await page.keyboard.press("Shift+Tab")
      await tip.waitFor({ state: "visible" })
      const [switcher, switcherRing] = await Promise.all([look(tip), ring(trigger)])
      await page.keyboard.press("Tab")
      const entryTip = tipOf(entry)
      await entryTip.waitFor({ state: "visible" })
      const [entryLook, entryRing] = await Promise.all([look(entryTip), ring(entry)])
      if (!switcher.delay.split(", ").every((value) => value === "0s")) {
        throw new Error(`the focused switcher's tooltip waits ${switcher.delay}, not 0s`)
      }
      if (Math.abs(switcher.x - entryLook.x) > 0.5) {
        throw new Error(
          `the switcher's tooltip starts at x ${switcher.x}, an entry's ${entryLook.x}`,
        )
      }
      if (switcher.bubble !== entryLook.bubble) {
        throw new Error(
          `the switcher's bubble is ${switcher.bubble}, an entry's ${entryLook.bubble}`,
        )
      }
      if (switcherRing !== entryRing || !switcherRing.startsWith("solid 2px")) {
        throw new Error(`the switcher's focus ring is ${switcherRing}, an entry's ${entryRing}`)
      }
      return `tooltip at x ${switcher.x}, ${switcher.bubble}; ring ${switcherRing}`
    },
  },
  {
    name: "AppShell on a touch screen at 1024 px: a label wraps only between words, and " +
      '"Notifications" never breaks between two letters',
    pageId: "system",
    run: async (page) => {
      const session = await page.context().newCDPSession(page)
      await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 })
      await page.setViewportSize({ width: 1024, height: 900 })
      if (!(await page.evaluate(() => matchMedia("(hover: none)").matches))) {
        throw new Error("touch emulation did not make the screen (hover: none)")
      }
      const column = inCard(page, APP, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const labels = column.locator("[data-rail-cell] span").filter({ hasNotText: /\s/ })
      const words = await labels.evaluateAll((spans) =>
        spans.filter((span) =>
          span.childElementCount === 0 && span.checkVisibility({ visibilityProperty: true })
        ).map((span) => {
          const text = span.textContent ?? ""
          const tops = new Set<number>()
          for (let index = 0; index < text.length; index++) {
            const range = document.createRange()
            range.setStart(span.firstChild!, index)
            range.setEnd(span.firstChild!, index + 1)
            const rect = range.getClientRects()[0]
            if (rect) tops.add(Math.round(rect.top))
          }
          const style = getComputedStyle(span)
          // Only hyphenation may break a word: no overflow-wrap or word-break that splits it bare.
          const hyphenOnly = style.hyphens === "auto" && style.overflowWrap === "normal" &&
            style.wordBreak === "normal"
          return { text, lines: tops.size, hyphenOnly }
        })
      )
      const notifications = words.find((word) => word.text === "Notifications")
      if (!notifications) throw new Error(`no visible "Notifications" label among ${words.length}`)
      const split = words.filter((word) => word.lines > 1 && !word.hyphenOnly)
      if (split.length > 0) {
        throw new Error(
          `split between letters with no hyphen: ${split.map((word) => word.text).join(", ")}`,
        )
      }
      return words.map((word) => `${word.text} on ${word.lines} line(s)`).join(", ")
    },
  },
  {
    name: "Rail labels: the 88 px column, where every cell prints its label under its icon and " +
      "draws no tooltip",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = inCard(page, RAIL_CARD, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const box = await column.boundingBox()
      if (!box || Math.abs(box.width - 88) > 1) throw new Error(`the column is ${box?.width} wide`)
      const work = column.getByRole("link", { name: "Work", exact: true })
      const [icon, label] = await Promise.all([
        work.locator("svg").boundingBox(),
        work.getByText("Work", { exact: true }).boundingBox(),
      ])
      if (!icon || !label || label.y < icon.y + icon.height) {
        throw new Error("the label is not drawn under the icon")
      }
      await work.hover()
      const tips = await column.locator(`[data-e2e="rail-shell-tooltip"]`).count()
      if (tips !== 0) throw new Error(`the labels variant draws ${tips} tooltips`)
      return `label at y ${label.y}, icon ends at y ${icon.y + icon.height}`
    },
  },
  {
    name: "Rail below md: the primary action takes the tab bar's centre slot and More the last",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const bar = inCard(page, RAIL_CARD, "rail-shell-tabbar")
      await bar.scrollIntoViewIfNeeded()
      const names = await bar.locator(`li > :is(a, button)`).evaluateAll((tabs) =>
        tabs.map((tab) => tab.getAttribute("aria-label") ?? tab.textContent?.trim() ?? "")
      )
      const wanted = ["Work", "Services", "Book", "Tools", "More"]
      if (JSON.stringify(names) !== JSON.stringify(wanted)) {
        throw new Error(`the bar is ${JSON.stringify(names)}, not ${JSON.stringify(wanted)}`)
      }
      return names.join(", ")
    },
  },
  {
    name: 'AppShell: a destination\'s own page is aria-current="page", and a page inside its ' +
      'section makes it aria-current="true" without claiming the page',
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = inCard(page, APP, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const notes = column.getByRole("link", { name: "Notes", exact: true })
      await notes.click()
      const state = () => notes.getAttribute("aria-current")
      if (await state() !== "page") throw new Error(`Notes is ${await state()} on its own page`)
      await inCard(page, APP, "app-shell-demo-inside").click()
      await inCard(page, APP, "app-shell-demo-current").getByText("#app-notes/42").waitFor()
      const pages = await column.locator(`[aria-current="page"]`).count()
      if (await state() !== "true" || pages !== 0) {
        throw new Error(`inside the section Notes is ${await state()}, with ${pages} pages`)
      }
      return 'Notes: "page" on #app-notes, "true" on #app-notes/42'
    },
  },
  {
    name: "AppShell below md: closing the account sheet with its close button or Escape returns " +
      "focus to the account tab",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const tab = page.locator(APP).getByRole("button", { name: "Account, 3 unread" })
      const dialog = inCard(page, APP, "rail-shell-dialog")
      await tab.scrollIntoViewIfNeeded()
      for (const how of ["close button", "Escape"] as const) {
        await tab.click()
        await dialog.waitFor({ state: "visible" })
        if (how === "Escape") await page.keyboard.press("Escape")
        else await inCard(page, APP, "rail-shell-close").click()
        await dialog.waitFor({ state: "hidden" })
        await tab.and(page.locator(":focus")).waitFor()
      }
      return "focus back on the account tab after the close button and after Escape"
    },
  },
  {
    name: 'AppShell admin: a neutral "Admin" badge under the avatar, spoken in the account ' +
      "button's name and printed as the phone's last tab",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await appShellAdmin(page)
      const column = inCard(page, APP, "rail-shell-column")
      await column.scrollIntoViewIfNeeded()
      const account = column.getByRole("button", { name: "Account: Uma Lee, Admin", exact: true })
      const badge = account.getByText("Admin", { exact: true })
      const [button, tag] = await Promise.all([account.boundingBox(), badge.boundingBox()])
      if (!button || !tag || tag.y < button.y + button.height / 2) {
        throw new Error("the badge is not under the avatar")
      }
      const fill = await badge.evaluate((element) => getComputedStyle(element).backgroundColor)
      const chroma = await badge.evaluate((element) => {
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 1
        const context = canvas.getContext("2d")
        if (!context) return -1
        context.fillStyle = getComputedStyle(element).backgroundColor
        context.fillRect(0, 0, 1, 1)
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data
        return Math.max(r, g, b) - Math.min(r, g, b)
      })
      if (chroma < 0 || chroma > 16) {
        throw new Error(`the badge's fill ${fill} is not a neutral gray (spread ${chroma})`)
      }
      await page.setViewportSize({ width: 390, height: 844 })
      const tab = inCard(page, APP, "rail-shell-more")
      await tab.scrollIntoViewIfNeeded()
      // The tab draws the avatar, whose initials are text too, above its word.
      const words = (await tab.locator("span.truncate").innerText()).trim()
      if (words !== "Admin") throw new Error(`the last tab reads "${words}"`)
      return `badge ${fill}, channel spread ${chroma}; last tab "${words}"`
    },
  },
  {
    name: "Rail and AppShell as the page frame pass axe at 390 and 1440 px in light, colour " +
      "contrast and landmarks included",
    pageId: "system",
    run: shellsAxeClean,
  },
  {
    name: "Rail and AppShell as the page frame pass axe at 390 and 1440 px in dark, colour " +
      "contrast and landmarks included",
    pageId: "system",
    colorScheme: "dark",
    run: shellsAxeClean,
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
  {
    name: "UnsentChangesDialog: opens with focus on Send, then sign out; Escape cancels it and " +
      "returns focus to the trigger",
    pageId: "system",
    run: async (page) => {
      const trigger = await openUnsentDialog(page)
      await expectUnsentFocus(page, "unsent-wait")
      await page.keyboard.press("Escape")
      await unsentDialog(page).waitFor({ state: "detached" })
      await unsentDemo(page, "unsent-demo-log").filter({ hasText: "cancelled" }).waitFor()
      if (!await trigger.evaluate((element) => element === document.activeElement)) {
        throw new Error("focus did not return to the Sign out trigger")
      }
      return "focus on the primary, Escape called onCancel, focus back on the trigger"
    },
  },
  {
    name: "UnsentChangesDialog: while sending, the primary keeps focus as an aria-disabled busy " +
      "button, the status line counts the sent changes up in order, and the dialog closes " +
      "when none is left",
    pageId: "system",
    run: async (page) => {
      await openUnsentDialog(page)
      await recordUnsentStatus(page)
      const primary = unsentDialog(page, "unsent-wait")
      await primary.press("Enter")
      await primary.and(page.locator(`[aria-disabled="true"][aria-busy="true"]`)).waitFor()
      await expectUnsentFocus(page, "unsent-wait")
      await primary.press("Enter")
      await unsentDialog(page).waitFor({ state: "detached" })
      await unsentDemo(page, "unsent-demo-log").filter({ hasText: "signed out after sending" })
        .waitFor()
      const seen = await page.evaluate(() =>
        (globalThis as typeof globalThis & { unsentSeen?: string[] }).unsentSeen ?? []
      )
      const expected = [0, 1, 2].map((sent) => `Sending changes…${sent} of 3 sent`)
      if (JSON.stringify(seen.slice(0, 3)) !== JSON.stringify(expected)) {
        throw new Error(`the status line said ${JSON.stringify(seen)}`)
      }
      return `status line: ${seen.join(" | ")}`
    },
  },
  {
    name: "UnsentChangesDialog: once only a change that needs a choice is left, the focused " +
      "primary turns into Review changes in place and keeps focus",
    pageId: "system",
    run: async (page) => {
      await openUnsentDialog(page, true)
      await unsentDialog(page, "unsent-wait").press("Enter")
      const review = unsentDialog(page, "unsent-review")
      await review.waitFor()
      if (await review.getAttribute("aria-disabled") !== null) {
        throw new Error("Review changes is still aria-disabled")
      }
      await expectUnsentFocus(page, "unsent-review")
      await unsentDialog(page).getByRole("heading", { name: "1 change needs your choice" })
        .waitFor()
      await review.press("Enter")
      await unsentDemo(page, "unsent-demo-log").filter({ hasText: "review" }).waitFor()
      return "the same button became Review changes with focus on it, and called onReview"
    },
  },
  {
    name: "UnsentChangesDialog: at 390 px the buttons stack full width with the primary on top",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await openUnsentDialog(page)
      const boxes = await Promise.all(
        ["unsent-wait", "unsent-sign-out-anyway", "unsent-cancel"].map((e2e) =>
          unsentDialog(page, e2e).boundingBox()
        ),
      )
      const [send, signOut, cancel] = boxes.map((box) => {
        if (!box) throw new Error("a footer button is not drawn")
        return box
      })
      if (!(send.y < signOut.y && signOut.y < cancel.y)) {
        throw new Error(`the buttons are not stacked primary first: ${JSON.stringify(boxes)}`)
      }
      if (new Set([send.width, signOut.width, cancel.width]).size !== 1) {
        throw new Error(`the buttons differ in width: ${JSON.stringify(boxes)}`)
      }
      return `${send.width} px wide, stacked`
    },
  },
  {
    name: "UnsentChangesDialog at 1440 px: the three buttons sit in one row, primary last",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await openUnsentDialog(page)
      const boxes = await Promise.all(
        ["unsent-cancel", "unsent-sign-out-anyway", "unsent-wait"].map((e2e) =>
          unsentDialog(page, e2e).boundingBox()
        ),
      )
      const ys = new Set(boxes.map((box) => Math.round(box?.y ?? -1)))
      const xs = boxes.map((box) => box?.x ?? -1)
      if (ys.size !== 1 || !(xs[0] < xs[1] && xs[1] < xs[2])) {
        throw new Error(`the buttons are not in one row: ${JSON.stringify(boxes)}`)
      }
      return "one row: Cancel, Sign out anyway, Send, then sign out"
    },
  },
  ...(["light", "dark"] as const).map((colorScheme): Spec => ({
    name: `UnsentChangesDialog: the dialog, asking and sending, passes axe in ${colorScheme} mode`,
    pageId: "system",
    colorScheme,
    run: async (page) => {
      await unsentDemo(page, "unsent-demo-offline").scrollIntoViewIfNeeded()
      await unsentDemo(page, "unsent-demo-offline").click()
      await openUnsentDialog(page)
      const asking = await expectAxeClean(page, `dialog[data-e2e="unsent-dialog"]`)
      await unsentDialog(page, "unsent-wait").click()
      await unsentDialog(page, "unsent-status").filter({ hasText: "You're offline." }).waitFor()
      const waiting = await expectAxeClean(page, `dialog[data-e2e="unsent-dialog"]`)
      return `asking: ${asking}; offline: ${waiting}`
    },
  })),
  // #857: the phone sheet leaves a modified click to the browser, and its theme choice is the
  // desktop menu's radio set.
  {
    name: "Rail and AppShell below md: a Ctrl-click on a link row in the sheet opens it in a new " +
      "tab and leaves the sheet open",
    pageId: "system",
    run: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const rows = [
        [RAIL_CARD, "More", "Home"],
        [APP, "Account, 3 unread", "Profile"],
      ] as const
      const results: string[] = []
      for (const [card, tabName, rowName] of rows) {
        const tab = page.locator(card).getByRole("button", { name: tabName, exact: true })
        const dialog = inCard(page, card, "rail-shell-dialog")
        await tab.scrollIntoViewIfNeeded()
        await tab.click()
        await dialog.waitFor({ state: "visible" })
        const opened = page.context().waitForEvent("page")
        await dialog.getByRole("link", { name: rowName, exact: true }).click({
          modifiers: ["ControlOrMeta"],
        })
        const popup = await opened
        const url = popup.url()
        await popup.close()
        if (!await dialog.evaluate((element: HTMLDialogElement) => element.open)) {
          throw new Error(`the ${card} sheet closed on a Ctrl-click on "${rowName}"`)
        }
        await inCard(page, card, "rail-shell-close").click()
        await dialog.waitFor({ state: "hidden" })
        results.push(`${card} "${rowName}": new tab ${url}, sheet still open`)
      }
      return results.join("; ")
    },
  },
  {
    name: "AppShell: the theme choice in the phone sheet and in the desktop menu are the same " +
      "radio set with the same checked item, before and after a choice",
    pageId: "system",
    run: async (page) => {
      const sheetTheme = inCard(page, APP, "app-shell-sheet-theme")
      const menuTheme = inCard(page, APP, "account-menu-theme")
      // The roles differ only as a menu's radio items differ from a dialog's radios.
      const shape = (snapshot: string) =>
        snapshot.replace(/menuitemradio/g, "radio").replace(/- group /, "- radiogroup ")
          .split("\n").filter((line) => !line.trim().startsWith("- text:")).join("\n")
      const tab = page.locator(APP).getByRole("button", { name: "Account, 3 unread" })
      const openSheet = async () => {
        await page.setViewportSize({ width: 390, height: 844 })
        await tab.scrollIntoViewIfNeeded()
        await tab.click()
      }
      const closeSheet = async () => {
        await page.keyboard.press("Escape")
        await inCard(page, APP, "rail-shell-dialog").waitFor({ state: "hidden" })
      }
      const read = async (checked: "System" | "Dark") => {
        await openSheet()
        await sheetTheme.getByRole("radio", { name: checked, checked: true }).waitFor()
        const sheet = await sheetTheme.ariaSnapshot()
        await closeSheet()
        await page.setViewportSize({ width: 1440, height: 900 })
        const trigger = inCard(page, APP, "rail-shell-column")
          .getByRole("button", { name: "Account: Uma Lee", exact: true })
        await trigger.scrollIntoViewIfNeeded()
        await trigger.click()
        await menuTheme.getByRole("menuitemradio", { name: checked, checked: true }).waitFor()
        const menu = await menuTheme.ariaSnapshot()
        await page.keyboard.press("Escape")
        if (!/^- radiogroup "Theme"/.test(sheet) || !/^- group "Theme"/.test(menu)) {
          throw new Error(`unexpected containers:\n${sheet}\n---\n${menu}`)
        }
        if (shape(sheet) !== shape(menu)) {
          throw new Error(`the sheet and the menu differ:\n${sheet}\n---\n${menu}`)
        }
        return shape(sheet).replace(/\n\s*/g, " ")
      }
      const before = await read("System")
      await openSheet()
      await sheetTheme.getByRole("radio", { name: "Dark" }).click()
      await closeSheet()
      const after = await read("Dark")
      return `before: ${before}; after choosing Dark in the sheet: ${after}`
    },
  },
]
