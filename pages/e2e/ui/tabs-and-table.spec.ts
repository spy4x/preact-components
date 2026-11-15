import { AxeBuilder } from "@axe-core/playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "../runner.ts"
import { scrollRegionSpec } from "../scroll-region.ts"
import { RING_PALETTES } from "./shared.ts"

/** The ring a focused element draws, and the colours around it, read in the browser. */
interface DrawnRing {
  /** The element's computed `box-shadow`. */
  shadow: string
  /** What `--color-ring` resolves to beside the element. */
  ring: string
  /** What `--color-focus-offset` resolves to there: the band between the element and the ring. */
  offset: string
  /** The first opaque background behind the element: what the ring is drawn against outside. */
  behind: string
  /** Contrast of the ring against `offset`, and against `behind`. */
  againstOffset: number
  againstBehind: number
}

/**
 * Read the ring `ring-2 ring-focus ring-offset-2 ring-offset-focus` draws on an element, with its
 * contrast against both colours it touches. Colours are compared as the browser paints them,
 * through a one-pixel canvas, so an `oklch()` token is measured in sRGB as it is shown.
 */
function drawnRing(element: Element): DrawnRing {
  const resolve = (property: string, value: string) => {
    const probe = document.createElement("span")
    probe.style.setProperty(property, value)
    element.after(probe)
    const resolved = getComputedStyle(probe).getPropertyValue(property)
    probe.remove()
    return resolved
  }
  const luminance = (color: string) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
  }
  let behind = "rgb(255, 255, 255)"
  for (let node = element.parentElement; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
      behind = color
      break
    }
  }
  const ring = resolve("color", "var(--color-ring)")
  const offset = resolve("color", "var(--color-focus-offset)")
  return {
    shadow: getComputedStyle(element).boxShadow,
    ring,
    offset,
    behind,
    againstOffset: contrast(ring, offset),
    againstBehind: contrast(ring, behind),
  }
}

/** One element reached with Tab whose focus ring the specs below measure. */
interface RingTarget {
  /** What it is, for the spec's name. */
  what: string
  /** The viewport's width in pixels. */
  width: number
  /** Puts the keyboard focus on the element with real key presses and returns it. */
  reach: (page: Page) => Promise<Locator>
}

/**
 * Specs proving an element a keyboard lands on draws the components' focus ring, 2px of
 * `--color-ring` set 2px off it, at 3:1 or more against the offset band and the page behind, in
 * the light, dark and ink palettes; and that it draws no ring before the focus arrives.
 *
 * @param target The element and how a keyboard reaches it.
 * @returns One spec per palette.
 */
function focusRingSpecs(target: RingTarget): Spec[] {
  return RING_PALETTES.map((palette): Spec => ({
    name: `${target.what}, reached with Tab, draws the components' 2px focus ring at 3:1 or ` +
      `more, ${palette}`,
    pageId: "ui",
    colorScheme: palette === "light" ? "light" : "dark",
    run: async (page) => {
      await page.setViewportSize({ width: target.width, height: 800 })
      if (palette === "ink") {
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
        await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
      }
      const element = await target.reach(page)
      const drawn = await element.evaluate(drawnRing)
      const ringShadow = `${drawn.ring} 0px 0px 0px 4px`
      const offsetShadow = `${drawn.offset} 0px 0px 0px 2px`
      if (!drawn.shadow.includes(ringShadow) || !drawn.shadow.includes(offsetShadow)) {
        throw new Error(
          `focused, it draws "${drawn.shadow}"; wanted ${offsetShadow}, ${ringShadow}`,
        )
      }
      if (drawn.againstOffset < 3 || drawn.againstBehind < 3) {
        throw new Error(
          `the ring ${drawn.ring} is ${drawn.againstOffset.toFixed(2)}:1 against ${drawn.offset} ` +
            `and ${drawn.againstBehind.toFixed(2)}:1 against ${drawn.behind}; wanted 3:1`,
        )
      }
      await page.keyboard.press("Shift+Tab")
      await element.and(page.locator(":focus")).waitFor({ state: "detached" })
      const blurred = await element.evaluate((node) => getComputedStyle(node).boxShadow)
      if (blurred.includes(ringShadow)) throw new Error(`unfocused, it still draws ${blurred}`)
      return `${drawn.againstOffset.toFixed(2)}:1 and ${drawn.againstBehind.toFixed(2)}:1`
    },
  }))
}

