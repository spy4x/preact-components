import { centreInView, check, type Devtools, pointerToCorner, poll } from "../harness.ts"
import { aimAt, clickAt } from "./shared.ts"

/** The `ErrorBoundary` card, read in one round trip. */
interface ErrorBoundaryCard {
  /** Whether the card is in the catalogue at all. */
  found: boolean
  /** Whether the fragile view's "Break this view" button is on screen. */
  view: boolean
  /** Whether the boundary's `role="alert"` screen is on screen. */
  alert: boolean
  /** The screen's `data-e2e`, or `null`. */
  alertE2E: string | null
  /** The screen's heading, as `TAG:text`. */
  heading: string
  /** The screen's description line. */
  description: string
  /** The reload button's text, or `null` when there is none. */
  reload: string | null
  /** The reload button's `data-e2e`, or `null`. */
  reloadE2E: string | null
  /** How many errors the demo's `onError` received. */
  caught: number
  /** What the demo's `onError` last received: the error as a string, and the `errorInfo` type. */
  last: string
  /** How many times the demo's `onReload` port was called. */
  reloads: number
  /** Whether the marker set before the first click survived, which a real reload would wipe. */
  marker: boolean
  /** The page's address, which a real reload or navigation could change. */
  href: string
}

const ERROR_BOUNDARY_CARD = `(() => {
  const card = document.querySelector("#demo-ErrorBoundary")
  const alert = card?.querySelector('[role="alert"]') ?? null
  const button = alert?.querySelector("button") ?? null
  const heading = alert?.querySelector("h1, h2, h3, h4") ?? null
  const count = (hook) => Number(card?.querySelector('[data-e2e="' + hook + '"]')?.textContent ?? -1)
  return {
    found: card !== null,
    view: card?.querySelector('[data-e2e="error-boundary-break"]') != null,
    alert: alert !== null,
    alertE2E: alert?.getAttribute("data-e2e") ?? null,
    heading: heading === null ? "" : heading.tagName + ":" + heading.textContent.trim(),
    description: alert?.querySelector("p")?.textContent.trim() ?? "",
    reload: button === null ? null : button.textContent.trim(),
    reloadE2E: button?.getAttribute("data-e2e") ?? null,
    caught: count("error-boundary-caught"),
    last: card?.querySelector('[data-e2e="error-boundary-last"]')?.textContent.trim() ?? "",
    reloads: count("error-boundary-reloads"),
    marker: globalThis.__verifyErrorBoundaryMarker === true,
    href: location.href,
  }
})()`

