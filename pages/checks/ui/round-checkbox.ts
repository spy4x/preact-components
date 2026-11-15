import { check, CONTRAST_HELPERS, type Devtools, poll, pressKey } from "../harness.ts"

/** The round boxes in the `Checkbox` card, by their `data-e2e` marks. */
const ROUND_CHECK = '#demo-Checkbox [data-e2e="round-check"]'

const ROUND_MIXED = '#demo-Checkbox [data-e2e="round-mixed"]'

const ROUND_DISABLED = '#demo-Checkbox [data-e2e="round-disabled"]'

const SQUARE_CHECK = '#demo-Checkbox [data-e2e="ref-target"]'

/** What one round box looks like right now, read off its computed style. */
interface RoundBoxLook {
  found: boolean
  checked: boolean
  /** Its corner radius as a share of its width; 0.5 or more is a circle. */
  roundness: number
  fill: string
  /** The tick's (or bar's) `display`, `rotate` and right border width. */
  mark: { display: string; rotate: string; right: string }
  opacity: string
  outline: { style: string; width: string }
  focused: boolean
}

/** Read a round box's look; `found: false` when the card lost it. */
function readRoundBox(devtools: Devtools, selector: string): Promise<RoundBoxLook> {
  return devtools.evaluate<RoundBoxLook>(`(() => {
    const box = document.querySelector('${selector}')
    if (!box) return { found: false }
    const style = getComputedStyle(box)
    const after = getComputedStyle(box, "::after")
    return {
      found: true,
      checked: box.checked,
      roundness: parseFloat(style.borderTopLeftRadius) / box.getBoundingClientRect().width,
      fill: style.backgroundColor,
      mark: { display: after.display, rotate: after.rotate, right: after.borderRightWidth },
      opacity: style.opacity,
      outline: { style: style.outlineStyle, width: style.outlineWidth },
      focused: document.activeElement === box,
    }
  })()`)
}

/**
 * `Checkbox` with `shape="round"`: a circle the browser does not draw, so its tick, its bar while
 * indeterminate, its dimming while disabled and its focus outline all have to be proven on the
 * painted page. Clicking the label and pressing Space still toggle it, because it is still a
 * native checkbox.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function roundCheckboxChecks(devtools: Devtools): Promise<void> {
  const before = await readRoundBox(devtools, ROUND_CHECK)
  await devtools.evaluate<null>(
    `(document.querySelector('${ROUND_CHECK}')?.closest("label")?.click(), null)`,
  )
  await poll(async () => (await readRoundBox(devtools, ROUND_CHECK)).checked, 2_000)
  const ticked = await readRoundBox(devtools, ROUND_CHECK)
  check(
    "a round Checkbox is a circle with no tick until it is ticked, and then it shows the tick",
    before.found && !before.checked && before.roundness >= 0.5 && before.mark.display === "none" &&
      ticked.checked && ticked.mark.display === "block" && ticked.mark.rotate === "45deg" &&
      ticked.mark.right !== "0px" && ticked.fill !== before.fill,
    JSON.stringify({ before, ticked }),
  )

  // Focus the square box above it, then Tab: a real key press, so the round box matches
  // `:focus-visible` and draws the browser's focus outline.
  await devtools.evaluate<null>(`(document.querySelector('${SQUARE_CHECK}')?.focus(), null)`)
  await pressKey(devtools, "Tab")
  const focused = await readRoundBox(devtools, ROUND_CHECK)
  await pressKey(devtools, "Space")
  await poll(async () => !(await readRoundBox(devtools, ROUND_CHECK)).checked, 2_000)
  const spaced = await readRoundBox(devtools, ROUND_CHECK)
  check(
    "a round Checkbox reached by Tab draws a visible focus outline",
    focused.focused && focused.outline.style !== "none" && parseFloat(focused.outline.width) > 0 &&
      !spaced.checked,
    JSON.stringify({ focused, spaced }),
  )

  const mixed = await readRoundBox(devtools, ROUND_MIXED)
  check(
    "an indeterminate round Checkbox draws a flat bar, not a tick",
    mixed.found && mixed.mark.display === "block" && /^(none|0deg)$/.test(mixed.mark.rotate) &&
      mixed.mark.right === "0px" && mixed.fill !== before.fill,
    JSON.stringify(mixed),
  )

  await devtools.evaluate<null>(
    `(document.querySelector('${ROUND_DISABLED}')?.closest("label")?.click(), null)`,
  )
  const disabled = await readRoundBox(devtools, ROUND_DISABLED)
  check(
    "a disabled round Checkbox is drawn dimmed",
    disabled.found && disabled.checked && parseFloat(disabled.opacity) < 1,
    JSON.stringify(disabled),
  )
}

/** The round box's colours in one palette, as {@link roundCheckboxColourChecks} reads them. */
interface RoundBoxColours {
  found: boolean
  /** The tick against the accent fill it sits on, ticked. */
  tick: number
  /** Whether the empty ring is drawn in the palette's `--color-border-strong`. */
  ringIsToken: boolean
  /** The empty ring against the empty box's fill. */
  ring: number
  /** The border colour `.pc-checkbox` declares, against the same fill. */
  square: number
  detail: string
}

