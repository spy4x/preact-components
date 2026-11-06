import { centreInView, check, type Devtools, poll, pressKey } from "../harness.ts"
import { type Aim, aimAt, holdsFor, type Landing, movePointer } from "./shared.ts"

/** One read of the live tooltip: the hint's own state, plus where focus is. */
interface TooltipState {
  /** `false` when the card is missing the row these checks drive; every other field is then noise. */
  ok: boolean
  /** Computed `visibility` of the surface. `"visible"` only while the hint is revealed. */
  visibility: string
  /** Computed `opacity`, so a reading taken mid-transition is visible as one. */
  opacity: string
  /** `true` while the surface has a box at all — Escape takes the box away with `hidden`. */
  boxed: boolean
  /** How many client rects the surface has. `boxed` is this above zero; the count is evidence. */
  rects: number
  /** `true` when the browser has the trigger in its `:hover` state, which is what reveals a hint. */
  hover: boolean
  /** `true` when the browser has the surface itself in `:hover`. */
  surfaceHover: boolean
  /** The trigger's `aria-describedby`, or `null` once the hint is dismissed. */
  described: string | null
  /** `true` when the parked trigger is the focused element. */
  focused: boolean
  /** What the hint says, cut short for the failure message. */
  text: string
}

/** The strip of surface between the bubble and the trigger, and what hit-tests inside it. */
interface Bridge {
  x: number
  y: number
  /** The bridge's own thickness in pixels, from the surface's edge to the bubble's. */
  strip: number
  /** Pixels between the trigger's box and the surface's. Dead space is anything above zero. */
  gap: number
  /** `true` when a point in the middle of the bridge hit-tests to the hint. */
  onTarget: boolean
  tag: string
}

/** What Chromium makes of the trigger: the three things a hint on a nameless element loses. */
interface Named {
  role: string
  name: string
  description: string
}

/**
 * Park the tooltip card's live row, its trigger and its surface on `globalThis`.
 *
 * Parked rather than re-queried for a reason this component makes sharper than most: dismissing a
 * hint takes `aria-describedby` off the trigger, so a selector written around that attribute stops
 * matching exactly when the check needs to read what it matched before.
 *
 * The row is the one hint on the card that reveals itself. Every other hint there is pinned open
 * with `contentClass="visible opacity-100"`, and a hint that is always up cannot tell a reveal
 * that works from one that is broken.
 */
const TOOLTIP_SETUP = `(() => {
  const row = document.querySelector('#demo-Tooltip [data-e2e="tooltip-live"]')
  // The trigger is found by the name it carries, not by its tag. Which element the component puts
  // the name on is the thing under test in one of the checks below, and a selector written around
  // a "button" would answer that question by not matching at all.
  const trigger = row?.querySelector("[aria-label]") ?? null
  globalThis.__verifyTooltip = {
    row,
    trigger,
    surface: trigger?.querySelector('[role="tooltip"]') ?? null,
  }
  return null
})()`

/** The hint's state and the trigger's, read in one round trip. */
const TOOLTIP_STATE = `(() => {
  const { trigger, surface } = globalThis.__verifyTooltip ?? {}
  if (!trigger || !surface) {
    return {
      ok: false, visibility: "", opacity: "", boxed: false, rects: 0, hover: false,
      surfaceHover: false, described: null, focused: false, text: "",
    }
  }
  const style = getComputedStyle(surface)
  return {
    ok: true,
    visibility: style.visibility,
    opacity: style.opacity,
    boxed: surface.getClientRects().length > 0,
    rects: surface.getClientRects().length,
    hover: trigger.matches(":hover"),
    surfaceHover: surface.matches(":hover"),
    described: trigger.getAttribute("aria-describedby"),
    focused: document.activeElement === trigger,
    text: (surface.textContent ?? "").trim().slice(0, 40),
  }
})()`

/** Whether the hint is on screen right now: visible, fully faded in, and with a box. */
const TOOLTIP_SHOWN = `(() => {
  const surface = globalThis.__verifyTooltip?.surface ?? null
  if (surface === null) return false
  const style = getComputedStyle(surface)
  return style.visibility === "visible" && style.opacity === "1" &&
    surface.getClientRects().length > 0
})()`

/**
 * Whether the browser has the trigger in `:hover` — the state the reveal rule keys on.
 *
 * `:hover` propagates up the DOM, so a pointer resting on the hint keeps the trigger in it: the
 * hint is a descendant of the trigger wrapper however far outside it the hint is painted.
 */
const TOOLTIP_HOVERED = `(globalThis.__verifyTooltip?.trigger?.matches(":hover") ?? false)`

/** Whether the surface has stopped taking up a box, which is what a dismissed hint does. */
const TOOLTIP_DISMISSED =
  `(globalThis.__verifyTooltip?.surface?.getClientRects().length ?? 1) === 0`

