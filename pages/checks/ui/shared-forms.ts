import { centreInView, type Devtools, poll } from "../harness.ts"

/**
 * `EnhancedForm`, and the sign-up and contact forms its card builds from it:
 * progressive-enhancement forms proven twice — once hydrated, in the functions below, and once with
 * no script running at all, in {@link enhancedFormsNoScriptChecks}.
 *
 * Every form lives in the `EnhancedForm` card, `ui-guide/sections/enhanced-forms.tsx`, and posts to
 * `form-demo/`, a static page `pages/build.ts` copies into the artefact verbatim. With scripts on,
 * `onSubmit` intercepts every submit below and the page never navigates there — that page only
 * matters to the no-JavaScript check, which reads the method and the body off the recorded network
 * request rather than assuming either: **only the local preview server this file's own `verify` run
 * drives answers a POST there.** The published GitHub Pages copy is a static host and answers one
 * with `405`.
 *
 * **Card lifetimes.** A submit that reaches `"done"` replaces a form's fields with a thank-you
 * message for good.
 *
 * - The primary `EnhancedForm` demo has no way back, so it takes its two failure proofs first
 *   ({@link enhancedFormAsyncFailureCheck}, {@link enhancedFormSynchronousThrowCheck}, both of
 *   which land back on `"idle"`) and its success proof last ({@link enhancedFormResultChecks}).
 * - The sign-up and contact cards hold one form each and a "Start over" button that remounts it.
 *   Every check that submits one of them starts with {@link startOver}, so the order among them
 *   does not matter.
 */

/** One read of a card's live region and its `<fieldset>`. */
interface EnhancedFormReading {
  /** The region's own text. */
  region: string
  /** Whether the region carries `sr-only` — hidden from sighted users because a slot already shows
   * the same result in view; see `EnhancedForm`'s own doc for why. */
  regionSrOnly: boolean
  /** Whether the card's `<fieldset>` is disabled. `false` once no `<fieldset>` is rendered at all,
   * which is what a `done`/`failed` slot without one of its own looks like. */
  disabled: boolean
}

/** Read one card's live region and `<fieldset>` state in one round trip. */
export async function enhancedFormReading(
  devtools: Devtools,
  card: string,
): Promise<EnhancedFormReading> {
  return await devtools.evaluate<EnhancedFormReading>(`(() => {
    const c = document.querySelector('${card}')
    const region = c ? c.querySelector('[role="status"]') : null
    const fieldset = c ? c.querySelector('fieldset') : null
    return {
      region: region ? region.textContent : "",
      regionSrOnly: region ? region.className.split(/\\s+/).includes("sr-only") : false,
      disabled: fieldset ? fieldset.disabled : false,
    }
  })()`)
}

/** Whether the card's live region currently holds document focus. */
export async function regionHasFocus(devtools: Devtools, card: string): Promise<boolean> {
  return await devtools.evaluate<boolean>(
    `document.activeElement === document.querySelector('${card} [role="status"]')`,
  )
}

/**
 * Set a checkbox to `checked`, click it only if it is not already there, and read `.checked` back —
 * never assume a click landed. Every toggle in this section's cards goes through this rather than a
 * bare `?.click()`, after a mutation test found that a toggle whose selector stopped matching (a
 * renamed `data-e2e`, say) failed silently: the click was a no-op, the demo's own submit behaved as
 * if the toggle had never been touched, and the check reading the *outcome* of that submit passed or
 * failed for a reason that had nothing to do with what it thought it was testing.
 *
 * @param devtools The connected session.
 * @param selector The checkbox.
 * @param checked The state it must end up in.
 * @returns Whether the checkbox exists and now reads `checked` as asked — `false` for either a
 * missing element or a click that did not take.
 */
export async function setToggle(
  devtools: Devtools,
  selector: string,
  checked: boolean,
): Promise<boolean> {
  return await devtools.evaluate<boolean>(`(() => {
    const el = document.querySelector('${selector}')
    if (!el) return false
    if (el.checked !== ${checked}) el.click()
    return el.checked === ${checked}
  })()`).catch(() => false)
}

/** One read of whether a card is ready to be submitted again — see {@link cardCanSubmit}. */
interface CardReadiness {
  ok: boolean
  reason: string
}

