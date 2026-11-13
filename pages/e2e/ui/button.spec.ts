import type { Spec } from "../runner.ts"
import { RING_PALETTES } from "./shared.ts"

/** A secondary `Button`'s edge and fill, and how far the stronger one stands off two grounds. */
interface DrawnEdge {
  border: string
  borderWidth: string
  fill: string
  behind: string
  surface: string
  /** The better of the border and the fill against the stage the button sits on. */
  onStage: number
  /** The same against `--color-surface`, the card a button often sits on in an app. */
  onSurface: number
}

/**
 * Read a button's edge and fill and measure the stronger of the two against what is behind it and
 * against `--color-surface`. A transparent or zero-width border counts as no border. Colours go
 * through a one-pixel canvas, so an `oklch()` token is measured in sRGB as it is shown.
 */
function drawnEdge(element: Element): DrawnEdge {
  const luminance = (color: string) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    if (a === 0) return Number.NaN
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (a: string, b: string) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    const value = (light + 0.05) / (dark + 0.05)
    return Number.isNaN(value) ? 1 : value
  }
  let behind = "rgb(255, 255, 255)"
  for (let node = element.parentElement; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
      behind = color
      break
    }
  }
  const probe = document.createElement("span")
  probe.style.color = "var(--color-surface)"
  element.after(probe)
  const surface = getComputedStyle(probe).color
  probe.remove()
  const style = getComputedStyle(element)
  const border = parseFloat(style.borderTopWidth) > 0 ? style.borderTopColor : "transparent"
  const fill = style.backgroundColor
  const best = (ground: string) => Math.max(contrast(border, ground), contrast(fill, ground))
  return {
    border,
    borderWidth: style.borderTopWidth,
    fill,
    behind,
    surface,
    onStage: best(behind),
    onSurface: best(surface),
  }
}

/**
 * Specs proving the guide's secondary `Button` shows where it ends, in the light, dark and ink
 * palettes: its border or its fill stands 3:1 or more off the stage behind it and off a card's
 * surface (WCAG 1.4.11, spy4x/seed#172). axe has no rule for a control's boundary, so the spec
 * measures it.
 *
 * @returns One spec per palette.
 */
function secondaryEdgeSpecs(): Spec[] {
  return RING_PALETTES.map((palette): Spec => ({
    name: `Button secondary: its edge stands 3:1 or more off the page and a card, ${palette}`,
    pageId: "ui",
    colorScheme: palette === "light" ? "light" : "dark",
    run: async (page) => {
      if (palette === "ink") {
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "ink"))
        await page.locator(`html.dark[data-theme="ink"]`).waitFor({ state: "attached" })
      }
      const button = page.locator(`#demo-Button button[title="secondary md"]`)
      const drawn = await button.evaluate(drawnEdge)
      const evidence = `border ${drawn.borderWidth} ${drawn.border}, fill ${drawn.fill}: ` +
        `${drawn.onStage.toFixed(2)}:1 on ${drawn.behind}, ` +
        `${drawn.onSurface.toFixed(2)}:1 on ${drawn.surface}`
      if (drawn.onStage < 3 || drawn.onSurface < 3) throw new Error(`${evidence}; wanted 3:1`)
      return evidence
    },
  }))
}

export const specs: readonly Spec[] = [
  ...secondaryEdgeSpecs(),
]
