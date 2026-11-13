import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  openGuidePage,
  PAGE_UNTIL,
  poll,
  pressKey,
  readAxNodes,
  settledScroll,
} from "../harness.ts"

/** What {@link tourChecks} reads off the `Tour` card and its open step. */
interface TourReading {
  /** `true` while the step's surface is shown in the top layer. */
  open: boolean
  /** The surface's `data-coachmark-mode`: `measured` or `sheet`. */
  mode: string | null
  /** The step's heading text. */
  title: string | null
  /** The step count in the footer. */
  count: string | null
  /** `true` when the step's heading has focus. */
  onHeading: boolean
  /** `true` when focus is inside the step's surface. */
  inSurface: boolean
  /** The focused element's `data-e2e`, or its tag and text. */
  active: string
  /** The surface's box, rounded. */
  surface: StepBox | null
  /** The Search field's box. */
  search: StepBox | null
  /** The New project button's box. */
  newProject: StepBox | null
  /** The viewport's width without its scrollbar, and its height. */
  view: { width: number; height: number }
  /** The Search field's `aria-describedby`. */
  searchDescribedBy: string | null
  /** The Search field's inline `anchor-name`. */
  searchAnchor: string
  /** The Search field's inline outline, which must go back to empty. */
  searchOutline: string
  /** The outline the browser draws round the Search field. */
  searchRing: Ring | null
  /** New project's `aria-describedby`. */
  newDescribedBy: string | null
  /** The outline the browser draws round New project. */
  newRing: Ring | null
  /** The id of the step's body. */
  bodyId: string | null
  /** How many elements other than the step itself point at the step's body. */
  describedByBody: number
  /** The Go to button's text, or `null` when the step has none. */
  goTo: string | null
  /** The demo's readout of the last `onClose` reason. */
  closed: string
  /** `true` while a modal dialog is open. */
  modal: boolean
  /** The page's scroll position, for a failure message. */
  scrollY: number
}

/** An outline as the browser draws it, from `getComputedStyle`. */
interface Ring {
  style: string
  width: number
}

/** Whether a {@link Ring} is really drawn: a style other than `none`, wider than nothing. */
function drawn(ring: Ring | null): boolean {
  return ring !== null && ring.style !== "none" && ring.width > 0
}

/** A rounded box in viewport pixels. */
interface StepBox {
  top: number
  left: number
  right: number
  bottom: number
  width: number
}

const TOUR_DEMO = `document.querySelector("#demo-Tour")`

/** Reads {@link TourReading} in one round trip. */
const TOUR_READING = `(() => {
  const demo = ${TOUR_DEMO}
  const surface = demo?.querySelector("[data-coachmark-mode]") ?? null
  const heading = surface?.querySelector("h2") ?? null
  const active = document.activeElement
  const box = (element) => {
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
    }
  }
  const ring = (element) => {
    if (!element) return null
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) || 0 }
  }
  const search = demo?.querySelector('[data-e2e="tour-search"]') ?? null
  const newProject = demo?.querySelector('[data-e2e="tour-new"]') ?? null
  const bodyId = surface?.querySelector('[id$="-body"]')?.id ?? null
  const goTo = [...(surface?.querySelectorAll("button") ?? [])]
    .find((button) => button.textContent.trim().startsWith("Go to"))
  return {
    open: surface?.matches(":popover-open") ?? false,
    mode: surface?.getAttribute("data-coachmark-mode") ?? null,
    title: heading?.textContent.trim() ?? null,
    count: surface?.querySelector("p")?.textContent.trim() ?? null,
    onHeading: heading !== null && active === heading,
    inSurface: surface !== null && surface.contains(active),
    active: active === null || active === document.body
      ? "the page"
      : active.getAttribute("data-e2e") ??
        (active.tagName + " " + (active.textContent ?? "").trim().slice(0, 30)).trim(),
    surface: box(surface),
    search: box(search),
    newProject: box(newProject),
    view: { width: document.documentElement.clientWidth, height: innerHeight },
    searchDescribedBy: search?.getAttribute("aria-describedby") ?? null,
    searchAnchor: search?.style.getPropertyValue("anchor-name") ?? "",
    searchOutline: search?.style.outline ?? "",
    searchRing: ring(search),
    newDescribedBy: newProject?.getAttribute("aria-describedby") ?? null,
    newRing: ring(newProject),
    bodyId,
    describedByBody: bodyId === null
      ? 0
      : [...document.querySelectorAll("[aria-describedby]")]
        .filter((element) =>
          element !== surface &&
          element.getAttribute("aria-describedby").split(" ").includes(bodyId)
        )
        .length,
    goTo: goTo?.textContent.trim() ?? null,
    closed: demo?.querySelector('[data-e2e="tour-closed"]')?.textContent.trim() ?? "",
    modal: document.querySelector("dialog:modal") !== null,
    scrollY: Math.round(scrollY),
  }
})()`

