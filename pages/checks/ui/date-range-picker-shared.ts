import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import { clickAtPoint } from "./shared-forms.ts"

/**
 * How long {@link settledActiveElement} waits before it starts comparing reads.
 *
 * The two-reads-100ms-apart loop below only proves focus held still for one interval; started
 * immediately, both of those reads can land before a wrong refocus that is merely a little late —
 * #265's second review measured one arriving 250ms after the panel reported closed, and a caller
 * using only the loop, with no floor, reported "settled" against that mid-transition value 2 of 2
 * runs. This floor has to be comfortably past that 250ms for the loop's first read to start only
 * once a late refocus has already happened, so a wrong one shows up as a real change instead of
 * being outrun.
 */
const FOCUS_SETTLE_FLOOR_MS = 400

/**
 * Wait past a late refocus effect, then wait until two reads of `document.activeElement`, one
 * `poll` retry interval (100ms) apart, name the same element — the same "two consecutive reads
 * agree" pattern {@link settledScroll} uses, applied to focus instead of scroll position, behind a
 * fixed {@link FOCUS_SETTLE_FLOOR_MS} floor.
 *
 * The floor is what the 100ms-apart loop alone cannot promise: that loop guarantees only that focus
 * did not change during the one interval it measured, and starting it the moment the panel reports
 * closed can measure an interval that is entirely before a wrong refocus arrives, which is exactly
 * what #265's second review found for a refocus delayed 250ms — the loop is deliberately unchanged
 * here, since #265 does not blame its shape, only what ran it too early. Even with the floor, this
 * cannot guarantee focus will never change again after the moment it returns — nothing short of
 * waiting out every timer and microtask a page could still have queued could promise that. What it
 * is for is narrower and is enough for its callers: a check that proves an *absence* — that a close
 * driven from outside a panel does not pull focus onto the trigger — cannot tell "hasn't happened
 * yet" from "correctly never happens" by reading once right after the panel reads closed. Closing
 * the panel and the effect that would wrongly move focus afterward are two separate Preact commits,
 * and a read timed between them reports whatever focus happens to be resting on mid-transition,
 * which can, by coincidence, look like the correct outcome even when the wrong one is a commit away.
 * Confirmed by breaking it: with a bug that always pulls focus back onto the trigger reintroduced, a
 * caller that read `document.activeElement` immediately after `closed` — no wait at all — reported
 * "ok" 3 of 3 runs; the same caller waiting on this function's own return value read the pulled-back
 * focus and reported the bug every time. **Its return value has to be checked**: a caller that calls
 * this and reads `document.activeElement` anyway without looking at what came back has proven
 * nothing more than the immediate read already did.
 *
 * @param devtools The connected session.
 * @param timeoutMs How long to wait, after the floor, for two consecutive reads to agree before
 * giving up.
 * @returns Whether two consecutive reads, 100ms apart, agreed inside the budget once the floor had
 * passed — `false` when focus was still changing when the budget ran out, which a caller must treat
 * as its own failure rather than press on and read a value this function never confirmed had
 * settled.
 */
export async function settledActiveElement(
  devtools: Devtools,
  timeoutMs = 3_000,
): Promise<boolean> {
  // A fixed floor, not a poll: it waits out a wrong refocus that may still come, an absence the
  // JSDoc above explains.
  await new Promise((resolve) => setTimeout(resolve, FOCUS_SETTLE_FLOOR_MS))
  let previous: string | null = null
  return await poll(async () => {
    const current = await devtools.evaluate<string>(`(() => {
      const active = document.activeElement
      return active === document.body
        ? "BODY"
        : (active?.getAttribute?.("data-e2e") ?? active?.tagName ?? "?")
    })()`)
    const settled = current === previous
    previous = current
    return settled
  }, timeoutMs)
}

/**
 * One of the two DateRangePicker demos the checks below drive the same way: the day-only picker
 * parked by {@link PICKER_SETUP} and the `withTime` one parked by {@link PICKER_TIME_SETUP}.
 */
