import { check, type Devtools, poll, pressKey } from "./harness.ts"

/** The card these checks drive, and the pieces of it they read. */
const CARD = "#demo-SWUpdater"
const INSTALL = CARD + ' [data-e2e="sw-install"]'
const RESET = CARD + ' [data-e2e="sw-reset"]'
const RELOADS = CARD + ' [data-e2e="sw-reloads"]'
/**
 * The live region of the mounted component, and the bar inside it.
 *
 * These used to be one selector, because the bar *was* the region: it carried `role="status"` and
 * it only existed once there was an update. They are two elements now, and the distinction matters
 * to every check below — the region is in the page before anything happens, so a check that looked
 * for `[role="status"]` and found one would prove nothing at all about the bar having appeared.
 */
const REGION = CARD + ' [data-e2e="sw-mount"] [role="status"]'
const BAR = REGION + " > div"
const LOG = CARD + ' [data-e2e="sw-log"] li'

/** The card that mounts the component with nothing waiting, and the pieces of it. */
const QUIET = CARD + ' [data-e2e="sw-quiet"]'
const QUIET_REGION = QUIET + ' [role="status"]'
const QUIET_BAR = QUIET_REGION + " > div"
const QUIET_ANNOUNCE = QUIET + ' [data-e2e="sw-quiet-announce"]'
/** The message that card passes as a prop. Not the component's English default, on purpose. */
const QUIET_MESSAGE = "A newer catalogue build is ready"

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
 * A missing element has to be a failed check and never a thrown exception. What a throw costs is
 * the rest of this package's own block: `verify.ts` records it as one failed check naming `system`,
 * and every check after it in this file is replaced by that one line, so a bar that did not appear
 * would report far less than it knows.
 *
 * It used to cost more, and the measurement is worth keeping as history rather than as a
 * description of the runner. Until `verify.ts` began running each package isolated from the others,
 * a throw here stopped the whole browser phase, so a missing bar took `crud`, `charts` and `ui`'s
 * checks down with it too: measured, not feared — breaking the container lookup on purpose ended a
 * run at 43 of 46 checks instead of 55 of 60.
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
 * @param bar Which bar to press it in; defaults to the live demo's.
 * @returns Whether there was such a button.
 */
