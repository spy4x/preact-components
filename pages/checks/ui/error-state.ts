import { check, CONTRAST_HELPERS, type Devtools } from "../harness.ts"
import { REPAINTED_DANGER } from "./shared.ts"

/** The `ErrorState` panel's colours, read in one palette. */
interface ErrorStatePanel {
  /** Whether the panel was found in the catalogue. */
  found: boolean
  /** The message's contrast against the panel's own background, composited over the page. */
  onPanel: number
  /** The computed text, border and background colours, for the report. */
  color: string
  border: string
  background: string
  /** Whether text and border paint `--color-danger`, and the background `--color-danger-soft`. */
  onTokens: boolean
}

/** The panel in every palette, and its colours after an app repaints both danger tokens. */
interface ErrorStateReading {
  light: ErrorStatePanel
  dark: ErrorStatePanel
  /** The opt-in dark `data-theme="ink"` palette. */
  ink: ErrorStatePanel
  /** In light and in dark, while the root repaints `--color-danger` and `--color-danger-soft`. */
  repainted: { palette: string; follows: boolean; detail: string }[]
}

/** A soft danger background no palette uses, set beside {@link REPAINTED_DANGER} for the repaint. */
const REPAINTED_DANGER_SOFT = "rgb(224, 255, 224)"

/**
 * `ErrorState` draws its panel with the danger tokens (#526): its text and border paint
 * `--color-danger` and its background `--color-danger-soft` in the light, the dark and the ink
 * palette, the message reaches 4.5:1 against that background, and an app that repaints the two
 * tokens gets its own colours in the panel, in light and in dark.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function errorStateDangerCheck(devtools: Devtools): Promise<void> {
  const reading = await devtools.evaluate<ErrorStateReading>(`(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const wasTheme = root.getAttribute("data-theme")
    const panel = document.querySelector('#demo-ErrorState [role="alert"]')
    const token = (name) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = "var(" + name + ")"
      document.body.appendChild(probe)
      const color = paint(getComputedStyle(probe).backgroundColor)
      probe.remove()
      return color
    }
    const settle = () =>
      Promise.all(panel ? panel.getAnimations().map((animation) => animation.finished.catch(() => {})) : [])
    const same = (a, b) => a.every((channel, index) => channel === b[index])
    const measure = () => {
      if (!panel) {
        return { found: false, onPanel: 0, color: "", border: "", background: "", onTokens: false }
      }
      const style = getComputedStyle(panel)
      const text = paint(style.color)
      return {
        found: true,
        onPanel: panel.querySelector("p") ? seenRatio(panel.querySelector("p")) : 0,
        color: style.color,
        border: style.borderTopColor,
        background: style.backgroundColor,
        onTokens: same(text, token("--color-danger")) &&
          same(paint(style.borderTopColor), token("--color-danger")) &&
          same(paint(style.backgroundColor), token("--color-danger-soft")),
      }
    }
    try {
      root.classList.remove("dark")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      root.setAttribute("data-theme", "ink")
      await settle()
      const ink = measure()
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)
      root.style.setProperty("--color-danger", ${JSON.stringify(REPAINTED_DANGER)})
      root.style.setProperty("--color-danger-soft", ${JSON.stringify(REPAINTED_DANGER_SOFT)})
      const danger = paint(${JSON.stringify(REPAINTED_DANGER)})
      const soft = paint(${JSON.stringify(REPAINTED_DANGER_SOFT)})
      const readRepainted = (palette) => {
        if (!panel) return { palette, follows: false, detail: "missing" }
        const style = getComputedStyle(panel)
        return {
          palette,
          follows: same(paint(style.color), danger) && same(paint(style.borderTopColor), danger) &&
            same(paint(style.backgroundColor), soft),
          detail: palette + " text " + style.color + " border " + style.borderTopColor +
            " background " + style.backgroundColor,
        }
      }
      await settle()
      const repaintedDark = readRepainted("dark")
      root.classList.remove("dark")
      await settle()
      return { light, dark, ink, repainted: [readRepainted("light"), repaintedDark] }
    } finally {
      root.style.removeProperty("--color-danger")
      root.style.removeProperty("--color-danger-soft")
      root.classList.toggle("dark", wasDark)
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)
    }
  })()`)

  for (const palette of ["light", "dark", "ink"] as const) {
    const panel = reading[palette]
    check(
      `in the ${palette} palette the ErrorState panel draws its text and border with ` +
        "--color-danger and its background with --color-danger-soft, the text at 4.5:1 or better",
      panel.found && panel.onTokens && panel.onPanel >= 4.5,
      panel.found
        ? `${panel.onPanel.toFixed(2)}:1 — text ${panel.color}, border ${panel.border}, ` +
          `background ${panel.background}`
        : "no ErrorState panel in the catalogue",
    )
  }
  check(
    "in the light and the dark palette the ErrorState panel follows an app's repainted " +
      "--color-danger and --color-danger-soft",
    reading.repainted.every((entry) => entry.follows),
    reading.repainted.map((entry) => entry.detail).join("; "),
  )
}