export interface PickerMode {
  /** Completes check names: "an open DateRangePicker", "an open withTime panel". */
  subject: string
  /** The `globalThis` key the mode's setup parked its trigger and panel under. */
  parked: "__verifyPicker" | "__verifyPickerTime"
  /** Opens the panel and waits for focus to land inside it. */
  open: (devtools: Devtools) => Promise<{ open: boolean; inPanel: boolean; label: string }>
}

/** Where focus is relative to one parked picker, read in one round trip. */
interface PickerFocus {
  /** `false` when the setup parked no trigger or panel. */
  ok: boolean
  open: boolean
  /** Focus is inside the component's root: the trigger or the panel. */
  inRoot: boolean
  inPanel: boolean
  onTrigger: boolean
  /** Focus is on the page itself — nothing focused. */
  onBody: boolean
  /** The focused element's `data-e2e`, or `""`. */
  e2e: string
  /** The focused element's text, test hook or tag, cut short, for the failure message. */
  label: string
}

/**
 * The page expression that reads a {@link PickerFocus}. The component's root is the trigger's
 * parent, which is how the component renders it: the trigger and the panel are its two children.
 */
function pickerFocus(mode: PickerMode): string {
  return `(() => {
    const { trigger, panel } = globalThis.${mode.parked} ?? {}
    const root = trigger?.parentElement ?? null
    const active = document.activeElement
    const label = active === document.body
      ? "the page"
      : ((active?.textContent ?? "").trim() || active?.getAttribute?.("data-e2e") ||
        (active?.tagName ?? ""))
    return {
      ok: Boolean(trigger) && Boolean(panel) && root !== null,
      open: Boolean(panel) && !panel.hasAttribute("hidden") &&
        panel.getBoundingClientRect().height > 0,
      inRoot: root?.contains(active) ?? false,
      inPanel: panel?.contains(active) ?? false,
      onTrigger: active === trigger,
      onBody: active === document.body,
      e2e: active?.getAttribute?.("data-e2e") ?? "",
      label: String(label).slice(0, 40),
    }
  })()`
}

/**
 * Tab through an open panel and out of it (#198): every press inside keeps the panel open, and the
 * press that leaves closes it and leaves focus where it went.
 *
 * Real Tab presses, so the browser's own focus navigation decides every step — including the steps
 * through a native date field's own segments, which move focus inside the field's shadow tree while
 * the field stays the document's active element. Where the last press lands is the catalogue page's
 * tab order, not this component's, so the check does not name it: it asserts only that it is outside
 * the component, is a real control rather than the page, and still has focus once everything has
 * settled — a close that pulled focus back onto the trigger would fail the last part.
 *
 * @param devtools The connected session, on a hydrated page with the mode's setup already run.
 * @param mode Which picker to drive.
 */