function clickBarButton(devtools: Devtools, label: string, bar = BAR): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const button = [...document.querySelectorAll('${bar} button')]
      .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)})
    if (button) button.click()
    return Boolean(button)
  })()`)
}

/**
 * `system/`'s browser checks: the calendar's keyboard, the lightbox's, and `SWUpdater` against a
 * real service worker.
 *
 * The three run in that order, and the order is the point. The service-worker block below stages a
 * real registration, a hidden frame inside its scope and a hand-over between two workers; it is the
 * only part of this file with state outside the page, so nothing that could be affected by it runs
 * after it. The lightbox opens a real modal `<dialog>`, which would sit in the top layer over every
 * check that came after if it ever refused to close — `ui.ts` answers that risk by running Modal
 * last of everything, and this file cannot, because `verify.ts` fixes the order of the packages. So
 * the lightbox block closes its dialog unconditionally at the end and asserts that the top layer is
 * empty, which is the same guarantee bought with a teardown instead of an ordering.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function systemChecks(devtools: Devtools): Promise<void> {
  await liveRegionChecks(devtools)
  await calendarChecks(devtools)
  await imageLightboxChecks(devtools)
  await serviceWorkerChecks(devtools)
  check(
    "every reading this file took came back without a page exception",
    pageErrors.length === 0,
    pageErrors.length === 0
      ? "each expression this file evaluated returned a value"
      : pageErrors.join(" | "),
  )
}

/** What one reading of the always-present live region and the observer watching it reports. */
interface RegionState {
  /** Whether the region is in the page at all. */
  found: boolean
  /** Whether it is the very element that was parked before any update. */
  same: boolean
  /** Whether that element is still attached to the document. */
  connected: boolean
  /** Everything the region reads, trimmed. */
  text: string
  /** How many element children it holds; `-1` when there is no region. */
  children: number
  /** The visible bar's text, or `""` when no bar is rendered. */
  bar: string
  /** The region's own height in CSS pixels; `-1` when there is no region. */
  height: number
  /** Mutation records the observer collected whose target is the region itself. */
  mutationsOnRegion: number
  /** Nodes added to the region, across every record so far. */
  added: number
  /** Nodes removed from it, across every record so far. */
  removed: number
}

/**
 * Read the live region, its box and everything the observer has recorded, in one round trip.
 *
 * The identity comparison is the load-bearing part. A reading that only asked "is there a region
 * with the message in it?" would be just as true of the code this change replaces, where the region
 * was created *carrying* its message — which is the defect. So the element is parked on
 * `globalThis` before anything happens and every later reading is compared against that reference.
 */
const READ_REGION = `(() => {
  const region = document.querySelector('${QUIET_REGION}')
  const bar = document.querySelector('${QUIET_BAR}')
  const box = region ? region.getBoundingClientRect() : null
  const records = globalThis.__swRegionMutations || []
  return {
    found: Boolean(region),
    same: Boolean(region) && region === globalThis.__swRegionElement,
    connected: Boolean(region) && region.isConnected,
    text: region ? region.textContent.trim() : "",
    children: region ? region.childElementCount : -1,
    bar: bar ? bar.textContent.trim() : "",
    height: box ? Math.round(box.height) : -1,
    mutationsOnRegion: records.filter((record) => record.onRegion).length,
    added: records.reduce((total, record) => total + record.added, 0),
    removed: records.reduce((total, record) => total + record.removed, 0),
  }
})()`

/** The region as it is before anything has happened: its marking, its emptiness and its box. */
interface IdleRegion {
  role: string | null
  live: string | null
  atomic: string | null
  /** Everything it reads. It has to be `""`. */
  text: string
  children: number
  /** Whether a visible bar was already rendered. It must not be. */
  bar: boolean
  height: number
  /** Border, padding, margin and minimum height, in one string, so a box shows up in the detail. */
  box: string
}

/** A reading that reads as a failure everywhere, for when the expression itself threw. */
const NO_REGION: RegionState = {
  found: false,
  same: false,
  connected: false,
  text: "",
  children: -1,
  bar: "",
  height: -1,
  mutationsOnRegion: 0,
  added: 0,
  removed: 0,
}

/**
 * `SWUpdater`'s live region, before, during and after there is something to announce.
 *
 * This is the proof for issue #169, and what it can and cannot show is worth stating plainly. **No
 * screen reader is run here, or anywhere in this repository.** What these checks demonstrate is the
 * markup and the order in which the DOM changes: a region that is in the page, empty, before
 * anything has happened, and a message that later arrives as a mutation of that same element rather
 * than as a new element carrying text. That is the footing the decision was taken on — assistive
 * technology announces a change to a region it is already watching, and commonly says nothing about
 * a region that arrives with its message in place — and it is not a demonstration that any
 * particular screen reader speaks.
 *
 * Two of these checks exist specifically to rule out the second cause. Finding "a region with the
 * message in it" after the update would pass just as well against the old code, where the region
 * and its message were mounted together. So a reference to the element is parked before the update
 * and compared by identity afterwards, and a `MutationObserver` is attached to that same element
 * beforehand, which is as close to the way assistive technology watches a region as a check here
 * can get: it records nothing at all unless the node it was given is still the node that changed.
 *
 * The card this drives mounts the component against a container that exists only in the page, so
 * nothing is registered with the browser and the whole sequence is synchronous — no timers, no
 * waiting on a worker state machine, and nothing left behind for the service-worker block further
 * down to trip over.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function liveRegionChecks(devtools: Devtools): Promise<void> {
  const idle = await read(
    devtools,
    `(() => {
      const region = document.querySelector('${QUIET_REGION}')
      if (!region) return null
      globalThis.__swRegionElement = region
      globalThis.__swRegionMutations = []
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          globalThis.__swRegionMutations.push({
            onRegion: record.target === globalThis.__swRegionElement,
            added: record.addedNodes.length,
            removed: record.removedNodes.length,
          })
        }
      })
      observer.observe(region, { childList: true, subtree: true, characterData: true })
      globalThis.__swRegionObserver = observer
      const style = getComputedStyle(region)
      return {
        role: region.getAttribute("role"),
        live: region.getAttribute("aria-live"),
        atomic: region.getAttribute("aria-atomic"),
        text: region.textContent.trim(),
        children: region.childElementCount,
        bar: Boolean(document.querySelector('${QUIET_BAR}')),
        height: Math.round(region.getBoundingClientRect().height),
        box: [
          style.borderTopWidth, style.borderBottomWidth,
          style.paddingTop, style.paddingBottom,
          style.marginTop, style.marginBottom,
          style.minHeight,
        ].join(" "),
      }
    })()`,
    null as IdleRegion | null,
  )

  await click(devtools, QUIET_ANNOUNCE)
  const barUp = await poll(
    () => read(devtools, `Boolean(document.querySelector('${QUIET_BAR}'))`, false),
    5_000,
  )
  const announced = await read(devtools, READ_REGION, NO_REGION)

  await clickBarButton(devtools, "Dismiss", QUIET_BAR)
  const barGone = await poll(
    () => read(devtools, `document.querySelector('${QUIET_BAR}') === null`, false),
    5_000,
  )
  const dismissed = await read(devtools, READ_REGION, NO_REGION)

  await click(devtools, QUIET_ANNOUNCE)
  const barBack = await poll(
    () => read(devtools, `Boolean(document.querySelector('${QUIET_BAR}'))`, false),
    5_000,
  )
  const again = await read(devtools, READ_REGION, NO_REGION)

  check(
    "SWUpdater's live region is in the page before there is anything to announce",
    Boolean(idle) && idle?.role === "status" && idle?.live === "polite" &&
      idle?.atomic === "true" && idle?.text === "" && idle?.children === 0 && idle?.bar === false,
    idle
      ? `role="${idle.role}" aria-live="${idle.live}" aria-atomic="${idle.atomic}", ` +
        `${idle.children} element children, text ${JSON.stringify(idle.text)}, ` +
        `and ${idle.bar ? "a bar was already there" : "no bar"}`
      : "the component was not mounted, so there was no region to read",
  )
  check(
    "an empty SWUpdater live region reserves no height, and gives it back when the bar goes",
    idle?.height === 0 && idle?.box === "0px 0px 0px 0px 0px 0px 0px" &&
      announced.height > 0 && dismissed.height === 0,
    idle
      ? `${idle.height}px tall empty, ${announced.height}px with the bar, ` +
        `${dismissed.height}px again once it was dismissed — and empty it carries ` +
        `border/padding/margin/min-height of ${idle.box}`
      : "the component was not mounted, so there was no box to measure",
  )
  check(
    "the update message arrives inside the live region that was already in the page",
    idle?.text === "" && barUp && announced.same && announced.connected &&
      announced.bar.includes(QUIET_MESSAGE) && announced.text.includes(QUIET_MESSAGE),
    idle?.text === ""
      ? barUp
        ? `the element parked while the region was empty is ${
          announced.same ? "the same element" : "NOT the element"
        } that now reads ${JSON.stringify(announced.text)}, and it is ${
          announced.connected ? "still in the document" : "detached"
        } — a message the card passes as a prop, so no English default could have produced it`
        : "no bar appeared within 5s of the card reporting an update"
      : "the region already had text before the update, so nothing here proves an arrival",
  )
  check(
    "a MutationObserver watching that region records the message arriving as a change to it",
    idle?.children === 0 && announced.mutationsOnRegion >= 1 && announced.added >= 1,
    idle?.children === 0
      ? `an observer attached to the empty region recorded ${announced.mutationsOnRegion} ` +
        `change(s) to that node and ${announced.added} node(s) added to it — a region created ` +
        `together with its message would have recorded none, because the observer would have ` +
        `been watching an element the page had thrown away`
      : "the region was not empty when the observer was attached",
  )
  check(
    "dismissing the bar empties the live region instead of replacing it",
    barGone && dismissed.same && dismissed.connected && dismissed.text === "" &&
      dismissed.children === 0 && dismissed.removed >= 1,
    barGone
      ? `the region is ${dismissed.same ? "the same element" : "a different element"}, now ` +
        `holding ${dismissed.children} children and reading ${
          JSON.stringify(dismissed.text)
        }, with ${dismissed.removed} node(s) recorded leaving it`
      : "the bar was still there 5s after Dismiss",
  )
  check(
    "an update after a dismissal arrives again, as a fresh change to the same region",
    barBack && again.same && again.text.includes(QUIET_MESSAGE) && again.added > announced.added,
    barBack
      ? `after a dismissal the same region went back to reading ${
        JSON.stringify(again.text)
      }, with the observer's count of nodes added rising from ${announced.added} to ${again.added}`
      : "the bar never came back after a dismissal, so a dismissed visitor is never told again",
  )

  // Put the card back the way it was found and stop the observer: the checks below this one read
  // the other SWUpdater card, and a live observer on a page is a cost every later check would pay.
  await read(
    devtools,
    `(() => {
      if (globalThis.__swRegionObserver) globalThis.__swRegionObserver.disconnect()
      delete globalThis.__swRegionObserver
      delete globalThis.__swRegionElement
      delete globalThis.__swRegionMutations
      const dismiss = [...document.querySelectorAll('${QUIET_BAR} button')]
        .find((button) => button.textContent.trim() === "Dismiss")
      if (dismiss) dismiss.click()
      return true
    })()`,
    false,
  )
}

