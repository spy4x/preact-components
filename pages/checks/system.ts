import { check, type Devtools, poll } from "./harness.ts"

/** The card these checks drive, and the pieces of it they read. */
const CARD = "#demo-SWUpdater"
const INSTALL = CARD + ' [data-e2e="sw-install"]'
const RESET = CARD + ' [data-e2e="sw-reset"]'
const RELOADS = CARD + ' [data-e2e="sw-reloads"]'
const BAR = CARD + ' [data-e2e="sw-mount"] [role="status"]'
const LOG = CARD + ' [data-e2e="sw-log"] li'

/** What the page reports about the demo registration, the bar, and the reload port. */
interface SWState {
  /** Registrations this origin holds, however scoped. */
  registrations: number
  /** Scope of the demo registration, or `""` when there is none. */
  scope: string
  /** Script URL of the active worker, or `""`. */
  active: string
  /** Script URL of the waiting worker, or `""`. */
  waiting: string
  /** Whether a worker controls the catalogue page itself. It never should. */
  controlled: boolean
  /** The bar's text, or `""` when no bar is rendered. */
  bar: string
  /** Labels of the bar's buttons, in order. */
  barButtons: string[]
  /** How many times the demo's reload port has been called. */
  reloads: string
  /** The marker parked on the page before anything was pressed; `""` once it has reloaded. */
  mark: string
  /** The card's own log, for the failure message. */
  log: string
}

/**
 * Read everything these checks assert on, in one round trip.
 *
 * `getRegistration` is given the demo's own scope rather than listing every registration: the
 * published site shares an origin with other projects, and a list would say nothing about which
 * registration belongs to this card.
 */
const READ_STATE = `(async () => {
  const scope = new URL("sw-demo/", location.href).href
  const registration = await navigator.serviceWorker.getRegistration(scope)
  const bar = document.querySelector('${BAR}')
  const reloadCount = document.querySelector('${RELOADS}')
  return {
    registrations: (await navigator.serviceWorker.getRegistrations()).length,
    scope: registration ? registration.scope : "",
    active: registration && registration.active ? registration.active.scriptURL : "",
    waiting: registration && registration.waiting ? registration.waiting.scriptURL : "",
    controlled: Boolean(navigator.serviceWorker.controller),
    bar: bar ? bar.textContent.trim() : "",
    barButtons: bar ? [...bar.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
    reloads: reloadCount ? reloadCount.textContent.trim() : "no card",
    mark: globalThis.__swUpdaterMark || "",
    log: [...document.querySelectorAll('${LOG}')].map((li) => li.textContent.trim()).join(" | "),
  }
})()`

/** The last segment of a script URL, version marker included — `sw.js?v=2`. */
function scriptName(url: string): string {
  return url ? url.slice(url.lastIndexOf("/") + 1) : "none"
}

/**
 * Click one element, or nothing at all when it is not on the page.
 *
 * A missing element has to be a failed check and never a thrown exception. This file runs before
 * three other packages', and `verify.ts` records a throw as one failed check and stops the browser
 * phase there — so a bar that did not appear would take `crud`, `charts` and `ui`'s checks down
 * with it and report far less than it knows. Measured, not feared: breaking the container lookup on
 * purpose ended a run at 43 of 46 checks instead of 55 of 60.
 *
 * @param devtools The connected session.
 * @param selector What to click.
 * @returns Whether there was anything to click.
 */
function click(devtools: Devtools, selector: string): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const element = document.querySelector('${selector}')
    if (element) element.click()
    return Boolean(element)
  })()`)
}

/**
 * Click the bar's button carrying this label, or nothing when there is no bar.
 *
 * By label rather than by position, because the labels are the component's contract — every one of
 * them is a prop with an English default — and a check keyed to "the first button" would survive
 * the two swapping places.
 *
 * @param devtools The connected session.
 * @param label The button's visible text.
 * @returns Whether there was such a button.
 */
function clickBarButton(devtools: Devtools, label: string): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const button = [...document.querySelectorAll('${BAR} button')]
      .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)})
    if (button) button.click()
    return Boolean(button)
  })()`)
}