/**
 * Tooltip's two halves of one rule: a hint can be dismissed, and a hint can be pointed at.
 *
 * Neither half is reachable from a test that renders to a string. The dismissal is a real Escape
 * press against a `keydown` listener the component keeps attached for its whole life (`#252`), and
 * the hoverable half is the browser's own hit testing — the thing `pointer-events-none` used to
 * fail, and which nothing in rendered markup can answer.
 *
 * **What the browser can show, and what it took to get there.** Tailwind v4 compiles every hover
 * style — `hover:`, `group-hover:` — inside `@media (hover: hover)`, and headless Chromium answers
 * `(hover: none)` and `(pointer: none)` unless it is told otherwise, so for a while no hover style
 * of any kind applied here and the reveal-on-hover was not observable at all. Neither emulation
 * route covers those two features: `Emulation.setEmulatedMedia` was tried with and without a
 * `media` string, and a device metrics override too, and `matchMedia("(hover: hover)")` still
 * answered false. The lever is a Chromium launch flag, and `pages/verify.ts` now passes it — see
 * `hoverCapability` there, which asserts the browser still answers `(hover: hover)` before any of
 * these checks run. So {@link hoverRevealCheck} below drives the reveal itself, with a real
 * pointer and with focus ruled out; the focus reveal is still checked beside it, because it is a
 * second path rather than the same one; and the pointer checks go on asserting what the hit
 * testing does — that the pointer reaches the hint at all, and that the trigger stays `:hover`
 * while it rests there, because the hint is a descendant of the trigger and that is the state the
 * reveal rule keys on.
 *
 * Three habits the checks above set, and why each one is needed here.
 *
 * The trigger and the surface are parked on `globalThis` instead of re-queried. Dismissing a hint
 * takes `aria-describedby` off the trigger, so a selector written around that attribute would stop
 * matching precisely when the check needs the element it matched a moment ago.
 *
 * Every assertion is a transition, and the first of them matters more than it looks: a hint that
 * always takes the pointer would pass "the hint is under the pointer" without proving anything at
 * all. So the pointer check reads the trigger unhovered at rest, moves onto it, moves onto the
 * hint, and then watches both leave `:hover` when the pointer does.
 *
 * No coordinate is guessed. Each point is the centre of the element's own box, read back with
 * `elementFromPoint` before it is used, and the page records where the browser actually delivered
 * the move. That second reading is what tells "the component is broken" from "the move went
 * somewhere else", and it is also how the hoverable half is proven at all: with
 * `pointer-events-none` the centre of the hint reads whatever is *behind* the hint, so the
 * derivation fails and the check says so in those words.
 *
 * Nothing here throws. A missing row is a failed check naming what is missing, because an exception
 * would cost every check left in this file — including Modal's, which run after it — and replace
 * them with one failure that names `ui` rather than the row.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function tooltipChecks(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(TOOLTIP_SETUP)
  await centreInView(devtools, `globalThis.__verifyTooltip?.row ?? null`)
  // The Dropdown checks above leave the pointer at viewport coordinates, and viewport coordinates
  // do not scroll with the page: without parking it first, the pointer can be resting on this very
  // trigger while the check reads the trigger "at rest".
  await pointerAwayFromTooltips(devtools)

  await hoverRevealCheck(devtools)

  const atRest = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // Revealed with focus here rather than with the pointer, on purpose: this check is about what the
  // hint does once it is on screen, and focus puts it there without the pointer already being where
  // the readings below are about to move it. A hidden element is not hit-testable at all, so
  // without a hint on screen there would be nothing for a pointer to reach and the two readings
  // below would be about nothing.
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)

  const bridge = await devtools.evaluate<Bridge>(`(() => {
    const { trigger, surface } = globalThis.__verifyTooltip ?? {}
    const bubble = surface?.firstElementChild ?? null
    if (!trigger || !surface || bubble === null) {
      return { x: -1, y: -1, strip: 0, gap: -1, onTarget: false, tag: "nothing" }
    }
    const surfaceBox = surface.getBoundingClientRect()
    const bubbleBox = bubble.getBoundingClientRect()
    const triggerBox = trigger.getBoundingClientRect()
    // This hint sits below its trigger, so its bridge is the strip between the surface's own top
    // edge and the bubble's. Measured from the two boxes rather than from the utility that makes
    // it, so it is the real gap whatever the class happens to be.
    const strip = bubbleBox.top - surfaceBox.top
    const x = Math.round(surfaceBox.left + surfaceBox.width / 2)
    const y = Math.round(surfaceBox.top + strip / 2)
    const at = document.elementFromPoint(x, y)
    return {
      x,
      y,
      strip: Math.round(strip),
      gap: Math.round(surfaceBox.top - triggerBox.bottom),
      onTarget: at !== null && (at === surface || surface.contains(at)),
      tag: at === null ? "nothing" : at.tagName,
    }
  })()`)

  const onTrigger = await hoverTrigger(devtools)
  const surfaceAim = await aimAt(devtools, `globalThis.__verifyTooltip?.surface ?? null`)
  const ontoSurface = await movePointer(
    devtools,
    surfaceAim,
    `globalThis.__verifyTooltip?.surface ?? null`,
  )
  const onHint = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)
  const held = await holdsFor(() => devtools.evaluate<boolean>(TOOLTIP_HOVERED), 600)
  await pointerAwayFromTooltips(devtools)
  const left = await poll(
    () =>
      devtools.evaluate<boolean>(
        `!${TOOLTIP_HOVERED} && !(globalThis.__verifyTooltip?.surface?.matches(":hover") ?? false)`,
      ),
    3_000,
  )
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  // Teardown, and nothing may be built on it: this waits for a CSS state, which stops matching the
  // instant focus leaves, with no render in between. It says the hint is off the screen; it does
  // not say the component has re-rendered or that its effect cleanups have run.
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)

  check(
    "a Tooltip's hint takes the pointer, bridge and all, and keeps its trigger hovered",
    atRest.ok && !atRest.hover && !atRest.surfaceHover && revealed && bridge.strip >= 2 &&
      bridge.gap <= 1 && bridge.onTarget && onTrigger.hovering &&
      onTrigger.landing?.onTarget === true && surfaceAim.onTarget &&
      ontoSurface?.onTarget === true && onHint.surfaceHover && onHint.hover && held.held && left,
    !atRest.ok
      ? "the Tooltip card has no live row — nothing matched '[data-e2e=\"tooltip-live\"]' with a " +
        "button and a role=tooltip inside it"
      : atRest.hover || atRest.surfaceHover
      ? "the pointer was already resting on the trigger with the page scrolled here, so the " +
        "readings below have nothing to move from"
      : !revealed
      ? `the hint never reached the screen on focus (visibility ${atRest.visibility}, opacity ` +
        `${atRest.opacity}), and a hidden hint cannot be pointed at by anyone`
      : bridge.strip < 2
      ? `the hint has no bridge: a ${bridge.strip}px strip between the surface's edge and the ` +
        `bubble's, so whatever separates the two is not part of the hint. This measures the strip ` +
        `above the bubble, which is where the bridge is for the card's bottom-anchored row — a ` +
        `row given another placement in ui-guide/sections/display.tsx reads 0 here too`
      : bridge.gap > 1
      ? `${bridge.gap}px of dead space between the trigger and the hint's own box: a pointer ` +
        `crossing it leaves the trigger, and the hint goes before the pointer arrives`
      : !bridge.onTarget
      ? `the middle of the ${bridge.strip}px bridge at (${bridge.x}, ${bridge.y}) reads ` +
        `${bridge.tag} rather than the hint, so the way to the hint is not the hint`
      : !onTrigger.aim.onTarget
      ? `nothing of the trigger to point at: (${onTrigger.aim.x}, ${onTrigger.aim.y}) reads ` +
        `${onTrigger.aim.tag} over a ${onTrigger.aim.width}×${onTrigger.aim.height} box — this ` +
        `proves nothing`
      : onTrigger.landing === null || !onTrigger.landing.onTarget
      ? `the pointer never landed on the trigger: ${
        onTrigger.landing === null
          ? "the move never reached the page"
          : `it went to ${onTrigger.landing.tag} at (${onTrigger.landing.x}, ${onTrigger.landing.y})`
      } — a missed move, which proves nothing`
      : !onTrigger.hovering
      ? "the browser never put the trigger into :hover with the pointer delivered onto it, so " +
        "nothing here is about hovering"
      : !surfaceAim.onTarget
      ? `the hint cannot be pointed at: its own centre (${surfaceAim.x}, ${surfaceAim.y}) reads ` +
        `${surfaceAim.tag}, which is what sits behind it — the surface takes no pointer events, ` +
        `so a pointer moving towards the hint lands on the page instead`
      : ontoSurface === null || !ontoSurface.onTarget
      ? `the pointer never landed on the hint: ${
        ontoSurface === null
          ? "the move never reached the page"
          : `it went to ${ontoSurface.tag} at (${ontoSurface.x}, ${ontoSurface.y})`
      } — a missed move, which proves nothing`
      : !onHint.surfaceHover
      ? "the pointer was delivered onto the hint and the browser did not take the hint into " +
        ":hover, so the hint is not something a pointer can rest on"
      : !onHint.hover
      ? "the pointer rests on the hint and the trigger has left :hover, so the rule that reveals " +
        "the hint has stopped matching and the hint would vanish under the pointer"
      : !held.held
      ? `the trigger left :hover ${held.elapsedMs}ms after the pointer moved onto the hint, so ` +
        `the hint cannot be read by resting on it`
      : !left
      ? "the trigger stayed in :hover with the pointer back in the corner, so it never leaves it " +
        "and the readings above prove nothing"
      : `the hint's box touches its trigger (${bridge.gap}px apart) across a ${bridge.strip}px ` +
        `bridge that hit-tests to the hint at (${bridge.x}, ${bridge.y}); the hint's own centre ` +
        `reads the hint, the pointer was delivered onto it at (${ontoSurface.x}, ` +
        `${ontoSurface.y}), and hint and trigger held :hover together for ${held.elapsedMs}ms → ` +
        `both left :hover when the pointer went back to the corner`,
  )

  await escapeOverPointerCheck(devtools)
  await escapeOnFocusCheck(devtools)
  await tooltipEscapeRaceCheck(devtools)
  await tooltipNameCheck(devtools)
}

/** What the browser says is under the parked pointer, relative to the tooltip's trigger. */
interface Corner {
  /** What `elementFromPoint` reads at the parking spot. */
  tag: string
  /** `true` when the parking spot is the trigger, or something inside it — a failed parking. */
  onTrigger: boolean
}

