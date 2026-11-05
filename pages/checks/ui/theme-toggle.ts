import { guidePages } from "@spy4x/preact-ui-guide/registry"
import { IconMoon, IconSun, IconThemeAuto } from "@spy4x/preact-icons"
import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  openGuidePage,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import { linkFocusRingCheck } from "./shared-links.ts"

/** The `ThemeToggle` card's button, its live region and its readout. */
const THEME_TOGGLE = `document.querySelector("#demo-ThemeToggle")`

/**
 * An icon's drawing as a string: each child element of its `<svg>` with its attributes, sorted.
 * Built here from the icon component itself and in the page from the DOM by the same rule, so the
 * check knows which glyph the button shows without the component marking it.
 *
 * @param icon One of the icon components.
 */
function iconDrawing(icon: (props: Record<string, never>) => unknown): string {
  type Node = { type: unknown; props: Record<string, unknown> }
  const svg = icon({}) as Node
  const children = [svg.props.children].flat(Infinity) as unknown[]
  return children
    .filter((child): child is Node =>
      typeof child === "object" && child !== null && typeof (child as Node).type === "string"
    )
    .map((child) =>
      `${child.type} ${
        Object.entries(child.props)
          .filter(([name]) => name !== "children")
          .map(([name, value]) => `${name}=${value}`)
          .sort()
          .join(" ")
      }`
    )
    .join("|")
}

/** What the ThemeToggle card reads at one instant. */
interface ThemeToggleReading {
  found: boolean
  /** The button's accessible name. */
  name: string
  /** The glyph inside the button, by {@link iconDrawing}'s rule. */
  drawing: string
  /** The live region's text. */
  hint: string
  /** Whether the hint bubble has a box on screen. */
  hintShown: boolean
  /** Whether the button has focus. */
  focused: boolean
  /** Whether the live region is the same element it was when the run started. */
  sameRegion: boolean
  /** The toggle's wrapper box and the button's box, `x,y,w,h`, rounded. */
  wrapperBox: string
  buttonBox: string
  /** `prefers-color-scheme: dark` as the page sees it. */
  deviceDark: boolean
}

/**
 * Reads a {@link ThemeToggleReading}. `sameRegion` compares the live region with the one
 * {@link themeToggleChecks} remembered before the first press.
 */
const THEME_TOGGLE_STATE = `(() => {
  const card = ${THEME_TOGGLE}
  const button = card?.querySelector("button")
  const region = card?.querySelector('[role="status"]')
  if (!button) {
    return { found: false, name: "", drawing: "", hint: "", hintShown: false, focused: false,
      sameRegion: false, wrapperBox: "", buttonBox: "", deviceDark: false }
  }
  const box = (element) => {
    const r = element.getBoundingClientRect()
    return [r.x, r.y, r.width, r.height].map(Math.round).join(",")
  }
  const svg = button.querySelector("svg")
  const drawing = [...(svg?.children ?? [])]
    .map((child) => child.tagName.toLowerCase() + " " +
      [...child.attributes].map((a) => a.name + "=" + a.value).sort().join(" "))
    .join("|")
  const bubble = region?.firstElementChild
  const bubbleBox = bubble?.getBoundingClientRect()
  return {
    found: true,
    name: button.getAttribute("aria-label") ?? "",
    drawing,
    hint: region?.textContent ?? "",
    hintShown: !!bubbleBox && bubbleBox.width > 0 && bubbleBox.height > 0 &&
      getComputedStyle(bubble).visibility === "visible",
    focused: document.activeElement === button,
    sameRegion: !!region && globalThis.__verifyThemeToggleRegion === region,
    wrapperBox: box(button.parentElement),
    buttonBox: box(button),
    deviceDark: matchMedia("(prefers-color-scheme: dark)").matches,
  }
})()`

/** How one step presses the button. */
type ThemeTogglePress = "click" | "Enter" | "Space"

/**
 * Press the ThemeToggle once: a real mouse click at its centre, or a real key press with focus on
 * it.
 *
 * @param devtools The connected session.
 * @param press How to press it.
 */
async function pressThemeToggle(devtools: Devtools, press: ThemeTogglePress): Promise<void> {
  if (press === "click") {
    const at = await devtools.evaluate<{ x: number; y: number }>(`(() => {
      const r = ${THEME_TOGGLE}.querySelector("button").getBoundingClientRect()
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    })()`)
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        ...at,
        button: type === "mouseMoved" ? "none" : "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: type === "mouseMoved" ? 0 : 1,
      })
    }
    return
  }
  await devtools.evaluate(`(${THEME_TOGGLE}.querySelector("button").focus(), null)`)
  await pressKey(devtools, press)
}