export async function tabThroughPanelChecks(devtools: Devtools, mode: PickerMode): Promise<void> {
  const opened = await mode.open(devtools)
  const walk: PickerFocus[] = []
  // A bound, not an expectation: the day panel takes about ten presses, the timed one about twenty.
  for (let press = 0; press < 40; press++) {
    await pressKey(devtools, "Tab")
    const step = await devtools.evaluate<PickerFocus>(`(() => {
      globalThis.__verifyTabbedTo = document.activeElement
      return ${pickerFocus(mode)}
    })()`)
    walk.push(step)
    if (!step.inRoot) break
  }
  const inside = walk.slice(0, -1)
  const last = walk.at(-1)
  const leftAt = inside.findIndex((step) => !step.open || !step.inPanel)
  const reached = new Set(inside.map((step) => step.e2e))
  const fields = reached.has("date-range-from") && reached.has("date-range-to")

  check(
    `Tab moves focus between an open ${mode.subject}'s own controls without closing it`,
    opened.open && opened.inPanel && inside.length >= 3 && leftAt === -1 && fields,
    !opened.open || !opened.inPanel
      ? "the panel would not open with focus inside, so there is nothing to walk"
      : leftAt !== -1
      ? `Tab press ${leftAt + 1} left the panel ${
        inside[leftAt].open ? "open" : "closed"
      } with focus on ${inside[leftAt].label}, while focus was still inside the component`
      : !fields
      ? `the walk left the component for ${last?.label ?? "nowhere"} with the panel ${
        last?.open ? "open" : "closed"
      } before reaching both date fields (it reached ${[...reached].join(", ")})`
      : `${inside.length} Tab presses inside, the panel open after each, through ` +
        `${[...reached].filter((e2e) => e2e !== "").join(", ")}`,
  )

  const closed = await poll(
    () => devtools.evaluate<boolean>(`${pickerFocus(mode)}.open === false`),
    3_000,
  )
  // See settledActiveElement's own doc: a close that wrongly refocused the trigger does so a
  // commit later, so an immediate read could still find focus where the Tab put it.
  const settled = await settledActiveElement(devtools)
  const after = await devtools.evaluate<PickerFocus & { stayed: boolean }>(`(() => ({
    ...${pickerFocus(mode)},
    stayed: document.activeElement === globalThis.__verifyTabbedTo,
  }))()`)

  check(
    `Tabbing out of an open ${mode.subject} closes it and leaves focus where the Tab went`,
    last !== undefined && !last.inRoot && !last.onBody && closed && settled && after.stayed &&
      !after.onTrigger,
    last === undefined || last.inRoot
      ? `40 Tab presses never took focus out of the component`
      : last.onBody
      ? "the Tab out landed on the page itself rather than a control, so there is nowhere to stay"
      : !closed
      ? `focus went to ${last.label}, outside the component, and the panel was still open 3s later`
      : !settled
      ? "focus was still moving 3s after the Tab out, so this proves nothing about where it settled"
      : after.onTrigger
      ? "the panel closed and pulled focus back onto its trigger, away from where the Tab went"
      : !after.stayed
      ? `the panel closed and focus moved from ${last.label} to ${after.label}`
      : `Tab from inside → ${last.label}: the panel is hidden and focus stayed there`,
  )
}

/**
 * Run `body` with the viewport widened to 1600×900, and restore it afterwards.
 *
 * The `withTime` picker is the third column of its card, and at the harness's own width its open
 * panel runs past the viewport's right edge, so its From field's calendar icon cannot be clicked or
 * photographed there. Widening is what `pages/checks/icons.ts` and `charts.ts` already do for their
 * own layouts.
 */
export async function inWideViewport(devtools: Devtools, body: () => Promise<void>): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    await devtools.evaluate<null>(
      `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))))`,
    )
    await body()
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/** The page expression for the From field of one parked picker's panel. */
function fromField(mode: PickerMode): string {
  return `globalThis.${mode.parked}?.panel?.querySelector('[data-e2e="date-range-from"]')`
}

/**
 * A date field's own picker keeps the panel open (#198): a real click on the From field's calendar
 * icon, then the window blur a native picker's popup causes, and the panel is still open with focus
 * on the field.
 *
 * The popup is the browser's, drawn outside the page, and the headless browser this runs in was
 * measured keeping `document.hasFocus()` true after the click, so nothing here can see a popup
 * open. What a popup does to the page in a browser with a window is send the focused field a
 * `focusout` with no `relatedTarget` while the field stays the document's active element; the
 * check sends that event itself, after the real click, because it is the one case in which the
 * component has to read where focus went instead of being told.
 *
 * @param devtools The connected session, on a hydrated page with the mode's setup already run.
 * @param mode Which picker to drive.
 */