/**
 * Hovering the trigger reveals the hint, and taking the pointer away hides it again.
 *
 * This is the component's headline behaviour and the one nothing could check until the browser was
 * told it has a mouse: Tailwind compiles `group-hover:visible` and `group-hover:opacity-100` inside
 * `@media (hover: hover)`, so in a browser that answers `(hover: none)` the reveal rule is present
 * in the stylesheet and never matches. The flag that fixes that is in `pages/verify.ts`, and
 * `hoverCapability` there fails loudly if it ever stops working — so a failure here is the
 * component rather than the environment.
 *
 * **Focus is ruled out as the revealer**, which is what keeps this from being satisfiable a second
 * way: the component reveals the hint on `group-focus-within` too, so the trigger is blurred first
 * and `document.activeElement` is read at rest *and* with the hint on screen. A reveal that
 * happened while focus sat on the trigger would prove the focus path over again and say nothing
 * about hovering.
 *
 * Both ends are asserted, because half of this is not worth having. A hint that were simply always
 * visible would pass "the hint is visible with the pointer on the trigger" without a reveal ever
 * happening, so the run is: hidden at rest → pointer on → visible → pointer away → hidden again.
 *
 * The pointer's resting place is asserted rather than assumed, at both ends. The point it moves to
 * is the centre of the trigger's own box, read back with `elementFromPoint` before the move and
 * recorded by the page as the browser delivers it, so a move that went somewhere else is reported
 * as a missed move and never as a broken tooltip. The corner it parks in is read the same way: a
 * pointer left resting on the trigger would make "hidden at rest" impossible and the reason would
 * not be the component.
 *
 * Nothing here throws. A missing row is a failed check naming what is missing.
 *
 * @param devtools The connected session, with the tooltip card parked and scrolled to.
 */