/** One step of a cycle: how it is pressed, and the name and glyph it must land on. */
interface ThemeToggleStep {
  press: ThemeTogglePress
  name: string
  drawing: string
}

/** The hint's text and its bubble in one palette. */
interface HintContrast {
  text: number[]
  fill: number[]
  ratio: number
}

/**
 * The "Auto mode" hint's text against its bubble, in the light and the dark palette, read while
 * the hint is up. The palette is the page's `dark` class, put back afterwards.
 *
 * @param devtools The connected session, with the hint on screen.
 */
async function themeToggleHintContrast(
  devtools: Devtools,
): Promise<{ found: boolean; light: HintContrast; dark: HintContrast }> {
  return await devtools.evaluate(`(() => {
    ${CONTRAST_HELPERS}
    const none = { text: [], fill: [], ratio: 0 }
    const bubble = ${THEME_TOGGLE}?.querySelector('[role="status"] > span')
    if (!bubble) return { found: false, light: none, dark: none }
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const read = (dark) => {
      root.classList.toggle("dark", dark)
      const { text, ground: fill } = seen(bubble)
      return { text, fill, ratio: ratio(text, fill) }
    }
    const light = read(false)
    const dark = read(true)
    root.classList.toggle("dark", wasDark)
    return { found: true, light, dark }
  })()`)
}

/**
 * `ThemeToggle` on an emulated dark device and on a light one: a full cycle with a real click,
 * Enter and Space, the glyph and the accessible name at every step, and the "Auto mode" hint on
 * the step back to auto — announced through the live region rendered from the start, shown
 * without moving the button or taking focus, gone after its two seconds. On the light device a
 * press while the hint is up hides it at once, and the next switch to auto shows it again. Then the
 * hint's text contrast in both palettes, the button's focus ring, and where the hint lands on a
 * phone-wide page.
 *
 * The card's store keeps nothing and paints nothing, so pressing it leaves the guide's own palette
 * alone; the emulated colour scheme is cleared afterwards.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function themeToggleChecks(devtools: Devtools): Promise<void> {
  const glyph = {
    auto: iconDrawing(IconThemeAuto),
    light: iconDrawing(IconSun),
    dark: iconDrawing(IconMoon),
  }
  const read = () => devtools.evaluate<ThemeToggleReading>(THEME_TOGGLE_STATE)
  const describe = (r: ThemeToggleReading) =>
    `name "${r.name}", glyph ${
      Object.entries(glyph).find(([, drawing]) => drawing === r.drawing)?.[0] ?? "unknown"
    }, hint "${r.hint}", focused ${r.focused}`

  await openGuidePage(devtools, "ui")
  await centreInView(devtools, THEME_TOGGLE)
  await pointerToCorner(devtools)
  // The live region before any press: a region that is missing now, or replaced later, is not it.
  await devtools.evaluate(
    `(globalThis.__verifyThemeToggleRegion =
      ${THEME_TOGGLE}?.querySelector('[role="status"]') ?? null, null)`,
  )

  try {
    for (const device of ["dark", "light"] as const) {
      const other = device === "dark" ? "light" : "dark"
      await devtools.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: device }],
      })
      const autoName = `Theme: auto (${device})`
      const ready = await poll(async () => {
        const r = await read()
        return r.deviceDark === (device === "dark") && r.name === autoName
      }, 3_000)
      const start = await read()
      check(
        `on a ${device} device ThemeToggle starts on auto, with the auto glyph and "${autoName}"`,
        ready && start.drawing === glyph.auto && start.hint === "",
        describe(start),
      )

      const steps: ThemeToggleStep[] = [
        { press: "click", name: `Theme: ${other}`, drawing: glyph[other] },
        { press: "Enter", name: `Theme: ${device}`, drawing: glyph[device] },
        { press: "Space", name: autoName, drawing: glyph.auto },
      ]
      for (const [index, step] of steps.entries()) {
        await pressThemeToggle(devtools, step.press)
        const landed = await poll(async () => (await read()).name === step.name, 2_000)
        const after = await read()
        const toAuto = index === steps.length - 1
        check(
          `on a ${device} device, ${step.press} on ThemeToggle moves to "${step.name}" with its ` +
            "glyph, keeping focus",
          landed && after.drawing === step.drawing && after.focused,
          describe(after),
        )
        if (!toAuto) {
          check(
            `on a ${device} device, ThemeToggle shows no hint on the step to "${step.name}"`,
            after.hint === "" && !after.hintShown,
            describe(after),
          )
        }
      }

      await hintAppearsAndGoes(read, start, `on a ${device} device`, describe)

      if (device === "light") {
        // Back to auto with the hint up, then one more press: the hint must go at once.
        await pressThemeToggle(devtools, "click")
        await pressThemeToggle(devtools, "Enter")
        await pressThemeToggle(devtools, "Space")
        const shown = await poll(async () => (await read()).hint === "Auto mode", 1_500)
        const contrast = await themeToggleHintContrast(devtools)
        await pressThemeToggle(devtools, "Space")
        const hidden = await read()
        check(
          "a press on ThemeToggle while its hint is up hides the hint at once",
          shown && hidden.name === "Theme: dark" && hidden.hint === "" && !hidden.hintShown,
          shown ? describe(hidden) : "the hint never came up on the switch back to auto",
        )
        const show = (name: string, c: HintContrast) =>
          `${name}: text rgb(${c.text}) on rgb(${c.fill}) ${c.ratio.toFixed(2)}:1`
        check(
          "ThemeToggle's hint text stands 4.5:1 off its bubble, in light and dark",
          contrast.found && contrast.light.ratio >= 4.5 && contrast.dark.ratio >= 4.5,
          contrast.found
            ? `${show("light", contrast.light)}; ${show("dark", contrast.dark)}`
            : "no hint bubble to measure",
        )
        // And the next switch to auto shows it again, with a fresh timer.
        await pressThemeToggle(devtools, "Enter")
        await pressThemeToggle(devtools, "Space")
        await hintAppearsAndGoes(read, start, "after a hidden hint", describe)
      }
    }
  } finally {
    await devtools.send("Emulation.setEmulatedMedia", { features: [] })
    await pointerToCorner(devtools)
  }

  await themeToggleUnmountCheck(devtools)
  await openGuidePage(devtools, "ui")
  await centreInView(devtools, THEME_TOGGLE)
  await linkFocusRingCheck(devtools, {
    selector: "#demo-ThemeToggle button",
    name: "ThemeToggle button",
  })
  await themeTogglePlacementChecks(devtools)
}

/** Where one ThemeToggle's hint landed, against its button and the viewport. */
interface ThemeTogglePlacement {
  shown: boolean
  bubbleLeft: number
  bubbleRight: number
  buttonLeft: number
  buttonRight: number
  viewport: number
}