/**
 * Focus a button in the open step by its text, for a real Enter press to activate it.
 *
 * @param text The button's text, or its start for Go to.
 */
function focusTourButton(text: string): string {
  return `(() => {
    const surface = ${TOUR_DEMO}?.querySelector("[data-coachmark-mode]")
    const button = [...(surface?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent.trim().startsWith(${JSON.stringify(text)}))
    button?.focus()
    return button !== undefined
  })()`
}

/** Waits two animation frames, so a measured layout scheduled for the next frame has run. */
const TWO_FRAMES =
  `new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null))))`

/**
 * Run `body` at a viewport of `width` × `height`, then go back to the harness's own.
 *
 * @param devtools The connected session.
 * @param width The viewport's width.
 * @param height The viewport's height.
 * @param body The checks to run there.
 */
async function atViewport(
  devtools: Devtools,
  width: number,
  height: number,
  body: () => Promise<void>,
): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    await devtools.evaluate<null>(TWO_FRAMES)
    await body()
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/**
 * Starts the tour on its first step with a real Enter on Start, so Start is what focus goes back
 * to, and waits for the step's heading to take focus.
 *
 * @returns The reading once the first step is up.
 */
async function startTour(devtools: Devtools): Promise<TourReading> {
  const read = () => devtools.evaluate<TourReading>(TOUR_READING)
  const start = `${TOUR_DEMO}?.querySelector('[data-e2e="tour-start"]')`
  await centreInView(devtools, start)
  await devtools.evaluate<null>(`(${start}?.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).onHeading, 3000)
  await devtools.evaluate<null>(TWO_FRAMES)
  return await read()
}

/** Ends an open tour through Skip, so the next check starts from a closed one. */
async function skipTour(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<TourReading>(TOUR_READING)
  if (!(await read()).open) return
  if (await devtools.evaluate<boolean>(focusTourButton("Skip tour"))) {
    await pressKey(devtools, "Enter")
  }
  await poll(async () => !(await read()).open, 3000)
}

/**
 * `Tour` and `Coachmark`, on their catalogue cards (#583). The tour's four steps point at a Search
 * field that carries the app's own `anchor-name` and `aria-describedby`, at a New project button
 * that opens a `Modal`, at an element the page does not have, and at a Help button.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function tourChecks(devtools: Devtools): Promise<void> {
  await openGuidePage(devtools, "ui")
  await settledScroll(devtools)
  try {
    await atViewport(devtools, 1280, 800, () => tourDesktopChecks(devtools))
    await atViewport(devtools, 1280, 800, () => tourMeasuredCheck(devtools))
    await atViewport(devtools, 375, 812, () => tourSheetCheck(devtools))
    await atViewport(devtools, 1280, 800, () => coachmarkCheck(devtools))
  } finally {
    await skipTour(devtools)
  }
}

/**
 * The tour at a desktop width: Tab leaving the step, Go to, Next, the first target's attributes
 * coming back, Escape inside a `Modal`, the missing-target sheet, contrast, and focus back on Start
 * when the tour closes. Where the first step opens, and what it adds to its target, are Playwright
 * specs in `e2e/ui.spec.ts`.
 */
async function tourDesktopChecks(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<TourReading>(TOUR_READING)
  await startTour(devtools)

  const [dialog] = await readAxNodes(devtools, "#demo-Tour [data-coachmark-mode]")
  check(
    "Tour: a screen reader hears the step's text and its step count as the dialog's description",
    dialog !== undefined && dialog.role === "dialog" && dialog.name === "Search everything" &&
      dialog.description.includes("Type a name to find a project") &&
      dialog.description.includes("Step 1 of 4"),
    dialog === undefined ? "no step dialog in the accessibility tree" : JSON.stringify(dialog),
  )

  const stops: string[] = []
  for (let press = 0; press < 5; press++) {
    await pressKey(devtools, "Tab")
    const now = await read()
    stops.push(now.inSurface ? now.active : `outside: ${now.active}`)
    if (!now.inSurface) break
  }
  const afterTab = await read()
  check(
    "Tour: Tab moves through the step's controls and then out into the page, leaving the step open",
    stops.join(" | ") ===
        "BUTTON | BUTTON Skip tour | BUTTON Next | BUTTON Go to Search | " +
          `outside: ${afterTab.active}` && afterTab.open,
    `stops: ${stops.join(" | ")}; open ${afterTab.open}`,
  )

  const focused = await devtools.evaluate<boolean>(focusTourButton("Go to"))
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).active === "tour-search", 3000)
  const wentTo = await read()
  check(
    "Tour: Go to focuses the step's target and leaves the step open",
    focused && wentTo.active === "tour-search" && wentTo.open &&
      wentTo.title === "Search everything",
    `Go to found ${focused}, focus on ${wentTo.active}, open ${wentTo.open}, title "${wentTo.title}"`,
  )

  // The page must stand still before the step moves, so the next target's position is its own.
  await settledScroll(devtools)
  const beforeNext = await read()
  await devtools.evaluate<boolean>(focusTourButton("Next"))
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).title === "Start a project", 3000)
  await settledScroll(devtools)
  await poll(async () => (await read()).onHeading, 3000)
  await devtools.evaluate<null>(TWO_FRAMES)
  const second = await read()
  const beside = second.surface !== null && second.newProject !== null &&
    (second.surface.left >= second.newProject.right ||
      second.surface.right <= second.newProject.left)
  check(
    "Tour: Next moves focus to the next step's heading, beside its target",
    second.onHeading && second.count === "Step 2 of 4" && drawn(second.newRing) &&
      beside,
    `focus on ${second.active}, count "${second.count}", ` +
      `drawn outline ${JSON.stringify(second.newRing)}, ` +
      `surface ${JSON.stringify(second.surface)}, target ${JSON.stringify(second.newProject)}, ` +
      `scrollY ${beforeNext.scrollY} before Next, ${second.scrollY} after`,
  )
  check(
    "Tour: leaving a step hands its target's anchor-name, aria-describedby and outline back",
    second.searchAnchor === "--demo-search" && second.searchDescribedBy === "tour-search-hint" &&
      second.searchOutline === "",
    `anchor-name "${second.searchAnchor}", aria-describedby "${second.searchDescribedBy}", ` +
      `outline "${second.searchOutline}"`,
  )

  const contrast = await devtools.evaluate<
    { light: number[]; dark: number[]; found: boolean }
  >(`(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const surface = ${TOUR_DEMO}?.querySelector("[data-coachmark-mode]")
    const parts = [
      surface?.querySelector("h2"),
      surface?.querySelector('[id$="-body"]'),
      surface?.querySelector("p"),
    ]
    const target = ${TOUR_DEMO}?.querySelector('[data-e2e="tour-new"]')
    // The target is a Button, whose colour transition covers its outline: read once every finite
    // transition on the page has finished, or the outline is read halfway between the palettes.
    const until = ${PAGE_UNTIL}
    const settle = async () => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      await until(() =>
        document.getAnimations().every((animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().endTime === Infinity
        )
      )
    }
    const round = (value) => Math.round(value * 100) / 100
    const measure = () => [
      ...parts.map((part) => part ? round(seenRatio(part)) : 0),
      target ? round(seenRatio(target, getComputedStyle(target).outlineColor, { outside: true })) : 0,
    ]
    try {
      root.classList.remove("dark")
      await settle()
      const light = measure()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      return { light, dark, found: parts.every(Boolean) && Boolean(target) }
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`)
  for (const palette of ["light", "dark"] as const) {
    const ratios = contrast[palette]
    const text = ratios.slice(0, 3)
    check(
      `Tour: in the ${palette} palette the step's title, text and step count read at 4.5:1 or more`,
      contrast.found && text.every((ratio) => ratio >= 4.5),
      `title, body, count: ${text.join(", ")}`,
    )
    check(
      `Tour: in the ${palette} palette the target's outline stands out from the page at 3:1 or more`,
      contrast.found && ratios[3] >= 3,
      `outline against the page: ${ratios[3]}`,
    )
  }

  await devtools.evaluate<null>(
    `(${TOUR_DEMO}?.querySelector('[data-e2e="tour-new"]')?.focus(), null)`,
  )
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).modal, 3000)
  const withModal = await read()
  await pressKey(devtools, "Escape")
  await poll(async () => !(await read()).modal, 3000)
  const afterModal = await read()
  check(
    "Tour: Escape inside a Modal the step opened closes only the dialog",
    withModal.modal && !afterModal.modal && afterModal.open &&
      afterModal.title === "Start a project" &&
      afterModal.closed === "onClose last said: nothing yet.",
    `modal opened ${withModal.modal}, then ${afterModal.modal}; tour open ${afterModal.open}, ` +
      `title "${afterModal.title}", readout "${afterModal.closed}"`,
  )
  await tourModalBodyEscapeCheck(devtools)

  await devtools.evaluate<boolean>(focusTourButton("Next"))
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).title === "A step with no target", 3000)
  await devtools.evaluate<null>(TWO_FRAMES)
  const missing = await read()
  check(
    "Tour: a step whose target is missing is a full-width sheet on the bottom edge with no Go to",
    missing.open && missing.mode === "sheet" && missing.surface !== null &&
      missing.surface.bottom === missing.view.height && missing.surface.left === 0 &&
      missing.surface.width === missing.view.width && missing.goTo === null &&
      missing.describedByBody === 0 && missing.onHeading,
    `mode ${missing.mode}, surface ${JSON.stringify(missing.surface)}, view ` +
      `${JSON.stringify(missing.view)}, Go to "${missing.goTo}", pointed at by ` +
      `${missing.describedByBody}, focus on ${missing.active}`,
  )

  await devtools.evaluate<boolean>(focusTourButton("Next"))
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).title === "Ask for help", 3000)
  await devtools.evaluate<boolean>(focusTourButton("Done"))
  await pressKey(devtools, "Enter")
  await poll(async () => !(await read()).open, 3000)
  const done = await read()
  check(
    "Tour: Done closes the tour, tells the app why and puts focus back on Start",
    !done.open && done.closed === "onClose last said: done." && done.active === "tour-start",
    `open ${done.open}, readout "${done.closed}", focus on ${done.active}`,
  )

  await startTour(devtools)
  await pressKey(devtools, "Escape")
  await poll(async () => !(await read()).open, 3000)
  const escaped = await read()
  check(
    "Tour: Escape closes the tour with the reason escape and puts focus back on Start",
    !escaped.open && escaped.closed === "onClose last said: escape." &&
      escaped.active === "tour-start",
    `open ${escaped.open}, readout "${escaped.closed}", focus on ${escaped.active}`,
  )

  // Opened by a script with nothing focused: there is no opener to go back to.
  await devtools.evaluate<null>(`(() => {
    document.activeElement?.blur?.()
    ${TOUR_DEMO}?.querySelector('[data-e2e="tour-start"]')?.click()
    return null
  })()`)
  await poll(async () => (await read()).onHeading, 3000)
  await devtools.evaluate<null>(
    `(${TOUR_DEMO}?.querySelector('[data-coachmark-mode] button[aria-label="Close"]')?.focus(), null)`,
  )
  await pressKey(devtools, "Enter")
  await poll(async () => !(await read()).open, 3000)
  const unfocused = await read()
  check(
    "Tour: closing a tour that opened with nothing focused puts focus on the step's target",
    !unfocused.open && unfocused.closed === "onClose last said: skip." &&
      unfocused.active === "tour-search",
    `open ${unfocused.open}, readout "${unfocused.closed}", focus on ${unfocused.active}`,
  )
}