/**
 * `SWUpdater` against a real service worker.
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
async function serviceWorkerChecks(devtools: Devtools): Promise<void> {
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

/** The card the calendar checks drive, and the pieces of it they read. */
const CALENDAR = '#demo-Calendar [data-e2e="calendar-interactive"]'
const GRID = `${CALENDAR} [role="grid"]`
const HEADING = `${CALENDAR} h3`
const HINT = `${CALENDAR} [data-calendar-hint]`
const MONTH_ECHO = `${CALENDAR} [data-e2e="calendar-month"]`
const LOCALE_CARD = '#demo-Calendar [data-e2e="calendar-locale"]'

/** The card the lightbox checks drive. */
const LIGHTBOX = "#demo-ImageLightbox"
const DIALOG = `${LIGHTBOX} dialog`
const PLAIN_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-image"]`
const LINKED_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-linked-image"]`

/**
 * Page exceptions the readings below swallowed.
 *
 * A check must never throw: `verify.ts` records a throw as one failed check naming `system` and
 * drops the rest of this file's checks — and, before each package was run isolated from the others,
 * it stopped the whole browser phase and took `crud`, `charts` and `ui`'s checks with it. So every
 * reading goes through {@link read}, a reading that failed leaves its message here, and `systemChecks`
 * turns the collection into a check of its own — otherwise a swallowed exception would be a silent
 * pass, because an expression that throws inside `Runtime.evaluate` raises no protocol event for
 * `verify.ts`'s console-error check to find.
 */
const pageErrors: string[] = []

/**
 * Evaluate an expression in the page, turning a page exception into a value.
 *
 * @param devtools The connected session.
 * @param expression JavaScript to run.
 * @param fallback What to return when the expression threw; it should be a value whose check reads
 *                 as a failure, never one that reads as a pass.
 */
async function read<T>(devtools: Devtools, expression: string, fallback: T): Promise<T> {
  try {
    return await devtools.evaluate<T>(expression)
  } catch (error) {
    pageErrors.push(error instanceof Error ? error.message : String(error))
    return fallback
  }
}

/**
 * Wait until the page has stopped scrolling, and answer where it stopped.
 *
 * The catalogue scrolls smoothly (`pages/styles.css` sets `scroll-behavior: smooth`), so a rectangle
 * read straight after `scrollIntoView` is the rectangle of a page still on its way and a scroll
 * position read then is still moving. Every measurement below that depends on either one waits here
 * first — measured, not feared: without it a click aimed at an image landed 14 000 pixels down the
 * document, and a scroll assertion read a hundred pixels of leftover animation as a key that
 * scrolled the page.
 *
 * @param devtools The connected session.
 * @returns The settled scroll position, or `-1` when it never settled.
 */
async function settleScroll(devtools: Devtools): Promise<number> {
  let previous = -1
  for (let attempt = 0; attempt < 30; attempt++) {
    const now = await read(devtools, "Math.round(globalThis.scrollY)", -1)
    if (now >= 0 && now === previous) return now
    previous = now
    await new Promise((done) => setTimeout(done, 100))
  }
  return -1
}