export async function nativePickerCheck(devtools: Devtools, mode: PickerMode): Promise<void> {
  await pointerToCorner(devtools)
  const opened = await mode.open(devtools)
  await centreInView(devtools, fromField(mode))
  const icon = await devtools.evaluate<{ x: number; y: number; hit: boolean }>(`(() => {
    const field = ${fromField(mode)}
    const box = field.getBoundingClientRect()
    const x = Math.round(box.right - 16)
    const y = Math.round(box.top + box.height / 2)
    return { x, y, hit: document.elementFromPoint(x, y) === field }
  })()`)
  if (icon.hit) await clickAtPoint(devtools, icon)
  await poll(
    () => devtools.evaluate<boolean>(`${pickerFocus(mode)}.e2e === "date-range-from"`),
    3_000,
  )
  const clicked = await devtools.evaluate<PickerFocus>(pickerFocus(mode))
  await devtools.evaluate<null>(`(() => {
    const field = ${fromField(mode)}
    field?.dispatchEvent(new FocusEvent("blur", { relatedTarget: null }))
    field?.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }))
    return null
  })()`)
  // A fixed wait, not a poll: it proves the panel does not close, and an absence has no state to
  // poll for. The component reads where focus went a tick after a focus-out with no target; give
  // it the time to close the panel if it were going to.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const blurred = await devtools.evaluate<PickerFocus>(pickerFocus(mode))

  check(
    `a date field's own picker keeps an open ${mode.subject} open`,
    opened.open && icon.hit && clicked.open && clicked.e2e === "date-range-from" &&
      blurred.open && blurred.e2e === "date-range-from",
    !opened.open
      ? "the panel would not open, so there is no field to click"
      : !icon.hit
      ? `the point (${icon.x}, ${icon.y}) is not on the From field, so there is no icon to click`
      : !clicked.open
      ? "a real click on the From field's calendar icon closed the panel"
      : clicked.e2e !== "date-range-from"
      ? `the click on the From field's icon left focus on ${clicked.label}`
      : !blurred.open
      ? "the window blur a native picker sends closed the panel while the field kept focus"
      : `a real click at (${icon.x}, ${icon.y}) on the icon, then a focus-out with no target: ` +
        `the panel is open and focus is on the From field`,
  )
  await devtools.evaluate<null>(`(() => {
    const { trigger, panel } = globalThis.${mode.parked} ?? {}
    if (panel && !panel.hidden) trigger?.click()
    return null
  })()`)
  await poll(() => devtools.evaluate<boolean>(`${pickerFocus(mode)}.open === false`), 3_000)
}

/**
 * An Escape press with focus on the page itself closes an open panel and leaves focus there.
 *
 * Focus leaving for another control closes the panel on its own (#198), so the one way left to be
 * outside the component with the panel still open is focus falling to the page — a scripted blur,
 * or a focused control that vanished. The check blurs the focused control inside the panel, asserts
 * the panel stayed open, and only then presses Escape: a component that returned focus to its
 * trigger for every Escape would move the person somewhere they never went.
 *
 * @param devtools The connected session, on a hydrated page with the mode's setup already run.
 * @param mode Which picker to drive.
 */
export async function escapeFromPageCheck(devtools: Devtools, mode: PickerMode): Promise<void> {
  const opened = await mode.open(devtools)
  await devtools.evaluate<null>(`((document.activeElement)?.blur?.(), null)`)
  // A fixed wait, not a poll: it proves the panel stays open, and an absence has no state to poll
  // for. The focus-out handler reads where focus went a tick later; give it the time to close the
  // panel if it were going to.
  await new Promise((resolve) => setTimeout(resolve, 200))
  const before = await devtools.evaluate<PickerFocus>(pickerFocus(mode))

  await pressKey(devtools, "Escape")
  const closed = await poll(
    () => devtools.evaluate<boolean>(`${pickerFocus(mode)}.open === false`),
    3_000,
  )
  const settled = await settledActiveElement(devtools)
  const after = await devtools.evaluate<PickerFocus>(pickerFocus(mode))

  check(
    `a real Escape press from outside an open ${mode.subject} leaves focus where it is`,
    opened.open && opened.inPanel && before.open && before.onBody && closed && settled &&
      after.onBody && !after.onTrigger,
    !opened.open || !opened.inPanel
      ? "the panel would not open with focus inside, so there is nothing to press Escape at"
      : !before.onBody
      ? `the blur left focus on ${before.label}, so the press did not come from the page`
      : !before.open
      ? "focus falling to the page closed the panel, so there was nothing open to press Escape at"
      : !closed
      ? "the panel was still open 3s after a real Escape press from the page"
      : !settled
      ? "focus was still moving 3s after the press, so this proves nothing about where it settled"
      : after.onTrigger
      ? "Escape from the page pulled focus onto the trigger, somewhere the person never went"
      : !after.onBody
      ? `Escape from the page moved focus to ${after.label} rather than leaving it alone`
      : "focus on the page with the panel open → a real Escape press → the panel is hidden and " +
        "focus has not moved",
  )
}

