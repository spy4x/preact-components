/** Playwright specs for the `theme/` classes, on the guide's theme page. */
import type { Spec } from "./runner.ts"
import { scrollRegionSpec } from "./scroll-region.ts"

/** The outline a form control draws, and the colour `--color-ring` resolves to beside it. */
interface Outline {
  style: string
  width: string
  offset: string
  color: string
  ringToken: string
}

/**
 * A theme form control reached with Tab draws the components' focus ring, 2px solid in
 * `--color-ring` at a 2px offset, and no outline before.
 *
 * @param what The control, as the spec's name says it.
 * @param selector The control on the theme page; the first match is the one tabbed to.
 */
function focusRingSpec(what: string, selector: string): Spec {
  return {
    name: `${what} reached with Tab draws the components' focus ring, and no outline before`,
    pageId: "theme",
    run: async (page) => {
      const box = page.locator(selector).first()
      const outline = () =>
        box.evaluate((element): Outline => {
          const probe = document.createElement("span")
          probe.style.color = "var(--color-ring)"
          element.after(probe)
          const ringToken = getComputedStyle(probe).color
          probe.remove()
          const style = getComputedStyle(element)
          return {
            style: style.outlineStyle,
            width: style.outlineWidth,
            offset: style.outlineOffset,
            color: style.outlineColor,
            ringToken,
          }
        })

      const before = await outline()
      if (before.style !== "none") {
        throw new Error(`${what} draws a ${before.style} outline before it is focused`)
      }

      // Away and back with real key presses, so the focus arrives the way a keyboard user's does.
      await box.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await box.and(page.locator(":focus-visible")).waitFor()

      const focused = await outline()
      const drawn = `${focused.width} ${focused.style} ${focused.color}, offset ${focused.offset}`
      if (
        focused.style !== "solid" || focused.width !== "2px" || focused.offset !== "2px" ||
        focused.color !== focused.ringToken
      ) {
        throw new Error(
          `${what}, focused, draws ${drawn}; wanted 2px solid ${focused.ringToken}, offset 2px`,
        )
      }
      return `${drawn} (--color-ring), none before`
    },
  }
}

export const specs: readonly Spec[] = [
  scrollRegionSpec({
    what: "the `.pc-scrollbar` card's row of months",
    pageId: "theme",
    selector: `#demo-class-scrollbar [data-e2e="scrollbar"]`,
    name: "Months",
    key: "ArrowRight",
  }),
  focusRingSpec("a square `.pc-checkbox`", "#demo-class-checkbox input.pc-checkbox"),
  focusRingSpec("a `.pc-radio`", "#demo-class-radio input.pc-radio"),
  {
    name: `ink: an app that sets --color-primary and --color-accent on :root keeps its colour ` +
      `under .dark and data-theme="ink", and links take the accent's step 400`,
    pageId: "theme",
    colorScheme: "dark",
    run: async (page) => {
      const read = await page.evaluate(() => {
        const root = document.documentElement
        const wasDark = root.classList.contains("dark")
        const wasTheme = root.getAttribute("data-theme")
        // An app's own brand colour, unlayered on :root, as the theme README tells an app to set it.
        const brand = document.createElement("style")
        brand.textContent =
          ":root { --color-primary: oklch(0.5 0.15 150); --color-accent: oklch(0.5 0.15 150); }"
        document.head.append(brand)
        root.classList.add("dark")
        root.setAttribute("data-theme", "ink")

        const resolve = (value: string) => {
          const probe = document.createElement("span")
          probe.style.color = value
          document.body.append(probe)
          const color = getComputedStyle(probe).color
          probe.remove()
          return color
        }
        const result = {
          brand: resolve("oklch(0.5 0.15 150)"),
          primary: resolve("var(--color-primary)"),
          accent: resolve("var(--color-accent)"),
          muted: resolve("var(--color-primary-muted)"),
          step400: resolve("var(--color-accent-400)"),
          canvas: getComputedStyle(document.body).backgroundColor,
        }

        brand.remove()
        root.classList.toggle("dark", wasDark)
        if (wasTheme === null) root.removeAttribute("data-theme")
        else root.setAttribute("data-theme", wasTheme)
        return result
      })
      const wrong = [
        read.primary !== read.brand && `--color-primary is ${read.primary}`,
        read.accent !== read.brand && `--color-accent is ${read.accent}`,
        read.muted !== read.step400 &&
        `--color-primary-muted is ${read.muted}, not ${read.step400}`,
      ].filter(Boolean)
      if (wrong.length > 0) {
        throw new Error(`with the brand ${read.brand} on :root, ${wrong.join("; ")}`)
      }
      return `primary and accent ${read.brand}, links ${read.muted}, canvas ${read.canvas}`
    },
  },
]