/**
 * Whether a card has a submit button that is not inside a disabled `<fieldset>` — the precondition
 * every check in this section that is about to submit a card checks first, so a card an earlier
 * check left disabled, terminal (its fields replaced by a `done`/`failed` slot with no button at
 * all) or simply missing — the exact shape a renamed `data-e2e` or a mutated component leaves behind
 * — is reported as its own named failure instead of a `null` dereference a few lines further down
 * that would abort every check the rest of this file still has to run.
 *
 * @param devtools The connected session.
 * @param card The card's own selector.
 */
export async function cardCanSubmit(devtools: Devtools, card: string): Promise<CardReadiness> {
  return await devtools.evaluate<CardReadiness>(`(() => {
    const root = document.querySelector('${card}')
    if (!root) return { ok: false, reason: "no card found at all" }
    const button = root.querySelector('button[type="submit"]')
    if (!button) return { ok: false, reason: "no submit button — the card may be in its terminal, fields-replaced state" }
    const fieldset = root.querySelector("fieldset")
    if (fieldset && fieldset.disabled) return { ok: false, reason: "the card's fieldset is disabled" }
    return { ok: true, reason: "" }
  })()`).catch(() => ({ ok: false, reason: "the card could not be read at all" }))
}

/**
 * Press a sign-up or contact card's "Start over" button and wait for the fresh form it mounts, then
 * report whether that form is ready to submit, as {@link cardCanSubmit} does.
 *
 * Each of those cards holds one form, and a sent form stays sent, so every check that submits one
 * starts here. The press is a scripted `.click()` on purpose: a real click would move focus to the
 * button, and several checks below are about where focus is, and is not, when a submit lands. The
 * fresh form is recognised by its counter reading 0 and its live region being empty, which is what
 * a remount through `key` and the reset counter leave behind.
 *
 * @param devtools The connected session.
 * @param card The card's own selector, holding a `[data-e2e$="-start-over"]` button.
 */
export async function startOver(devtools: Devtools, card: string): Promise<CardReadiness> {
  const pressed = await devtools.evaluate<boolean>(`(() => {
    const button = document.querySelector('${card} [data-e2e$="-start-over"]')
    if (!button) return false
    button.click()
    return true
  })()`)
  if (!pressed) return { ok: false, reason: "the card has no Start over button" }

  const fresh = await poll(
    () =>
      devtools.evaluate<boolean>(`(() => {
        const root = document.querySelector('${card}')
        const count = root?.querySelector(
          '[data-e2e$="-subscribes"], [data-e2e$="-leads"], [data-e2e$="-submits"]',
        )
        const region = root?.querySelector('[role="status"]')
        return /: 0$/.test(count?.textContent.trim() ?? "") && (region?.textContent ?? "") === ""
      })()`),
    2_000,
  )
  if (!fresh) return { ok: false, reason: "Start over did not bring back a fresh, empty form" }
  return await cardCanSubmit(devtools, card)
}

/** Scroll an element into view, wait for the page to stop moving, then read its centre point. */
/** Scroll an element into view and read its on-screen centre — see {@link elementCenter}. */
interface ElementCenter {
  /** `true` when the element was found, scrolled to and confirmed under its own centre point. */
  ok: boolean
  x: number
  y: number
  /** Why `ok` is `false`, for the caller's own failure detail. */
  reason: string
}

/**
 * Scroll an element into view, wait for the page to stop moving, read its centre point, and confirm
 * with `elementFromPoint` that the point actually lands on the element (or a descendant of it) —
 * before any caller dispatches a real mouse event there. A point derived from a rectangle read a
 * moment too early or too late (mid-animation, or after an unrelated layout shift elsewhere on this
 * considerably tall page) can be a real coordinate that no longer lands where it was aimed, and a
 * click dispatched there proves nothing about the element the caller meant to press.
 *
 * @param devtools The connected session.
 * @param selector The element.
 */
