/** Playwright specs for the `theme/` classes, on the guide's theme page. */
import type { Spec } from "./runner.ts"

/** The outline a checkbox draws, and the colour `--color-ring` resolves to beside it. */
interface Outline {
  style: string
  width: string
  offset: string
  color: string
  ringToken: string
}

export const specs: readonly Spec[] = [
  {
    name: "a square `.pc-checkbox` reached with Tab draws the components' focus ring, and no " +
      "outline before",
    pageId: "theme",
    run: async (page) => {
      const box = page.locator("#demo-class-checkbox input.pc-checkbox").first()
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
        throw new Error(`an unfocused checkbox already draws a ${before.style} outline`)
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
          `the focused checkbox draws ${drawn}; wanted 2px solid ${focused.ringToken}, offset 2px`,
        )
      }
      return `${drawn} (--color-ring), none before`
    },
  },
]