/**
 * The round `Checkbox`'s colours in the light, dark and ink palettes: the tick clears 3:1 against
 * the fill it sits on, and the empty ring is drawn in `--color-border-strong` and shows at least as
 * clearly as the theme's square box's border does in the light palette. Then, with forced
 * colours on, the tick is drawn in the system text colour, so it stays visible when the browser
 * replaces the fill.
 *
 * The round box is ticked for the reading and put back afterwards, and the palette and the
 * emulated media are restored in `finally`.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function roundCheckboxColourChecks(devtools: Devtools): Promise<void> {
  const reading = await devtools.evaluate<
    { light: RoundBoxColours; dark: RoundBoxColours; ink: RoundBoxColours }
  >(`(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const wasTheme = root.getAttribute("data-theme")
    const box = document.querySelector('${ROUND_CHECK}')
    const square = document.querySelector('${SQUARE_CHECK}')
    const wasChecked = box?.checked
    const same = (a, b) => a.every((channel, index) => channel === b[index])
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
    const settle = async () => {
      await Promise.all(box.getAnimations().map((animation) => animation.finished.catch(() => {})))
      await frame()
      await frame()
    }
    const findRule = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText === ".pc-checkbox") return rule
        const inner = rule.cssRules && findRule(rule.cssRules)
        if (inner) return inner
      }
      return null
    }
    // The colour the theme's .pc-checkbox rule declares. Without @tailwindcss/forms the guide's
    // square is drawn natively, so its computed border is not what an app with forms paints.
    const squareRule = [...document.styleSheets].map((sheet) => findRule(sheet.cssRules))
      .find(Boolean)
    const resolve = (value) => {
      const probe = document.createElement("div")
      probe.style.borderStyle = "solid"
      probe.style.borderColor = value
      box.parentElement.appendChild(probe)
      const colour = getComputedStyle(probe).borderTopColor
      probe.remove()
      return colour
    }
    const measure = () => {
      box.checked = true
      const fill = getComputedStyle(box).backgroundColor
      const tick = getComputedStyle(box, "::after").borderRightColor
      box.checked = false
      const ring = getComputedStyle(box).borderTopColor
      const emptyFill = getComputedStyle(box).backgroundColor
      const token = resolve("var(--color-border-strong)")
      const squareBorder = squareRule ? resolve(squareRule.style.borderColor) : "missing"
      box.checked = wasChecked
      return {
        found: squareRule !== undefined && squareRule !== null,
        tick: contrast(tick, fill),
        ringIsToken: same(paint(ring), paint(token)),
        ring: contrast(ring, emptyFill),
        square: squareRule ? contrast(squareBorder, emptyFill) : 0,
        detail: "tick " + tick + " on fill " + fill + ", ring " + ring + " on " + emptyFill +
          ", --color-border-strong " + token + ", square border " + squareBorder,
      }
    }
    if (!box || !square) {
      const missing = {
        found: false,
        tick: 0,
        ringIsToken: false,
        ring: 0,
        square: 0,
        detail: "missing",
      }
      return { light: missing, dark: missing, ink: missing }
    }
    try {
      root.classList.remove("dark")
      root.removeAttribute("data-theme")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      root.setAttribute("data-theme", "ink")
      await settle()
      const ink = measure()
      return { light, dark, ink }
    } finally {
      root.classList.toggle("dark", wasDark)
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)
    }
  })()`)

  // The square box's border in the light palette is the dimmest edge the theme already accepts.
  const floor = reading.light.square - 0.005
  for (const palette of ["light", "dark", "ink"] as const) {
    const colours = reading[palette]
    check(
      `in the ${palette} palette a round Checkbox's tick clears 3:1 against its fill, and its ` +
        "empty ring is drawn in --color-border-strong and shows at least as clearly as a light " +
        "square Checkbox's border",
      colours.found && colours.tick >= 3 && colours.ringIsToken && colours.ring >= floor,
      `tick ${colours.tick.toFixed(2)}:1, ring ${colours.ring.toFixed(2)}:1, light square ` +
        `${reading.light.square.toFixed(2)}:1 — ${colours.detail}`,
    )
  }

  try {
    await devtools.send("Emulation.setEmulatedMedia", {
      features: [{ name: "forced-colors", value: "active" }],
    })
    const forced = await devtools.evaluate<{ tick: string; text: string } | null>(`(async () => {
      const box = document.querySelector('${ROUND_CHECK}')
      if (!box) return null
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const wasChecked = box.checked
      box.checked = true
      const tick = getComputedStyle(box, "::after").borderRightColor
      box.checked = wasChecked
      const probe = document.createElement("div")
      probe.style.color = "CanvasText"
      document.body.appendChild(probe)
      const text = getComputedStyle(probe).color
      probe.remove()
      return { tick, text }
    })()`)
    check(
      "with forced colours a round Checkbox draws its tick in the system text colour",
      forced !== null && forced.tick === forced.text,
      JSON.stringify(forced),
    )
  } finally {
    await devtools.send("Emulation.setEmulatedMedia", { features: [] })
  }
}

/**
 * A keyboard-focused round box's outline in one palette, as {@link roundCheckboxFocusRingChecks}
 * reads it.
 */