export async function elementCenter(devtools: Devtools, selector: string): Promise<ElementCenter> {
  const found = await devtools.evaluate<boolean>(`document.querySelector('${selector}') !== null`)
  if (!found) return { ok: false, x: -1, y: -1, reason: "no such element" }

  await centreInView(devtools, `document.querySelector('${selector}')`)

  return await devtools.evaluate<ElementCenter>(`(() => {
    const el = document.querySelector('${selector}')
    if (!el) return { ok: false, x: -1, y: -1, reason: "element disappeared after settling" }
    const rect = el.getBoundingClientRect()
    const x = Math.round(rect.left + rect.width / 2)
    const y = Math.round(rect.top + rect.height / 2)
    const under = document.elementFromPoint(x, y)
    const onTarget = under !== null && (under === el || el.contains(under))
    return {
      ok: onTarget,
      x,
      y,
      reason: onTarget
        ? ""
        : "elementFromPoint(" + x + ", " + y + ") found " +
          (under ? under.tagName : "nothing") + ", not the target",
    }
  })()`).catch(() => ({ ok: false, x: -1, y: -1, reason: "the page could not be read" }))
}

/**
 * Press and release the left mouse button once at one point, through the browser's own input
 * pipeline. `clickAt` elsewhere in this file does the same for a point derived a different way;
 * this one exists for {@link doubleClickAt}, which needs `clickCount` to genuinely increment the
 * way a person's second press does rather than reusing one dispatch twice.
 *
 * @param clickCount `1` for an ordinary click, `2` for the second half of a double click —
 * `MouseEvent.detail`'s own meaning, which is what lets {@link doubleClickAt} build one from two
 * calls to this rather than duplicating the dispatch.
 */
export async function clickAtPoint(
  devtools: Devtools,
  point: { x: number; y: number },
  clickCount = 1,
): Promise<void> {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount,
    })
  }
}

/** `name` of the honeypot field, `HONEYPOT_FIELD_NAME` in `@spy4x/platform/universal/honeypot`. */
export const HONEYPOT_INPUT_SELECTOR = 'input[name="hp-field"]'

/** Fill the contact form's three fields on the given card. */
export async function fillContact(devtools: Devtools, card: string): Promise<void> {
  // Guarded rather than assumed present: a check that runs after an earlier one left the card in
  // its terminal, fields-replaced "done" state has nothing here to fill, and should report that as
  // an ordinary failed check further down — not as an uncaught page exception that takes the rest
  // of this file's checks down with it.
  await devtools.evaluate<null>(`(() => {
    const c = document.querySelector('${card}')
    const name = c?.querySelector('input[name="name"]')
    const email = c?.querySelector('input[name="email"]')
    const message = c?.querySelector('textarea[name="message"]')
    if (name) name.value = "Ada Lovelace"
    if (email) email.value = "ada@example.com"
    if (message) message.value = "Hello there."
    return null
  })()`)
}

/** Wait for the next full navigation, without throwing — see `system/`'s own copy for why. */
export async function waitForNavigation(devtools: Devtools, timeoutMs = 20_000): Promise<boolean> {
  try {
    await devtools.next("Page.loadEventFired", timeoutMs)
    return true
  } catch {
    return false
  }
}

/** What this file reads off one captured `Network.requestWillBeSent` event. */
interface CapturedRequest {
  requestId: string
  method: string
  postData?: string
  hasPostData?: boolean
}

/**
 * Wait for the next request whose URL contains `urlIncludes`, ignoring any other traffic in
 * between.
 *
 * Registered *before* the action expected to trigger it: a waiter only sees events that arrive
 * after it starts listening, so calling this after the click would race whichever request the
 * click produced.
 *
 * @param devtools The connected session.
 * @param urlIncludes Substring the request's URL must contain.
 * @param timeoutMs Budget across every non-matching event this has to skip past.
 */
export async function waitForRequest(
  devtools: Devtools,
  urlIncludes: string,
  timeoutMs: number,
): Promise<CapturedRequest | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const event = await devtools.once<
        {
          requestId: string
          request: { url: string; method: string; postData?: string; hasPostData?: boolean }
        }
      >("Network.requestWillBeSent", Math.max(deadline - Date.now(), 1))
      if (event.request.url.includes(urlIncludes)) {
        return {
          requestId: event.requestId,
          method: event.request.method,
          postData: event.request.postData,
          hasPostData: event.request.hasPostData,
        }
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * The submitted body of a captured request — inline on the event when Chromium included it, or
 * fetched separately when it only said one was there.
 */
export async function requestBody(devtools: Devtools, request: CapturedRequest): Promise<string> {
  if (request.postData !== undefined) return request.postData
  if (!request.hasPostData) return ""

  try {
    const body = await devtools.send<{ postData: string }>("Network.getRequestPostData", {
      requestId: request.requestId,
    })
    return body.postData
  } catch {
    return ""
  }
}