async function hoverRevealCheck(devtools: Devtools): Promise<void> {
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  // The point comes back from the helper that dispatched the move, so this reads the place the
  // pointer actually went rather than a second copy of the same two numbers.
  const parked = await pointerAwayFromTooltips(devtools)
  const corner = await devtools.evaluate<Corner>(`(() => {
    const trigger = globalThis.__verifyTooltip?.trigger ?? null
    const at = document.elementFromPoint(${parked.x}, ${parked.y})
    return {
      tag: at === null ? "nothing" : at.tagName,
      onTrigger: trigger !== null && at !== null && (at === trigger || trigger.contains(at)),
    }
  })()`)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  const atRest = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  const onTrigger = await hoverTrigger(devtools)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const shown = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  await pointerAwayFromTooltips(devtools)
  const hidAgain = await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "the pointer alone reveals a Tooltip's hint, and taking it away hides the hint again",
    atRest.ok && !corner.onTrigger && !atRest.focused && !atRest.hover &&
      atRest.visibility === "hidden" && onTrigger.aim.onTarget &&
      onTrigger.landing?.onTarget === true && onTrigger.hovering && revealed && !shown.focused &&
      shown.rects > 0 && hidAgain && after.visibility === "hidden",
    !atRest.ok
      ? "the Tooltip card has no live row — nothing matched '[data-e2e=\"tooltip-live\"]' with a " +
        "button and a role=tooltip inside it"
      : corner.onTrigger
      ? `the pointer parked at (${parked.x}, ${parked.y}) is still on the trigger ` +
        `(elementFromPoint reads ${corner.tag}), so there is no unhovered state to start from`
      : atRest.focused
      ? "the trigger still had focus at rest, and a hint revealed by focus would prove the focus " +
        "path over again rather than the pointer one"
      : atRest.hover
      ? "the browser still had the trigger in :hover with the pointer in the corner, so nothing " +
        "below moves from anywhere"
      : atRest.visibility !== "hidden"
      ? `the hint is already ${atRest.visibility} at opacity ${atRest.opacity} with nothing ` +
        `hovering or focusing the trigger, so it is not revealed by anything — it is simply up`
      : !onTrigger.aim.onTarget
      ? `nothing of the trigger to point at: (${onTrigger.aim.x}, ${onTrigger.aim.y}) reads ` +
        `${onTrigger.aim.tag} over a ${onTrigger.aim.width}×${onTrigger.aim.height} box — this ` +
        `proves nothing`
      : onTrigger.landing === null || !onTrigger.landing.onTarget
      ? `the pointer never landed on the trigger: ${
        onTrigger.landing === null
          ? "the move never reached the page"
          : `it went to ${onTrigger.landing.tag} at (${onTrigger.landing.x}, ` +
            `${onTrigger.landing.y})`
      } — a missed move, which proves nothing`
      : !onTrigger.hovering
      ? "the browser never put the trigger into :hover with the pointer delivered onto it, so " +
        "nothing here is about hovering"
      : shown.focused
      ? "the pointer's arrival moved focus onto the trigger, so the reveal below cannot be told " +
        "from the focus one"
      : !revealed
      ? `the hint never reached the screen with the pointer resting on the trigger: visibility ` +
        `${shown.visibility}, opacity ${shown.opacity}, ${shown.rects} client rect(s). The rule ` +
        `that reveals it is \`group-hover:visible group-hover:opacity-100\`, which a browser ` +
        `answering (hover: none) compiles and never matches — check that one first`
      : !hidAgain
      ? `the hint stayed ${after.visibility} at opacity ${after.opacity} with the pointer back in ` +
        `the corner, so it never goes away and being up while hovered means nothing`
      : `at rest the hint reads visibility ${atRest.visibility} at opacity ${atRest.opacity}, ` +
        `with focus off the trigger and the pointer parked over ${corner.tag} at (${parked.x}, ` +
        `${parked.y}) → the pointer was delivered onto ${onTrigger.landing.tag} at ` +
        `(${onTrigger.landing.x}, ` +
        `${onTrigger.landing.y}) and the hint read visibility ${shown.visibility} at opacity ` +
        `${shown.opacity} over ${shown.rects} client rect(s), with focus still off the trigger → ` +
        `the pointer went back to the corner and it reads visibility ${after.visibility} again. ` +
        `The visibility flip is the reveal, and it is what takes the hint in and out of hit ` +
        `testing; the fade beside it is sampled at ${after.opacity} here because a headless page ` +
        `only advances a transition when it paints a frame`,
  )

  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
}