interface RoundBoxRing {
  focused: boolean
  focusVisible: boolean
  style: string
  width: string
  /** Whether the outline is drawn in the palette's `--color-ring`. */
  ringIsToken: boolean
  /** The outline against what the page paints behind the box. */
  behind: number
  /** The outline against `--color-surface` and `--color-canvas`. */
  surface: number
  canvas: number
  detail: string
}

/**
 * A round `Checkbox` reached by a real Tab press draws the components' focus ring (#621): a solid
 * 2 px outline in the palette's `--color-ring`, the colour `ring-focus` gives other components,
 * in the light, dark and ink palettes, and not the browser's own focus colour. Ink sets no
 * `--color-ring`, so there the box keeps the dark accent like every `ring-focus` component, while
 * `.btn` draws ink's `--color-focus-ring`. The contrast of that outline against the card behind
 * the box, the surface and the canvas is reported in the check's detail and held to 3:1, the
 * floor for a focus indicator.
 *
 * The palette is switched while the box keeps its focus; the `dark` class and the earlier
 * `data-theme` value are put back in `finally`.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function roundCheckboxFocusRingChecks(devtools: Devtools): Promise<void> {
  const read = (palette: "light" | "dark" | "ink") =>
    devtools.evaluate<RoundBoxRing | null>(`(async () => {
    ${CONTRAST_HELPERS}
    const box = document.querySelector('${ROUND_CHECK}')
    if (!box) return null
    const root = document.documentElement
    root.classList.toggle("dark", ${palette !== "light"})
    if (${palette === "ink"}) root.setAttribute("data-theme", "ink")
    else root.removeAttribute("data-theme")
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const token = (name) => {
      const probe = document.createElement("div")
      probe.style.color = "var(" + name + ")"
      box.parentElement.appendChild(probe)
      const colour = getComputedStyle(probe).color
      probe.remove()
      return colour
    }
    const style = getComputedStyle(box)
    const outline = style.outlineColor
    const ring = token("--color-ring")
    const surface = token("--color-surface")
    const canvas = token("--color-canvas")
    return {
      focused: document.activeElement === box,
      focusVisible: box.matches(":focus-visible"),
      style: style.outlineStyle,
      width: style.outlineWidth,
      ringIsToken: paint(outline).every((channel, index) => channel === paint(ring)[index]),
      behind: seenRatio(box, outline, { outside: true }),
      surface: contrast(outline, surface),
      canvas: contrast(outline, canvas),
      detail: "outline " + outline + ", --color-ring " + ring + ", surface " + surface +
        ", canvas " + canvas,
    }
  })()`)

  const was = await devtools.evaluate<{ dark: boolean; theme: string | null }>(`({
    dark: document.documentElement.classList.contains("dark"),
    theme: document.documentElement.getAttribute("data-theme"),
  })`)
  try {
    // Focus the square box above it, then Tab: a real key press, so the round box matches
    // `:focus-visible` the way it does for a keyboard user.
    await devtools.evaluate<null>(`(document.querySelector('${SQUARE_CHECK}')?.focus(), null)`)
    await pressKey(devtools, "Tab")
    for (const palette of ["light", "dark", "ink"] as const) {
      const ring = await read(palette)
      check(
        `in the ${palette} palette a round Checkbox reached by Tab draws a 2 px outline in ` +
          "--color-ring that clears 3:1 against the card, the surface and the canvas",
        ring !== null && ring.focused && ring.focusVisible && ring.style === "solid" &&
          ring.width === "2px" && ring.ringIsToken && ring.behind >= 3 && ring.surface >= 3 &&
          ring.canvas >= 3,
        ring === null ? "no round box in the Checkbox card" : `card ${ring.behind.toFixed(2)}:1, ` +
          `surface ${ring.surface.toFixed(2)}:1, canvas ${ring.canvas.toFixed(2)}:1 — ` +
          JSON.stringify(ring),
      )
    }
  } finally {
    await devtools.evaluate<null>(`(() => {
      const root = document.documentElement
      root.classList.toggle("dark", ${was.dark})
      const theme = ${JSON.stringify(was.theme)}
      if (theme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", theme)
      document.activeElement?.blur()
      return null
    })()`)
  }
}
