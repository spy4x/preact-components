import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  navigateAndLoad,
  pointerToCorner,
  poll,
  pressKey,
  settledScroll,
} from "../harness.ts"
import { waitForNavigation } from "./shared-forms.ts"

/** A keyboard-focused link's ring, read in one palette. */
interface LinkedBadgeRing {
  /** Whether the link was found, took focus, and matched `:focus-visible`. */
  focusVisible: boolean
  /** The badge's computed `box-shadow`, where Tailwind draws the offset gap and the ring. */
  shadow: string
  /** Whether a shadow layer spreads past the offset gap, which is the ring itself being drawn. */
  ringDrawn: boolean
  ring: number[]
  offset: number[]
  ground: number[]
  /** The ring against its offset gap, and against what the badge sits on. */
  onOffset: number
  onGround: number
}

/** A link whose focus ring {@link linkFocusRingCheck} measures, and what its check calls it. */
interface FocusRingTarget {
  /** In-page selector of the link itself. */
  selector: string
  /** The component, as the check's name says it: "linked Badge", "Button link". */
  name: string
}

/**
 * A keyboard-focused link draws a focus ring that stands 3:1 off its offset gap and off the card
 * behind it, in the light and the dark palette. For a linked `Badge` (one given `href`, #473) the
 * ring is the one interactive thing `href` adds; a `Button` given `href` (#472) must keep the ring
 * its `<button>` draws.
 *
 * @param devtools The connected session, on a hydrated page.
 * @param target The link to focus, and the name its check uses.
 */
export async function linkFocusRingCheck(
  devtools: Devtools,
  target: FocusRingTarget,
): Promise<void> {
  await pointerToCorner(devtools)
  const missing = JSON.stringify(`nothing at ${target.selector}`)
  const read = async (dark: boolean): Promise<LinkedBadgeRing> => {
    // A real key press first, so the scripted focus below counts as keyboard focus.
    await pressKey(devtools, "Tab")
    return await devtools.evaluate<LinkedBadgeRing>(`(async () => {
      ${CONTRAST_HELPERS}
      const frames = () =>
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      document.documentElement.classList.toggle("dark", ${dark})
      const still = document.createElement("style")
      still.textContent = "*, *::before, *::after { transition: none !important; }"
      document.head.append(still)
      try {
        const link = document.querySelector(${JSON.stringify(target.selector)})
        if (!link) {
          return { focusVisible: false, shadow: ${missing}, ringDrawn: false, ring: [],
            offset: [], ground: [],
            onOffset: 0, onGround: 0 }
        }
        link.focus({ preventScroll: true })
        await frames()
        const style = getComputedStyle(link)
        const colourOf = (value) => {
          const probe = document.createElement("span")
          probe.style.color = value
          link.append(probe)
          const colour = getComputedStyle(probe).color
          probe.remove()
          return colour
        }
        const ringColour = colourOf(style.getPropertyValue("--tw-ring-color"))
        const ring = paint(ringColour)
        const offset = paint(colourOf(style.getPropertyValue("--tw-ring-offset-color")))
        const shown = seen(link, ringColour, { outside: true })
        const ground = shown.ground
        const reading = {
          focusVisible: link.matches(":focus-visible"),
          shadow: style.boxShadow,
          ringDrawn: [...style.boxShadow.matchAll(/0px 0px 0px (\\d+(?:\\.\\d+)?)px/g)]
            .some(([, spread]) =>
              Number(spread) > (parseFloat(style.getPropertyValue("--tw-ring-offset-width")) || 0)
            ),
          ring,
          offset,
          ground,
          onOffset: ratio(ring, offset),
          onGround: ratio(shown.text, ground),
        }
        link.blur()
        return reading
      } finally {
        still.remove()
      }
    })()`)
  }
  const wasDark = await devtools.evaluate<boolean>(
    `document.documentElement.classList.contains("dark")`,
  )
  const light = await read(false)
  const dark = await read(true)
  await devtools.evaluate(`(document.documentElement.classList.toggle("dark", ${wasDark}), null)`)
  const describe = (name: string, reading: LinkedBadgeRing) =>
    `${name}: focus-visible ${reading.focusVisible}, ring drawn ${reading.ringDrawn}, ` +
    `ring rgb(${reading.ring}) on offset ` +
    `rgb(${reading.offset}) ${reading.onOffset.toFixed(2)}:1, on card rgb(${reading.ground}) ` +
    `${reading.onGround.toFixed(2)}:1, box-shadow ${reading.shadow}`
  check(
    `a keyboard-focused ${target.name} draws a ring that stands 3:1 off its offset gap and the ` +
      "card, in light and dark",
    [light, dark].every((reading) =>
      reading.focusVisible && reading.ringDrawn &&
      reading.onOffset >= 3 &&
      reading.onGround >= 3
    ),
    `${describe("light", light)}; ${describe("dark", dark)}`,
  )
}

/** The card the `Link` checks drive, and its two links. */
export const LINK_CARD = "#demo-Link"

/** Where a card's `navigate` port reports "called N times"; {@link pressLink} reads it. */
const LINK_COUNTER = `${LINK_CARD} [data-e2e="link-navigated"]`

/** The `Button` card's routed link, its disabled link, and its `navigate` counter. */
export const BUTTON_LINK = `#demo-Button [data-e2e="button-link-routed"]`

/** One mouse press the `Link` checks send: which button, and the CDP modifier bitmask. */
export interface LinkPress {
  /** What the check's name calls this press. */
  name: string
  button: "left" | "middle"
  /** CDP's bitmask: Alt 1, Ctrl 2, Meta 4, Shift 8. */
  modifiers: number
}