/**
 * At a 375px phone width, each of the card's two ThemeToggles is pressed back to auto and its hint
 * measured: the one at the start of a row slides inside the viewport, and the one at the end of a
 * header keeps its end edge on the button's, because it fits there as it is.
 *
 * @param devtools The connected session, on the `ui` page with a fresh card on auto.
 */
async function themeTogglePlacementChecks(devtools: Devtools): Promise<void> {
  const rows = [
    {
      name: "at the start of a row",
      wrapper: `${THEME_TOGGLE}?.querySelector("button")?.parentElement`,
    },
    {
      name: "at the end of a header",
      wrapper: `${THEME_TOGGLE}?.querySelector('[data-e2e="theme-toggle-header"] button')` +
        "?.parentElement",
    },
  ] as const
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    for (const row of rows) {
      await centreInView(devtools, row.wrapper)
      // From auto, three presses come back to auto, and only this button's own presses show its hint.
      await devtools.evaluate(`(() => {
        const button = ${row.wrapper}?.querySelector("button")
        for (let press = 0; press < 3; press++) button?.click()
        return null
      })()`)
      const measure = `(() => {
        const wrapper = ${row.wrapper}
        const bubble = wrapper?.querySelector('[role="status"]')?.firstElementChild
        const button = wrapper?.querySelector("button")
        const b = bubble?.getBoundingClientRect()
        const k = button?.getBoundingClientRect()
        return {
          shown: !!b && b.width > 0,
          bubbleLeft: Math.round(b?.left ?? 0),
          bubbleRight: Math.round(b?.right ?? 0),
          buttonLeft: Math.round(k?.left ?? 0),
          buttonRight: Math.round(k?.right ?? 0),
          viewport: document.documentElement.clientWidth,
        }
      })()`
      await poll(async () => (await devtools.evaluate<ThemeTogglePlacement>(measure)).shown, 1_500)
      const at = await devtools.evaluate<ThemeTogglePlacement>(measure)
      const inside = at.shown && at.bubbleLeft >= 0 && at.bubbleRight <= at.viewport
      const detail = at.shown
        ? `bubble ${at.bubbleLeft}–${at.bubbleRight}, button ${at.buttonLeft}–` +
          `${at.buttonRight}, viewport 0–${at.viewport}`
        : "the hint never came up"
      if (row.name === "at the start of a row") {
        check(
          `at 375px, the hint of a ThemeToggle ${row.name} stays wholly inside the viewport`,
          inside,
          detail,
        )
      } else {
        check(
          `at 375px, the hint of a ThemeToggle ${row.name} fits as it is, end edge on the button's`,
          inside && at.bubbleRight === at.buttonRight,
          detail,
        )
      }
    }
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/**
 * Right after a press that moved ThemeToggle to auto: the hint comes up in the live region that
 * was there from the start, the button keeps its box and its focus, and the hint goes on its own
 * after its two seconds: not before 1.5 seconds and not after 3.
 *
 * @param read Reads the card.
 * @param start A reading from before any press, for the boxes and the region.
 * @param when How the check names the situation.
 * @param describe Formats a reading for a failure.
 */
async function hintAppearsAndGoes(
  read: () => Promise<ThemeToggleReading>,
  start: ThemeToggleReading,
  when: string,
  describe: (reading: ThemeToggleReading) => string,
): Promise<void> {
  const pressed = Date.now()
  const shown = await poll(async () => {
    const r = await read()
    return r.hint === "Auto mode" && r.hintShown
  }, 1_500)
  const during = await read()
  check(
    `${when}, the switch to auto shows "Auto mode" in the live region that was there from the ` +
      "start, without moving the button or taking its focus",
    shown && during.sameRegion && during.focused &&
      during.wrapperBox === start.wrapperBox && during.buttonBox === start.buttonBox,
    `${describe(during)}, same region ${during.sameRegion}, wrapper ${start.wrapperBox} → ` +
      `${during.wrapperBox}, button ${start.buttonBox} → ${during.buttonBox}`,
  )
  const gone = await poll(async () => {
    const r = await read()
    return r.hint === "" && !r.hintShown
  }, 3_500)
  const after = Date.now() - pressed
  check(
    `${when}, ThemeToggle's hint goes on its own after about two seconds`,
    shown && gone && after >= 1_500 && after <= 3_000,
    gone ? `gone ${after}ms after the press` : `still up ${after}ms after the press`,
  )
}

/**
 * A ThemeToggle that leaves the page while its hint is up clears the hint's timer. The page's
 * `setTimeout` and `clearTimeout` are wrapped for the length of the check to see the timer the
 * press starts, then the guide shows another page, which unmounts the card.
 *
 * @param devtools The connected session, on the `ui` page.
 */
async function themeToggleUnmountCheck(devtools: Devtools): Promise<void> {
  const started = await devtools.evaluate<boolean>(`(async () => {
    const frames = () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    const watch = { created: [], cleared: [], setTimeout, clearTimeout }
    globalThis.__verifyThemeToggleTimers = watch
    globalThis.setTimeout = (callback, ms, ...rest) => {
      const id = watch.setTimeout.call(globalThis, callback, ms, ...rest)
      if (ms === 2000) watch.created.push(id)
      return id
    }
    globalThis.clearTimeout = (id) => {
      watch.cleared.push(id)
      return watch.clearTimeout.call(globalThis, id)
    }
    const button = ${THEME_TOGGLE}?.querySelector("button")
    if (!button) return false
    // From auto, three presses come back to auto and start the hint's timer.
    for (let press = 0; press < 3; press++) button.click()
    for (let wait = 0; wait < 20 && watch.created.length === 0; wait++) await frames()
    return watch.created.length > 0
  })()`)
  const other = guidePages.find((page) => page.id !== "ui")?.id ?? "ui"
  await openGuidePage(devtools, other)
  const result = await devtools.evaluate<{ created: number; cleared: boolean; gone: boolean }>(
    `(() => {
      const watch = globalThis.__verifyThemeToggleTimers
      globalThis.setTimeout = watch.setTimeout
      globalThis.clearTimeout = watch.clearTimeout
      delete globalThis.__verifyThemeToggleTimers
      const id = watch.created.at(-1)
      return {
        created: watch.created.length,
        cleared: id !== undefined && watch.cleared.includes(id),
        gone: ${THEME_TOGGLE} === null,
      }
    })()`,
  )
  check(
    "a ThemeToggle that unmounts while its hint is up clears the hint's timer",
    started && result.gone && result.cleared,
    !started
      ? "the presses started no two-second timer"
      : `${result.created} two-second timer(s) started; card gone ${result.gone}, last timer ` +
        `cleared ${result.cleared}`,
  )
}