/**
 * Escape while a modal dialog is open and focus is on the page body, not inside the dialog: the
 * key belongs to the dialog, so the tour stays open. Runs on the tour's second step, whose target
 * opens the demo's `Modal`; the dialog is closed afterwards through its own Close button.
 */
async function tourModalBodyEscapeCheck(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<TourReading>(TOUR_READING)
  await devtools.evaluate<null>(
    `(${TOUR_DEMO}?.querySelector('[data-e2e="tour-new"]')?.focus(), null)`,
  )
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).modal, 3000)
  const onBody = await devtools.evaluate<boolean>(`(() => {
    document.activeElement?.blur?.()
    return document.activeElement === document.body
  })()`)
  await pressKey(devtools, "Escape")
  await devtools.evaluate<null>(TWO_FRAMES)
  const after = await read()
  await devtools.evaluate<null>(`(() => {
    const dialog = document.querySelector("dialog[open]")
    const close = [...(dialog?.querySelectorAll("button") ?? [])].find((button) =>
      button.textContent.trim() === "Close" || button.getAttribute("aria-label") === "Close"
    )
    close?.click()
    return null
  })()`)
  await poll(async () => !(await read()).modal, 3000)
  const closed = await read()
  check(
    "Tour: Escape with a modal dialog open and focus on the page body leaves the tour open",
    onBody && after.modal && after.open && after.title === "Start a project" &&
      after.closed === "onClose last said: nothing yet." && !closed.modal,
    `focus on the body ${onBody}, then modal open ${after.modal}, tour open ${after.open}, ` +
      `title "${after.title}", readout "${after.closed}"; modal closed after ${!closed.modal}`,
  )
}