/**
 * Escape dismisses the hint the pointer is on, takes its description with it, and moves no focus.
 *
 * The dismissal has to work while the pointer is on the trigger and focus is somewhere else
 * entirely, which is why the component listens on `document` rather than on the trigger: a hint
 * revealed by a pointer has no focus of its own to catch the key.
 *
 * Two transitions, and neither of them is the paint — a dismissed hint loses its box and its id,
 * so this check reads what the `hidden` attribute and `aria-describedby` do, which this browser
 * runs whatever it thinks of hover.
 *
 * The last step hovers again, and it is not a formality: "the hint is gone" is also true of a
 * component that broke itself on the key press, and only a hint that comes back has been dismissed
 * rather than destroyed.
 *
 * An earlier version of this check began with a control — pointer in the corner, press Escape,
 * assert nothing happened — to pin the listener being registered only while the trigger is
 * engaged. It is gone since `#252`: the component now keeps the listener attached for its whole
 * life and decides at press time from `hovered`/`focused` instead, which is what closed the
 * same-task race `tooltipEscapeRaceCheck` proves below. The control also raced on its own terms
 * even before that fix mattered: the check before this one blurs the trigger and waits for the
 * hint to stop being shown, but that wait watches a CSS state which stops matching the instant
 * focus leaves, with no render involved, so it could return before the old effect's cleanup had
 * removed the listener. Two runs in eight then failed on the control press landing on a listener
 * that was still attached.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeOverPointerCheck(devtools: Devtools): Promise<void> {
  await pointerAwayFromTooltips(devtools)
  const hovering = await hoverTrigger(devtools)
  await devtools.evaluate<null>(`(globalThis.__verifyFocusBefore = document.activeElement, null)`)
  const before = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // Pressed inside the poll rather than before it. Nothing here can say the component's effect has
  // attached its listener — the wait that got the pointer this far is on `:hover`, which the
  // browser flips without a render — so a single press could land before the listener does and
  // leave this waiting three seconds for a dismissal nobody heard. Escape is idempotent here: once
  // the hint is dismissed, pressing it again sets the same flag.
  const gone = await poll(async () => {
    await pressKey(devtools, "Escape")
    return await devtools.evaluate<boolean>(TOOLTIP_DISMISSED)
  }, 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)
  const focusHeld = await devtools.evaluate<boolean>(
    `document.activeElement === globalThis.__verifyFocusBefore`,
  )
  const focusName = await devtools.evaluate<string>(
    `document.activeElement === document.body ? "the page" : document.activeElement.tagName`,
  )

  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_HOVERED}`), 3_000)
  const again = await hoverTrigger(devtools)
  const back = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "a real Escape press dismisses the Tooltip under the pointer, without moving focus",
    before.ok && hovering.hovering && before.boxed && before.described !== null && gone &&
      !after.boxed && after.described === null && focusHeld && again.hovering && back.boxed &&
      back.described !== null,
    !before.ok
      ? "the Tooltip card has no live row to dismiss"
      : !before.boxed
      ? "the hint had already been dismissed before this check pressed anything, so there was " +
        "nothing here to dismiss"
      : !hovering.hovering
      ? "the pointer never took the trigger into :hover, so a dismissal here proves nothing"
      : before.described === null
      ? "the trigger described nothing before the key press, so losing the description proves " +
        "nothing"
      : !gone
      ? `the hint still had a box 3s after a real Escape press, so nothing dismissed it`
      : after.described !== null
      ? `the hint is off the page but the trigger still points at it with ` +
        `aria-describedby="${after.described}", so a screen reader still reads a dismissed hint`
      : !focusHeld
      ? `Escape moved focus to ${focusName}; dismissing a hint must leave focus where it was`
      : !again.hovering
      ? "the pointer never took the trigger into :hover again, so the hint coming back cannot be " +
        "read from this"
      : !back.boxed || back.described === null
      ? "the hint never came back on the next hover, so Escape did not dismiss it — it destroyed " +
        "it"
      : `pointer onto the trigger, then Input.dispatchKeyEvent Escape: the hint lost its box and ` +
        `the trigger dropped aria-describedby="${before.described}", with focus still on ` +
        `${focusName} → pointer away and back: the hint has its box and its description again`,
  )
}

/**
 * The same dismissal from the keyboard: a focused hint goes on Escape, and focus stays put.
 *
 * Focus is placed with `.focus()` rather than by tabbing to it. The tab order between the last
 * check and this trigger belongs to the catalogue page, not to the component, so walking it would
 * assert the page's layout; the dismissal itself is a real `Input.dispatchKeyEvent` press, which
 * is the path under test.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function escapeOnFocusCheck(devtools: Devtools): Promise<void> {
  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  const revealed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const focused = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  // Inside the poll, for the reason the check above gives: the reveal this waited on is a CSS
  // state, so nothing has said the listener is attached yet, and a repeated Escape costs nothing.
  const gone = await poll(async () => {
    await pressKey(devtools, "Escape")
    return await devtools.evaluate<boolean>(TOOLTIP_DISMISSED)
  }, 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "keyboard focus reveals a Tooltip, and Escape dismisses it with focus still on the trigger",
    revealed && focused.focused && gone && after.focused && after.described === null,
    !focused.focused
      ? "focus never reached the trigger, so nothing here is about the keyboard"
      : !revealed
      ? "the hint never appeared on focus, so this component cannot be used without a pointer"
      : !gone
      ? `the hint was still on screen 3s after a real Escape press (visibility ` +
        `${after.visibility}, opacity ${after.opacity})`
      : !after.focused
      ? "Escape took focus off the trigger; a dismissal must leave focus where it was, or the " +
        "next Tab starts from somewhere the person never went"
      : after.described !== null
      ? `the hint is off screen but the trigger still points at it with ` +
        `aria-describedby="${after.described}"`
      : "focus → the hint appeared; a real Escape press → it lost its box, dropped the " +
        "description, and focus never left the trigger",
  )

  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  await pointerAwayFromTooltips(devtools)
}

/**
 * An Escape dispatched in the same task as the focus that reveals the hint must still dismiss it —
 * `#252`.
 *
 * `ui/tooltip.tsx`'s "Dismissible" bullet explains the shape this used to have: a `keydown`
 * listener that only (re)attached once `engaged` had caught up ran *after* the render an
 * `onFocusIn` handler already committed synchronously, so a key press landing in that gap found no
 * listener at all. This drives `focus()` and a bubbling synthetic Escape back to back inside one
 * `Runtime.evaluate`, before Preact's own scheduling gets a turn to run the effect that would have
 * (re)attached the old, gated listener — `pages/checks/system.ts`'s `siteHeaderEscapeRaceCheck` is
 * the reference this follows, two animation frames included: they let the *previous* engagement's
 * effect cleanup finish first, so a listener left over from an earlier press is not what this one
 * accidentally passes against.
 *
 * `Input.dispatchKeyEvent` is not used here, unlike the two checks above: those exist to prove a
 * *trusted* key press reaches the listener. This one is not about trust — a plain
 * `document.addEventListener("keydown", …)` reacts to an untrusted, synthetic event exactly the
 * same way, and what is in question is only whether a listener exists at the instant the press
 * lands, which a same-task synthetic dispatch settles on its own.
 *
 * The dismissal itself lands through a render — `dismissed.value = true` takes the `hidden`
 * attribute and `aria-describedby` off through Preact's own scheduling, not a direct DOM write —
 * so unlike `siteHeaderEscapeRaceCheck`'s `details.open`, this cannot read the outcome inside the
 * same `Runtime.evaluate` call the press was sent in. Only the focus and the key press have to
 * land in the same task; reading the result afterwards, once the render has had a chance to run,
 * still proves the listener was there when the press arrived; a stale listener from a pathological
 * old build would only make this check pass *late*, and the 3s poll bounds how late.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tooltipEscapeRaceCheck(devtools: Devtools): Promise<void> {
  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)

  const dispatched = await devtools.evaluate<boolean>(`(async () => {
    // Let the previous engagement's effect cleanup finish first — see the JSDoc above.
    for (let k = 0; k < 2; k++) {
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    }
    const trigger = globalThis.__verifyTooltip?.trigger ?? null
    if (!trigger) return false
    // Same task, back to back: the focus that engages the trigger, then the Escape.
    trigger.focus()
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    )
    return true
  })()`)

  const dismissed = await poll(() => devtools.evaluate<boolean>(TOOLTIP_DISMISSED), 3_000)
  const after = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  check(
    "an Escape dispatched in the same task as the focus that reveals the hint still dismisses it",
    dispatched && dismissed && after.described === null,
    !dispatched
      ? "the Tooltip card has no live row to focus"
      : !dismissed
      ? "the hint still had a box 3s after focus() and a same-task Escape dispatch — the listener " +
        "was not there yet when the press landed"
      : `dismissed, and aria-describedby reads ${JSON.stringify(after.described)}`,
  )

  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)
  await pointerAwayFromTooltips(devtools)
  await poll(() => devtools.evaluate<boolean>(`!${TOOLTIP_SHOWN}`), 3_000)
}

/**
 * Chromium names the trigger and reads the hint as its description.
 *
 * This is the one thing the browser can settle that markup cannot: `aria-label` on an element with
 * no role is not guaranteed to reach the accessibility tree, so the old `<span tabindex="0">`
 * could carry a name and a description that nothing ever read. Asking Chromium for the node's own
 * computed role, name and description is asking the tree itself.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function tooltipNameCheck(devtools: Devtools): Promise<void> {
  await devtools.send("DOM.enable")
  await devtools.send("Accessibility.enable")
  const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
    depth: 1,
  })
  const { nodeId } = await devtools.send<{ nodeId: number }>("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: `#demo-Tooltip [data-e2e="tooltip-live"] [aria-label]`,
  })

  const atRest = await computedNode(devtools, nodeId)
  // That first reading is evidence, not an assertion. The check before this one left the hint
  // dismissed, so it is `display: none` and Chromium reads no description off it at all — which is
  // the dismissal doing its job rather than anything about naming. The reading that answers "is
  // the hint this trigger's description" is the one taken with the hint on screen, which is why
  // the trigger is focused for it.
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.focus(), null)`)
  await poll(() => devtools.evaluate<boolean>(TOOLTIP_SHOWN), 3_000)
  const computed = await computedNode(devtools, nodeId)
  await devtools.evaluate<null>(`(globalThis.__verifyTooltip?.trigger?.blur(), null)`)

  check(
    "Chromium names the Tooltip's trigger and reads its hint as the description",
    nodeId !== 0 && computed.role === "button" && computed.name.length > 0 &&
      computed.description.length > 0 && computed.name !== computed.description,
    nodeId === 0
      ? "the Tooltip card has no live row for Chromium to read"
      : computed.role !== "button"
      ? `Chromium reads the trigger as "${computed.role}" — a name and a description on an ` +
        `element with no role of its own may never reach the accessibility tree at all ` +
        `(name "${computed.name}", description "${computed.description}")`
      : computed.name.length === 0
      ? "Chromium computes no name for the trigger, so it announces as an unnamed button"
      : computed.description.length === 0
      ? `Chromium computes no description for the trigger named "${computed.name}", so the hint ` +
        `is never read out`
      : computed.name === computed.description
      ? `the hint is the trigger's name as well as its description ("${computed.name}"), so it ` +
        `is not supplementary to anything`
      : `Chromium reads a ${computed.role} named "${computed.name}", described by ` +
        `"${computed.description}" while the hint is on screen; with the hint dismissed by the ` +
        `check before this one it reads a ${atRest.role} named "${atRest.name}" described by ` +
        `"${atRest.description}", so a dismissed hint is not announced either`,
  )
}

/**
 * Ask Chromium for one node's own computed role, name and description.
 *
 * @param devtools The connected session.
 * @param nodeId The DOM node, or `0` when the selector matched nothing.
 */