/** Where the focus is, and what the calendar is showing, in one round trip. */
interface CalendarState {
  /** `data-calendar-date` of the focused element, or `""` when focus is not on a day. */
  date: string
  /** Whether the focused element is a day cell of this grid. */
  inGrid: boolean
  /** What the focused element is, for a failure message. */
  focused: string
  /** The month heading, e.g. `March 2026`. */
  heading: string
  /** The anchor the card echoes back from `onSelectMonth`. */
  month: string
  /** The hint under the grid, and whether it is on screen. */
  hint: string
  hintShown: boolean
  /** Dates of the focused cell's own row, in column order. */
  row: string[]
  /** The page's scroll position, which no key the grid answers may change. */
  scrollY: number
}

/** Read {@link CalendarState}. Written to survive every element it names being absent. */
const CALENDAR_STATE = `(() => {
  const active = document.activeElement
  const grid = document.querySelector('${GRID}')
  const hint = document.querySelector('${HINT}')
  const heading = document.querySelector('${HEADING}')
  const month = document.querySelector('${MONTH_ECHO}')
  const date = active && active.getAttribute ? (active.getAttribute("data-calendar-date") || "") : ""
  const row = active && active.closest ? active.closest('[role="row"]') : null
  return {
    date,
    inGrid: Boolean(grid && active && grid.contains(active) && date),
    focused: active
      ? active.tagName.toLowerCase() + (active.getAttribute("aria-label")
        ? ' "' + active.getAttribute("aria-label") + '"'
        : "")
      : "nothing",
    heading: heading ? heading.textContent.trim() : "",
    month: month ? month.textContent.trim() : "",
    hint: hint ? hint.textContent.trim() : "",
    hintShown: Boolean(hint) && getComputedStyle(hint).display !== "none",
    row: row
      ? [...row.querySelectorAll("[data-calendar-date]")].map((cell) =>
        cell.getAttribute("data-calendar-date")
      )
      : [],
    scrollY: Math.round(globalThis.scrollY),
  }
})()`

/** A reading that says "nothing could be read", so a check built on it fails rather than passes. */
const NO_CALENDAR: CalendarState = {
  date: "",
  inGrid: false,
  focused: "the page could not be read",
  heading: "",
  month: "",
  hint: "",
  hintShown: false,
  row: [],
  scrollY: -1,
}

/** Put the focus back on the grid's own Tab stop, between checks. */
function focusGrid(devtools: Devtools): Promise<boolean> {
  return read(
    devtools,
    `(() => {
      const cell = document.querySelector('${GRID} [data-calendar-date][tabindex="0"]')
      if (cell) cell.focus()
      return Boolean(cell)
    })()`,
    false,
  )
}