/**
 * Without CSS anchor positioning, the step is placed by measurement, and placed again when the
 * page scrolls. The check makes `CSS.supports` answer no for `anchor-name`, which the component
 * asks at every layout, and puts it back afterwards.
 */
async function tourMeasuredCheck(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<TourReading>(TOUR_READING)
  await devtools.evaluate<null>(`(() => {
    globalThis.__verifyCssSupports = CSS.supports
    CSS.supports = (...args) =>
      String(args[0]).includes("anchor") ? false : globalThis.__verifyCssSupports.apply(CSS, args)
    return null
  })()`)
  try {
    const first = await startTour(devtools)
    const gap = first.surface && first.search ? first.surface.top - first.search.bottom : NaN
    await devtools.evaluate<null>(`(scrollBy({ top: 40, behavior: "instant" }), null)`)
    await devtools.evaluate<null>(TWO_FRAMES)
    const scrolled = await read()
    const gapAfter = scrolled.surface && scrolled.search
      ? scrolled.surface.top - scrolled.search.bottom
      : NaN
    check(
      "Tour: without anchor positioning the step is measured into place below its target, and follows it on scroll",
      first.mode === "measured" && gap === 8 && scrolled.mode === "measured" && gapAfter === 8 &&
        first.search !== null && scrolled.search !== null &&
        scrolled.search.top !== first.search.top,
      `mode ${first.mode} then ${scrolled.mode}, gap ${gap}px then ${gapAfter}px, target top ` +
        `${first.search?.top} then ${scrolled.search?.top}`,
    )
  } finally {
    await skipTour(devtools)
    await devtools.evaluate<null>(`(() => {
      if (globalThis.__verifyCssSupports) CSS.supports = globalThis.__verifyCssSupports
      return null
    })()`)
  }
}