async function computedNode(devtools: Devtools, nodeId: number): Promise<Named> {
  if (nodeId === 0) return { role: "", name: "", description: "" }
  const { nodes } = await devtools.send<{
    nodes: Array<{
      role?: { value?: string }
      name?: { value?: string }
      description?: { value?: string }
    }>
  }>("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })

  return {
    role: (nodes[0]?.role?.value ?? "").trim(),
    name: (nodes[0]?.name?.value ?? "").trim(),
    description: (nodes[0]?.description?.value ?? "").trim(),
  }
}

/** A hover of the tooltip trigger, with everything a failure message needs to explain itself. */
interface Hovered {
  aim: Aim
  landing: Landing | null
  /** `true` when the browser put the trigger into `:hover` within the budget. */
  hovering: boolean
  /** What the hint looked like once the pointer had arrived. */
  state: TooltipState
}

/**
 * Point at the tooltip's trigger and wait for the hint.
 *
 * @param devtools The connected session.
 * @returns The derivation, where the move landed, and whether the browser took the trigger into
 * `:hover` — so a caller can tell a component that did nothing from a pointer that never arrived.
 */
async function hoverTrigger(devtools: Devtools): Promise<Hovered> {
  const aim = await aimAt(devtools, `globalThis.__verifyTooltip?.trigger ?? null`)
  const landing = await movePointer(devtools, aim, `globalThis.__verifyTooltip?.trigger ?? null`)
  const hovering = await poll(() => devtools.evaluate<boolean>(TOOLTIP_HOVERED), 3_000)
  const state = await devtools.evaluate<TooltipState>(TOOLTIP_STATE)

  return { aim, landing, hovering, state }
}

/**
 * Park the pointer clear of every Tooltip in the catalogue's own demo card, for the checks in this
 * file that drive that card.
 *
 * {@link pointerToCorner}'s top-left corner is not clear of it: the card pins five of its six
 * tooltips permanently open (`contentClass="visible opacity-100"`) so the catalogue can show every
 * placement at once — `top`, `right`, `bottom` and two more besides the one row left to hover — and
 * `centreInView` scrolls the page to centre the card's *last* row (the one check that reveals its
 * own hint on hover). On a viewport shorter than the card — the 780×493 this harness actually
 * measured running, not the 800×600 assumed here before that measurement — that scroll leaves the
 * card's *top* row, and the bubbles pinned above and around it (including the `bottom`-placed one,
 * which anchors *below* its own trigger and so reaches past the row nominally above it), sitting
 * within a few pixels of the viewport's own top-left corner. A pointer parked there lands on one of
 * those bubbles instead of clear space: the bubble is a descendant of its own trigger and takes
 * pointer events by design (`ui/tooltip.tsx`'s "Hoverable" bullet), so landing on it puts that
 * *other* Tooltip into `:hover` — and a real Escape pressed while the pointer sits there, meant for
 * the row under test, dismisses whichever pinned tooltip the corner happened to land on instead.
 * Found by watching the group wrapper around the `Archive` hint lose its description this way, well
 * after the check driving it had moved the pointer elsewhere on purpose — the corner was never
 * involved as far as that check's own steps went.
 *
 * The bottom-right corner was picked as clear of all of that, but only because it happens to sit on
 * the page's own vertical scrollbar rather than on the card at all — an accident of this viewport's
 * width, not a property of the card's layout the way the doc comment above describes it. So this
 * checks the actual landing spot with `elementFromPoint` before handing it back, and fails loudly —
 * a check failure, not a silent bad read — if it lands inside a tooltip bubble or its trigger,
 * rather than trusting the corner forever.
 *
 * @param devtools The connected session.
 * @returns Where the pointer now is.
 */
async function pointerAwayFromTooltips(devtools: Devtools): Promise<{ x: number; y: number }> {
  const { x, y } = await devtools.evaluate<{ x: number; y: number }>(
    `({ x: innerWidth - 4, y: innerHeight - 4 })`,
  )
  await devtools.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
    buttons: 0,
  })

  const landedInTooltip = await devtools.evaluate<boolean>(
    `(() => {
      const target = document.elementFromPoint(${x}, ${y})
      if (target === null) return false
      if (target.closest('[role="tooltip"]') !== null) return true
      const described = target.closest("[aria-describedby]")
      if (described === null) return false
      return [...described.getAttribute("aria-describedby").split(/\\s+/)]
        .some((id) => document.getElementById(id)?.getAttribute("role") === "tooltip")
    })()`,
  )
  if (landedInTooltip) {
    throw new Error(
      `pointerAwayFromTooltips's landing spot (${x}, ${y}) is inside a tooltip or its trigger ` +
        `on this run's viewport — pick a different clear spot rather than trusting the corner`,
    )
  }

  return { x, y }
}