/**
 * `Calendar`'s keyboard, driven in the browser that owns it.
 *
 * Every assertion here is a transition — the date focus was on before a key, and the date it is on
 * after — because an end state proves nothing about movement: "focus is on the 15th" is equally
 * true of a grid that has never moved at all. The one structural check, that the grid is a grid of
 * rows and cells, is named for being structural.
 *
 * Nothing is activated with `.click()` except the locale buttons, which are ordinary buttons and
 * not what is under test. Every key is a real press through the browser's own input pipeline.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function calendarChecks(devtools: Devtools): Promise<void> {
  // The grid is put in the middle of the viewport before anything is pressed, so that a key which
  // moves the focus one row cannot scroll the page merely by bringing a cell into view — the
  // scroll assertions below would otherwise be measuring the wrong thing.
  const start = await read(
    devtools,
    `(() => {
      const card = document.querySelector('${CALENDAR}')
      if (!card) return { staged: false, cells: 0, detail: "no interactive calendar on the page" }
      card.scrollIntoView({ block: "center", behavior: "instant" })
      const arrow = card.querySelector('button[aria-label^="Next month"]')
      if (!arrow) return { staged: false, cells: 0, detail: "the card has no next-month button" }
      arrow.focus()
      const grid = card.querySelector('[role="grid"]')
      const rect = grid ? grid.getBoundingClientRect() : null
      return {
        staged: document.activeElement === arrow,
        cells: card.querySelectorAll("[data-calendar-date]").length,
        fits: Boolean(rect) && rect.top >= 0 && rect.bottom <= globalThis.innerHeight,
        detail: rect
          ? "the grid occupies " + Math.round(rect.top) + "–" + Math.round(rect.bottom) +
            " of a " + globalThis.innerHeight + "px viewport"
          : "the card has no grid",
      }
    })()`,
    { staged: false, cells: 0, fits: false, detail: "the page could not be read" },
  )
  await settleScroll(devtools)

  await pressKey(devtools, "Tab")
  const entered = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "Tab")
  const left = await read(devtools, CALENDAR_STATE, NO_CALENDAR)

  check(
    "one Tab press reaches the whole month grid, and one more leaves it",
    start.staged && entered.inGrid && !left.inGrid && start.cells > 27,
    start.staged
      ? `Tab from the month arrow landed on ${entered.date || "nothing"}, and the next Tab left ` +
        `the grid for ${left.focused} — ${start.cells} days behind one Tab stop rather than ` +
        `${start.cells} of them`
      : `nothing to Tab into: ${start.detail}`,
  )

  await focusGrid(devtools)
  await settleScroll(devtools)
  const before = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "ArrowRight")
  const right = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "ArrowDown")
  const down = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "ArrowUp")
  await pressKey(devtools, "ArrowLeft")
  const back = await read(devtools, CALENDAR_STATE, NO_CALENDAR)

  check(
    "the arrow keys move the focus a day and a week through the grid",
    before.date !== "" && right.date === dayAfter(before.date, 1) &&
      down.date === dayAfter(before.date, 8) && back.date === before.date,
    before.date
      ? `${before.date} → right ${right.date || "nowhere"} → down ${down.date || "nowhere"} → ` +
        `up and left ${back.date || "nowhere"}`
      : "the focus never reached a day cell, so no movement could be measured",
  )

  // Staged in the middle of a week rather than wherever the arrows left off, so both presses have
  // somewhere to go: "End did not move" and "End was already there" are the same reading, and a
  // fixture whose first day happened to sit at the end of a row would make the second one true.
  const midweek = await read(
    devtools,
    `(() => {
      const grid = document.querySelector('${GRID}')
      if (!grid) return { staged: false, from: "", first: "", last: "", reason: "no grid" }
      for (const row of grid.querySelectorAll('[role="row"]')) {
        const cells = [...row.querySelectorAll("[data-calendar-date]")]
        if (cells.length < 3) continue
        const middle = cells[Math.floor(cells.length / 2)]
        middle.focus()
        return {
          staged: document.activeElement === middle,
          from: middle.getAttribute("data-calendar-date"),
          first: cells[0].getAttribute("data-calendar-date"),
          last: cells[cells.length - 1].getAttribute("data-calendar-date"),
          reason: "",
        }
      }
      return { staged: false, from: "", first: "", last: "", reason: "no week with three days on it" }
    })()`,
    { staged: false, from: "", first: "", last: "", reason: "the page could not be read" },
  )
  await pressKey(devtools, "End")
  const end = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "Home")
  const home = await read(devtools, CALENDAR_STATE, NO_CALENDAR)

  check(
    "End and Home move the focus to the ends of the week it is on",
    midweek.staged && midweek.from !== midweek.first && midweek.from !== midweek.last &&
      end.date === midweek.last && home.date === midweek.first,
    midweek.staged
      ? `from ${midweek.from}, mid-week: End → ${end.date || "nowhere"} (the week ends on ` +
        `${midweek.last}), Home → ${home.date || "nowhere"} (it starts on ${midweek.first})`
      : `nothing was staged: ${midweek.reason}`,
  )

  const beforePaging = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "PageDown")
  await poll(
    () =>
      read(
        devtools,
        `document.querySelector('${MONTH_ECHO}')?.textContent.trim() !== ${
          JSON.stringify(beforePaging.month)
        }`,
        false,
      ),
    3_000,
  )
  const paged = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  await pressKey(devtools, "PageUp")
  await poll(
    () =>
      read(
        devtools,
        `document.querySelector('${MONTH_ECHO}')?.textContent.trim() === ${
          JSON.stringify(beforePaging.month)
        }`,
        false,
      ),
    3_000,
  )
  const pagedBack = await read(devtools, CALENDAR_STATE, NO_CALENDAR)

  check(
    "Page Down and Page Up move the grid a month, keeping the focus on the same day number",
    beforePaging.heading !== "" && paged.heading !== beforePaging.heading &&
      paged.inGrid && dayNumber(paged.date) === dayNumber(beforePaging.date) &&
      pagedBack.heading === beforePaging.heading && pagedBack.inGrid,
    beforePaging.heading
      ? `${beforePaging.heading} (${beforePaging.date}) → Page Down → ${paged.heading} ` +
        `(${paged.date}) → Page Up → ${pagedBack.heading} (${pagedBack.date}); the card's ` +
        `onSelectMonth echo went ${beforePaging.month} → ${paged.month} → ${pagedBack.month}`
      : "the calendar showed no month, so paging could not be measured",
  )

  // Six real presses, and the page may not move under any of them: an arrow key scrolls a page by a
  // line and Page Down by a screen, so a grid that answered a key without cancelling it would take
  // the reader somewhere else entirely.
  // The fit is asserted and not merely reported: a grid taller than the viewport would let a focus
  // move scroll the page for a reason that has nothing to do with a key being cancelled, and this
  // check would then be measuring something else while still reading green on a good day.
  const scrolls = [before, right, down, back, paged, pagedBack].map((state) => state.scrollY)
  check(
    "no key the grid answers scrolls the page",
    start.fits && before.scrollY >= 0 && scrolls.every((position) => position === before.scrollY),
    before.scrollY >= 0
      ? `scrollY across right, down, up, left, Page Down and Page Up: ${scrolls.join(" → ")} — ` +
        `${start.fits ? "and the whole grid is in view" : "but it does not all fit"}, ` +
        `${start.detail}`
      : "the scroll position could not be read",
  )

  await burstChecks(devtools)

  // Aimed rather than assumed: the focus is put on the day immediately left of the first bookable
  // one, which the card's data makes a day with no availability, so one press right crosses from a
  // day that cannot be picked to one that can. The reason used to live in a `title`, which is why
  // the grid is also counted for them.
  const staged = await read(
    devtools,
    `(() => {
      const grid = document.querySelector('${GRID}')
      if (!grid) return { staged: false, from: "", to: "", reason: "no grid on the page" }
      const cells = [...grid.querySelectorAll("[data-calendar-date]")]
      const bookable = cells.findIndex((cell) =>
        cell.tagName === "A" || cell.tagName === "BUTTON"
      )
      if (bookable < 1) {
        return { staged: false, from: "", to: "", reason: "no bookable day with a day before it" }
      }
      cells[bookable - 1].focus()
      return {
        staged: document.activeElement === cells[bookable - 1],
        from: cells[bookable - 1].getAttribute("data-calendar-date"),
        to: cells[bookable].getAttribute("data-calendar-date"),
        reason: "",
      }
    })()`,
    { staged: false, from: "", to: "", reason: "the page could not be read" },
  )
  const onDisabled = await read(
    devtools,
    `(() => {
      const active = document.activeElement
      const grid = document.querySelector('${GRID}')
      return {
        ...${CALENDAR_STATE},
        disabled: Boolean(active && active.getAttribute("aria-disabled") === "true"),
        label: active && active.getAttribute ? (active.getAttribute("aria-label") || "") : "",
        titles: grid ? grid.querySelectorAll("[title]").length : -1,
      }
    })()`,
    { ...NO_CALENDAR, disabled: false, label: "", titles: -1 },
  )
  await pressKey(devtools, "ArrowRight")
  const onBookable = await read(devtools, CALENDAR_STATE, NO_CALENDAR)

  check(
    "a day that cannot be picked takes focus, and says why where a keyboard reaches it",
    staged.staged && onDisabled.disabled && onDisabled.label.includes("no times available") &&
      onDisabled.hintShown && onDisabled.hint === onDisabled.label &&
      onBookable.date === staged.to && onBookable.hint.includes("available") &&
      !onBookable.hint.includes("no times") && onDisabled.titles === 0,
    staged.staged
      ? `focus on ${onDisabled.date}: aria-disabled=${onDisabled.disabled}, named ` +
        `"${onDisabled.label}", hint ${onDisabled.hintShown ? "shown" : "hidden"} reading ` +
        `"${onDisabled.hint}"; one press right lands on ${onBookable.date} and the hint reads ` +
        `"${onBookable.hint}"; ${onDisabled.titles} title attributes inside the grid`
      : `nothing was staged: ${staged.reason}`,
  )

  const shape = await read(
    devtools,
    `(() => {
      const grid = document.querySelector('${GRID}')
      if (!grid) return { grid: false, rows: 0, headers: 0, cells: 0, named: false }
      const labelledBy = grid.getAttribute("aria-labelledby")
      const heading = labelledBy ? document.getElementById(labelledBy) : null
      return {
        grid: grid.getAttribute("role") === "grid",
        rows: grid.querySelectorAll('[role="row"]').length,
        headers: grid.querySelectorAll('[role="columnheader"]').length,
        cells: grid.querySelectorAll('[role="gridcell"]').length,
        named: Boolean(heading) && heading.textContent.trim().length > 0,
      }
    })()`,
    { grid: false, rows: 0, headers: 0, cells: 0, named: false },
  )
  check(
    "the days are announced as a named grid of rows and cells",
    shape.grid && shape.rows === 7 && shape.headers === 7 && shape.cells === 42 && shape.named,
    `role=grid ${shape.grid}, ${shape.rows} rows, ${shape.headers} column headers, ` +
      `${shape.cells} grid cells, named after the month heading: ${shape.named}`,
  )

  await localeChecks(devtools)
}

/**
 * Two presses of a key with nothing between them, for every key that moves the grid.
 *
 * This is the pattern the rest of the file was missing, and the reason three instances of one
 * defect reached review. Every other check reads the page between one press and the next, which
 * hands the component a render it would not get from a reader holding a key down; a component that
 * works out where to go from what the last render is showing then looks correct, because there has
 * always been a render. Pressing twice with no reading in between removes it.
 *
 * Each check below records where the cursor started, sends two real presses back to back, and only
 * then waits — the wait is for the page to settle, never between the presses.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function burstChecks(devtools: Devtools): Promise<void> {
  const anchor = await read(devtools, `${CALENDAR_STATE}.month`, "")

  // Two activations of the month arrow inside one expression, which is the one place a component
  // can be caught acting on a render that has not happened: a key press cannot do this, because
  // each one arrives as its own protocol message and the page always renders in between, but two
  // `.click()` calls in one statement run before anything is rendered at all. A month worked out
  // from what the render is showing therefore answers both clicks with the same month.
  //
  // The arrow is an ordinary button and a click is how a person activates it, so this is the one
  // check here that uses `.click()` on the thing under test rather than a real press.
  const beforeClicks = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  const twoAhead = monthAfter(beforeClicks.month, 2)
  const clicked = await read(
    devtools,
    `(() => {
      const arrow = document.querySelector('${CALENDAR} button[aria-label^="Next month"]')
      if (!arrow) return false
      arrow.click()
      arrow.click()
      return true
    })()`,
    false,
  )
  await poll(
    () => read(devtools, `${CALENDAR_STATE}.month === ${JSON.stringify(twoAhead)}`, false),
    3_000,
  )
  const afterClicks = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  check(
    "two activations of the month arrow in one frame ask for two months, not one",
    clicked && beforeClicks.month !== "" && afterClicks.month === twoAhead,
    clicked
      ? `${beforeClicks.heading} → next next, with no render in between → ` +
        `${afterClicks.heading} (${afterClicks.month || "nothing"}), wanted ${twoAhead}`
      : "the card has no next-month button to activate",
  )

  await focusGrid(devtools)
  const beforeDays = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  const twoDaysOn = dayAfter(beforeDays.date, 2)
  await pressKey(devtools, "ArrowRight")
  await pressKey(devtools, "ArrowRight")
  await poll(
    () => read(devtools, `${CALENDAR_STATE}.date === ${JSON.stringify(twoDaysOn)}`, false),
    3_000,
  )
  const afterDays = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  check(
    "two arrow presses with nothing between them move two days, not one",
    beforeDays.date !== "" && afterDays.date === twoDaysOn,
    beforeDays.date
      ? `${beforeDays.date} → right right → ${afterDays.date || "nowhere"}, wanted ${twoDaysOn}`
      : "the focus never reached a day cell",
  )

  const beforeMonths = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  const twoMonthsOn = monthAfter(beforeMonths.month, 2)
  await pressKey(devtools, "PageDown")
  await pressKey(devtools, "PageDown")
  const twoMonthsLanding = `${twoMonthsOn.slice(0, 8)}${dayNumber(beforeMonths.date)}`
  await poll(
    () => read(devtools, `${CALENDAR_STATE}.date === ${JSON.stringify(twoMonthsLanding)}`, false),
    3_000,
  )
  const afterMonths = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  check(
    "two Page Down presses with nothing between them move two months, not one",
    beforeMonths.month !== "" && afterMonths.month === twoMonthsOn &&
      afterMonths.heading !== beforeMonths.heading &&
      dayNumber(afterMonths.date) === dayNumber(beforeMonths.date),
    beforeMonths.month
      ? `${beforeMonths.heading} (${beforeMonths.month}) → Page Down Page Down → ` +
        `${afterMonths.heading} (${afterMonths.month || "nothing"}), wanted ${twoMonthsOn}; the ` +
        `focus went ${beforeMonths.date} → ${afterMonths.date || "nowhere"}`
      : "the card echoed no month, so paging could not be measured",
  )

  // The other half of the same defect: the arrow is validated against a month, and after a Page Up
  // the month it has to be validated against is the one the Page Up asked for.
  const beforeMixed = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  const oneMonthBack = monthAfter(beforeMixed.month, -1)
  const mixedTarget = dayAfter(
    `${oneMonthBack.slice(0, 8)}${dayNumber(beforeMixed.date)}`,
    1,
  )
  await pressKey(devtools, "PageUp")
  await pressKey(devtools, "ArrowRight")
  await poll(
    () => read(devtools, `${CALENDAR_STATE}.date === ${JSON.stringify(mixedTarget)}`, false),
    3_000,
  )
  const afterMixed = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  check(
    "an arrow press straight after Page Up moves inside the month it landed on",
    beforeMixed.date !== "" && afterMixed.month === oneMonthBack &&
      afterMixed.date === mixedTarget,
    beforeMixed.date
      ? `${beforeMixed.date} → Page Up Arrow Right → ${afterMixed.date || "nowhere"} in ` +
        `${afterMixed.heading || "no month"}, wanted ${mixedTarget}`
      : "the focus never reached a day cell",
  )

  // Back where the checks after this one expect to find it, with one more burst on the way: two
  // presses of Page Up cover the direction the two above did not.
  const beforeBack = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  const backTo = monthAfter(beforeBack.month, -1)
  const backTarget = dayAfter(`${backTo.slice(0, 8)}${dayNumber(beforeBack.date)}`, -1)
  await pressKey(devtools, "PageUp")
  await pressKey(devtools, "ArrowLeft")
  await poll(
    () => read(devtools, `${CALENDAR_STATE}.date === ${JSON.stringify(backTarget)}`, false),
    3_000,
  )
  const afterBack = await read(devtools, CALENDAR_STATE, NO_CALENDAR)
  check(
    "Page Up answers a burst the same way Page Down does",
    beforeBack.month !== "" && afterBack.month === backTo && afterBack.date === backTarget,
    beforeBack.month
      ? `${beforeBack.date} → Page Up Arrow Left → ${afterBack.date || "nowhere"} in ` +
        `${afterBack.heading || "no month"}, wanted ${backTarget}`
      : "the card echoed no month",
  )

  // Teardown, with nothing asserted on it: the checks after this one read the month the card
  // started on, and a burst that went wrong must not decide which month they read.
  for (let step = 0; step < 12; step++) {
    const now = await read(devtools, `${CALENDAR_STATE}.month`, "")
    if (now === anchor || now === "") break
    const direction = now < anchor ? "Next" : "Previous"
    await read(
      devtools,
      `(document.querySelector('${CALENDAR} button[aria-label^="${direction} month"]')?.click(), true)`,
      false,
    )
    await poll(
      () => read(devtools, `${CALENDAR_STATE}.month !== ${JSON.stringify(now)}`, false),
      2_000,
    )
  }
}

/**
 * What changes about the grid when the locale does.
 *
 * Two claims, and the second is the one a browser is needed for: the column order follows the
 * locale's own first day of the week, and a header carries whatever `Intl` abbreviates the weekday
 * to. The expected labels are computed in the page from `Intl` itself rather than written down
 * here, because the whole point is that they are not this repository's to choose.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function localeChecks(devtools: Devtools): Promise<void> {
  const headersNow = `(() => {
    const card = document.querySelector('${LOCALE_CARD}')
    if (!card) return { tag: "", headers: [] }
    const tag = card.querySelector('[data-e2e="calendar-locale-tag"]')
    return {
      tag: tag ? tag.textContent.trim() : "",
      headers: [...card.querySelectorAll('[role="columnheader"]')].map((cell) =>
        cell.textContent.trim()
      ),
    }
  })()`
  const empty = { tag: "", headers: [] as string[] }

  const british = await read(devtools, headersNow, empty)
  await read(
    devtools,
    `(document.querySelector('${LOCALE_CARD} [data-e2e="calendar-locale-en-US"]')?.click(), true)`,
    false,
  )
  await poll(
    () => read(devtools, `${headersNow}.tag === "en-US"`, false),
    3_000,
  )
  const american = await read(devtools, headersNow, empty)
  await read(
    devtools,
    `(document.querySelector('${LOCALE_CARD} [data-e2e="calendar-locale-ar-EG"]')?.click(), true)`,
    false,
  )
  await poll(
    () => read(devtools, `${headersNow}.tag === "ar-EG"`, false),
    3_000,
  )
  const egyptian = await read(devtools, headersNow, empty)

  // The browser's own answer for the same locale, built from `Intl` in the page: seven weekday
  // abbreviations in the order the locale's week runs.
  const expected = await read(
    devtools,
    `(() => {
      const locale = new Intl.Locale("ar-EG")
      const info = typeof locale.getWeekInfo === "function" ? locale.getWeekInfo() : locale.weekInfo
      const first = info && info.firstDay ? info.firstDay : 1
      const format = new Intl.DateTimeFormat("ar-EG", { weekday: "short", timeZone: "UTC" })
      const monday = Date.parse("2024-01-01T00:00:00Z")
      return Array.from({ length: 7 }, (_, index) =>
        format.format(new Date(monday + ((first - 1 + index) % 7) * 86400000)))
    })()`,
    [] as string[],
  )

  check(
    "the week starts on the day the reader's locale starts it on",
    british.headers[0] === "Mon" && american.headers[0] === "Sun" &&
      egyptian.headers[0] === expected[0] && expected.length === 7,
    `first column: en-GB "${british.headers[0] ?? "none"}" → en-US ` +
      `"${american.headers[0] ?? "none"}" → ar-EG "${egyptian.headers[0] ?? "none"}", where the ` +
      `browser's own Intl says ar-EG starts on "${expected[0] ?? "none"}"`,
  )
  check(
    "a weekday header is the locale's abbreviation, not its first two characters",
    egyptian.headers.length === 7 && new Set(egyptian.headers).size === 7 &&
      egyptian.headers.join("|") === expected.join("|"),
    egyptian.headers.length === 7
      ? `ar-EG headers ${egyptian.headers.join(" ")} — ${
        new Set(egyptian.headers).size
      } of 7 distinguishable, and cutting them to two characters would leave ${
        new Set(egyptian.headers.map((header) => header.slice(0, 2))).size
      }`
      : "the locale card rendered no column headers",
  )

  await read(
    devtools,
    `(document.querySelector('${LOCALE_CARD} [data-e2e="calendar-locale-en-GB"]')?.click(), true)`,
    false,
  )
}

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
 * Press the left mouse button and release it at one point of the viewport.
 *
 * A real, trusted click through the browser's input pipeline, which is what a backdrop check needs:
 * calling `.click()` on the element the component listens for would prove the handler and say
 * nothing about whether a click at that place ever reaches it.
 *
 * @param devtools The connected session.
 * @param point Viewport coordinates, in CSS pixels.
 */