/** Below 640 px wide, a step whose target is on screen is still a sheet on the bottom edge. */
async function tourSheetCheck(devtools: Devtools): Promise<void> {
  try {
    const phone = await startTour(devtools)
    check(
      "Tour: on a 375 px screen the step is a full-width sheet on the bottom edge",
      phone.open && phone.mode === "sheet" && phone.surface !== null &&
        phone.surface.bottom === phone.view.height && phone.surface.left === 0 &&
        phone.surface.width === phone.view.width && phone.onHeading &&
        phone.goTo === "Go to Search",
      `mode ${phone.mode}, surface ${JSON.stringify(phone.surface)}, view ` +
        `${JSON.stringify(phone.view)}, focus on ${phone.active}, Go to "${phone.goTo}"`,
    )
  } finally {
    await skipTour(devtools)
  }
}

/** What {@link coachmarkCheck} reads off the `Coachmark` card. */
interface CoachmarkReading {
  open: boolean
  mode: string | null
  surface: StepBox | null
  target: StepBox | null
  active: string
  /** The target's `tabindex` attribute, or `null` when it has none. */
  tabIndex: string | null
}

/**
 * A single `Coachmark` with a ref target: Go to and its tabindex. Where it sits, × and focus going
 * back are a Playwright spec in `e2e/ui.spec.ts`.
 */
