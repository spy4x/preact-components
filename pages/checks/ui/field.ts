import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  PAGE_UNTIL,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import { inlineEditState, REPAINTED_DANGER } from "./shared.ts"
import { typeInto } from "./shared-typing.ts"

/** `Field`'s wiring of its label, control and messages. */
export async function fieldChecks(devtools: Devtools): Promise<void> {
  // The `Fields` section's primitives: what `Field` wires is exactly what the browser makes
  // observable — the label's `for`, the control's `id`, and the ids of the messages the control
  // describes itself by, including the one it stops describing itself by once the error clears.
  const fields = await devtools.evaluate<{
    echoBefore: string
    echoAfter: string
    controlId: string
    labelFor: string
    beforeInvalid: string | null
    beforeDescribedBy: string
    afterInvalid: string | null
    afterDescribedBy: string
    errorText: string
  }>(`(async () => {
    const echo = () =>
      document.querySelector('#demo-Field [data-e2e="controlled-value"]').textContent.trim()
    const email = document.querySelector("#demo-Field input[type=email]")
    const read = () => ({
      invalid: email.getAttribute("aria-invalid"),
      describedBy: email.getAttribute("aria-describedby") ?? "",
    })

    const echoBefore = echo()
    const before = read()
    email.value = "ada@example.com"
    email.dispatchEvent(new Event("input", { bubbles: true }))
    await ${PAGE_UNTIL}(() => echo().includes("ada@example.com") && read().invalid === null)

    return {
      echoBefore,
      echoAfter: echo(),
      controlId: email.id,
      labelFor: document.querySelector("#demo-Field label[for='guide-email']")?.getAttribute("for") ?? "",
      beforeInvalid: before.invalid,
      beforeDescribedBy: before.describedBy,
      afterInvalid: read().invalid,
      afterDescribedBy: read().describedBy,
      errorText: document.querySelector("#guide-email-error")?.textContent ?? "",
    }
  })()`)
  check(
    "typing into a `Field`'s control drives the demo's controlled value",
    fields.echoBefore !== fields.echoAfter && fields.echoAfter.includes("ada@example.com"),
    fields.echoAfter,
  )
  check(
    "`Field` wires the label's `for` to the control's `id`",
    fields.controlId === "guide-email" && fields.labelFor === "guide-email",
    `for="${fields.labelFor}" id="${fields.controlId}"`,
  )
  check(
    "`Field` describes the control by its error and its hint, and drops the error once it clears",
    fields.beforeInvalid === "true" &&
      fields.beforeDescribedBy === "guide-email-error guide-email-hint" &&
      fields.afterInvalid === null && fields.afterDescribedBy === "guide-email-hint" &&
      fields.errorText === "",
    `invalid=${fields.beforeInvalid} "${fields.beforeDescribedBy}" → ` +
      `invalid=${fields.afterInvalid} "${fields.afterDescribedBy}"`,
  )
}

/** One field error message's text, measured in one palette. */
interface FieldErrorContrast {
  /** The component that renders the message. */
  name: string
  /** Whether the message was found in the catalogue. */
  found: boolean
  /** Against the card behind it, the palette's page canvas and its raised surface. */
  onBackdrop: number
  onCanvas: number
  onSurface: number
  /** Against ink's rail and active-row surfaces; the canvas figure again in the other palettes. */
  onExtra: number
  /** The message's colour as the browser computes it. */
  color: string
  /** Whether that colour paints the same pixel as `--color-danger` in this palette. */
  isDanger: boolean
}

/** Both palettes' readings of every field error message, and the colour after a repaint. */
interface FieldErrorReading {
  light: FieldErrorContrast[]
  dark: FieldErrorContrast[]
  /** The opt-in dark `data-theme="ink"` palette. */
  ink: FieldErrorContrast[]
  /**
   * Each message's colour, in the light and the dark palette, while the root sets
   * `--color-danger` to {@link REPAINTED_DANGER}.
   */
  repainted: { name: string; color: string; follows: boolean }[]
}