async function clickAt(devtools: Devtools, point: { x: number; y: number }): Promise<void> {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    })
  }
}

/** A point worked out from an element's geometry, and what the browser says is actually there. */
interface AimedClick {
  /** Whether the point lands on what it was aimed at. */
  onTarget: boolean
  x: number
  y: number
  /** What `elementFromPoint` reports at that point. */
  landedOn: string
  /** Why no point could be worked out, when none could. */
  reason: string
}

const MISSED: AimedClick = { onTarget: false, x: 0, y: 0, landedOn: "nothing", reason: "unread" }

/**
 * `ImageLightbox`'s keyboard and its backdrop, driven in the browser that owns them.
 *
 * Enter and Space are real key presses, and Space is provable here where it is not for an ordinary
 * button: what opens the lightbox is the component's own `keydown` listener rather than the
 * activation click headless Chromium declines to synthesise, so both keys reach it exactly as a
 * person's would. The two clicks are real mouse events at points worked out from the geometry, and
 * each point is checked against `elementFromPoint` before it is used — a press that landed
 * somewhere else is reported as a missed click and never as a failure of the component.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function imageLightboxChecks(devtools: Devtools): Promise<void> {
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
  await settleScroll(devtools)
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
  if (aim.onTarget) await clickAt(devtools, aim)
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

  // The linked image leaves the lightbox open, and a real Escape press is what closes it — which
  // is both the last assertion and the teardown every package after this file depends on.
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

  // Teardown, with nothing asserted on it: a dialog left open would sit over every check
  // `verify.ts` runs after this file's, whatever went wrong above.
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
  await settleScroll(devtools)
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
  if (aim.onTarget) await clickAt(devtools, aim)
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
  // press, which is the last thing this file proves and the teardown for everything after it.
  await read(
    devtools,
    `(document.removeEventListener("click", globalThis.__lightboxListener), true)`,
    false,
  )
}

/**
 * The ISO date `days` after `date`, for comparing one reading against another.
 *
 * Answers `""` for anything that is not a date, and never throws: these helpers are called on
 * readings, a reading can come back empty when the page was not in the state a check expected, and
 * a throw here costs the rest of this package's own block — every check after it in this file,
 * replaced by one failure that names the package rather than the reading. Measured, not feared — an
 * earlier version threw `Invalid time value` on an empty reading and the run reported 46 checks
 * instead of 92. It used to be worse than the rest of one block: until `pages/verify.ts` began
 * running each package isolated from the others, a throw here ended the whole browser phase and
 * dropped every package after this one.
 */
function dayAfter(date: string, days: number): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN
  if (Number.isNaN(parsed)) return ""
  return new Date(parsed + days * 86_400_000).toISOString().slice(0, 10)
}

/** The day-of-month of an ISO date, or `""` — what Page Up and Page Down have to preserve. */
function dayNumber(date: string): string {
  return date ? date.slice(8, 10) : ""
}

/** The first of the month `months` away from a `YYYY-MM-01` anchor. `""` for anything else. */
function monthAfter(anchor: string, months: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return ""
  const total = Number(anchor.slice(0, 4)) * 12 + Number(anchor.slice(5, 7)) - 1 + months
  const month = String((total % 12) + 1).padStart(2, "0")
  return `${Math.floor(total / 12)}-${month}-01`
}
