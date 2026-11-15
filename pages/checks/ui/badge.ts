import { check, CONTRAST_HELPERS, type Devtools, pointerToCorner } from "../harness.ts"

/** One outline badge's label contrast, measured in one palette. */
interface BadgeContrast {
  /** The badge's text, which is its colour's name in the catalogue. */
  name: string
  /** Against what the badge really sits on (its own fill, when it has one). */
  onBackdrop: number
  /** Against the palette's page canvas and raised surface, the other places a badge sits. */
  onCanvas: number
  onSurface: number
  /** The label's colour as the browser computes it. */
  color: string
  /** Whether the badge has a fill of its own, so only its own fill is behind the label. */
  filled: boolean
}

/** Both palettes' readings of every outline badge. */
interface OutlineBadgeReading {
  found: number
  light: BadgeContrast[]
  dark: BadgeContrast[]
}

/**
 * The outline badges' dark label colours: #463 gave the light palette its own shades and left
 * these alone.
 */
const DARK_OUTLINE_BADGE_COLOURS: Record<string, string> = {
  red: "oklch(0.704 0.191 22.216)", // red-400
  orange: "oklch(0.75 0.183 55.934)", // orange-400
  green: "oklch(0.792 0.209 151.711)", // green-400
  blue: "oklch(0.707 0.165 254.624)", // blue-400
}

/**
 * In both palettes every outline `Badge` label reaches 4.5:1 against what it sits on: the
 * catalogue card behind it, the canvas and the surface (#396 for dark, #463 for light). A badge
 * with its own fill (`purpleNav`) is measured against that fill alone. The dark red, orange, green
 * and blue labels keep their 400 shades. The unpressed `ToggleChips` chip's contrast is a
 * Playwright spec in `pages/e2e/ui.spec.ts` since it stopped drawing the grey outline badge.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function outlineBadgeContrastCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const reading = await devtools.evaluate<OutlineBadgeReading>(`(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const card = document.querySelector("#demo-Badge")
    const row = [...card.querySelectorAll("span")].find((span) => span.textContent.trim() === "outline")
    const badges = [...(row?.nextElementSibling?.children ?? [])]
    const token = (name) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = "var(" + name + ")"
      document.body.appendChild(probe)
      const color = paint(getComputedStyle(probe).backgroundColor)
      probe.remove()
      return color
    }
    const settle = () => Promise.all(
      badges.flatMap((element) =>
        element.getAnimations().map((animation) => animation.finished.catch(() => {}))
      ),
    )
    const measure = () => {
      const canvas = token("--color-canvas")
      const surface = token("--color-surface")
      return badges.map((badge) => {
        const text = paint(getComputedStyle(badge).color)
        const shown = seen(badge)
        const behind = shown.ground
        paintLayers([getComputedStyle(badge).backgroundColor])
        const filled = contrastCanvas.getImageData(0, 0, 1, 1).data[3] === 255
        return {
          name: badge.textContent.trim(),
          color: getComputedStyle(badge).color,
          onBackdrop: ratio(shown.text, behind),
          onCanvas: filled ? ratio(shown.text, behind) : ratio(text, canvas),
          onSurface: filled ? ratio(shown.text, behind) : ratio(text, surface),
          filled,
        }
      })
    }
    try {
      root.classList.remove("dark")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      return { found: badges.length, light, dark }
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`)

  const lowest = (badge: BadgeContrast) =>
    Math.min(badge.onBackdrop, badge.onCanvas, badge.onSurface)
  const table = (badges: BadgeContrast[]) =>
    badges.map((badge) =>
      badge.filled
        ? `${badge.name} ${badge.onBackdrop.toFixed(2)} on its fill`
        : `${badge.name} ${badge.onBackdrop.toFixed(2)}/${badge.onCanvas.toFixed(2)}/` +
          badge.onSurface.toFixed(2)
    ).join(", ")
  for (const palette of ["light", "dark"] as const) {
    check(
      `in the ${palette} palette every outline Badge label reaches 4.5:1 on the card, canvas and ` +
        "surface",
      reading.found === 7 && reading[palette].every((badge) => lowest(badge) >= 4.5),
      reading.found !== 7
        ? `found ${reading.found} outline badges in the Badge card, expected 7`
        : `card/canvas/surface — ${palette}: ${table(reading[palette])}`,
    )
  }
  const darkMoved = Object.entries(DARK_OUTLINE_BADGE_COLOURS).filter(([name, colour]) =>
    reading.dark.find((badge) => badge.name === name)?.color !== colour
  )
  check(
    "in the dark palette the red, orange, green and blue outline Badges keep their 400 shades",
    darkMoved.length === 0,
    reading.dark.map((badge) => `${badge.name} ${badge.color}`).join(", "),
  )
}