/**
 * `ErrorBoundary`, driven with real clicks on its card (#581): a view that throws on a click is
 * replaced by the reload screen, `onError` hears the error exactly once, and the Reload button
 * calls the `onReload` port the demo injects rather than reloading the catalogue.
 *
 * A server render runs no error boundary, so this is the only proof that the boundary catches.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function errorBoundaryChecks(devtools: Devtools): Promise<void> {
  const view = `document.querySelector('#demo-ErrorBoundary [data-e2e="error-boundary-break"]')`
  const reload = `document.querySelector('#demo-ErrorBoundary [role="alert"] button')`
  await devtools.evaluate<null>(`(globalThis.__verifyErrorBoundaryMarker = true, null)`)
  const before = await devtools.evaluate<ErrorBoundaryCard>(ERROR_BOUNDARY_CARD)

  await centreInView(devtools, view)
  const breakAim = await aimAt(devtools, view)
  const broke = breakAim.onTarget ? await clickAt(devtools, breakAim, view) : null
  const shown = await poll(
    () => devtools.evaluate<boolean>(`${reload} !== null`),
    2_000,
  )
  // Long enough for a second report, from a re-render that threw again, to land.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const caught = await devtools.evaluate<ErrorBoundaryCard>(ERROR_BOUNDARY_CARD)

  check(
    "a view that throws on a click inside `ErrorBoundary` is replaced by its reload screen",
    before.found && before.view && !before.alert && broke?.onTarget === true && shown &&
      !caught.view && caught.alert && caught.alertE2E === "error-boundary-screen" &&
      caught.heading === "H4:Something went wrong." &&
      caught.description === "Reloading the page usually fixes it." &&
      caught.reload === "Reload the page" && caught.reloadE2E === "error-boundary-screen-reload",
    !before.found
      ? "no #demo-ErrorBoundary card in the catalogue"
      : !before.view || before.alert
      ? `the card did not start on its working view (view=${before.view}, alert=${before.alert})`
      : broke?.onTarget !== true
      ? `the click on "Break this view" landed on ${broke?.tag ?? breakAim.tag}`
      : `view=${caught.view} alert=${caught.alert} data-e2e=${caught.alertE2E} ` +
        `heading=${JSON.stringify(caught.heading)} description=${
          JSON.stringify(caught.description)
        } button=${JSON.stringify(caught.reload)} button data-e2e=${caught.reloadE2E}`,
  )
  check(
    "`ErrorBoundary` hands the caught error and Preact's `errorInfo` to `onError` exactly once",
    before.caught === 0 && caught.caught === 1 &&
      caught.last ===
        "Error: The ErrorBoundary demo view broke on purpose., with object errorInfo",
    `onError calls: ${before.caught} before the click, ${caught.caught} after; last received ` +
      JSON.stringify(caught.last),
  )

  const reloadAim = await aimAt(devtools, reload)
  const pressed = reloadAim.onTarget ? await clickAt(devtools, reloadAim, reload) : null
  const mended = await poll(
    () => devtools.evaluate<boolean>(`${view} !== null`),
    2_000,
  )
  const after = await devtools.evaluate<ErrorBoundaryCard>(ERROR_BOUNDARY_CARD)
  check(
    "`ErrorBoundary`'s Reload button calls the injected `onReload` port, not `location.reload()`",
    pressed?.onTarget === true && mended && after.reloads === 1 && after.marker &&
      after.href === caught.href && !after.alert,
    !reloadAim.onTarget
      ? `the Reload button's centre reads ${reloadAim.tag}, so there was nothing to click`
      : pressed === null
      ? "the page lost the record of the click on Reload, so it reloaded or navigated"
      : !pressed.onTarget
      ? `the click on Reload landed on ${pressed.tag}`
      : `onReload calls ${after.reloads}; marker ${
        after.marker ? "kept" : "gone, so the page really reloaded"
      }; address ${caught.href} → ${after.href}; view back ${mended}; screen still up ${after.alert}`,
  )

  // The fresh boundary the key change mounted catches a second throw on its own.
  await centreInView(devtools, view)
  const againAim = await aimAt(devtools, view)
  const rebroke = againAim.onTarget ? await clickAt(devtools, againAim, view) : null
  const again = await poll(() => devtools.evaluate<boolean>(`${reload} !== null`), 2_000)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const second = await devtools.evaluate<ErrorBoundaryCard>(ERROR_BOUNDARY_CARD)
  check(
    "an `ErrorBoundary` remounted by a `key` change catches a second throw and reports it once",
    rebroke?.onTarget === true && again && second.alert && !second.view && second.caught === 2 &&
      second.marker,
    rebroke?.onTarget !== true
      ? `the second click on "Break this view" landed on ${rebroke?.tag ?? againAim.tag}`
      : `screen ${second.alert}; view ${second.view}; onError calls ${second.caught}; marker ${
        second.marker ? "kept" : "gone"
      }`,
  )
  // Leave the card on its working view for anyone who reads it after this block.
  const mendAim = await aimAt(devtools, reload)
  if (mendAim.onTarget) await clickAt(devtools, mendAim, reload)
  await poll(() => devtools.evaluate<boolean>(`${view} !== null`), 2_000)
  await pointerToCorner(devtools)
}