/**
 * The error text of `Field`, `ToggleField`, `FileInput` and `InlineEdit` is drawn with
 * `text-danger` (#507): in the light, the dark and the ink palette it paints `--color-danger` and
 * reaches 4.5:1 against the card behind it, the canvas and the surface (in ink also its rail and
 * active-row surfaces), and an app that repaints
 * `--color-danger` gets its own colour in every message, in both palettes. `FileInput` is read off its refusal region,
 * which carries the same classes as its `error` paragraph and is the one of the two the catalogue
 * renders; the `Field` demo's email is set to an invalid address for the reading and put back
 * after, and the failing `InlineEdit` is saved once so its alert shows, then abandoned with Escape.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function fieldErrorContrastCheck(devtools: Devtools): Promise<void> {
  const fail = inlineEditState("inline-edit-fail")
  const failTrigger =
    `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-fail"] button')`
  await centreInView(devtools, failTrigger)
  await devtools.evaluate<null>(`(${failTrigger}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${fail}.onField`), 2_000)
  await typeInto(devtools, "Contrast")
  await pressKey(devtools, "Enter")
  await poll(() => devtools.evaluate<boolean>(`${fail}.alert !== ""`), 2_000)
  await pointerToCorner(devtools)

  const reading = await devtools.evaluate<FieldErrorReading>(`(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const wasTheme = root.getAttribute("data-theme")
    const email = document.querySelector("#demo-Field input[type=email]")
    const emailBefore = email?.value ?? ""
    const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    const setEmail = async (value) => {
      if (!email) return
      email.value = value
      email.dispatchEvent(new Event("input", { bubbles: true }))
      await frames()
    }
    const messages = () => [
      ["Field", document.querySelector("#guide-email-error")],
      ["ToggleField", document.querySelector("#guide-toggle-error-error")],
      ["FileInput", document.querySelector("#guide-file-input-rejection")],
      ["InlineEdit", document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-fail"] [role="alert"]')],
    ]
    const token = (name) => {
      const probe = document.createElement("div")
      probe.style.backgroundColor = "var(" + name + ")"
      document.body.appendChild(probe)
      const color = paint(getComputedStyle(probe).backgroundColor)
      probe.remove()
      return color
    }
    const settle = () => Promise.all(
      messages().flatMap(([, element]) =>
        element ? element.getAnimations().map((animation) => animation.finished.catch(() => {})) : []
      ),
    )
    const same = (a, b) => a.every((channel, index) => channel === b[index])
    const measure = (extras = ["--color-canvas"]) => {
      const canvas = token("--color-canvas")
      const surface = token("--color-surface")
      const danger = token("--color-danger")
      return messages().map(([name, element]) => {
        if (!element) {
          return { name, found: false, onBackdrop: 0, onCanvas: 0, onSurface: 0, onExtra: 0, color: "", isDanger: false }
        }
        const text = paint(getComputedStyle(element).color)
        return {
          name,
          found: true,
          onBackdrop: seenRatio(element),
          onCanvas: ratio(text, canvas),
          onSurface: ratio(text, surface),
          onExtra: Math.min(...extras.map((extra) => ratio(text, token(extra)))),
          color: getComputedStyle(element).color,
          isDanger: same(text, danger),
        }
      })
    }
    try {
      await setEmail("not-an-address")
      root.classList.remove("dark")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      root.setAttribute("data-theme", "ink")
      await settle()
      const ink = measure(["--color-surface-rail", "--color-surface-active"])
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)
      await settle()
      root.style.setProperty("--color-danger", ${JSON.stringify(REPAINTED_DANGER)})
      await settle()
      const wanted = paint(${JSON.stringify(REPAINTED_DANGER)})
      const readRepainted = (palette) => messages().map(([name, element]) => {
        const color = element ? getComputedStyle(element).color : "missing"
        return { name: palette + " " + name, color, follows: element !== null && same(paint(color), wanted) }
      })
      const repaintedDark = readRepainted("dark")
      root.classList.remove("dark")
      await settle()
      const repainted = [...readRepainted("light"), ...repaintedDark]
      return { light, dark, ink, repainted }
    } finally {
      root.style.removeProperty("--color-danger")
      root.classList.toggle("dark", wasDark)
      if (wasTheme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", wasTheme)
      await setEmail(emailBefore)
    }
  })()`)

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`!${fail}.editing`), 2_000)

  const lowest = (message: FieldErrorContrast) =>
    Math.min(message.onBackdrop, message.onCanvas, message.onSurface, message.onExtra)
  const table = (messages: FieldErrorContrast[]) =>
    messages.map((message) =>
      message.found
        ? `${message.name} ${message.color} ${message.onBackdrop.toFixed(2)}/` +
          `${message.onCanvas.toFixed(2)}/${message.onSurface.toFixed(2)}/` +
          message.onExtra.toFixed(2)
        : `${message.name} missing`
    ).join(", ")
  for (const palette of ["light", "dark", "ink"] as const) {
    check(
      `in the ${palette} palette every field error message paints --color-danger at 4.5:1 or ` +
        "better on the card, canvas and surface" +
        (palette === "ink" ? ", rail and active row" : ""),
      reading[palette].every((message) =>
        message.found && message.isDanger && lowest(message) >= 4.5
      ),
      `card/canvas/surface/${palette === "ink" ? "lower of rail and active" : "canvas"} — ` +
        `${palette}: ${table(reading[palette])}`,
    )
  }
  check(
    "in the light and the dark palette every field error message follows an app's repainted " +
      "--color-danger",
    reading.repainted.every((message) => message.follows),
    reading.repainted.map((message) => `${message.name} ${message.color}`).join(", "),
  )
}
