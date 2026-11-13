import { check, type Devtools, MISSED, poll, pressKey, readOr, settledScroll } from "../harness.ts"
import { clickAtPoint } from "./shared-forms.ts"

/** Fails the block by name when a ZoomableImages reading threw inside the page. */
export function zoomableImagesReadErrorsCheck(): void {
  // A ZoomableImages reading that threw inside the page was recorded rather than raised, so the
  // rest of this block still ran; fail the block by name now, at its end.
  if (lightboxReadErrors.length > 0) {
    throw new Error(`a ZoomableImages reading threw: ${lightboxReadErrors.join(" | ")}`)
  }
}

/**
 * Page exceptions the `ZoomableImages` readings below swallowed.
 *
 * These checks moved here from `pages/checks/system.ts` (#369), a file whose checks never throw, and
 * they kept its way of reading the page: {@link read} answers a fallback that reads as a failure
 * and records the exception here. `uiChecks` throws once at its end when anything was recorded,
 * after every other ui check has run, so a swallowed exception fails the `ui` block by name
 * instead of passing silently — an expression that throws inside `Runtime.evaluate` raises
 * no protocol event for `verify.ts`'s console-error check to find.
 */
const lightboxReadErrors: string[] = []

/**
 * Evaluate an expression in the page for the `ZoomableImages` checks, turning a page exception
 * into `fallback` and recording it in {@link lightboxReadErrors}.
 */
function read<T>(devtools: Devtools, expression: string, fallback: T): Promise<T> {
  return readOr(devtools, expression, fallback, lightboxReadErrors)
}

/** The card the lightbox checks drive. */
const LIGHTBOX = "#demo-ZoomableImages"

const DIALOG = `${LIGHTBOX} dialog`

const PLAIN_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-image"]`

const LINKED_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-linked-image"]`

/** The card's third scenario: an undescribed image inside a link, `fallbackAlt=""`. */
const BARE_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-bare-image"]`

/** Whether the lightbox is open, and where its image sits. */
interface LightboxState {
  /** Whether the dialog is really in the top layer, not merely present. */
  open: boolean
  /** The focused element, for a failure message. */
  focused: string
  /** The page's scroll position. */
  scrollY: number
  /** How many dialogs — this one or any other — are in the top layer. */
  modals: number
}

/** Read {@link LightboxState}. */
const LIGHTBOX_STATE = `(() => {
  const dialog = document.querySelector('${DIALOG}')
  const active = document.activeElement
  return {
    open: Boolean(dialog) && dialog.matches(":modal"),
    focused: active
      ? active.tagName.toLowerCase() +
        (active.getAttribute("aria-label") ? ' "' + active.getAttribute("aria-label") + '"' : "")
      : "nothing",
    scrollY: Math.round(globalThis.scrollY),
    modals: document.querySelectorAll("dialog:modal").length,
  }
})()`

const NO_LIGHTBOX: LightboxState = {
  open: false,
  focused: "the page could not be read",
  scrollY: -1,
  modals: -1,
}

/** Focus one of the card's images and settle the page, without pressing anything. */
function focusImage(devtools: Devtools, selector: string): Promise<boolean> {
  return read(
    devtools,
    `(() => {
      const image = document.querySelector('${selector}')
      if (!image) return false
      image.scrollIntoView({ block: "center", behavior: "instant" })
      image.focus()
      return document.activeElement === image
    })()`,
    false,
  )
}