async function coachmarkCheck(devtools: Devtools): Promise<void> {
  const demo = `document.querySelector("#demo-Coachmark")`
  const read = () =>
    devtools.evaluate<CoachmarkReading>(`(() => {
      const demo = ${demo}
      const surface = demo?.querySelector("[data-coachmark-mode]") ?? null
      const box = (element) => {
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
        }
      }
      const active = document.activeElement
      return {
        open: surface?.matches(":popover-open") ?? false,
        mode: surface?.getAttribute("data-coachmark-mode") ?? null,
        surface: box(surface),
        target: box(demo?.querySelector('[data-e2e="coachmark-target"]')),
        active: active?.getAttribute("data-e2e") ?? active?.getAttribute("aria-label") ??
          active?.tagName ?? "nothing",
        tabIndex: demo?.querySelector('[data-e2e="coachmark-target"]')?.getAttribute("tabindex") ??
          null,
      }
    })()`)
  const toggle = `${demo}?.querySelector('[data-e2e="coachmark-toggle"]')`
  await centreInView(devtools, toggle)
  await devtools.evaluate<null>(`(${toggle}?.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).open, 3000)
  await devtools.evaluate<null>(TWO_FRAMES)
  const goTo = await devtools.evaluate<boolean>(`(() => {
    const button = [...(${demo}?.querySelectorAll("[data-coachmark-mode] button") ?? [])]
      .find((button) => button.textContent.trim().startsWith("Go to"))
    button?.focus()
    return button !== undefined
  })()`)
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).active === "coachmark-target", 3000)
  const wentTo = await read()
  await devtools.evaluate<null>(
    `(${demo}?.querySelector('[data-coachmark-mode] button[aria-label="Close"]')?.focus(), null)`,
  )
  await pressKey(devtools, "Enter")
  await poll(async () => !(await read()).open, 3000)
  const closed = await read()
  check(
    "Coachmark: Go to makes a target that cannot take focus focusable, and closing takes that away",
    goTo && wentTo.active === "coachmark-target" && wentTo.tabIndex === "-1" && !closed.open &&
      closed.tabIndex === null,
    `Go to found ${goTo}, focus on ${wentTo.active}, tabindex "${wentTo.tabIndex}"; after × ` +
      `tabindex "${closed.tabIndex}"`,
  )
}