/** What reached `document` for one press on a link, and what the card's `navigate` port saw. */
interface LinkOutcome {
  /** The link was there and the point aimed at lands on it. */
  aimed: boolean
  /** `click` for the primary button, `auxclick` for the middle one; `null` when nothing arrived. */
  type: string | null
  /** `defaultPrevented` as the event reached `document`, before the listener there cancelled it. */
  prevented: boolean | null
  /** How many more times `navigate` was called than before the press. */
  navigations: number
  /** Whether the page's URL changed: it must not, whatever the component did. */
  navigated: boolean
  /** Why no press was sent, when none was. */
  reason: string
}

/**
 * Press one mouse button once on a link, with modifiers, and report what reached `document`.
 *
 * A listener on `document` records `defaultPrevented` for `click` and `auxclick` and then cancels
 * the event itself, so the page never really navigates, opens a tab or starts a download, whatever
 * `Link` did. `document` is the last place the event reaches, so its reading is what the browser
 * would have acted on.
 */
export async function pressLink(
  devtools: Devtools,
  link: string,
  press: LinkPress,
  counter: string = LINK_COUNTER,
): Promise<LinkOutcome> {
  const failed = (reason: string): LinkOutcome => ({
    aimed: false,
    type: null,
    prevented: null,
    navigations: 0,
    navigated: false,
    reason,
  })
  if (!await centreInView(devtools, `document.querySelector('${link}')`)) {
    return failed(`${link} is missing or the page did not come to rest on it`)
  }
  const aim = await devtools.evaluate<{ ok: boolean; x: number; y: number; reason: string }>(
    `(() => {
    const link = document.querySelector('${link}')
    const rect = link.getBoundingClientRect()
    const x = Math.round(rect.left + rect.width / 2)
    const y = Math.round(rect.top + rect.height / 2)
    const at = document.elementFromPoint(x, y)
    const counter = document.querySelector('${counter}')
    globalThis.__linkPress = {
      events: [],
      href: location.href,
      before: Number(/called (\\d+)/.exec(counter?.textContent ?? "")?.[1] ?? 0),
    }
    globalThis.__linkListener = (event) => {
      if (event.target !== link && !link.contains(event.target)) return
      globalThis.__linkPress.events.push({ type: event.type, prevented: event.defaultPrevented })
      event.preventDefault()
    }
    document.addEventListener("click", globalThis.__linkListener)
    document.addEventListener("auxclick", globalThis.__linkListener)
    return {
      ok: at === link,
      x,
      y,
      reason: "the point at " + x + "," + y + " lands on " + (at ? at.tagName : "nothing"),
    }
  })()`,
  ).catch(() => ({ ok: false, x: 0, y: 0, reason: "the page could not be read" }))
  if (aim.ok) {
    const buttons = press.button === "left" ? 1 : 4
    for (const type of ["mousePressed", "mouseReleased"]) {
      await devtools.send("Input.dispatchMouseEvent", {
        type,
        x: aim.x,
        y: aim.y,
        button: press.button,
        buttons: type === "mousePressed" ? buttons : 0,
        clickCount: 1,
        modifiers: press.modifiers,
      })
    }
    await poll(() => devtools.evaluate<boolean>(`globalThis.__linkPress.events.length > 0`), 2_000)
  }
  const outcome = await devtools.evaluate<Omit<LinkOutcome, "aimed" | "reason">>(`(() => {
    document.removeEventListener("click", globalThis.__linkListener)
    document.removeEventListener("auxclick", globalThis.__linkListener)
    const record = globalThis.__linkPress
    const counter = document.querySelector('${counter}')
    const after = Number(/called (\\d+)/.exec(counter?.textContent ?? "")?.[1] ?? 0)
    const first = record.events[0] ?? { type: null, prevented: null }
    return {
      type: first.type,
      prevented: first.prevented,
      navigations: after - record.before,
      navigated: location.href !== record.href,
    }
  })()`).catch(() => ({ type: null, prevented: null, navigations: 0, navigated: false }))
  return { aimed: aim.ok, reason: aim.ok ? "" : aim.reason, ...outcome }
}

/** One line on what a {@link pressLink} saw, for a check's detail. */
export function describeLinkOutcome(outcome: LinkOutcome): string {
  if (!outcome.aimed) return `no press was sent: ${outcome.reason}`
  if (outcome.type === null) return "nothing reached document after the press"
  return `${outcome.type} reached document with defaultPrevented=${outcome.prevented}, navigate ` +
    `was called ${outcome.navigations} time(s), and the page ` +
    (outcome.navigated ? "navigated away" : "stayed where it was")
}

/**
 * Re-enable scripts, go back to `restoreUrl` and record whether the page hydrated again — the
 * restoring half of {@link enhancedFormsNoScriptChecks}, with the same one retry.
 */
export async function restoreHydratedPage(devtools: Devtools, restoreUrl: string, label: string) {
  await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})
  await devtools.send("Fetch.disable").catch(() => {})
  // Not a bare `Page.navigate`: `restoreUrl` carries a hash, so going to it from the same page loads
  // nothing and fires no load event, and the wait for one ran its full 20 seconds (#696).
  await navigateAndLoad(devtools, restoreUrl)
  const hydrated = () =>
    poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      10_000,
    )
  let rehydrated = await hydrated()
  if (!rehydrated) {
    await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
    await waitForNavigation(devtools)
    rehydrated = await hydrated()
  }
  check(
    `the page rehydrates after ${label}`,
    rehydrated,
    rehydrated ? "data-hydrated set again" : "the page never rehydrated, even after a retry",
  )
  await settledScroll(devtools)
}