/**
 * `ZoomableImages`' keyboard and its backdrop, driven in the browser that owns them.
 *
 * Enter and Space are real key presses: what opens the lightbox is the component's own `keydown`
 * listener on the image, an element with no native activation of its own, rather than a native
 * button's default action, so both keys reach it exactly as a person's would. The two clicks are
 * real mouse events at points worked out from the geometry, and each point is checked against
 * `elementFromPoint` before it is used — a press that landed somewhere else is reported as a missed
 * click and never as a failure of the component.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function zoomableImagesChecks(devtools: Devtools): Promise<void> {
  const focusedPlain = await focusImage(devtools, PLAIN_IMAGE)
  const marks = await read(
    devtools,
    `(() => {
      const images = [...document.querySelectorAll('${LIGHTBOX} [data-lightbox] img')]
      return {
        total: images.length,
        controls: images.filter((image) =>
          image.getAttribute("tabindex") === "0" && image.getAttribute("role") === "button" &&
          (image.getAttribute("aria-label") || "").length > 0
        ).length,
        names: images.map((image) => image.getAttribute("aria-label") || "unnamed"),
      }
    })()`,
    { total: 0, controls: 0, names: [] as string[] },
  )
  check(
    "every zoomable image is a control a keyboard can hold: a tab stop, a role and a name",
    marks.total > 1 && marks.controls === marks.total && focusedPlain,
    marks.total > 0
      ? `${marks.controls}/${marks.total} images carry tabindex, role=button and a name ` +
        `(${marks.names.join(", ")}), and one of them took focus: ${focusedPlain}`
      : "the card rendered no images inside the watched container",
  )

  const beforeEnter = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)
  await pressKey(devtools, "Enter")
  await poll(() => read(devtools, `${LIGHTBOX_STATE}.open`, false), 3_000)
  const afterEnter = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)
  await pressKey(devtools, "Escape")
  await poll(() => read(devtools, `${LIGHTBOX_STATE}.open === false`, false), 3_000)
  const afterEscape = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)

  check(
    "a real Enter press on a focused image opens the lightbox, and Escape closes it again",
    focusedPlain && !beforeEnter.open && afterEnter.open && !afterEscape.open,
    focusedPlain
      ? `closed → Enter → ${afterEnter.open ? "a modal dialog with focus on " : "still closed; "}` +
        `${afterEnter.focused} → Escape → ${afterEscape.open ? "still open" : "closed"}`
      : "the image never took focus, so a key press proves nothing about it",
  )

  // Space is the half of the button contract a check can really press: a real Space press *does*
  // reach a listener in headless Chromium, and an uncancelled one scrolls the page by a screen.
  //
  // Both halves are measured, and the second needs the listener below rather than the scroll
  // position alone. Measured, not assumed: with the component's `preventDefault` deleted the page
  // still did not move, because the modal dialog the same press opens stops the document
  // scrolling before the browser gets to act on the key. `defaultPrevented`, read on `document`
  // after the component's own listener, is the fact that decides whether a page would scroll.
  const focusedAgain = await focusImage(devtools, PLAIN_IMAGE)
  await settledScroll(devtools)
  await read(
    devtools,
    `(() => {
      globalThis.__lightboxSpace = { presses: 0, prevented: null }
      globalThis.__lightboxSpaceListener = (event) => {
        if (event.key !== " ") return
        globalThis.__lightboxSpace.presses++
        globalThis.__lightboxSpace.prevented = event.defaultPrevented
      }
      document.addEventListener("keydown", globalThis.__lightboxSpaceListener)
      return true
    })()`,
    false,
  )
  const beforeSpace = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)
  await pressKey(devtools, "Space")
  await poll(() => read(devtools, `${LIGHTBOX_STATE}.open`, false), 3_000)
  const afterSpace = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)
  const space = await read(
    devtools,
    `(() => {
      document.removeEventListener("keydown", globalThis.__lightboxSpaceListener)
      return globalThis.__lightboxSpace || { presses: 0, prevented: null }
    })()`,
    { presses: 0, prevented: null as boolean | null },
  )

  check(
    "a real Space press opens the lightbox, cancelled so the page cannot scroll",
    focusedAgain && !beforeSpace.open && afterSpace.open && space.presses === 1 &&
      space.prevented === true && beforeSpace.scrollY >= 0 &&
      afterSpace.scrollY === beforeSpace.scrollY,
    focusedAgain
      ? `closed → Space → ${afterSpace.open ? "open" : "still closed"}; the press reached ` +
        `document ${space.presses} time(s) with defaultPrevented=${space.prevented}, and scrollY ` +
        `went ${beforeSpace.scrollY} → ${afterSpace.scrollY}`
      : "the image never took focus, so a key press proves nothing about it",
  )

  // The backdrop, aimed at rather than guessed: halfway between the left edge of the viewport and
  // the left edge of the image, which is the dialog's own area whenever the image does not fill it.
  const aim = await read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${DIALOG}')
      const image = dialog ? dialog.querySelector("img") : null
      if (!dialog || !image) return { onTarget: false, x: 0, y: 0, landedOn: "nothing", reason: "the lightbox is not open" }
      const rect = image.getBoundingClientRect()
      if (rect.left < 16) {
        return { onTarget: false, x: 0, y: 0, landedOn: "nothing", reason: "the image reaches the edge of the viewport, so the dialog has no backdrop to click" }
      }
      const x = Math.round(rect.left / 2)
      const y = Math.round(rect.top + rect.height / 2)
      const at = document.elementFromPoint(x, y)
      return {
        onTarget: at === dialog,
        x,
        y,
        landedOn: at ? at.tagName.toLowerCase() : "nothing",
        reason: "the image sits " + Math.round(rect.left) + "px from the left edge",
      }
    })()`,
    MISSED,
  )
  if (aim.onTarget) await clickAtPoint(devtools, aim)
  await poll(() => read(devtools, `${LIGHTBOX_STATE}.open === false`, false), 3_000)
  const afterBackdrop = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)

  check(
    "a real click on the backdrop closes the lightbox",
    afterSpace.open && aim.onTarget && !afterBackdrop.open,
    afterSpace.open
      ? aim.onTarget
        ? `a click at ${aim.x},${aim.y} — ${aim.reason} — landed on the dialog itself and it ` +
          `${afterBackdrop.open ? "stayed open" : "closed"}`
        : `no click was sent: the point at ${aim.x},${aim.y} lands on ${aim.landedOn}, not the ` +
          `dialog — ${aim.reason}`
      : "the lightbox was not open, so a backdrop click proves nothing",
  )

  await bareImageRefusalCheck(devtools)

  // The linked image leaves the lightbox open, and a real Escape press is what closes it — which
  // is both the last assertion and the teardown every check after this block depends on.
  //
  // It is written as a transition for a reason worth keeping: this check used to close the dialog
  // itself and then assert the top layer was empty, so its own action produced its outcome and no
  // change to the component could turn it red.
  await linkedImageCheck(devtools)
  const beforeClose = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)
  await pressKey(devtools, "Escape")
  await poll(() => read(devtools, `${LIGHTBOX_STATE}.modals === 0`, false), 3_000)
  const afterClose = await read(devtools, LIGHTBOX_STATE, NO_LIGHTBOX)

  check(
    "a real Escape press closes the lightbox and leaves the top layer empty after it",
    beforeClose.open && beforeClose.modals === 1 && !afterClose.open && afterClose.modals === 0,
    beforeClose.open
      ? `${beforeClose.modals} dialog in the top layer → Escape → ${afterClose.modals}`
      : "the lightbox was not open, so its closing proves nothing",
  )

  // Teardown, with nothing asserted on it: a dialog left open would sit over every check that
  // runs after this block, whatever went wrong above.
  await read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${DIALOG}')
      if (dialog && dialog.open) dialog.close()
      return true
    })()`,
    false,
  )
}

/**
 * An image with no `alt` at all, where `fallbackAlt=""` has turned the substitution off, is never
 * marked a zoom control, and a real click on it — inside a link — is left uncancelled instead of
 * being cancelled for a lightbox that would have refused to open anyway.
 *
 * The measurement is `defaultPrevented`, the same one {@link linkedImageCheck} uses and for the
 * same reason: a browser follows a link exactly when the click that reached it was not cancelled,
 * so reading `defaultPrevented` on a listener that then cancels the event itself proves what a real
 * navigation would have done without ever letting the page actually move. An earlier version of
 * this check let the click really navigate to a same-page fragment. Measured in review, that left
 * the page moving for about 200 ms after the check's own wait returned, and a full run under load
 * from a concurrent build failed an unrelated check further down the file — most likely because of
 * that movement, though the failure was never reproduced.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function bareImageRefusalCheck(devtools: Devtools): Promise<void> {
  const marks = await read(
    devtools,
    `(() => {
      const image = document.querySelector('${BARE_IMAGE}')
      if (!image) return { found: false, marked: false }
      return {
        found: true,
        marked: image.hasAttribute("role") || image.hasAttribute("tabindex") ||
          image.hasAttribute("aria-label"),
      }
    })()`,
    { found: false, marked: true },
  )
  check(
    'an image with no alt and fallbackAlt="" is never marked a zoom control',
    marks.found && !marks.marked,
    marks.found
      ? `role/tabindex/aria-label present: ${marks.marked}`
      : "the card has no bare, undescribed image to check",
  )

  await read(
    devtools,
    `(() => {
      globalThis.__bareImageClick = { clicks: 0, prevented: null }
      globalThis.__bareImageListener = (event) => {
        const target = event.target
        const link = target && target.closest
          ? target.closest('[data-e2e="lightbox-bare-link"]')
          : null
        if (!link) return
        globalThis.__bareImageClick.clicks++
        globalThis.__bareImageClick.prevented = event.defaultPrevented
        event.preventDefault()
      }
      document.addEventListener("click", globalThis.__bareImageListener)
      return true
    })()`,
    false,
  )

  await read(
    devtools,
    `(document.querySelector('${BARE_IMAGE}')?.scrollIntoView({ block: "center", behavior: "instant" }), true)`,
    false,
  )
  await settledScroll(devtools)
  const aim = await read(
    devtools,
    `(() => {
      const image = document.querySelector('${BARE_IMAGE}')
      if (!image) return { onTarget: false, x: 0, y: 0, landedOn: "nothing", reason: "the bare image is missing" }
      const rect = image.getBoundingClientRect()
      const x = Math.round(rect.left + rect.width / 2)
      const y = Math.round(rect.top + rect.height / 2)
      const at = document.elementFromPoint(x, y)
      return {
        onTarget: at === image,
        x,
        y,
        landedOn: at ? at.tagName.toLowerCase() : "nothing",
        reason: Math.round(rect.width) + "×" + Math.round(rect.height) + " image",
      }
    })()`,
    MISSED,
  )
  if (aim.onTarget) await clickAtPoint(devtools, aim)
  await poll(() => read(devtools, `globalThis.__bareImageClick?.clicks === 1`, false), 3_000)
  const outcome = await read(
    devtools,
    `(() => {
      const record = globalThis.__bareImageClick || { clicks: 0, prevented: null }
      return {
        clicks: record.clicks,
        prevented: record.prevented,
        modalsOpen: document.querySelectorAll("dialog:modal").length,
      }
    })()`,
    { clicks: 0, prevented: null as boolean | null, modalsOpen: -1 },
  )

  check(
    "a real click on the undescribed, linked image is not cancelled, so the link it sits in still works",
    aim.onTarget && outcome.clicks === 1 && outcome.prevented === false && outcome.modalsOpen === 0,
    aim.onTarget
      ? `a real click on the ${aim.reason} reached document with defaultPrevented=` +
        `${outcome.prevented}, ${outcome.modalsOpen} modal dialog(s) open`
      : `no click was sent: the point at ${aim.x},${aim.y} lands on ${aim.landedOn} — ${aim.reason}`,
  )

  // Teardown: this check's own listener removed, and any dialog this scenario might have wrongly
  // opened closed, so neither leaks into a check that runs after this one.
  await read(
    devtools,
    `(() => {
      document.removeEventListener("click", globalThis.__bareImageListener)
      for (const dialog of document.querySelectorAll("dialog")) if (dialog.open) dialog.close()
      return true
    })()`,
    false,
  )
}

/**
 * An image inside a link opens the lightbox and does not follow the link.
 *
 * The measurement is `defaultPrevented`, read by a listener on `document`: a browser follows a link
 * click exactly when the event was not cancelled, and `document` is the last place the event
 * reaches, after the container the component listens on. The same listener cancels the event
 * itself, so the page cannot navigate whatever the component did — a check that left the browser on
 * another site would take every check after it down as well.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function linkedImageCheck(devtools: Devtools): Promise<void> {
  // Closed first, whatever the check before left behind: a dialog still in the top layer would
  // cover the image this one aims at, and the miss would be reported against the wrong fix.
  await read(
    devtools,
    `(() => {
      const open = document.querySelector('${DIALOG}')
      if (open && open.open) open.close()
      return true
    })()`,
    false,
  )
  await read(
    devtools,
    `(() => {
      globalThis.__lightboxLink = { clicks: 0, prevented: null, href: location.href }
      globalThis.__lightboxListener = (event) => {
        const target = event.target
        const link = target && target.closest
          ? target.closest('[data-e2e="lightbox-link"]')
          : null
        if (!link) return
        globalThis.__lightboxLink.clicks++
        globalThis.__lightboxLink.prevented = event.defaultPrevented
        event.preventDefault()
      }
      document.addEventListener("click", globalThis.__lightboxListener)
      return true
    })()`,
    false,
  )

  await read(
    devtools,
    `(document.querySelector('${LINKED_IMAGE}')?.scrollIntoView({ block: "center", behavior: "instant" }), true)`,
    false,
  )
  await settledScroll(devtools)
  const aim = await read(
    devtools,
    `(() => {
      const image = document.querySelector('${LINKED_IMAGE}')
      if (!image) return { onTarget: false, x: 0, y: 0, landedOn: "nothing", reason: "the card has no linked image" }
      const rect = image.getBoundingClientRect()
      const x = Math.round(rect.left + rect.width / 2)
      const y = Math.round(rect.top + rect.height / 2)
      const at = document.elementFromPoint(x, y)
      return {
        onTarget: at === image,
        x,
        y,
        landedOn: at ? at.tagName.toLowerCase() : "nothing",
        reason: Math.round(rect.width) + "×" + Math.round(rect.height) + " image",
      }
    })()`,
    MISSED,
  )
  if (aim.onTarget) await clickAtPoint(devtools, aim)
  await poll(() => read(devtools, `${LIGHTBOX_STATE}.open`, false), 3_000)

  const outcome = await read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${DIALOG}')
      const record = globalThis.__lightboxLink || { clicks: 0, prevented: null, href: "" }
      return {
        open: Boolean(dialog) && dialog.matches(":modal"),
        clicks: record.clicks,
        prevented: record.prevented,
        navigated: record.href !== "" && record.href !== location.href,
      }
    })()`,
    { open: false, clicks: 0, prevented: null as boolean | null, navigated: false },
  )

  check(
    "clicking an image inside a link opens the lightbox instead of following the link",
    aim.onTarget && outcome.clicks === 1 && outcome.prevented === true && outcome.open &&
      !outcome.navigated,
    aim.onTarget
      ? `a real click on the ${aim.reason} reached document with defaultPrevented=` +
        `${outcome.prevented}, the lightbox is ${outcome.open ? "open" : "closed"}, and the page ` +
        `${outcome.navigated ? "navigated away" : "is still where it was"}`
      : `no click was sent: the point at ${aim.x},${aim.y} lands on ${aim.landedOn} — ${aim.reason}`,
  )

  // The lightbox is deliberately left open: the check after this one closes it with a real Escape
  // press, which is the last thing this block proves and the teardown for everything after it.
  await read(
    devtools,
    `(document.removeEventListener("click", globalThis.__lightboxListener), true)`,
    false,
  )
}