/** The `Tabs` card's open panel: one Tab from its active tab. */
async function reachTabPanel(page: Page): Promise<Locator> {
  const card = page.locator("#demo-Tabs")
  const panel = card.getByRole("tabpanel", { name: "Overview" })
  await card.getByRole("tab", { name: "Overview" }).focus()
  await page.keyboard.press("Tab")
  await panel.and(page.locator(":focus")).waitFor()
  return panel
}

/** The `Table` card's scroll area at 390px: Shift+Tab off it and Tab back on. */
async function reachTableScroller(page: Page): Promise<Locator> {
  const region = page.locator("#demo-Table").getByRole("region", {
    name: "February transactions",
    exact: true,
  })
  await region.focus()
  await page.keyboard.press("Shift+Tab")
  await region.and(page.locator(":focus")).waitFor({ state: "detached" })
  await page.keyboard.press("Tab")
  await region.and(page.locator(":focus")).waitFor()
  return region
}

/**
 * `Tabs` and `Table` at 390px: axe finds no violation in either card, and has evaluated
 * `scrollable-region-focusable` on the table's scroll area, which is too narrow for it there; then
 * `Table` at 1440px, where the table fits: the area is no Tab stop and has no role or name.
 */
function tabsAndTableKeyboardSpecs(): Spec[] {
  return [
    scrollRegionSpec({
      what: "Table at 390px",
      pageId: "ui",
      selector: `#demo-Table [role="region"]`,
      role: "region",
      name: "February transactions",
      key: "ArrowRight",
      width: 390,
    }),
    ...focusRingSpecs({ what: "A Tabs panel", width: 1440, reach: reachTabPanel }),
    ...focusRingSpecs({
      what: "Table's scroll area at 390px",
      width: 390,
      reach: reachTableScroller,
    }),
    {
      name: "Tabs and Table at 390px: axe finds no violation, and checks the table's scroll area " +
        "is reachable by keyboard",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 390, height: 800 })
        await page.locator(`#demo-Table [role="region"]`).waitFor()
        await page.addStyleTag({ content: `[data-card-part="demo"] { background-image: none; }` })
        const { violations, passes } = await new AxeBuilder({ page })
          .include("#demo-Tabs").include("#demo-Table").analyze()
        if (violations.length > 0) {
          throw new Error(
            violations.map(({ id, nodes }) =>
              `${id}: ${nodes.map((node) => node.target.join(" ")).join(", ")}`
            ).join(" | "),
          )
        }
        const scrollable = passes.find(({ id }) => id === "scrollable-region-focusable")
        if (!scrollable?.nodes.some((node) => node.target.join(" ").length > 0)) {
          throw new Error("axe did not evaluate scrollable-region-focusable: nothing scrolls")
        }
        return `${passes.length} rules pass, scrollable-region-focusable on ` +
          `${scrollable.nodes.length} element(s)`
      },
    },
    {
      name:
        "Table at 1440px, where it fits: its scroll area is no Tab stop and has no role or name",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 800 })
        // The demo's own frame: the card's props table sits in a scrolling box of its own.
        const frame = page.locator(`#demo-Table div:has(> table [data-e2e="ui-guide-row"])`)
        await frame.and(page.locator(":not([tabindex]):not([role]):not([aria-labelledby])"))
          .waitFor()
        const room = await frame.evaluate((node) => node.scrollWidth - node.clientWidth)
        if (room > 0) {
          throw new Error(`the table overflows by ${room}px, so the spec proves nothing`)
        }
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...tabsAndTableKeyboardSpecs(),
]