/**
 * In the dark palette the From field's calendar icon is drawn light on the dark field (#379).
 *
 * The icon is drawn by the browser from the field's `color-scheme`, which no computed-style read
 * of the icon can see, so this reads the pixels of a real screenshot the way `pages/checks/theme.ts`
 * reads the dark Checkbox. It samples the strip at the field's right edge where the icon sits,
 * inset past the border, and takes the brightest pixel there: a black icon on the dark field leaves
 * that strip no brighter than the field itself. The field's own shade is read between the text and
 * the icon, to show the palette really was dark.
 *
 * @param devtools The connected session, on a hydrated page with the mode's setup already run.
 * @param mode Which picker to drive.
 */
export async function darkDateIconCheck(devtools: Devtools, mode: PickerMode): Promise<void> {
  const wasDark = await devtools.evaluate<boolean>(`(() => {
    const was = document.documentElement.classList.contains("dark")
    document.documentElement.classList.add("dark")
    return was
  })()`)
  try {
    const opened = await mode.open(devtools)
    const field = fromField(mode)
    const inView = await centreInView(devtools, field)
    await pointerToCorner(devtools)
    const box = await devtools.evaluate<
      { left: number; right: number; top: number; bottom: number; width: number }
    >(`(() => {
      const box = (${field}).getBoundingClientRect()
      return {
        left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth,
      }
    })()`)
    const { data } = await devtools.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
    })
    const read = await devtools.evaluate<{ icon: number; field: number }>(`(async () => {
      ${CONTRAST_HELPERS}
      const blob = await (await fetch("data:image/png;base64,${data}")).blob()
      const bitmap = await createImageBitmap(blob)
      const scale = bitmap.width / ${box.width}
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext("2d")
      context.drawImage(bitmap, 0, 0)
      const lightAt = (x, y) => relativeLuminance([
        ...context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data.slice(0, 3),
      ])
      let icon = 0
      for (let x = ${box.right} - 32; x <= ${box.right} - 4; x++) {
        for (let y = ${box.top} + 4; y <= ${box.bottom} - 4; y++) icon = Math.max(icon, lightAt(x, y))
      }
      const field = lightAt(${box.left} + (${box.right} - ${box.left}) * 0.65, (${box.top} + ${box.bottom}) / 2)
      return { icon, field }
    })()`)

    check(
      `in the dark palette the ${mode.subject}'s From field draws its calendar icon light`,
      opened.open && inView && box.right <= box.width && read.field < 0.1 && read.icon > 0.35,
      !opened.open
        ? "the panel would not open, so there is no field to look at"
        : !inView || box.right > box.width
        ? "the From field could not be brought into view"
        : read.field >= 0.1
        ? `the field reads ${read.field.toFixed(3)}, not dark, so the palette never switched`
        : read.icon <= 0.35
        ? `the brightest pixel in the icon strip is ${read.icon.toFixed(3)} on a field of ` +
          `${read.field.toFixed(3)} (white is 1): the icon is drawn dark on the dark field`
        : `brightest pixel in the icon strip ${read.icon.toFixed(3)}, field ${
          read.field.toFixed(3)
        } (white is 1)`,
    )
  } finally {
    await devtools.evaluate<null>(`(() => {
      const { trigger, panel } = globalThis.${mode.parked} ?? {}
      if (panel && !panel.hidden) trigger?.click()
      document.documentElement.classList.toggle("dark", ${wasDark})
      return null
    })()`)
    await poll(() => devtools.evaluate<boolean>(`${pickerFocus(mode)}.open === false`), 3_000)
  }
}