/**
 * `system/`'s browser checks: `SWUpdater` against a real service worker.
 *
 * This is the one behaviour in the package no test here can reach. Every unit test renders to an
 * HTML string and runs no effect, so the registration — the component's whole reason to exist — had
 * never been executed anywhere, and the component spent its life looking for the service-worker
 * container on the global object, where a page never has one. It registered nothing, and no test
 * could tell.
 *
 * What the card stages, and what is asserted below, is a real update cycle: a worker registered and
 * activated, a hidden frame inside its scope for it to control, and then a second script at the same
 * scope, which installs and *waits* behind the first. `SWUpdater` is mounted only at that point, and
 * no container is passed to it, so finding the waiting worker is the component's own work.
 *
 * **The published site must never install a worker of its own**, which shapes three things here.
 * Nothing registers on load: the card has a button, this file presses it, and the first check reads
 * a freshly loaded page that holds no registration at all. The worker is scoped to `sw-demo/`, a
 * directory below this page, so the catalogue itself is never controlled — read off
 * `navigator.serviceWorker.controller` twice, once at install and once after the hand-over. And the
 * worker stores nothing and claims nobody, checked through `caches.keys()` and through an
 * uncontrolled client, because inertness is a property of what the browser ends up holding and not
 * of what a source file says.
 *
 * **The limit of that last pair: they cover storage and claiming, not interception.** A worker that
 * answered every request itself and stored nothing would leave both of them green — measured, with
 * a `fetch` handler that does exactly that, and the suite stayed at 62 of 62. What confines such a
 * worker is the scope and nothing else: it can only ever intercept requests for `sw-demo/`, which
 * holds one page that only this card opens. That is judged enough, and proving the absence of
 * interception would be more machinery than the risk deserves.
 *
 * Buttons are activated with `.click()` rather than a key press, which is measured and not assumed:
 * `ui.ts`'s Modal check records that headless Chromium does not turn Enter on a focused button into
 * the activation click a person's Enter produces. No step here is about the keyboard.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function systemChecks(devtools: Devtools): Promise<void> {
  // A marker the page keeps until it navigates. Every assertion below is about a page that must not
  // reload, and a reload wipes this.
  await devtools.evaluate<null>(`(globalThis.__swUpdaterMark = "still the first load", null)`)

  // A page inside the worker's scope, loaded before anything is registered, so it is an
  // *uncontrolled* client. This is the only place `clients.claim()` can be seen: a client that was
  // already open when a worker activates stays uncontrolled until it navigates, and claiming is
  // exactly what overrides that. Every other client here is controlled whatever the worker does —
  // a fresh navigation into an active scope is controlled by definition, and `skipWaiting()` alone
  // moves an already-controlled client to the new worker, measured here and with no claim involved.
  const probeUncontrolled = await devtools.evaluate<boolean>(`(async () => {
    const frame = document.createElement("iframe")
    frame.id = "sw-inert-probe"
    frame.title = "A page opened inside the demo worker's scope before it was registered"
    frame.src = new URL("sw-demo/", location.href).href
    frame.style.cssText = "position:absolute;left:-9999px;width:0;height:0;border:0"
    document.body.appendChild(frame)
    await new Promise((done) => frame.addEventListener("load", done, { once: true }))
    return frame.contentWindow.navigator.serviceWorker.controller === null
  })()`)
  const before = await devtools.evaluate<SWState>(READ_STATE)

  await click(devtools, INSTALL)
  const barAppeared = await poll(
    () => devtools.evaluate<boolean>(`Boolean(document.querySelector('${BAR}'))`),
    25_000,
  )
  const staged = await devtools.evaluate<SWState>(READ_STATE)

  check(
    "the catalogue registers no service worker until a visitor asks for one",
    before.registrations === 0 && before.scope === "" && before.bar === "",
    `${before.registrations} registrations and no bar on a freshly loaded page`,
  )
  check(
    "pressing the card's control installs the demo worker, scoped below this page",
    before.scope === "" && staged.scope.endsWith("/sw-demo/") &&
      staged.active.includes("sw.js?v=1") && !staged.controlled,
    `no registration → ${staged.scope || "none"} active ${scriptName(staged.active)}, ` +
      `navigator.serviceWorker.controller on this page is ${staged.controlled ? "set" : "null"}`,
  )
  // The update cycle, which is what the bar needs and what a static site makes awkward: the same
  // file under a second version marker is a second script, so the browser installs it, and it can
  // only wait because the hidden frame inside the scope is still controlled by the first.
  check(
    "a second script at the same scope leaves a worker waiting",
    staged.waiting.includes("sw.js?v=2") && staged.active.includes("sw.js?v=1"),
    `active ${scriptName(staged.active)}, waiting ${scriptName(staged.waiting)} — ${staged.log}`,
  )
  check(
    "a waiting worker makes SWUpdater's update bar appear",
    before.bar === "" && barAppeared && staged.bar.includes("New version available"),
    before.bar === ""
      ? barAppeared
        ? `the bar reads "${staged.bar}" with buttons ${staged.barButtons.join(", ")}`
        : `no bar 25s after the worker began waiting — ${staged.log}`
      : "a bar was already on the page, so its appearance proves nothing",
  )

  // `controllerchange` is constructed here and dispatched at the container, where the component
  // listens. It cannot be a real one: this page sits outside the demo worker's scope by design, so
  // a real hand-over never reaches it. An untrusted event still runs a listener — it only skips the
  // browser's own default handling, and this event has none — so what these two checks measure is
  // whether a listener is attached, and they are named for that and nothing more. Neither says
  // anything about a second tab: no check here opens one.
  const unasked = await devtools.evaluate<SWState>(`(async () => {
    navigator.serviceWorker.dispatchEvent(new Event("controllerchange"))
    await new Promise((done) => setTimeout(done, 100))
    return ${READ_STATE}
  })()`)
  check(
    "no reload listener is armed before the visitor presses Reload",
    staged.bar !== "" && unasked.reloads === "0" && unasked.mark === "still the first load",
    staged.bar !== ""
      ? `a controllerchange constructed in the page, dispatched with the bar up, called the ` +
        `reload port ${unasked.reloads} times, and the page is ${
          unasked.mark || "gone — it reloaded"
        }`
      : "the bar never appeared, so an unarmed listener proves nothing",
  )

  await clickBarButton(devtools, "Reload")
  const handedOver = await poll(
    () =>
      devtools.evaluate<boolean>(`(async () => {
        const scope = new URL("sw-demo/", location.href).href
        const registration = await navigator.serviceWorker.getRegistration(scope)
        return Boolean(registration) && registration.waiting === null &&
          Boolean(registration.active) && registration.active.scriptURL.includes("sw.js?v=2")
      })()`),
    10_000,
  )
  const asked = await devtools.evaluate<SWState>(`(async () => {
    navigator.serviceWorker.dispatchEvent(new Event("controllerchange"))
    await new Promise((done) => setTimeout(done, 100))
    return ${READ_STATE}
  })()`)

  // The demo worker answers `{ action: "skipWaiting" }` and no other message, so a hand-over is
  // proof that what the button posted is what the contract names.
  check(
    "Reload posts the skip-waiting message, and the waiting worker takes over",
    staged.waiting.includes("sw.js?v=2") && handedOver && asked.waiting === "",
    `waiting ${scriptName(staged.waiting)} → ${scriptName(asked.waiting)}, ` +
      `active ${scriptName(staged.active)} → ${scriptName(asked.active)}`,
  )
  check(
    "pressing Reload arms the listener, and it calls the reload port once",
    unasked.reloads === "0" && asked.reloads === "1",
    `the same constructed controllerchange called the reload port ${unasked.reloads} times ` +
      `before the press and ${asked.reloads} times after it`,
  )

  // What makes this worker safe to publish, asserted the way the browser answers it and never by
  // reading the worker's source: a check that grepped `sw.js` for the word `fetch` would be a
  // source-text assertion, which this repository treats as a defect, and it would pass a worker
  // that grew a cache through a helper anyway.
  //
  // Both facts are read after a full install and a hand-over, which is the point at which a worker
  // that cached or claimed would have done it. `caches.keys()` is origin-wide, so one response
  // stored from inside the worker's own scope still shows up here. The probe frame is the claim
  // detector described where it is created.
  const inert = await devtools.evaluate<{
    controller: string
    probeController: string
    caches: string[]
  }>(`(async () => {
    const probe = document.querySelector("#sw-inert-probe")
    const probeWorker = probe && probe.contentWindow
      ? probe.contentWindow.navigator.serviceWorker.controller
      : null
    return {
      controller: navigator.serviceWorker.controller
        ? navigator.serviceWorker.controller.scriptURL
        : "none",
      probeController: probeWorker ? probeWorker.scriptURL : "none",
      caches: await caches.keys(),
    }
  })()`)
  check(
    "the demo worker stores nothing and never controls the catalogue page",
    inert.controller === "none" && inert.caches.length === 0,
    `after a full install and hand-over: this page's controller is ${inert.controller}, ` +
      `and the origin holds ${inert.caches.length} cache(s)${
        inert.caches.length ? ` — ${inert.caches.join(", ")}` : ""
      }`,
  )
  check(
    "the demo worker claims no client: a page open before it installed is still uncontrolled",
    probeUncontrolled && handedOver && inert.probeController === "none",
    probeUncontrolled && handedOver
      ? `the frame inside the scope was uncontrolled before the install and its controller is ` +
        `${inert.probeController} after two activations`
      : probeUncontrolled
      ? "no hand-over happened, so an unclaimed client proves nothing"
      : "the probe frame was already controlled before anything was registered",
  )
  await devtools.evaluate<null>(`(document.querySelector("#sw-inert-probe").remove(), null)`)

  const dismissClicked = await clickBarButton(devtools, "Dismiss")
  const dismissed = dismissClicked && await poll(
    () => devtools.evaluate<boolean>(`document.querySelector('${BAR}') === null`),
    5_000,
  )
  check(
    "Dismiss puts the bar away",
    asked.bar !== "" && dismissed,
    asked.bar !== ""
      ? dismissed
        ? "the bar left the page on the visitor's word, with the worker untouched"
        : "the bar was still there 5s after Dismiss"
      : "there was no bar to dismiss",
  )

  // Clean up through the card's own control, so the check leaves the browser as it found it and the
  // control a visitor is told to press is itself proven to work.
  await click(devtools, RESET)
  const cleared = await poll(
    () =>
      devtools.evaluate<boolean>(`(async () => {
        const scope = new URL("sw-demo/", location.href).href
        return (await navigator.serviceWorker.getRegistration(scope)) === undefined &&
          document.querySelector('iframe[src$="sw-demo/"]') === null
      })()`),
    10_000,
  )
  const after = await devtools.evaluate<SWState>(READ_STATE)
  check(
    "the card's reset control unregisters the demo worker and removes its frame",
    staged.scope !== "" && cleared && after.registrations === 0,
    `${staged.registrations} registration(s) → ${after.registrations}, frame removed`,
  )
}
