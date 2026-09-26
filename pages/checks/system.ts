import { centreInView, check, type Devtools, openGuidePage, poll, pressKey } from "./harness.ts"

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
 * Focus an element and then click it, or nothing at all when it is not on the page.
 *
 * `click`'s own `.click()` does not focus the element in this harness's Chromium — measured
 * against `authFormFocusStabilityChecks`, which needs focus to land exactly where it presses so a
 * later reading of `document.activeElement` means something. Calling `.focus()` first removes the
 * dependency on whatever a synthetic click's own activation behaviour does or does not do to focus,
 * which is not the same in every engine.
 *
 * @param devtools The connected session.
 * @param selector What to focus and click.
 * @returns Whether there was anything to click.
 */
function focusAndClick(devtools: Devtools, selector: string): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const element = document.querySelector('${selector}')
    if (element) {
      element.focus()
      element.click()
    }
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
 * `system/`'s browser checks: `AuthForm`, the calendar's keyboard, the lightbox's, `SiteHeader`'s
 * mobile panel, `Shell`'s drawer and its interaction with `ui/`'s `Dropdown`, `RailShell`'s rail,
 * tab bar and "More" dialog, and `SWUpdater` against a real service worker.
 *
 * `AuthForm` runs first, and its last step is the reason the calendar and the lightbox come after
 * it rather than around it: proving that a submit survives disabled script execution means
 * disabling script execution and forcing a fresh, unhydrated load of the page, and every check in
 * this file after that needs the hydrated page back. `authFormNoScriptChecks` re-enables scripts,
 * reloads the page and waits for the same `data-hydrated` marker `verify.ts` waits for at startup
 * before it returns — nothing in `authFormChecks` after it, and nothing in this function after
 * `authFormChecks`, may run before that restoration is confirmed. `SiteHeader` is not the only
 * other block with its own such excursion any more: `siteHeaderNoScriptCheck` disables script
 * execution the same way `AuthForm` does, and `siteHeaderHydrationSyncChecks` holds the island
 * bundle back with the Fetch domain instead — both restore the hydrated page in their own
 * `finally` before `siteHeaderChecks` returns, the same contract `authFormNoScriptChecks` keeps.
 *
 * The calendar, the lightbox and the service worker run in the stated order, and that order is the
 * point. The service-worker block below stages a real registration, a hidden frame inside its scope
 * and a hand-over between two workers; it is the only other part of this file with state outside
 * the page, so nothing that could be affected by it runs after it. The lightbox opens a real modal
 * `<dialog>`, which would sit in the top layer over every check that came after if it ever refused
 * to close — `ui.ts` answers that risk by running Modal last of everything, and this file cannot,
 * because `verify.ts` fixes the order of the packages. So the lightbox block closes its dialog
 * unconditionally at the end and asserts that the top layer is empty, which is the same guarantee
 * bought with a teardown instead of an ordering.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function systemChecks(devtools: Devtools): Promise<void> {
  await authFormChecks(devtools)
  await liveRegionChecks(devtools)
  await calendarChecks(devtools)
  await imageLightboxChecks(devtools)
  await siteHeaderChecks(devtools)
  await shellChecks(devtools)
  await railShellChecks(devtools)
  // RailShell's no-script check reloads the page on an address whose hash names no guide page,
  // so the guide opens its overview; the SWUpdater card lives on the system page.
  await openGuidePage(devtools, "system")
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
    !idle
      ? "there was no live region in the page before the update, so nothing arrived in one"
      : idle.text === ""
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
    !idle
      ? "there was no region to attach an observer to before the update"
      : idle.children === 0
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
      ? `after a dismissal ${
        again.same ? "the same region" : "a region that is NOT the parked element"
      } went back to reading ${
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

/** The `AuthForm` card, and the pieces of it these checks read. */
const AUTH_FORM = "#demo-AuthForm"
/** Two real, simultaneously mounted instances — the password-manager and unique-ids proof. */
const AUTH_AUTOFILL = `${AUTH_FORM} [data-e2e="auth-form-autofill"]`
/** The one instrumented instance every other check below drives. */
const AUTH_INTERACTIVE = `${AUTH_FORM} [data-e2e="auth-form-interactive"]`
const AUTH_ALERT = `${AUTH_INTERACTIVE} [role="alert"]`
const AUTH_LOGIN = `${AUTH_INTERACTIVE} input[name="login"]`
const AUTH_PASSWORD = `${AUTH_INTERACTIVE} input[name="password"]`
const AUTH_CODE = `${AUTH_INTERACTIVE} input[name="code"]`
const AUTH_TOGGLE = `${AUTH_INTERACTIVE} button[aria-pressed]`
const AUTH_SET_FORM_ERROR = `${AUTH_INTERACTIVE} [data-e2e="auth-form-set-form-error"]`
const AUTH_SET_FIELD_ERROR = `${AUTH_INTERACTIVE} [data-e2e="auth-form-set-field-error"]`
const AUTH_CLEAR_ERROR = `${AUTH_INTERACTIVE} [data-e2e="auth-form-clear-error"]`
const AUTH_STEP_CODE = `${AUTH_INTERACTIVE} [data-e2e="auth-form-step-code"]`
const AUTH_STEP_CREDENTIALS = `${AUTH_INTERACTIVE} [data-e2e="auth-form-step-credentials"]`
const AUTH_TOGGLE_BUSY = `${AUTH_INTERACTIVE} [data-e2e="auth-form-toggle-busy"]`
const AUTH_REQUEST_SUBMIT = `${AUTH_INTERACTIVE} [data-e2e="auth-form-request-submit"]`
const AUTH_SIGNINS = `${AUTH_INTERACTIVE} [data-e2e="auth-form-signins"]`
const AUTH_SIGNUPS = `${AUTH_INTERACTIVE} [data-e2e="auth-form-signups"]`
const AUTH_CODES = `${AUTH_INTERACTIVE} [data-e2e="auth-form-codes"]`

/** The two messages the guide card's buttons set, read back here so a check can match on them. */
const AUTH_FORM_ERROR = "Wrong login or password"
const AUTH_FIELD_ERROR = "No account with that login"

/** What one reading of the interactive card reports, for the checks that need more than one fact. */
interface AuthFormState {
  /** Whether the card is on the page at all. */
  found: boolean
  passwordType: string
  passwordAutocomplete: string
  togglePressed: string
  toggleFocused: boolean
  submitDisabled: boolean
  statusText: string
  signIns: string
  signUps: string
  codes: string
  /** `document.activeElement`'s `name`, for the focus-move check. */
  focusedName: string
  /** `document.activeElement`'s `data-e2e`, for the checks that park focus on a demo control. */
  focusedE2e: string
}

const NO_AUTH_STATE: AuthFormState = {
  found: false,
  passwordType: "",
  passwordAutocomplete: "",
  togglePressed: "",
  toggleFocused: false,
  submitDisabled: false,
  statusText: "",
  signIns: "not found",
  signUps: "not found",
  codes: "not found",
  focusedName: "",
  focusedE2e: "",
}

/** Read {@link AuthFormState} in one round trip. */
const AUTH_STATE = `(() => {
  const card = document.querySelector('${AUTH_INTERACTIVE}')
  if (!card) return null
  const password = card.querySelector('input[name="password"]')
  const toggle = card.querySelector('button[aria-pressed]')
  const submit = card.querySelector('button[type="submit"]')
  const status = card.querySelector('[role="status"]')
  const signIns = document.querySelector('${AUTH_SIGNINS}')
  const signUps = document.querySelector('${AUTH_SIGNUPS}')
  const codes = document.querySelector('${AUTH_CODES}')
  const active = document.activeElement
  return {
    found: true,
    passwordType: password ? password.type : "",
    passwordAutocomplete: password ? password.autocomplete : "",
    togglePressed: toggle ? toggle.getAttribute("aria-pressed") : "",
    toggleFocused: Boolean(toggle) && active === toggle,
    submitDisabled: Boolean(submit) && submit.disabled,
    statusText: status ? status.textContent.trim() : "",
    signIns: signIns ? signIns.textContent.trim() : "not found",
    signUps: signUps ? signUps.textContent.trim() : "not found",
    codes: codes ? codes.textContent.trim() : "not found",
    focusedName: active && active.getAttribute ? (active.getAttribute("name") || "") : "",
    focusedE2e: active && active.getAttribute ? (active.getAttribute("data-e2e") || "") : "",
  }
})()`

/**
 * `AuthForm`'s browser checks: the password-manager markup, the always-present error region, the
 * focus move to the one-time-code field and its stability across an unrelated re-render, the mode
 * switch and the show/hide password toggle never submitting, a busy submit — including one started
 * with `form.requestSubmit()` — calling no callback, and a submit surviving disabled script
 * execution with no query string added to the URL.
 *
 * Every unit test in `system/auth-form.test.tsx` renders to an HTML string, so nothing behind an
 * effect, a focus change, a real key press, a real pointer press or a real navigation is provable
 * there. This file is where those are proven, against the two cards `ui-guide/sections/system.tsx`
 * mounts: `AUTH_AUTOFILL`, two plain instances side by side, and `AUTH_INTERACTIVE`, one instance
 * with buttons standing in for the round trip an app's own server would otherwise drive.
 *
 * `authFormNoScriptChecks` runs last and only there: it disables script execution and forces a
 * fresh, unhydrated load of the page, so everything after it in this function needs the hydrated
 * page it restores at its own end. `authFormModeSwitchChecks` runs second, right after the markup
 * proof and before anything else touches `mode` — it leaves the card in sign-in, the mode every
 * later check in this file assumes, and it has to switch away from sign-in and back to prove
 * anything at all.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function authFormChecks(devtools: Devtools): Promise<void> {
  await autofillChecks(devtools)
  await authFormModeSwitchChecks(devtools)
  await authFormErrorChecks(devtools)
  await authFormFocusChecks(devtools)
  await authFormFocusStabilityChecks(devtools)
  await authFormToggleChecks(devtools)
  await authFormBusyChecks(devtools)
  await authFormNoScriptChecks(devtools)
}

/**
 * Fill every empty text input of the interactive card's form with a value.
 *
 * Shared by every check below that submits the form on purpose: the browser's own constraint
 * validation refuses a `required` field with no value before the submit event this component
 * listens for is ever dispatched, which would make "nothing happened" mean "validation stopped it"
 * rather than "the behaviour under test stopped it". Filling first is what isolates the one thing
 * each of those checks means to prove.
 *
 * @param devtools The connected session.
 * @returns Whether the card's form was found.
 */
function fillCredentialFields(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const card = document.querySelector('${AUTH_INTERACTIVE}')
    const form = card ? card.querySelector('form') : null
    if (!form) return false
    for (const input of form.querySelectorAll('input')) {
      if (input.value === "") input.value = input.name === "code" ? "123456" : "demo value"
    }
    return true
  })()`)
}

/** What the autofill card reports about its two instances, read in one round trip. */
interface AutofillState {
  forms: number
  /** One entry per `<form>`, in document order. */
  fields: Array<{
    action: string
    method: string
    loginName: string
    loginAutocomplete: string
    loginId: string
    loginLabelFor: string
    loginLabelText: string
    passwordType: string
    passwordAutocomplete: string
    passwordId: string
    passwordLabelFor: string
  }>
}

const NO_AUTOFILL: AutofillState = { forms: 0, fields: [] }

/**
 * Two real, simultaneously mounted `AuthForm`s — the markup a password manager reads, and the one
 * page on which two instances' ids could collide.
 *
 * Nothing here drives a real password manager: no browser extension is installed in this harness,
 * so what is proven is the markup a password manager relies on — a `<form>` ancestor, a `<label
 * for>` pointing at each field's own `id`, and the `autocomplete`/`name`/`type` triad — read back
 * from the DOM rather than asserted from the source. The two instances are `mode="sign-in"` and
 * `mode="sign-up"` precisely so their `autocomplete` values differ too.
 */
async function autofillChecks(devtools: Devtools): Promise<void> {
  const state = await read(
    devtools,
    `(() => {
      const forms = [...document.querySelectorAll('${AUTH_AUTOFILL} form')]
      const fields = forms.map((form) => {
        const login = form.querySelector('input[name="login"]')
        const password = form.querySelector('input[name="password"]')
        const loginLabel = login ? document.querySelector('label[for="' + login.id + '"]') : null
        const passwordLabel = password
          ? document.querySelector('label[for="' + password.id + '"]')
          : null
        return {
          action: form.getAttribute("action") || "",
          method: form.getAttribute("method") || "",
          loginName: login ? login.name : "",
          loginAutocomplete: login ? login.autocomplete : "",
          loginId: login ? login.id : "",
          loginLabelFor: loginLabel ? loginLabel.getAttribute("for") : "",
          loginLabelText: loginLabel ? loginLabel.textContent.trim() : "",
          passwordType: password ? password.type : "",
          passwordAutocomplete: password ? password.autocomplete : "",
          passwordId: password ? password.id : "",
          passwordLabelFor: passwordLabel ? passwordLabel.getAttribute("for") : "",
        }
      })
      return { forms: forms.length, fields }
    })()`,
    NO_AUTOFILL,
  )

  check(
    "two AuthForm instances on one page each sit inside their own real <form>",
    state.forms === 2 && state.fields[0]?.action === "/auth/sign-in" &&
      state.fields[1]?.action === "/auth/sign-up" && state.fields[0]?.method === "post" &&
      state.fields[1]?.method === "post",
    `${state.forms} form(s): ${
      state.fields.map((f) => `${f.action || "no action"} (${f.method || "no method"})`).join(", ")
    }`,
  )
  check(
    "every field carries the autocomplete/name/type a password manager reads",
    state.fields.length === 2 &&
      state.fields.every((f) =>
        f.loginName === "login" && f.loginAutocomplete === "username" &&
        f.passwordType === "password"
      ) && state.fields[0]?.passwordAutocomplete === "current-password" &&
      state.fields[1]?.passwordAutocomplete === "new-password",
    state.fields.map((f) =>
      `login name=${f.loginName} autocomplete=${f.loginAutocomplete}, password type=` +
      `${f.passwordType} autocomplete=${f.passwordAutocomplete}`
    ).join(" | "),
  )
  check(
    "every field has a real <label for> pointing at its own id",
    state.fields.length === 2 &&
      state.fields.every((f) =>
        f.loginId !== "" && f.loginLabelFor === f.loginId && f.loginLabelText.length > 0 &&
        f.passwordId !== "" && f.passwordLabelFor === f.passwordId
      ),
    state.fields.map((f) => `login id=${f.loginId} for=${f.loginLabelFor}`).join(" | "),
  )
  check(
    "the two instances' field ids do not collide",
    state.fields.length === 2 && state.fields[0]?.loginId !== "" &&
      state.fields[0]?.loginId !== state.fields[1]?.loginId &&
      state.fields[0]?.passwordId !== state.fields[1]?.passwordId,
    `login ids: ${state.fields[0]?.loginId} vs ${state.fields[1]?.loginId}`,
  )
}

/** One read of the mode-switch control's aim — see {@link findModeSwitchTarget}. */
interface ModeSwitchAim {
  found: boolean
  x: number
  y: number
  /**
   * Whether the computed centre point resolves back to the button, right now, via
   * `elementFromPoint`. Diagnostic only: the click below is dispatched at `(x, y)` regardless, and
   * this exists so a failure's detail can say whether the aim was already off before the click ever
   * landed, not to decide whether to click at all.
   */
  onTarget: boolean
}

/**
 * Find the mode-switch control's centre, scrolling it into view first — one scroll, one read, no
 * retry.
 *
 * By its own visible text rather than by position or by "the second button in this row": the
 * labels are the component's contract, so a check keyed to them survives the two buttons around it
 * changing, and a relabel of the control itself would be caught here rather than silently aimed at
 * the wrong element.
 *
 * This used to retry the whole scroll-and-read, and then the whole aim-and-click, until the mode
 * actually switched — which a review of `#253` rejected: a mode-switch button that ignored every
 * other click still passed both checks, "in 2 attempt(s)", because the retry could not tell a slow
 * correct click from a broken one that happened to work eventually. A real visitor forced to click
 * twice is exactly the defect this check exists to catch, and a retry inside the check hides it.
 * `elementFromPoint` still runs, once, so a failure's detail can say whether the computed point was
 * even on the button before the click — evidence for whoever reads the failure, not a reason to try
 * again.
 *
 * @param devtools The connected session.
 * @returns The point to click and whether it verified on the button, or `found: false` when no such
 * button was found on the card at all.
 */
function findModeSwitchTarget(devtools: Devtools): Promise<ModeSwitchAim> {
  return devtools.evaluate<ModeSwitchAim>(`(() => {
    const card = document.querySelector('${AUTH_INTERACTIVE}')
    const button = card
      ? [...card.querySelectorAll("button")].find((candidate) =>
        /^(Need|Have) an account\\?/.test(candidate.textContent.trim())
      )
      : null
    if (!button) return { found: false, x: 0, y: 0, onTarget: false }
    button.scrollIntoView({ block: "center", behavior: "instant" })
    const rect = button.getBoundingClientRect()
    const x = Math.round(rect.left + rect.width / 2)
    const y = Math.round(rect.top + rect.height / 2)
    const at = document.elementFromPoint(x, y)
    return { found: true, x, y, onTarget: at !== null && (at === button || button.contains(at)) }
  })()`)
}

/**
 * The mode-switch control never submits the form — proven with a real pointer press rather than
 * with `.click()`, the way every other button in this file is activated. That distinction matters
 * here specifically: `.click()` on a `type="submit"` button submits the form exactly as a person's
 * click does, native activation behaviour rather than a listener, so a check built on `.click()`
 * cannot tell "this button is wired to switch the mode" apart from "this button happens to be a
 * submit button that also switches the mode" — both would look identical to it. A real
 * `Input.dispatchMouseEvent` at the button's own geometry carries no such blind spot.
 *
 * Fields are filled first, for the same reason {@link fillCredentialFields}'s own doc gives: an
 * empty `required` field would stop a wrongly-`type="submit"` button before this check could tell
 * the difference between validation and the behaviour actually under test.
 *
 * **`#253`.** `AUTH_INTERACTIVE` sits far enough down the page that the first time anything scrolls
 * to it, the page can still be mid-flight: the catalogue's `DeletionValidation` demo
 * (`crud/deletion-validation.tsx:29`) starts a smooth scroll toward itself on hydration, from the
 * top of the page to roughly 36,500px down, and when the `system` block ran alone that scroll was
 * still moving when this check's own `scrollIntoView` ran — one more frame of it landed on top,
 * moving the button 170–540px in the runs measured, after this check had already computed where to
 * click. In a full run the earlier blocks cost enough wall-clock time that the scroll has always
 * finished first. `pages/verify.ts` now waits for the whole page to stop scrolling once, right
 * after hydration and before any block's checks run, which covers every block's own first check
 * under `--only`, not only this one — see its own comment there. (`crud/`'s self-scroll on load is
 * a separate, pre-existing defect, tracked on its own issue rather than fixed here.)
 *
 * The press is asserted to have landed — `passwordAutocomplete` flips from `current-password` to
 * `new-password` only because `mode` actually changed — before the counters are trusted, because an
 * unread miss and "correctly did nothing" report the same counters.
 */
async function authFormModeSwitchChecks(devtools: Devtools): Promise<void> {
  await fillCredentialFields(devtools)
  const before = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  const toSignUp = await findModeSwitchTarget(devtools)
  if (toSignUp.found) await clickAt(devtools, { x: toSignUp.x, y: toSignUp.y })
  const afterFirstPress = await poll(
    () => read(devtools, `${AUTH_STATE}?.passwordAutocomplete === "new-password"`, false),
    3_000,
  )
  const switched = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "a real pointer press on the mode-switch control switches the mode and submits nothing",
    toSignUp.found && afterFirstPress && switched.passwordAutocomplete === "new-password" &&
      switched.signIns === before.signIns && switched.signUps === before.signUps &&
      switched.codes === before.codes,
    !toSignUp.found
      ? "no mode-switch button found to press"
      : `password autocomplete ${before.passwordAutocomplete} → ${switched.passwordAutocomplete}` +
        (toSignUp.onTarget ? "" : " (elementFromPoint did not confirm the aim before the click)") +
        `, sign-ins ${before.signIns} → ${switched.signIns}, sign-ups ${before.signUps} → ` +
        `${switched.signUps}, codes ${before.codes} → ${switched.codes}`,
  )

  // Switched back to sign-in, which every later check in this file assumes as the starting mode —
  // but only if the first press actually landed. Without this guard, a first press that silently
  // did nothing (the mode-switch button ignoring every other click, say) leaves the form in
  // sign-in the whole time, and the check below reads current-password before and after the second
  // press and passes on a button that never worked — found in review of `#253`, with a button
  // rigged to ignore every other click leaving only the first check red.
  const startedInSignUp = switched.passwordAutocomplete === "new-password"

  const toSignIn = await findModeSwitchTarget(devtools)
  if (toSignIn.found) await clickAt(devtools, { x: toSignIn.x, y: toSignIn.y })
  const afterSecondPress = await poll(
    () => read(devtools, `${AUTH_STATE}?.passwordAutocomplete === "current-password"`, false),
    3_000,
  )
  const restored = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "a second press switches back to sign-in, still submitting nothing",
    startedInSignUp && toSignIn.found && afterSecondPress &&
      restored.passwordAutocomplete === "current-password" &&
      restored.signIns === before.signIns && restored.signUps === before.signUps &&
      restored.codes === before.codes,
    !startedInSignUp
      ? "the form was not in sign-up before this press — the first press above did not land, so " +
        "this press cannot be told apart from a button that never moved"
      : !toSignIn.found
      ? "no mode-switch button found to press back"
      : `password autocomplete ${switched.passwordAutocomplete} → ${restored.passwordAutocomplete}` +
        (toSignIn.onTarget ? "" : " (elementFromPoint did not confirm the aim before the click)") +
        `, sign-ins ${switched.signIns} → ${restored.signIns}, sign-ups ${switched.signUps} → ` +
        `${restored.signUps}`,
  )
}

/** What one reading of the error region and the observer watching it reports. */
interface AuthRegionState {
  found: boolean
  same: boolean
  connected: boolean
  text: string
  mutationsOnRegion: number
  added: number
  loginInvalid: string | null
  passwordInvalid: string | null
}

const NO_AUTH_REGION: AuthRegionState = {
  found: false,
  same: false,
  connected: false,
  text: "",
  mutationsOnRegion: 0,
  added: 0,
  loginInvalid: null,
  passwordInvalid: null,
}

/** Read {@link AuthRegionState}, against the observer {@link authFormErrorChecks} parked. */
const READ_AUTH_REGION = `(() => {
  const region = document.querySelector('${AUTH_ALERT}')
  const login = document.querySelector('${AUTH_LOGIN}')
  const password = document.querySelector('${AUTH_PASSWORD}')
  const records = globalThis.__authRegionMutations || []
  return {
    found: Boolean(region),
    same: Boolean(region) && region === globalThis.__authRegionElement,
    connected: Boolean(region) && region.isConnected,
    text: region ? region.textContent.trim() : "",
    mutationsOnRegion: records.filter((record) => record.onRegion).length,
    added: records.reduce((total, record) => total + record.added, 0),
    loginInvalid: login ? login.getAttribute("aria-invalid") : null,
    passwordInvalid: password ? password.getAttribute("aria-invalid") : null,
  }
})()`

/**
 * The error region before, during and after there is something to announce — the same proof
 * `liveRegionChecks` above builds for `SWUpdater`, applied to `AuthForm`'s `role="alert"` region.
 *
 * The identity comparison is the load-bearing part, for the same reason it is above: finding "a
 * region with the message in it" after a click would pass just as well against a region created
 * carrying its message, which is the defect this pattern rules out. A reference to the element is
 * parked before anything happens and a `MutationObserver` is attached to it, so a later reading can
 * show the message arriving as a change to the region the reader was already being told to watch.
 *
 * The field-level error is checked here too: the same click that fills the region also has to mark
 * exactly one field `aria-invalid`, never the other.
 */
async function authFormErrorChecks(devtools: Devtools): Promise<void> {
  const idle = await read(
    devtools,
    `(() => {
      const region = document.querySelector('${AUTH_ALERT}')
      if (!region) return null
      globalThis.__authRegionElement = region
      globalThis.__authRegionMutations = []
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          globalThis.__authRegionMutations.push({
            onRegion: record.target === globalThis.__authRegionElement,
            added: record.addedNodes.length,
            removed: record.removedNodes.length,
          })
        }
      })
      observer.observe(region, { childList: true, subtree: true, characterData: true })
      globalThis.__authRegionObserver = observer
      return {
        role: region.getAttribute("role"),
        live: region.getAttribute("aria-live"),
        atomic: region.getAttribute("aria-atomic"),
        text: region.textContent.trim(),
        children: region.childElementCount,
      }
    })()`,
    null as { role: string; live: string; atomic: string; text: string; children: number } | null,
  )

  check(
    "AuthForm's error region is in the page before there is anything to announce",
    Boolean(idle) && idle?.role === "alert" && idle?.live === "assertive" &&
      idle?.atomic === "true" && idle?.text === "" && idle?.children === 0,
    idle
      ? `role="${idle.role}" aria-live="${idle.live}" aria-atomic="${idle.atomic}", ` +
        `${idle.children} element children, text ${JSON.stringify(idle.text)}`
      : "the interactive card was not on the page, so there was no region to read",
  )

  await click(devtools, AUTH_SET_FORM_ERROR)
  await poll(
    () =>
      read(
        devtools,
        `${READ_AUTH_REGION}.text.includes(${JSON.stringify(AUTH_FORM_ERROR)})`,
        false,
      ),
    3_000,
  )
  const announced = await read(devtools, READ_AUTH_REGION, NO_AUTH_REGION)

  check(
    "a form-level error arrives inside the region that was already in the page",
    idle?.text === "" && announced.same && announced.connected &&
      announced.text.includes(AUTH_FORM_ERROR) && announced.mutationsOnRegion >= 1 &&
      announced.added >= 1 && announced.loginInvalid !== "true" &&
      announced.passwordInvalid !== "true",
    idle
      ? `the element parked while the region was empty is ${
        announced.same ? "the same element" : "NOT the element"
      } that now reads ${JSON.stringify(announced.text)}, with ${announced.mutationsOnRegion} ` +
        `mutation(s) recorded on it directly and neither field marked aria-invalid`
      : "there was no idle reading to compare against",
  )

  await click(devtools, AUTH_SET_FIELD_ERROR)
  await poll(
    () =>
      read(
        devtools,
        `${READ_AUTH_REGION}.text.includes(${JSON.stringify(AUTH_FIELD_ERROR)})`,
        false,
      ),
    3_000,
  )
  const fieldAnnounced = await read(devtools, READ_AUTH_REGION, NO_AUTH_REGION)

  check(
    "a field-named error reaches the same region and marks only that field aria-invalid",
    fieldAnnounced.same && fieldAnnounced.text.includes(AUTH_FIELD_ERROR) &&
      fieldAnnounced.loginInvalid === "true" && fieldAnnounced.passwordInvalid !== "true",
    `region reads ${JSON.stringify(fieldAnnounced.text)}, login aria-invalid=` +
      `${fieldAnnounced.loginInvalid}, password aria-invalid=${fieldAnnounced.passwordInvalid}`,
  )

  await click(devtools, AUTH_CLEAR_ERROR)
  await poll(() => read(devtools, `${READ_AUTH_REGION}.text === ""`, false), 3_000)
  const cleared = await read(devtools, READ_AUTH_REGION, NO_AUTH_REGION)

  check(
    "clearing the error empties the region instead of replacing it",
    cleared.same && cleared.connected && cleared.text === "",
    cleared.same
      ? `the region is still the same element, now reading ${JSON.stringify(cleared.text)}`
      : "the region was replaced rather than emptied",
  )

  await read(
    devtools,
    `(() => {
      if (globalThis.__authRegionObserver) globalThis.__authRegionObserver.disconnect()
      delete globalThis.__authRegionObserver
      delete globalThis.__authRegionElement
      delete globalThis.__authRegionMutations
      return true
    })()`,
    false,
  )
}

/**
 * The one-time-code step moves the focus to its field, and no other transition does.
 *
 * Read before and after, never asserted from the end state alone: "focus is on the code field" is
 * equally true of a page that loaded there already, so the check also confirms focus was
 * *somewhere else* before the step button was pressed.
 */
async function authFormFocusChecks(devtools: Devtools): Promise<void> {
  await click(devtools, AUTH_STEP_CREDENTIALS) // Known starting state, whatever ran before this.
  const before = await read(devtools, `${AUTH_STATE}?.focusedName || ""`, "")

  await click(devtools, AUTH_STEP_CODE)
  const appeared = await poll(
    () => read(devtools, `Boolean(document.querySelector('${AUTH_CODE}'))`, false),
    3_000,
  )
  const after = await read(devtools, `${AUTH_STATE}?.focusedName || ""`, "")

  check(
    "moving to the one-time-code step moves the focus to its field",
    appeared && before !== "code" && after === "code",
    appeared
      ? `focus was on "${before || "nothing"}" before the step button, "${after || "nothing"}" ` +
        `after it appeared`
      : "the code field never appeared within 3s of the step button",
  )

  await click(devtools, AUTH_STEP_CREDENTIALS) // Leave the card ready for the next block.
}

/**
 * The one-time-code focus effect fires once, on the transition into the step — never again for as
 * long as the step stays `"one-time-code"`.
 *
 * `authFormFocusChecks` above proves the move happens; this proves it happens on *no other* render.
 * Focus is parked on a demo control rather than left wherever the step button leaves it, and two
 * separate re-renders are forced on that same step — one by setting an error, one by toggling
 * `busy` — because a single forced render would leave open the possibility that the first one
 * happened to coincide with something the effect's real dependency was still reacting to. An effect
 * whose dependency array was dropped calls `.focus()` on the code field every render, which would
 * pull focus back off the button this parks it on after either forced render.
 */
async function authFormFocusStabilityChecks(devtools: Devtools): Promise<void> {
  await click(devtools, AUTH_STEP_CODE)
  // Waited out fully, not merely until the code field exists: `authFormFocusChecks` above proves
  // the step transition's own effect moves focus there, and that move is scheduled after the
  // commit rather than during it — the element existing is not the same as the effect having run.
  // Proceeding on existence alone raced that still-pending effect against the focus this function
  // parks next, and lost often enough to read as a false positive for the very bug it means to
  // catch: measured, the code field (which carries no `data-e2e`) took the focus a `focusedE2e`
  // read blamed on nothing at all.
  await poll(() => read(devtools, `${AUTH_STATE}?.focusedName === "code"`, false), 3_000)

  await focusAndClick(devtools, AUTH_SET_FORM_ERROR)
  const afterError = await read(devtools, `${AUTH_STATE}?.focusedE2e || ""`, "")

  await focusAndClick(devtools, AUTH_TOGGLE_BUSY)
  const afterBusy = await read(devtools, `${AUTH_STATE}?.focusedE2e || ""`, "")

  check(
    "forcing a re-render on the code step does not pull focus back to the code field",
    afterError === "auth-form-set-form-error" && afterBusy === "auth-form-toggle-busy",
    `focus read "${afterError || "nothing"}" after setting an error, "${
      afterBusy || "nothing"
    }" after toggling busy — the code field would have taken it back on every render`,
  )

  // Leave the card ready for the next block: busy off, error cleared, back on credentials.
  await click(devtools, AUTH_TOGGLE_BUSY)
  await click(devtools, AUTH_CLEAR_ERROR)
  await click(devtools, AUTH_STEP_CREDENTIALS)
}

/**
 * The show/hide password control: a real click, then a real Space press, then a real Enter press,
 * none of them a submit.
 *
 * `ui.ts`'s Dropdown and Modal checks already prove `pressKey(devtools, "Enter")` activates a
 * focused native button in general, but only a press on this button's own listener can catch a
 * handler here that called `preventDefault()` on Enter specifically (#261), so the toggle gets its
 * own Enter press rather than relying on that general proof. The click is `.click()`, which is how
 * every button in this file is activated; nothing here is testing the pointer path itself, only
 * what the activation does. `signIns` is read before and after every press, because a toggle that
 * happened to submit the form would be the one regression a purely visual check misses.
 */
async function authFormToggleChecks(devtools: Devtools): Promise<void> {
  const before = await read(devtools, AUTH_STATE, NO_AUTH_STATE)
  const clicked = await click(devtools, AUTH_TOGGLE)
  const afterClick = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "a real click on the show/hide button reveals the password and presses the button",
    clicked && before.passwordType === "password" && before.togglePressed === "false" &&
      afterClick.passwordType === "text" && afterClick.togglePressed === "true" &&
      afterClick.toggleFocused,
    clicked
      ? `type ${before.passwordType} → ${afterClick.passwordType}, aria-pressed ` +
        `${before.togglePressed} → ${afterClick.togglePressed}, focused after: ` +
        `${afterClick.toggleFocused}`
      : "no show/hide button to click",
  )

  await pressKey(devtools, "Space")
  const afterSpace = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "a real Space press on the focused button hides the password again",
    afterClick.toggleFocused && afterSpace.passwordType === "password" &&
      afterSpace.togglePressed === "false",
    afterClick.toggleFocused
      ? `type ${afterClick.passwordType} → ${afterSpace.passwordType}, aria-pressed ` +
        `${afterClick.togglePressed} → ${afterSpace.togglePressed}`
      : "the button did not keep the focus after the click, so Space had nothing to press",
  )

  await pressKey(devtools, "Enter")
  const afterEnter = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "a real Enter press on the focused button reveals the password again",
    afterSpace.toggleFocused && afterEnter.passwordType === "text" &&
      afterEnter.togglePressed === "true",
    afterSpace.toggleFocused
      ? `type ${afterSpace.passwordType} → ${afterEnter.passwordType}, aria-pressed ` +
        `${afterSpace.togglePressed} → ${afterEnter.togglePressed}`
      : "the button did not keep the focus after Space, so Enter had nothing to press",
  )

  // The toggle sits over the field's right edge, so the field's own right padding is all that
  // keeps a shown password from running under it (#331). A long value is set directly, read back
  // as geometry, and the field's previous value put back, so later checks see the page unchanged.
  const clearance = await devtools.evaluate<
    { textRight: number; toggleLeft: number; overflows: boolean; name: string } | null
  >(`(() => {
    const input = document.querySelector('${AUTH_PASSWORD}')
    const toggle = document.querySelector('${AUTH_TOGGLE}')
    if (!input || !toggle) return null
    const previous = input.value
    input.value = "a-long-password-that-fills-the-whole-field-and-then-some-0123456789"
    const box = input.getBoundingClientRect()
    const style = getComputedStyle(input)
    const textRight = box.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth)
    const overflows = input.scrollWidth > input.clientWidth
    input.value = previous
    return {
      textRight,
      toggleLeft: toggle.getBoundingClientRect().left,
      overflows,
      name: toggle.getAttribute("aria-label") || "",
    }
  })()`)
  check(
    "a long shown password ends before the show/hide toggle, which is named by its label",
    clearance !== null && afterEnter.passwordType === "text" && clearance.overflows &&
      clearance.textRight <= clearance.toggleLeft && clearance.name === "Hide password",
    clearance === null
      ? "no password field or toggle to measure"
      : `text area ends at ${clearance.textRight}px, toggle starts at ${clearance.toggleLeft}px, ` +
        `value overflows the field: ${clearance.overflows}, name "${clearance.name}"`,
  )

  check(
    "no press on the show/hide button submitted the form",
    before.signIns === afterClick.signIns && afterClick.signIns === afterSpace.signIns &&
      afterSpace.signIns === afterEnter.signIns,
    `sign-ins stayed at "${before.signIns}" across all three presses`,
  )
}

/**
 * A busy submit calls no callback, including one started with `form.requestSubmit()` — which
 * reaches the submit handler without going through the (disabled) submit button at all.
 *
 * The demo card's button fills every empty field before calling `requestSubmit()`, so a blocked
 * submit here is `busy` stopping it and not the browser's own constraint validation stopping an
 * empty required field — the same request is made once busy and once not, with the same values
 * left in the fields from the first attempt, so only `busy` differs between the two.
 */
async function authFormBusyChecks(devtools: Devtools): Promise<void> {
  const before = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  await click(devtools, AUTH_TOGGLE_BUSY)
  const busy = await read(devtools, AUTH_STATE, NO_AUTH_STATE)
  await click(devtools, AUTH_REQUEST_SUBMIT)
  const afterBusySubmit = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "the submit button is disabled and says so off-screen while busy",
    busy.submitDisabled && busy.statusText.length > 0,
    `disabled=${busy.submitDisabled}, status region reads ${JSON.stringify(busy.statusText)}`,
  )
  check(
    "a busy form.requestSubmit() calls no callback",
    before.signIns === busy.signIns && busy.signIns === afterBusySubmit.signIns,
    `sign-ins stayed at "${before.signIns}" through toggling busy and requesting a submit`,
  )

  await click(devtools, AUTH_TOGGLE_BUSY) // Busy off, same filled fields left from the attempt above.
  const idle = await read(devtools, AUTH_STATE, NO_AUTH_STATE)
  await click(devtools, AUTH_REQUEST_SUBMIT)
  const submitted = await poll(
    () => read(devtools, `${AUTH_STATE}?.signIns !== ${JSON.stringify(idle.signIns)}`, false),
    3_000,
  )
  const afterIdleSubmit = await read(devtools, AUTH_STATE, NO_AUTH_STATE)

  check(
    "the same form.requestSubmit() calls the callback once busy is cleared",
    !idle.submitDisabled && submitted && afterIdleSubmit.signIns !== idle.signIns,
    !idle.submitDisabled
      ? submitted
        ? `sign-ins went from "${idle.signIns}" to "${afterIdleSubmit.signIns}"`
        : "no change in sign-ins within 3s of requesting a submit with busy cleared"
      : "the submit button was still disabled after toggling busy off",
  )
}

/**
 * Wait for the next `Page.loadEventFired`, without throwing.
 *
 * Every other wait in this file goes through {@link poll}, which never throws either — a real
 * navigation is the one event this harness has no poll-based way to wait for, so this is `next`'s
 * own timeout turned into a reading instead of an exception. That matters most here: a throw would
 * abort this function immediately, and this is the one `AuthForm` check that leaves the page in a
 * state — script execution disabled, possibly mid-navigation — every later check in the `system`
 * block depends on being undone. `authFormNoScriptChecks` restores that state in a `finally`
 * block, which a throw from this call would skip.
 *
 * @param devtools The connected session.
 * @param timeoutMs How long to wait before giving up.
 * @returns Whether the event arrived in time.
 */
async function waitForLoad(devtools: Devtools, timeoutMs = 20_000): Promise<boolean> {
  try {
    await devtools.next("Page.loadEventFired", timeoutMs)
    return true
  } catch {
    return false
  }
}

/**
 * Wait until `scrollY` has held the same value for a full second, bounded.
 *
 * Written for `authFormNoScriptChecks`'s restoring reload specifically: the guide shell's
 * route effect re-runs on every load and smoothly scrolls toward whatever card the address
 * currently deep-links to, which can still be moving hundreds of milliseconds after the load
 * event fires. `settleScroll` further down this file polls for two *consecutive* readings a tenth
 * of a second apart, which is enough to catch the tail of a settling animation but not enough to
 * rule out the coasting middle of a `scroll-behavior: smooth` one — the reading it returns can
 * still be moving. A full second is a large enough window to run out that possibility instead of
 * merely reducing it, and this function's caller is the one place in this file that needs that
 * assurance rather than a numeric position.
 *
 * @param devtools The connected session.
 * @param stableForMs How long `scrollY` has to stop changing before this resolves `true`.
 * @param timeoutMs How long to keep trying before giving up and resolving `false`.
 * @returns Whether the page held still for `stableForMs`, within `timeoutMs`.
 */
async function waitForScrollSettle(
  devtools: Devtools,
  stableForMs = 1_000,
  timeoutMs = 20_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  let previous = -1
  let stableSince: number | null = null

  while (Date.now() < deadline) {
    const now = await read(devtools, "Math.round(globalThis.scrollY)", -1)
    if (now === previous) {
      stableSince ??= Date.now()
      if (Date.now() - stableSince >= stableForMs) return true
    } else {
      previous = now
      stableSince = null
    }
    await new Promise((done) => setTimeout(done, 100))
  }

  return false
}

/**
 * A submit before the bundle has run — the gap between the page painting and hydration finishing,
 * or JavaScript off entirely — must never put the password in the address bar.
 *
 * This is the one behaviour in the package no other check in this file can reach: every one of
 * them runs against Preact's own submit handler on an already-hydrated page, and proving the
 * no-JavaScript path needs a page that never ran the bundle at all. `Emulation.
 * setScriptExecutionDisabled` buys that by disabling script execution before the next navigation.
 * `Runtime.evaluate` keeps working the whole time — DevTools reads and writes the page through its
 * own privileged channel rather than through the page's own script execution, measured here rather
 * than assumed — so this check can still fill fields, find the button and read `location.search`
 * the ordinary way even though nothing the page itself authored can run.
 *
 * The card driven is `AUTH_INTERACTIVE`: it carries callbacks and no `action`, the ordinary shape
 * of a hydrated app and the one `ui-guide/sections/system.tsx`'s own doc names for exactly this
 * reason. Its markup is prerendered — `catalogue.test.tsx` proves every card is — so the card and
 * its `<form method="post">` exist on the page in full before any script runs; only the
 * interactivity hydration would add is missing.
 *
 * The button is pressed with a real pointer for the same reason `authFormModeSwitchChecks` uses
 * one: a `.click()` run through `Runtime.evaluate` is script executing on the page's behalf where
 * genuinely none should be able to, which would make a pass here prove nothing about a visitor's
 * own tap. `location.search` is compared before and after rather than asserted empty, because an
 * earlier block in this same run may have left a query string on the page this check reloads —
 * what matters is that the press added nothing to whatever was already there.
 *
 * **Everything from disabling script execution onward runs inside a `try`, and re-enabling it,
 * reloading the page and waiting for the `data-hydrated` marker `verify.ts` waits for at startup
 * all run inside the matching `finally`.** A throw or a stalled navigation partway through the
 * probe must not leave the page unhydrated for every check after this one — measured, not assumed:
 * a real run under machine load once left a bare `Page.navigate` plus
 * `next("Page.loadEventFired")` waiting past its timeout, which without a `finally` took the whole
 * rest of the `system` block, and the unrestored page took the next block after it too.
 * {@link waitForLoad} is what makes the restoration itself safe to run unconditionally — it turns
 * that same timeout into a reading rather than a second throw.
 *
 * **The restoring reload does not make this function's `finally` block done, because the
 * catalogue's own route effect is not done with the page yet.** Every load — this reload included —
 * re-runs the guide shell's route effect, which smoothly scrolls toward whatever card the
 * address currently deep-links to, and that address still carries whatever route an earlier block
 * left in it. Measured: several thousand pixels of scroll, still moving several hundred
 * milliseconds after the reload's own load event. Returning while that animation is running hands
 * the next block's own `scrollIntoView` and `focus()` calls a scroll position that keeps changing
 * under them from a cause that has nothing to do with what they are testing — measured to turn
 * `calendarChecks`' "no key the grid answers scrolls the page" red on code this file never
 * touches. So the `finally` block's last step waits for `scrollY` to hold still for about a
 * second, bounded, and records its own named check when it never does, rather than letting a
 * moving page pass silently into whatever runs next.
 */
async function authFormNoScriptChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")

  let unhydrated = false
  let before = "(page unreadable)"
  let target: { x: number; y: number } | null = null
  let settled = false
  let after = "(page unreadable)"

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    // `Page.reload`, not `Page.navigate` to the same address: measured against this exact page,
    // navigating to the URL already loaded did not reliably tear down the already-hydrated
    // document, so `data-hydrated` read "true" straight through a run that had genuinely disabled
    // script execution — a false negative for the very bug this check exists to catch.
    // `ignoreCache` also rules out the bundle answering from HTTP cache as a second way to reach
    // the same false negative.
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForLoad(devtools)

    unhydrated = loaded &&
      await read(devtools, `document.documentElement.dataset.hydrated !== "true"`, false)
    before = await read(devtools, "location.search", "(page unreadable)")

    await fillCredentialFields(devtools)
    target = await read(
      devtools,
      `(() => {
        const card = document.querySelector('${AUTH_INTERACTIVE}')
        const form = card ? card.querySelector('form') : null
        const button = form ? form.querySelector('button[type="submit"]') : null
        if (!button) return null
        button.scrollIntoView({ block: "center", behavior: "instant" })
        const rect = button.getBoundingClientRect()
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        }
      })()`,
      null as { x: number; y: number } | null,
    )
    if (target) await clickAt(devtools, target)

    settled = await poll(
      () => read(devtools, `document.readyState === "complete"`, false),
      8_000,
    )
    after = await read(devtools, "location.search", "(page unreadable)")
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})
    // `Page.reload`, not `Page.navigate`, for the same reason the disabling step above uses it:
    // the submit this function presses lands back on `restoreUrl` whether or not it changed
    // anything, so this is a reload of the page already there rather than a navigation to a
    // different one, and `Page.navigate` to that identical address was measured not to reliably
    // rehydrate it — sending both in sequence races two navigations against each other, which is
    // worse, so this is the one command rather than a belt-and-braces pair of them.
    await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
    await waitForLoad(devtools)

    // The one case `reload` alone cannot fix: a target miss or a stray navigation left the page
    // somewhere other than where the run was. Checked rather than assumed, and only acted on when
    // it is actually true, so the ordinary run never sends the second navigation this function's
    // own doc says not to race against the first.
    const strayed = await read(
      devtools,
      `location.href !== ${JSON.stringify(restoreUrl)}`,
      false,
    )
    if (strayed) {
      await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
      await waitForLoad(devtools)
    }

    // Last, and inside the same `finally`: the catalogue's own deep-link scroll, restarted by the
    // reload above, has to actually stop before this function hands the page to whatever runs
    // next — see this function's own doc for what happens when it does not.
    const scrollSettled = await waitForScrollSettle(devtools)
    check(
      "the page's own route scroll settles after the restoring reload",
      scrollSettled,
      scrollSettled
        ? "scrollY held still for a full second before this check returned"
        : "scrollY never held still — a later block may have read it while it was still moving",
    )
  }

  check(
    "a submit with script execution disabled never puts the password in the URL",
    unhydrated && Boolean(target) && settled && after === before,
    !unhydrated
      ? "the fresh load still hydrated, so this proves nothing about a visitor without the bundle"
      : !target
      ? "no submit button was found on the unhydrated, prerendered page"
      : `location.search ${JSON.stringify(before)} → ${JSON.stringify(after)}` +
        (settled ? "" : " (the page never reached readyState complete)"),
  )

  const rehydrated = await poll(
    () => read(devtools, `document.documentElement.dataset.hydrated === "true"`, false),
    10_000,
  )
  check(
    "the page rehydrates once script execution is re-enabled again",
    rehydrated,
    rehydrated
      ? "data-hydrated set again after the restoring reload"
      : "the page never rehydrated after script execution was re-enabled",
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
 * Buttons are activated with `.click()` rather than a key press: no step here is about the
 * keyboard, and `ui.ts`'s Dropdown and Modal checks already prove a real Enter press activates a
 * focused native button.
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

/** The card whose owner refuses every month change, and the pieces of it its checks read. */
const REFUSED = '#demo-Calendar [data-e2e="calendar-refused"]'
const REFUSED_GRID = `${REFUSED} [role="grid"]`
/** An ordinary button of that card, outside the calendar: somewhere to move the focus to. */
const REFUSED_RESET = `${REFUSED} [data-e2e="calendar-refused-reset"]`
/**
 * The day those checks stand on, and why it is that day rather than any other.
 *
 * The card pins `today` to `2026-03-10`, and a refused request leaves the grid's own Tab stop
 * falling back to today. Standing on the 19th is therefore what separates "the focus went back to
 * the day the reader was on" from "the focus went to the day the grid would have picked anyway":
 * a fix that restored the focus to the Tab stop rather than to the day the press started from
 * would land on the 10th and fail here. The card gives it availability, so it is a selectable
 * `<button>`.
 */
const REFUSED_DAY = "2026-03-19"

/** The card whose owner draws the month it was asked for, but a timer later. */
const LATE = '#demo-Calendar [data-e2e="calendar-late"]'
const LATE_GRID = `${LATE} [role="grid"]`
/** The day its checks stand on: the same 19th, and for the same reason. */
const LATE_DAY = "2026-03-19"

/** The card the lightbox checks drive. */
const LIGHTBOX = "#demo-ImageLightbox"
const DIALOG = `${LIGHTBOX} dialog`
const PLAIN_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-image"]`
const LINKED_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-linked-image"]`
/** The card's third scenario: an undescribed image inside a link, `fallbackAlt=""`. */
const BARE_IMAGE = `${LIGHTBOX} [data-e2e="lightbox-bare-image"]`

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

  // Aimed rather than assumed: the focus is put on the day immediately left of the first selectable
  // one, which the card's data makes a day with no availability, so one press right crosses from a
  // day that cannot be picked to one that can. The reason used to live in a `title`, which is why
  // the grid is also counted for them.
  const staged = await read(
    devtools,
    `(() => {
      const grid = document.querySelector('${GRID}')
      if (!grid) return { staged: false, from: "", to: "", reason: "no grid on the page" }
      const cells = [...grid.querySelectorAll("[data-calendar-date]")]
      const selectable = cells.findIndex((cell) =>
        cell.tagName === "A" || cell.tagName === "BUTTON"
      )
      if (selectable < 1) {
        return { staged: false, from: "", to: "", reason: "no selectable day with a day before it" }
      }
      cells[selectable - 1].focus()
      return {
        staged: document.activeElement === cells[selectable - 1],
        from: cells[selectable - 1].getAttribute("data-calendar-date"),
        to: cells[selectable].getAttribute("data-calendar-date"),
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
  const onSelectable = await read(devtools, CALENDAR_STATE, NO_CALENDAR)

  check(
    "a day that cannot be picked takes focus, and says why where a keyboard reaches it",
    staged.staged && onDisabled.disabled && onDisabled.label.includes("not available") &&
      onDisabled.hintShown && onDisabled.hint === onDisabled.label &&
      onSelectable.date === staged.to && onSelectable.hint.includes("available") &&
      !onSelectable.hint.includes("not available") && onDisabled.titles === 0,
    staged.staged
      ? `focus on ${onDisabled.date}: aria-disabled=${onDisabled.disabled}, named ` +
        `"${onDisabled.label}", hint ${onDisabled.hintShown ? "shown" : "hidden"} reading ` +
        `"${onDisabled.hint}"; one press right lands on ${onSelectable.date} and the hint reads ` +
        `"${onSelectable.hint}"; ${onDisabled.titles} title attributes inside the grid`
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
  await refusedMonthChecks(devtools)
  await lateMonthChecks(devtools)
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

/** Where the focus is on one calendar card, what the card shows, and what it says it was asked. */
interface CardState {
  /** `data-calendar-date` of the focused element, or `""` when the focus is not on a day. */
  date: string
  /** Whether the focused element is a day cell of *this* card's grid. */
  onDay: boolean
  /** Whether the focus is on the grid container itself — where a pending request parks it. */
  onGrid: boolean
  /** Whether nothing holds the focus: the document body, the root element, or no element at all. */
  onBody: boolean
  /** What the focused element is, for a failure message. */
  focused: string
  /** `data-e2e` of the focused element, or `""` — how a check names a control it moved focus to. */
  focusedHook: string
  /** The month heading, e.g. `March 2026`. */
  heading: string
  /** The one day the grid offers as its Tab stop, which is where Shift-Tab would come back to. */
  tabStop: string
  /** The month anchor the card says it was last asked for. */
  asked: string
  /** The card's own counter; `-1` when it could not be read. */
  count: number
  /** One more piece of the card's text, when it has one to read. */
  extra: string
}

/** A reading that says "nothing could be read", so a check built on it fails rather than passes. */
const NO_CARD: CardState = {
  date: "",
  onDay: false,
  onGrid: false,
  onBody: false,
  focused: "the page could not be read",
  focusedHook: "",
  heading: "",
  tabStop: "",
  asked: "",
  count: -1,
  extra: "",
}

/**
 * Build the expression that reads {@link CardState} for one card.
 *
 * Written to survive every element it names being absent: a card that is not on the page reads back
 * as {@link NO_CARD} rather than throwing, because a throw here costs every later check in this
 * file rather than the one that was looking for the card.
 *
 * @param card Selector of the card's wrapper.
 * @param hooks `data-e2e` names of the card's own text, inside that wrapper: the month it was asked
 *              for, its counter, and optionally one more piece.
 */
function cardState(
  card: string,
  hooks: { asked: string; count: string; extra?: string },
): string {
  return `(() => {
    const card = document.querySelector('${card}')
    const grid = card ? card.querySelector('[role="grid"]') : null
    const heading = card ? card.querySelector('h3') : null
    const stop = grid ? grid.querySelector('[data-calendar-date][tabindex="0"]') : null
    const active = document.activeElement
    const text = (hook) => {
      const node = hook && card ? card.querySelector('[data-e2e="' + hook + '"]') : null
      return node ? node.textContent.trim() : ""
    }
    const date = active && active.getAttribute
      ? (active.getAttribute("data-calendar-date") || "")
      : ""
    // Named rather than tagged, because "the focus is on div" is the one failure this file exists
    // to report and a reader should not have to work out which div that is.
    const describe = (element) => {
      if (!element) return "nothing"
      if (element === grid) return "the grid container itself"
      if (element === document.body) return "the document body — nothing holds the focus"
      const name = element.getAttribute("aria-label") || element.getAttribute("data-e2e") || ""
      return element.tagName.toLowerCase() + (name ? ' "' + name + '"' : "")
    }
    const counted = text(${JSON.stringify(hooks.count)})
    return {
      date,
      onDay: Boolean(grid && active && grid.contains(active) && date),
      onGrid: Boolean(grid) && active === grid,
      onBody: !active || active === document.body || active === document.documentElement,
      focused: describe(active),
      focusedHook: active && active.getAttribute ? (active.getAttribute("data-e2e") || "") : "",
      heading: heading ? heading.textContent.trim() : "",
      tabStop: stop ? stop.getAttribute("data-calendar-date") : "",
      asked: text(${JSON.stringify(hooks.asked)}),
      count: counted ? Number(counted) : -1,
      extra: text(${JSON.stringify(hooks.extra ?? "")}),
    }
  })()`
}

/** The refusing card's reading. */
const REFUSED_STATE = cardState(REFUSED, {
  asked: "calendar-refused-asked",
  count: "calendar-refused-count",
})

/** The late-answering card's reading; `count` is how many answers it has drawn. */
const LATE_STATE = cardState(LATE, {
  asked: "calendar-late-asked",
  count: "calendar-late-answered",
  extra: "calendar-late-month",
})

/** What the recorder below saw at the end of the key dispatch it was armed for. */
interface RefusalProbe {
  /** Whether a month key reached the grid at all. */
  ran: boolean
  /** `data-calendar-date` of the element the key was pressed on. */
  from: string
  /** Whether the focus was on the grid container by the end of that dispatch. */
  parked: boolean
  /** What the focus was on instead, when it was not. */
  focused: string
  /** What the recorder moved the focus to, when it was armed to move it. */
  movedTo: string
}

const NO_PROBE: RefusalProbe = {
  ran: false,
  from: "",
  parked: false,
  focused: "no probe was armed, so nothing was recorded",
  movedTo: "",
}

/**
 * Read what the probe recorded, or a reading that fails every check built on it.
 *
 * The fallback is inlined into the expression rather than left to {@link read}, and the difference
 * is not cosmetic: `read` substitutes its fallback only when the *page* throws, and an unset global
 * does not throw — it evaluates to `undefined`, which arrives here as `undefined` and makes the
 * very next property access throw on this side instead. That throw costs the rest of this
 * package's block, which is the same cost a missing card should report as one failed check.
 */
function readProbe(devtools: Devtools): Promise<RefusalProbe> {
  return read(
    devtools,
    `globalThis.__calendarRefusal ?? ${JSON.stringify(NO_PROBE)}`,
    NO_PROBE,
  )
}

/**
 * Arm a one-shot recorder for the moment the refusing card's grid takes the focus itself.
 *
 * This is how the *intermediate* state is read without a race, and the event it listens for is the
 * point. A month request parks the focus on the grid container while it waits for the new cells,
 * and the wait is now shorter than a single key dispatch: the calendar decides in a layout effect,
 * and the microtask checkpoint that runs between two listeners on the same `keydown` is enough for
 * that effect to have run and moved the focus on again. A listener on the key therefore sees the
 * end of the story and never the middle. A `focusin` listener on the grid sees the middle, because
 * it is called synchronously from inside the parking `focus()` call itself.
 *
 * Arming it with a selector also gives the checks the only way to be somewhere else *while* a
 * request is outstanding, which is the window rule 2 of this behaviour is about. The move happens
 * inside the same call, before the caller has even been asked for the month.
 *
 * The key is still a real press through the browser's input pipeline. Nothing here substitutes for
 * the component's handler; the listener only watches what that handler does.
 *
 * @param devtools The connected session.
 * @param moveTo A selector to move the focus to the instant the grid takes it, or `""` to record
 *               the parking and leave the focus alone.
 * @returns Whether there was a grid to arm.
 */
function armRefusalProbe(devtools: Devtools, moveTo: string): Promise<boolean> {
  return read(
    devtools,
    `(() => {
      // Arming twice must not leave two listeners on the page. The parking a probe waits for is
      // sometimes the very thing that does not happen — that is the failure these checks report —
      // so the listener cannot be trusted to remove itself, and the previous one comes off here
      // before another goes on.
      if (globalThis.__calendarRefusalOff) globalThis.__calendarRefusalOff()
      const grid = document.querySelector('${REFUSED_GRID}')
      if (!grid) return false
      const move = ${JSON.stringify(moveTo)}
      globalThis.__calendarRefusal = {
        ran: false, from: "", parked: false, focused: "the grid never took the focus", movedTo: "",
      }
      const listener = (event) => {
        if (event.target !== grid) return
        grid.removeEventListener("focusin", listener)
        const record = globalThis.__calendarRefusal
        const cameFrom = event.relatedTarget
        record.ran = true
        record.parked = true
        record.from = cameFrom && cameFrom.getAttribute
          ? (cameFrom.getAttribute("data-calendar-date") || "")
          : ""
        record.focused = "the grid container itself"
        if (move) {
          const elsewhere = document.querySelector(move)
          if (elsewhere) elsewhere.focus()
          record.movedTo = document.activeElement === elsewhere
            ? (elsewhere.getAttribute("data-e2e") || elsewhere.tagName.toLowerCase())
            : "nothing — the move did not land"
        }
      }
      grid.addEventListener("focusin", listener)
      globalThis.__calendarRefusalOff = () => grid.removeEventListener("focusin", listener)
      return true
    })()`,
    false,
  )
}

/** Take any armed probe off the page, listener and globals both. */
function disarmRefusalProbe(devtools: Devtools): Promise<boolean> {
  return read(
    devtools,
    `(() => {
      if (globalThis.__calendarRefusalOff) globalThis.__calendarRefusalOff()
      delete globalThis.__calendarRefusalOff
      delete globalThis.__calendarRefusal
      return true
    })()`,
    false,
  )
}

/**
 * Put the focus on one day of a card's grid and wait for the render that follows.
 *
 * The wait is not decoration. Focusing a cell tells the component where the reader is through the
 * cell's own `focus` handler, and the cursor every key press counts from is reconciled during the
 * render that handler causes. A press sent before that render would count from the day the grid
 * had chosen for itself — today — and the check below would then be measuring the wrong day
 * through no fault of the component.
 *
 * @param devtools The connected session.
 * @param grid Selector of the grid to stand in.
 * @param date The day to stand on, `YYYY-MM-DD`.
 * @returns Whether the focus landed there and the grid agreed it is now the Tab stop.
 */
async function standOnDay(devtools: Devtools, grid: string, date: string): Promise<boolean> {
  const landed = await read(
    devtools,
    `(() => {
      const cell = document.querySelector('${grid} [data-calendar-date="${date}"]')
      if (!cell) return false
      cell.focus()
      return document.activeElement === cell
    })()`,
    false,
  )

  return landed && await poll(
    () =>
      read(
        devtools,
        `document.querySelector('${grid} [data-calendar-date="${date}"]')` +
          `?.getAttribute("tabindex") === "0"`,
        false,
      ),
    3_000,
  )
}

/** Put the card in the middle of the viewport and let the smooth scroll finish. */
async function frameCard(devtools: Devtools, card: string): Promise<boolean> {
  const framed = await read(
    devtools,
    `(() => {
      const card = document.querySelector('${card}')
      if (!card) return false
      card.scrollIntoView({ block: "center", behavior: "instant" })
      return true
    })()`,
    false,
  )
  await settleScroll(devtools)
  return framed
}

/**
 * What a month change the owner refuses does to the reader's place in the grid.
 *
 * `onSelectMonth` is a request, and a controlled calendar is free to leave the month where it is.
 * The calendar parks the focus on the grid container while it waits for the month to be drawn,
 * because a month change replaces every cell; a request that is never answered used to leave it
 * parked there for good, so the reader's next arrow press was spent walking back to the day they
 * had never left, and a screen reader on the focused element read the grid rather than a date.
 *
 * Every check here rules out the obvious second cause. "The focus is still on the 19th" and "the
 * month is still March" are both exactly as true of a key press that never reached the page at
 * all, so each one is asserted together with the card's own count of refused requests rising by
 * one — proof that the press arrived, that the component asked, and that the owner said no.
 *
 * **Page Up and Page Down are the only keys this can happen to**, which is why they are the two
 * keys pressed here. An arrow at a month's edge cannot cross the month — `moveTo` refuses a day
 * outside the cursor's own month outright — and Home and End are clipped to the month by
 * `dayInMonth`, so neither ever reaches `onSelectMonth` and neither can be refused.
 *
 * **The control is not repeated here.** That a month change the owner *accepts* still carries the
 * focus into the new month is what "Page Down and Page Up move the grid a month, keeping the focus
 * on the same day number" asserts, a few checks above, against the interactive card.
 *
 * Nothing below reads a colour, a size or anything else a resting pointer could change — the
 * readings are `document.activeElement`, two pieces of the card's own text and the month heading —
 * so no pointer is parked first.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function refusedMonthChecks(devtools: Devtools): Promise<void> {
  // Nothing below may be read off a page that is still scrolling.
  const framed = await frameCard(devtools, REFUSED)

  const stagedDown = framed && await standOnDay(devtools, REFUSED_GRID, REFUSED_DAY)
  const beforeDown = await read(devtools, REFUSED_STATE, NO_CARD)
  await armRefusalProbe(devtools, "")
  await pressKey(devtools, "PageDown")
  // The whole transition in one predicate: the count has risen *and* the focus is back on the day.
  // Polling on the count alone would read the page between the refusal and the effect that answers
  // it; polling on the day alone would be satisfied by a press that never arrived.
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${REFUSED_STATE}; return state.count === ${
          beforeDown.count + 1
        } && state.date === ${JSON.stringify(REFUSED_DAY)} })()`,
        false,
      ),
    3_000,
  )
  const afterDown = await read(devtools, REFUSED_STATE, NO_CARD)
  const probeDown = await readProbe(devtools)

  check(
    "a month change the owner refuses leaves Page Down's focus on the day it was pressed on",
    stagedDown && beforeDown.date === REFUSED_DAY && beforeDown.heading !== "" &&
      beforeDown.count >= 0 && afterDown.count === beforeDown.count + 1 &&
      afterDown.asked === "2026-04-01" && afterDown.heading === beforeDown.heading &&
      afterDown.onDay && afterDown.date === REFUSED_DAY,
    stagedDown
      ? `from ${beforeDown.date} in ${beforeDown.heading}: the card was asked for ` +
        `${afterDown.asked} and its refusal count went ${beforeDown.count} → ` +
        `${afterDown.count}, the heading went ${beforeDown.heading} → ` +
        `${afterDown.heading || "unreadable"}, and the ` +
        `focus is on ${afterDown.date || afterDown.focused}`
      : `the focus was never staged on ${REFUSED_DAY} of the refusing card`,
  )
  check(
    "the focus waits on the grid itself while a month change is outstanding",
    probeDown.ran && probeDown.from === REFUSED_DAY && probeDown.parked,
    probeDown.ran
      ? `a focusin listener on the grid, called from inside the component's own focus() call, ` +
        `saw the container take the focus from ${probeDown.from || "nowhere"} — the wait is ` +
        `shorter than the key dispatch, so only a listener on the focus move itself can see it`
      : "the refusing card's grid never took the focus, so no month was being waited for",
  )

  // The cursor the next press counts from has to come back with the focus. It is a separate fact
  // from where the focus is: the component keeps its own cursor, and a version that put the focus
  // back on the 19th while leaving the cursor on the day the grid fell back to would send this
  // press to the 11th.
  const arrowTarget = dayAfter(REFUSED_DAY, 1)
  await pressKey(devtools, "ArrowRight")
  await poll(
    () => read(devtools, `${REFUSED_STATE}.date === ${JSON.stringify(arrowTarget)}`, false),
    3_000,
  )
  const afterArrow = await read(devtools, REFUSED_STATE, NO_CARD)

  check(
    "the next arrow press after a refused month counts from the day the focus went back to",
    afterDown.date === REFUSED_DAY && afterArrow.onDay && afterArrow.date === arrowTarget &&
      afterArrow.heading === beforeDown.heading &&
      afterArrow.count === afterDown.count,
    afterDown.date === REFUSED_DAY
      ? `${afterDown.date} → Arrow Right → ${afterArrow.date || afterArrow.focused}, wanted ` +
        `${arrowTarget}; the month went ${afterDown.heading} → ` +
        `${afterArrow.heading || "unreadable"} and nothing ` +
        `further was asked for (count ${afterArrow.count})`
      : `the focus was not on ${REFUSED_DAY} after the refusal, so this measures nothing`,
  )

  // The second month-crossing key, so the rule is not held by one input. Page Up goes the other
  // way and is refused the same way.
  const stagedUp = await standOnDay(devtools, REFUSED_GRID, REFUSED_DAY)
  const beforeUp = await read(devtools, REFUSED_STATE, NO_CARD)
  await armRefusalProbe(devtools, "")
  await pressKey(devtools, "PageUp")
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${REFUSED_STATE}; return state.count === ${
          beforeUp.count + 1
        } && state.date === ${JSON.stringify(REFUSED_DAY)} })()`,
        false,
      ),
    3_000,
  )
  const afterUp = await read(devtools, REFUSED_STATE, NO_CARD)
  const probeUp = await readProbe(devtools)

  check(
    "a refused Page Up leaves the focus on its day too, so the rule is not one key's",
    stagedUp && beforeUp.date === REFUSED_DAY && beforeUp.count >= 0 &&
      probeUp.ran && probeUp.parked && afterUp.count === beforeUp.count + 1 &&
      afterUp.asked === "2026-02-01" && afterUp.heading === beforeUp.heading &&
      afterUp.onDay && afterUp.date === REFUSED_DAY,
    stagedUp
      ? `from ${beforeUp.date} in ${beforeUp.heading}: the card was asked for ${afterUp.asked}, ` +
        `its refusal count went ${beforeUp.count} → ${afterUp.count}, the focus waited on ` +
        `${probeUp.parked ? "the grid" : probeUp.focused} and came back to ` +
        `${afterUp.date || afterUp.focused} with the heading going ${beforeUp.heading} → ` +
        `${afterUp.heading || "unreadable"}`
      : `the focus was never staged on ${REFUSED_DAY} for the Page Up press`,
  )

  // Restoring the focus is a move *from the grid*, never a move from wherever the reader happens to
  // be. The recorder moves the focus to a button outside the calendar in the same dispatch as the
  // press, which is what a reader pressing Tab while the request is outstanding does, and the
  // calendar has to leave it there.
  const stagedOut = await standOnDay(devtools, REFUSED_GRID, REFUSED_DAY)
  const beforeOut = await read(devtools, REFUSED_STATE, NO_CARD)
  await armRefusalProbe(devtools, REFUSED_RESET)
  await pressKey(devtools, "PageDown")
  const askedOut = await poll(
    () => read(devtools, `${REFUSED_STATE}.count === ${beforeOut.count + 1}`, false),
    3_000,
  )
  // A full second of asking whether the focus ever comes back to a day. A pass spends all of it;
  // a component that pulls the focus back answers within a frame and this returns early.
  const pulledBack = await poll(() => read(devtools, `${REFUSED_STATE}.onDay`, false), 1_000)
  const afterOut = await read(devtools, REFUSED_STATE, NO_CARD)
  const probeOut = await readProbe(devtools)

  check(
    "a refusal does not take the focus back from a control the reader moved it to",
    stagedOut && beforeOut.date === REFUSED_DAY && probeOut.ran && probeOut.parked &&
      probeOut.movedTo === "calendar-refused-reset" && askedOut && !pulledBack &&
      afterOut.focusedHook === "calendar-refused-reset" && !afterOut.onDay && afterOut.date === "",
    stagedOut && probeOut.ran
      ? `Page Down on ${beforeOut.date} parked the focus on ` +
        `${probeOut.parked ? "the grid" : probeOut.focused}, the same dispatch moved it to ` +
        `${probeOut.movedTo || "nowhere"}, the card's refusal count went ${beforeOut.count} → ` +
        `${afterOut.count}, and a second later the focus is on ${afterOut.focused} — ` +
        `${pulledBack ? "it was pulled back onto a day" : "not pulled back onto a day"}`
      : stagedOut
      ? "no Page Down reached the refusing card's grid"
      : `the focus was never staged on ${REFUSED_DAY} for the move-away press`,
  )

  // The other half of "the reader keeps their place", and the only half a check can isolate. Where
  // the focus goes back is proved above; where the grid's *Tab stop* goes back to can only be seen
  // on this path, because everywhere else the restoring focus call fires the cell's own `focus`
  // handler, which sets the Tab stop as a side effect and hides whether the refusal branch set it.
  // Here the focus is elsewhere, nothing else touches it, and the Tab stop is what a reader
  // pressing Shift-Tab back into this calendar would land on: the day they pressed from, not the
  // day the grid falls back to when it has no request to honour.
  check(
    "a refusal the reader has walked away from still puts the grid's Tab stop on their day",
    stagedOut && beforeOut.tabStop === REFUSED_DAY && askedOut &&
      afterOut.focusedHook === "calendar-refused-reset" && afterOut.tabStop === REFUSED_DAY,
    stagedOut
      ? `with the focus moved to ${afterOut.focusedHook || "nowhere"} during the request, the ` +
        `grid's one Tab stop went ${beforeOut.tabStop || "nowhere"} → ` +
        `${afterOut.tabStop || "nowhere"}; the day the grid falls back to on its own is ` +
        `2026-03-10, the card's today`
      : `the focus was never staged on ${REFUSED_DAY} for the move-away press`,
  )

  // Leave no listener and no global behind: the probe is armed for a press that sometimes never
  // arrives, which is the one case its own listener cannot clean up after.
  await disarmRefusalProbe(devtools)
}

/**
 * Put the late-answering card back on the month it starts on, with nothing asserted on it.
 *
 * Its owner answers every month arrow too, so the walk is a poll per step rather than a click and
 * a guess, and it gives up rather than looping if the card stops answering.
 *
 * @param devtools The connected session.
 */
async function settleLateCard(devtools: Devtools): Promise<void> {
  for (let step = 0; step < 8; step++) {
    const now = await read(devtools, `${LATE_STATE}.extra`, "")
    if (now === "2026-03-01" || now === "") break
    const direction = now < "2026-03-01" ? "Next" : "Previous"
    await read(
      devtools,
      `(document.querySelector('${LATE} button[aria-label^="${direction} month"]')?.click(), true)`,
      false,
    )
    await poll(() => read(devtools, `${LATE_STATE}.extra !== ${JSON.stringify(now)}`, false), 5_000)
  }
}

/**
 * What an owner that draws the month it was asked for, but later, does to the reader's place.
 *
 * This is the case the refusal handling above creates and has to finish. A refusal can only be
 * judged by the render that follows the call, so an owner that checks or fetches before it answers
 * — `onSelectMonth: async (month) => { await load(month); setMonth(month) }`, an ordinary thing to
 * write — is read as a refusal first and the reader is put back on their day. The month that then
 * arrives replaces that very cell, and without the dropped request being kept and honoured the
 * focus falls to the document body, where no key reaches the grid at all: worse than the defect
 * this pull request set out to fix, which at least left the focus on a grid that still answered
 * keys.
 *
 * The card's owner is a timer rather than a fetch, so the wait is bounded and the page needs no
 * network, and its two counters say what was asked and what was drawn — without them "the focus is
 * on 19 April" would be just as true of an owner that answered at once, which is not what is being
 * measured.
 *
 * The arrow press at the end is not a flourish. It is what says the cursor and the focus agree
 * about the new month: a focus moved to 19 April while the cursor stayed on 19 March would answer
 * Arrow Right with 20 March, and the reader would be thrown back a month.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function lateMonthChecks(devtools: Devtools): Promise<void> {
  const framed = await frameCard(devtools, LATE)
  const staged = framed && await standOnDay(devtools, LATE_GRID, LATE_DAY)
  const before = await read(devtools, LATE_STATE, NO_CARD)

  const wanted = `2026-04-${LATE_DAY.slice(8, 10)}`
  await pressKey(devtools, "PageDown")
  // The whole transition in one predicate: the owner has drawn one more answer *and* the focus is
  // on the day the press asked for. Polling on the count alone would read the page between the
  // month arriving and the effect that follows the focus to it.
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${LATE_STATE}; return state.count === ${
          before.count + 1
        } && state.date === ${JSON.stringify(wanted)} })()`,
        false,
      ),
    5_000,
  )
  const after = await read(devtools, LATE_STATE, NO_CARD)

  check(
    "an owner that draws the month a moment late still lands the focus on the day asked for",
    staged && before.date === LATE_DAY && before.heading !== "" && before.count >= 0 &&
      after.count === before.count + 1 && after.asked === "2026-04-01" &&
      after.extra === "2026-04-01" && after.heading !== before.heading &&
      after.onDay && !after.onBody && !after.onGrid && after.date === wanted,
    staged
      ? `from ${before.date} in ${before.heading}: the card was asked for ${after.asked}, its ` +
        `count of answers drawn went ${before.count} → ${after.count} and it is showing ` +
        `${after.extra || "nothing"}; the heading went ${before.heading} → ` +
        `${after.heading || "unreadable"}, the focus is on ${after.date || after.focused} and ` +
        `the grid's Tab stop is ${after.tabStop || "nowhere"}, both wanted ${wanted}`
      : `the focus was never staged on ${LATE_DAY} of the late-answering card`,
  )

  const arrowTarget = dayAfter(wanted, 1)
  await pressKey(devtools, "ArrowRight")
  await poll(
    () => read(devtools, `${LATE_STATE}.date === ${JSON.stringify(arrowTarget)}`, false),
    3_000,
  )
  const afterArrow = await read(devtools, LATE_STATE, NO_CARD)

  check(
    "the arrow keys count from the new month once a late answer has been honoured",
    after.date === wanted && afterArrow.onDay && afterArrow.date === arrowTarget &&
      afterArrow.heading === after.heading,
    after.date === wanted
      ? `${after.date} → Arrow Right → ${afterArrow.date || afterArrow.focused} in ` +
        `${afterArrow.heading || "no month"}, wanted ${arrowTarget}`
      : `the focus was not on ${wanted} after the late answer, so this measures nothing`,
  )

  // Two presses with nothing between them, against an owner slower than the reader's fingers.
  //
  // Both presses reach the calendar and both are answered — that is the property to hold, and it
  // is the one that was broken: before the handling moved into a layout effect, the second press
  // landed while nothing inside the grid held the focus and reached no handler at all, so the card
  // counted one call for two presses. Both now count.
  //
  // They move one month between them, not two, and that is the honest consequence rather than a
  // second defect. Each press is answered by the render that follows it, and that render still
  // shows the old month, so each press is read as refused and the reader is put back where they
  // were; the second therefore asks for the same month the first did. The same burst against an
  // owner that answers on a microtask moves two months, and the check below this one holds that.
  const beforeBurst = await read(devtools, LATE_STATE, NO_CARD)
  const burstMonth = monthAfter(beforeBurst.extra, 1)
  const burstWanted = `${burstMonth.slice(0, 8)}${dayNumber(beforeBurst.date)}`
  await pressKey(devtools, "PageDown")
  await pressKey(devtools, "PageDown")
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${LATE_STATE}; return state.count === ${
          beforeBurst.count + 2
        } && state.date === ${JSON.stringify(burstWanted)} })()`,
        false,
      ),
    5_000,
  )
  const afterBurst = await read(devtools, LATE_STATE, NO_CARD)

  check(
    "two Page Downs a slow owner has yet to answer are both answered, and keep the focus",
    beforeBurst.date === arrowTarget && beforeBurst.extra === "2026-04-01" &&
      afterBurst.count === beforeBurst.count + 2 && afterBurst.extra === burstMonth &&
      afterBurst.onDay && !afterBurst.onBody && afterBurst.date === burstWanted &&
      afterBurst.tabStop === burstWanted,
    beforeBurst.date === arrowTarget
      ? `from ${beforeBurst.date} with ${beforeBurst.extra} on screen, Page Down Page Down with ` +
        `no render in between: the card drew ${afterBurst.count - beforeBurst.count} more ` +
        `answer(s) — one per press — and is showing ${afterBurst.extra || "nothing"}, wanted ` +
        `${burstMonth}, with the focus on ${afterBurst.date || afterBurst.focused} and the ` +
        `Tab stop on ` +
        `${afterBurst.tabStop || "nowhere"}, both wanted ${burstWanted}`
      : `the focus was not on ${arrowTarget} before the burst, so it measures nothing`,
  )

  // Page Down and then Page Up, which is a press superseded before its answer arrives. Two months
  // arrive for two requests and the cells the focus is on are replaced twice, so this is the
  // sequence that used to end with nothing focused at all.
  //
  // The month is pinned as well as the day, because it is the calendar's doing and not the
  // owner's: both presses were read as refused before the next arrived, so both counted from the
  // month on screen, and the calendar asked for the month after and then the month *before*. The
  // owner drew exactly what it was asked for. The reader therefore ends one month behind where
  // they started, which is the price of the cursor never disagreeing with the focus, and it is
  // pinned here so that a future change to that trade goes red instead of passing quietly.
  const beforePair = await read(devtools, LATE_STATE, NO_CARD)
  await pressKey(devtools, "PageDown")
  await pressKey(devtools, "PageUp")
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${LATE_STATE}; return state.count === ${
          beforePair.count + 2
        } && state.extra === ${JSON.stringify(monthAfter(beforePair.extra, -1))} })()`,
        false,
      ),
    5_000,
  )
  const afterPair = await read(devtools, LATE_STATE, NO_CARD)

  const pairMonth = monthAfter(beforePair.extra, -1)
  const pairWanted = `${pairMonth.slice(0, 8)}${dayNumber(beforePair.date)}`

  check(
    "Page Down then Page Up at a slow owner lands a month back, on the same day number",
    beforePair.date !== "" && afterPair.count === beforePair.count + 2 &&
      afterPair.onDay && !afterPair.onBody && afterPair.extra === pairMonth &&
      afterPair.date === pairWanted && afterPair.tabStop === pairWanted,
    beforePair.date !== ""
      ? `from ${beforePair.date} with ${beforePair.extra} on screen, Page Down Page Up drew ` +
        `${afterPair.count - beforePair.count} answers and left the card showing ` +
        `${afterPair.extra || "nothing"}, with the focus on ` +
        `${afterPair.date || afterPair.focused} and the Tab stop on ` +
        `${afterPair.tabStop || "nowhere"} — wanted ${pairWanted} in ${pairMonth}, one month ` +
        `before where the reader started, because both presses were read as refused before ` +
        `the next arrived and so both were asked from the month on screen`
      : "the focus never reached a day of the late-answering card",
  )

  // A reader who leaves while a press is unanswered is left alone, and the page is not scrolled to
  // a calendar they are not looking at. The blur is a page-side call rather than a key, because
  // blurring is not what is under test; the press before it and the month after it are real.
  const beforeBlur = await read(devtools, LATE_STATE, NO_CARD)
  await pressKey(devtools, "PageDown")
  // Wait for the refusal to put them back on their day: that is the state the reader leaves from,
  // and leaving before it would be measuring a different thing.
  const restored = await poll(
    () => read(devtools, `${LATE_STATE}.date === ${JSON.stringify(beforeBlur.date)}`, false),
    3_000,
  )
  // Blur, then take the page somewhere else, so that a focus this calendar steals has to scroll
  // the page back to show it and the scroll position can say whether it did.
  const parked = await read(
    devtools,
    `(() => {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur()
      globalThis.scrollTo({ top: 0, behavior: "instant" })
      return document.activeElement === document.body
    })()`,
    false,
  )
  const scrollBefore = await settleScroll(devtools)
  const answeredAfterBlur = await poll(
    () => read(devtools, `${LATE_STATE}.count === ${beforeBlur.count + 1}`, false),
    5_000,
  )
  const afterBlur = await read(devtools, LATE_STATE, NO_CARD)
  const scrollAfter = await settleScroll(devtools)

  check(
    "a month that arrives after the reader has left does not pull the focus back",
    restored && parked && answeredAfterBlur && afterBlur.extra !== beforeBlur.extra &&
      afterBlur.onBody && !afterBlur.onDay && scrollBefore >= 0 && scrollAfter === scrollBefore,
    restored && parked
      ? `Page Down put the focus back on ${beforeBlur.date}, the reader blurred and scrolled ` +
        `away, and the month then went ${beforeBlur.extra} → ${afterBlur.extra || "nothing"}: ` +
        `the focus is on ${afterBlur.focused} and the page is at ${scrollAfter}, having been at ` +
        `${scrollBefore}`
      : restored
      ? "the blur did not leave the document body holding the focus, so nothing was measured"
      : `the refusal never put the focus back on ${beforeBlur.date}`,
  )

  // The mirror of the check above, and the only place `preventScroll` is exercised. The reader
  // keeps the focus on their day this time and scrolls the page away from the calendar, so the
  // month arrives under a focus that is still the calendar's but is nowhere near the viewport.
  // The focus has to follow the month; the page must not follow the focus.
  await settleLateCard(devtools)
  await frameCard(devtools, LATE)
  const stagedAway = await standOnDay(devtools, LATE_GRID, LATE_DAY)
  const beforeAway = await read(devtools, LATE_STATE, NO_CARD)
  // When the key went down, by the page's own clock, so the read below can say how much of the
  // owner's delay it used up — the margin this check runs on, printed rather than assumed.
  await read(
    devtools,
    `(document.addEventListener("keydown", () => {
      globalThis.__verifyLateKeyAt = performance.now()
    }, { capture: true, once: true }), true)`,
    false,
  )
  await pressKey(devtools, "PageDown")
  // The scroll and the "still on their day, still the old month" read happen in one
  // `Runtime.evaluate`, in that order inside the same page task, so nothing the browser runs between
  // two separate round trips — including the demo's own late answer — can land in between them
  // unnoticed. Reading the day alone, in an earlier version of this check, proved only that the day
  // had not moved by the time *that* read ran; it said nothing about whether the scroll had already
  // happened after the month arrived, which is exactly what a `Calendar` that dropped `preventScroll`
  // would still pass under this weaker proof (found in review). The month's own answer count is read
  // in the same breath for the same reason: two facts pinned to one instant are one proof, not two
  // reads that could straddle the moment the answer lands. A round trip slower than the demo's own
  // delay still loses this race and fails on correct code — nothing running one JS statement after
  // another inside a single page task can promise otherwise — but it fails loudly instead of
  // quietly passing broken code. That is why the card's delay is a full second (#267, see
  // `LATE_ANSWER_MS` in `ui-guide/sections/system.tsx`): measured under `stress-ng --cpu 0`, this
  // read ran 65 to 72ms after the key went down, the check still passes with an extra 350ms pause
  // put in front of it, and the detail below prints the figure on every run so a slower machine
  // shows how close it came.
  const away = await read(
    devtools,
    `(() => {
      globalThis.scrollTo({ top: 0, behavior: "instant" })
      const state = ${LATE_STATE}
      return {
        still: state.date === ${JSON.stringify(LATE_DAY)} && state.count === ${beforeAway.count},
        sinceKey: Math.round(performance.now() - (globalThis.__verifyLateKeyAt ?? Number.NaN)),
      }
    })()`,
    { still: false, sinceKey: Number.NaN },
  )
  const stillOnDay = away.still
  const lateAnswerMs = await read(
    devtools,
    `Number(document.querySelector('${LATE}')?.dataset.answerMs ?? Number.NaN)`,
    Number.NaN,
  )
  const scrolledTo = await settleScroll(devtools)
  const awayWanted = `2026-04-${LATE_DAY.slice(8, 10)}`
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${LATE_STATE}; return state.count === ${
          beforeAway.count + 1
        } && state.date === ${JSON.stringify(awayWanted)} })()`,
        false,
      ),
    5_000,
  )
  const afterAway = await read(devtools, LATE_STATE, NO_CARD)
  const scrollAfterAway = await settleScroll(devtools)

  check(
    "a month arriving under a reader scrolled away moves the focus without moving the page",
    stagedAway && stillOnDay && scrolledTo === 0 &&
      afterAway.count === beforeAway.count + 1 && afterAway.onDay &&
      afterAway.date === awayWanted && scrollAfterAway === 0,
    stagedAway && stillOnDay
      ? `the reader stayed on ${LATE_DAY} and scrolled the page to ${scrolledTo}; the month then ` +
        `went ${beforeAway.extra} → ${afterAway.extra || "nothing"}, the focus went to ` +
        `${afterAway.date || afterAway.focused} — wanted ${awayWanted} — and the page is at ` +
        `${scrollAfterAway}; the scroll and the read ran ${away.sinceKey}ms after the key went ` +
        `down, inside the owner's ${lateAnswerMs}ms`
      : stagedAway
      ? `${away.sinceKey}ms after the key went down, against the owner's ${lateAnswerMs}ms, the ` +
        `reader was not on ${LATE_DAY} with the answer still to come`
      : `the focus was never staged on ${LATE_DAY} of the late-answering card`,
  )

  // Back on the month this card starts on before the last burst, which needs the same day.
  await settleLateCard(devtools)

  // The same burst against the other kind of lateness. An owner that answers on a microtask has
  // drawn the month before the browser delivers the next key, so the second press is made against
  // the month the first one brought and asks for the one after it: two presses, two months. This
  // is the case that says the window is closed rather than merely narrowed — the calendar decides
  // in a layout effect, synchronously with the commit that removed the cells, so there is no
  // moment at which a key can arrive to find nothing inside the grid listening.
  await read(
    devtools,
    `(document.querySelector('${LATE} [data-e2e="calendar-late-mode-microtask"]')?.click(), true)`,
    false,
  )
  await poll(() => read(devtools, `${LATE_STATE}.asked !== ""`, false), 1_000)
  const inMicrotaskMode = await read(
    devtools,
    `document.querySelector('${LATE} [data-e2e="calendar-late-mode"]')?.textContent.trim() ===` +
      ` "microtask"`,
    false,
  )
  await frameCard(devtools, LATE)
  const stagedQuick = inMicrotaskMode && await standOnDay(devtools, LATE_GRID, LATE_DAY)
  const beforeQuick = await read(devtools, LATE_STATE, NO_CARD)
  const quickMonth = monthAfter(beforeQuick.extra, 2)
  const quickWanted = `${quickMonth.slice(0, 8)}${dayNumber(LATE_DAY)}`
  await pressKey(devtools, "PageDown")
  await pressKey(devtools, "PageDown")
  await poll(
    () =>
      read(
        devtools,
        `(() => { const state = ${LATE_STATE}; return state.count === ${
          beforeQuick.count + 2
        } && state.date === ${JSON.stringify(quickWanted)} })()`,
        false,
      ),
    5_000,
  )
  const afterQuick = await read(devtools, LATE_STATE, NO_CARD)

  check(
    "two Page Downs at an owner that answers on a microtask move two months",
    stagedQuick && beforeQuick.date === LATE_DAY && afterQuick.count === beforeQuick.count + 2 &&
      afterQuick.extra === quickMonth && afterQuick.onDay && !afterQuick.onBody &&
      afterQuick.date === quickWanted,
    stagedQuick
      ? `from ${beforeQuick.date} with ${beforeQuick.extra} on screen, Page Down Page Down with ` +
        `no render in between: the card drew ${afterQuick.count - beforeQuick.count} answers and ` +
        `is showing ${afterQuick.extra || "nothing"}, with the focus on ` +
        `${afterQuick.date || afterQuick.focused}, wanted ${quickWanted} in ${quickMonth}`
      : inMicrotaskMode
      ? `the focus was never staged on ${LATE_DAY} of the late-answering card`
      : "the card would not switch to answering on a microtask",
  )

  // Back where this block found the card, with nothing asserted on it.
  await read(
    devtools,
    `(document.querySelector('${LATE} [data-e2e="calendar-late-mode-timer"]')?.click(), true)`,
    false,
  )
  await settleLateCard(devtools)
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
 * Enter and Space are real key presses: what opens the lightbox is the component's own `keydown`
 * listener on the image, an element with no native activation of its own, rather than a native
 * button's default action, so both keys reach it exactly as a person's would. The two clicks are
 * real mouse events at points worked out from the geometry, and each point is checked against
 * `elementFromPoint` before it is used — a press that landed somewhere else is reported as a missed
 * click and never as a failure of the component.
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

  await bareImageRefusalCheck(devtools)

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
  await settleScroll(devtools)
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
  if (aim.onTarget) await clickAt(devtools, aim)
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

/** The card `siteHeaderChecks` drives, and the pieces of it it reads. */
const SITE_HEADER_CARD = "#demo-SiteHeader"
const SITE_HEADER = SITE_HEADER_CARD + ' [data-e2e="site-header-demo"]'
const SITE_HEADER_HEADER = SITE_HEADER + " header"
const SITE_HEADER_BRAND = SITE_HEADER + ' [data-e2e="site-header-brand"]'
const SITE_HEADER_BUTTON = SITE_HEADER + ' [data-e2e="site-header-menu-button"]'
const SITE_HEADER_PANEL = SITE_HEADER + ' [data-e2e="site-header-panel"]'
const SITE_HEADER_DETAILS = SITE_HEADER + " details"
/** Every link inside the mobile panel, in document order — the order Tab has to follow. */
const SITE_HEADER_PANEL_LINKS = SITE_HEADER_PANEL + " nav a"
const SITE_HEADER_CTA = SITE_HEADER + ' [data-e2e="site-header-cta"]'

/** A viewport narrow enough to put `SiteHeader` into its `<details>` layout (`lg` is 1024px). */
const SITE_HEADER_VIEWPORT = { width: 390, height: 844 }

/** What one reading of the card's `<details>` and menu button reports. */
interface SiteHeaderState {
  /** Whether the details element, the button and the panel were all found. */
  found: boolean
  detailsOpen: boolean
  /** `aria-expanded` on the menu button, or `null` when the button was not found. */
  expanded: string | null
  /** `aria-label` on the menu button — its accessible name while closed or open. */
  buttonLabel: string | null
}

const READ_SITE_HEADER = `(() => {
  const details = document.querySelector('${SITE_HEADER_DETAILS}')
  const button = document.querySelector('${SITE_HEADER_BUTTON}')
  const panel = document.querySelector('${SITE_HEADER_PANEL}')
  return {
    found: Boolean(details) && Boolean(button) && Boolean(panel),
    detailsOpen: details ? details.open : false,
    expanded: button ? button.getAttribute("aria-expanded") : null,
    buttonLabel: button ? button.getAttribute("aria-label") : null,
  }
})()`

/** A reading that reads as a failure everywhere, for when the expression itself threw. */
const SITE_HEADER_UNREAD: SiteHeaderState = {
  found: false,
  detailsOpen: false,
  expanded: null,
  buttonLabel: null,
}

function readSiteHeader(devtools: Devtools): Promise<SiteHeaderState> {
  return read(devtools, READ_SITE_HEADER, SITE_HEADER_UNREAD)
}

/**
 * Force the panel closed before a sub-check opens it, rather than assuming the previous one left
 * it that way.
 *
 * Every sub-check below opens the panel with a click, and a click toggles: one that lands on an
 * already-open panel closes it instead, which is indistinguishable from "never opened" to a poll
 * that only checks `detailsOpen` afterward. A sub-check earlier in `siteHeaderChecks` that closes
 * the panel with Escape as its own teardown, rather than as something it records a `check` against,
 * can occasionally leave it open on a run where that Escape press was itself slow to land — this is
 * what a later sub-check's own "the panel was never open" turned out to mean, traced back from a
 * click that closed a panel already open rather than opening a closed one. Setting `open` directly
 * fires the same native `toggle` event a click does, so `handleToggle` still runs and `isOpen`
 * still ends up correct — this is not a way around the component's own wiring, only a way to reach
 * a known starting state without depending on a previous sub-check's own teardown having landed.
 */
async function ensureSiteHeaderClosed(devtools: Devtools): Promise<void> {
  await read(
    devtools,
    `(() => {
      const details = document.querySelector('${SITE_HEADER_DETAILS}')
      if (details) details.open = false
      return true
    })()`,
    false,
  )
  await poll(async () => !(await readSiteHeader(devtools)).detailsOpen, 3_000)
}

/**
 * The race a listener gated on `isOpen` can lose, forced every run instead of left to chance.
 *
 * A real click and a real Escape, sent as two separate DevTools Protocol commands, do not reliably
 * land inside the gap: an earlier version of this check, built that way, caught the old `isOpen`-
 * gated listener's absence in only 2 of 15 `verify` runs,
 * because the round trip each command makes to the browser is itself enough time, on most attempts,
 * for the `toggle` event — a queued task — to have been delivered and the old listener to have
 * (re)attached before the key arrives. Doing both inside one `Runtime.evaluate` closes that gap
 * instead of hoping to land in it: `button.click()` sets `details.open` synchronously, as part of
 * the click's own default action, and dispatching the `keydown` immediately after, in the same
 * call, reaches this hook's `document` listener before the browser ever gets back to its task queue
 * to deliver `toggle` at all. With the old listener, that listener cannot exist yet at that point,
 * because there has been no task boundary for the effect that attaches it to run across. One more
 * gap had to be closed first: after the preceding close, `aria-expanded` reads `"false"` one render
 * before the old listener's effect cleanup removes it, so a click fired in that window found the
 * previous listener still attached and passed — the old listener with the `contains` guard went red
 * in only 3 of 5 review runs. Two animation frames inside the same evaluate, before the click, let
 * that cleanup finish. `bubbles: true` is what lets the synthetic event reach the
 * `document` listener at all, and dispatching it *from the button* — not from `document` — is what
 * lets it also pass the `contains` guard `siteHeaderEscapeScopingCheck` exists for.
 *
 * This only proves the listener responds once attached; it says nothing about whether a *trusted*
 * key event reaches it the same way. That half is what `siteHeaderChecks`' own Escape check (a real
 * click, then a real `Input.dispatchKeyEvent` Escape) and `siteHeaderEscapeScopingCheck` already
 * prove, each with enough of a pause between the two that the race this check targets does not
 * apply to them.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller. Waits for the panel to report closed itself first, rather than assuming it already is.
 */
async function siteHeaderEscapeRaceCheck(devtools: Devtools): Promise<void> {
  await ensureSiteHeaderClosed(devtools)
  await poll(async () => {
    const state = await readSiteHeader(devtools)
    return !state.detailsOpen && state.expanded === "false"
  }, 3_000)

  const stillOpen = await read(
    devtools,
    `(async () => {
      // Let the close that ensureSiteHeaderClosed caused finish its cleanup first. \`aria-expanded\`
      // reads "false" one render before an effect-attached listener is removed, so without this
      // wait a gated listener left over from the previous open could close the panel and pass.
      for (let k = 0; k < 2; k++) {
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
      }
      const button = document.querySelector('${SITE_HEADER_BUTTON}')
      if (!button) return null
      button.click()
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      )
      const details = button.closest("details")
      return details ? details.open : null
    })()`,
    null as boolean | null,
  )

  check(
    "an Escape dispatched in the same task as the click still closes the panel",
    stillOpen === false,
    stillOpen === null
      ? "the menu button was not found"
      : stillOpen
      ? "details.open still read true immediately after the click and the same-task Escape"
      : "details.open read false immediately after the click and the same-task Escape",
  )

  await ensureSiteHeaderClosed(devtools)
}

/**
 * An Escape meant for a layer above the panel must not also close the panel.
 *
 * The listener lives on `document` so it can hear a press from anywhere inside the panel, and
 * before this check existed nothing scoped it any further: with the menu open and the `Modal`
 * demo's dialog opened on top of it, one Escape press closed the dialog *and* the menu, and pulled
 * focus back to the menu button instead of leaving it on the dialog's own trigger — the browser's
 * native handling of the topmost `<dialog>` and this hook's own listener both see the same bubbled
 * keydown. `detailsRef.current.contains(event.target)` is what `mobile-panel.ts` now checks before
 * acting, and this proves it: the dialog closes, the menu stays open, and focus ends up on the
 * dialog's own trigger, not the menu's.
 *
 * The dialog is `ui/`'s `Modal`, on the catalogue's own `#demo-Modal` card — the same card and
 * trigger `ui.ts`'s own Modal checks drive, found the same way: the first button whose text starts
 * with `"default"`. `system` runs before `ui` in `verify.ts`'s fixed package order, so this check
 * closes the dialog itself and confirms no dialog is left in the top layer before it returns,
 * rather than leaving that for `ui.ts`'s own checks to trip over.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller. Forces the panel closed itself first, rather than assuming it already is.
 */
async function siteHeaderEscapeScopingCheck(devtools: Devtools): Promise<void> {
  // The Modal is a `ui/` card, so this check runs on the guide's `all` page, where both cards are.
  await openGuidePage(devtools, "all")
  await ensureSiteHeaderClosed(devtools)

  await focusAndClick(devtools, SITE_HEADER_BUTTON)
  const opened = await poll(async () => {
    const state = await readSiteHeader(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)

  const armed = await read(
    devtools,
    `(() => {
      const card = document.querySelector("#demo-Modal")
      const trigger = card
        ? [...card.querySelectorAll("button")]
          .find((candidate) => candidate.textContent.trim().startsWith("default"))
        : null
      if (!trigger) return false
      globalThis.__siteHeaderScopeTrigger = trigger
      // Focused before it is clicked — not because the click needs it, but because Modal's own
      // dialog restores focus to whatever held it at the moment showModal() ran, natively, once
      // the dialog closes. A scripted .click() with no focus() first leaves that "whatever" as the
      // menu button — still focused from opening the panel above — which would make the dialog's
      // own native restore behaviour look exactly like this check's own bug and was, measured,
      // indistinguishable from one at first.
      trigger.focus()
      trigger.click()
      return true
    })()`,
    false,
  )
  const modalOpened = await poll(
    () =>
      read(
        devtools,
        `document.querySelector("#demo-Modal dialog")?.matches(":modal") === true`,
        false,
      ),
    3_000,
  )
  await pressKey(devtools, "Escape")

  const modalClosed = await poll(
    () =>
      read(
        devtools,
        `document.querySelector("#demo-Modal dialog")?.matches(":modal") !== true`,
        false,
      ),
    3_000,
  )
  const after = await read(
    devtools,
    `(() => ({
      panelStillOpen: document.querySelector('${SITE_HEADER_DETAILS}')?.open === true,
      focusOnModalTrigger: document.activeElement === globalThis.__siteHeaderScopeTrigger,
      focusOnMenuButton: document.activeElement === document.querySelector('${SITE_HEADER_BUTTON}'),
    }))()`,
    { panelStillOpen: false, focusOnModalTrigger: false, focusOnMenuButton: false },
  )

  check(
    "an Escape meant for a modal on top does not also close the menu behind it",
    opened && armed && modalOpened && modalClosed && after.panelStillOpen &&
      after.focusOnModalTrigger && !after.focusOnMenuButton,
    !opened
      ? "the menu was never open"
      : !armed
      ? "the Modal demo's own trigger could not be found"
      : !modalOpened
      ? "the Modal demo's dialog never opened"
      : !modalClosed
      ? "the dialog was still :modal after the Escape press"
      : !after.panelStillOpen
      ? "the menu closed too, though the Escape press was never inside it"
      : !after.focusOnModalTrigger
      ? `focus landed elsewhere instead of the dialog's own trigger (menu button: ` +
        `${after.focusOnMenuButton})`
      : "the dialog closed, the menu stayed open, and focus stayed on the dialog's own trigger",
  )

  // Force the dialog closed and confirm the top layer is empty, whatever the checks above found —
  // `ui.ts`'s own Modal checks, and everything else `verify.ts` runs after this package block,
  // assume no dialog is left open from an earlier one.
  await read(
    devtools,
    `(() => {
      const dialog = document.querySelector("#demo-Modal dialog")
      if (dialog?.open) dialog.close()
      return true
    })()`,
    false,
  )
  const topLayerEmpty = await poll(
    () => read(devtools, `document.querySelectorAll("dialog:modal").length === 0`, false),
    3_000,
  )
  check(
    "no dialog is left in the top layer after the Escape-scoping check",
    topLayerEmpty,
    topLayerEmpty ? "0 modal dialogs remain" : "a dialog is still in the top layer",
  )

  await ensureSiteHeaderClosed(devtools)
  await openGuidePage(devtools, "system")
  // The `#demo-Modal` card lives somewhere else on this long catalogue page, and focusing its
  // trigger scrolled there to bring it into view — settling for *that* scroll is not enough, since
  // `siteHeaderLayoutChecks` right after this reads a viewport-relative position off a header that
  // is no longer anywhere near the viewport. Scrolled back to this card, not merely settled.
  await read(
    devtools,
    `(() => {
      document.querySelector('${SITE_HEADER_HEADER}')
        ?.scrollIntoView({ block: "center", behavior: "instant" })
      return true
    })()`,
    false,
  )
  await waitForScrollSettle(devtools)
}

/**
 * `SiteHeader`'s mobile panel: closed by default, opened by a click on the menu button, walked in
 * order by Tab, closed by a real Escape press with focus returned to the button, closed a different
 * way by a client-side navigation, exposed as expanded natively regardless of `aria-expanded`, laid
 * out without moving anything else in the bar, correct once a menu opened before hydration catches
 * up, and — the one behaviour no other check here can reach — every link inside it still reachable
 * with script execution disabled.
 *
 * **Phone width, for the whole function.** `SiteHeader` only builds the `<details>` disclosure below
 * `lg` (1024px); above it the panel is `display:none` and the desktop row takes its place instead.
 * `Emulation.setDeviceMetricsOverride` narrows the viewport before the first check and
 * `clearDeviceMetricsOverride` restores it in a `finally`, so a package block that runs after this
 * one is never handed a viewport this file changed and forgot to put back.
 *
 * **`aria-current` is read once, before anything is clicked**, because it is static markup rather
 * than a state this file changes — both the desktop row and the panel render it the same way
 * whether or not the panel is open.
 *
 * **Three of the sub-checks below run their own script-execution or network excursion**, the same
 * shape `authFormNoScriptChecks` uses: everything they change runs inside a `try`, and putting it
 * back — including waiting for `data-hydrated` again — runs inside the matching `finally`, so a
 * throw partway through one cannot leave the page in a state the checks after it did not expect.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function siteHeaderChecks(devtools: Devtools): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    ...SITE_HEADER_VIEWPORT,
    deviceScaleFactor: 1,
    mobile: false,
  })

  try {
    const currentLinks = await read(
      devtools,
      `[...document.querySelectorAll('${SITE_HEADER} a[aria-current="page"]')]
        .map((el) => el.textContent.trim())`,
      [] as string[],
    )
    check(
      "aria-current marks only the Pricing link, in both the desktop row and the panel",
      currentLinks.length === 2 && currentLinks.every((label) => label === "Pricing"),
      `aria-current="page" found on: ${JSON.stringify(currentLinks)}`,
    )

    const idle = await readSiteHeader(devtools)
    check(
      "the menu button starts closed, with aria-expanded false and a fixed accessible name",
      idle.found && !idle.detailsOpen && idle.expanded === "false" && idle.buttonLabel === "Menu",
      idle.found
        ? `details.open=${idle.detailsOpen}, aria-expanded=${idle.expanded}, ` +
          `aria-label=${JSON.stringify(idle.buttonLabel)}`
        : "the SiteHeader card was not found at phone width",
    )

    // `actions` sits before the menu button in the DOM and, unlike `links`, is never redrawn
    // inside the panel — see `site-header.tsx`'s own doc for why. So Tab order is checked in two
    // parts: this first Tab proves `actions` comes before the button at all, and the loop below
    // proves the panel's own links follow the button once it is open.
    await focusAndClick(devtools, SITE_HEADER_CTA)
    await pressKey(devtools, "Tab")
    const reachedButtonFromActions = await read(
      devtools,
      `document.activeElement === document.querySelector('${SITE_HEADER_BUTTON}')`,
      false,
    )
    check(
      "Tab from the actions button reaches the menu button next",
      reachedButtonFromActions,
      `document.activeElement is the menu button: ${reachedButtonFromActions}`,
    )

    await focusAndClick(devtools, SITE_HEADER_BUTTON)
    // `details.open` flips synchronously in the click's own default action, but the browser fires
    // `toggle` — the event `handleToggle` listens for — as a queued task rather than synchronously
    // with it. `useMobilePanel`'s `isOpen` signal, and everything downstream of it, only update once
    // that task runs, so this polls the whole state rather than `detailsOpen` alone: reading
    // `aria-expanded` right after `detailsOpen` turns true caught the click before the queued task
    // had run, every time.
    const opened = await poll(async () => {
      const state = await readSiteHeader(devtools)
      return state.detailsOpen && state.expanded === "true"
    }, 3_000)
    const afterOpen = await readSiteHeader(devtools)
    check(
      "clicking the menu button opens the panel, flips aria-expanded, and keeps the same name",
      opened && afterOpen.buttonLabel === "Menu",
      `details.open=${afterOpen.detailsOpen}, aria-expanded=${afterOpen.expanded}, ` +
        `aria-label=${JSON.stringify(afterOpen.buttonLabel)}`,
    )

    const expectedOrder = await read(
      devtools,
      `[...document.querySelectorAll('${SITE_HEADER_PANEL_LINKS}')]
        .map((el) => el.textContent.trim())`,
      [] as string[],
    )
    const tabbedThrough: string[] = []
    for (let index = 0; index < expectedOrder.length; index++) {
      await pressKey(devtools, "Tab")
      tabbedThrough.push(
        await read(
          devtools,
          `(document.activeElement ? document.activeElement.textContent.trim() : "")`,
          "",
        ),
      )
    }
    check(
      "Tab walks the open panel's links, in document order, once the button has focus",
      opened && expectedOrder.length > 0 && tabbedThrough.length === expectedOrder.length &&
        tabbedThrough.every((label, index) => label === expectedOrder[index]),
      `expected ${JSON.stringify(expectedOrder)}, tabbed through ${JSON.stringify(tabbedThrough)}`,
    )

    await pressKey(devtools, "Escape")
    const closed = await poll(async () => !(await readSiteHeader(devtools)).detailsOpen, 3_000)
    const focusedButton = await read(
      devtools,
      `document.activeElement === document.querySelector('${SITE_HEADER_BUTTON}')`,
      false,
    )
    check(
      "a real Escape key press closes the panel and returns focus to the menu button",
      opened && closed && focusedButton,
      !opened
        ? "the panel was never open, so this proves nothing about Escape"
        : !closed
        ? "the panel was still open 3s after the key press"
        : `document.activeElement is the menu button: ${focusedButton}`,
    )

    await siteHeaderEscapeRaceCheck(devtools)
    await siteHeaderEscapeScopingCheck(devtools)
    await siteHeaderLayoutChecks(devtools)
    await siteHeaderNativeExpandedStateCheck(devtools)
    await siteHeaderClientNavigationChecks(devtools)
    await siteHeaderNoScriptCheck(devtools)
    await siteHeaderHydrationSyncChecks(devtools)
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
  }
}

/** What one reading of the card's layout geometry reports; `-1` for anything not found. */
interface SiteHeaderLayout {
  headerHeight: number
  headerLeft: number
  headerWidth: number
  brandTop: number
  panelLeft: number
  panelWidth: number
}

const SITE_HEADER_LAYOUT_UNREAD: SiteHeaderLayout = {
  headerHeight: -1,
  headerLeft: -1,
  headerWidth: -1,
  brandTop: -1,
  panelLeft: -1,
  panelWidth: -1,
}

const READ_SITE_HEADER_LAYOUT = `(() => {
  const header = document.querySelector('${SITE_HEADER_HEADER}')
  const brand = document.querySelector('${SITE_HEADER_BRAND}')
  const panel = document.querySelector('${SITE_HEADER_PANEL}')
  const headerRect = header ? header.getBoundingClientRect() : null
  const brandRect = brand ? brand.getBoundingClientRect() : null
  const panelRect = panel ? panel.getBoundingClientRect() : null
  return {
    headerHeight: headerRect ? Math.round(headerRect.height) : -1,
    headerLeft: headerRect ? Math.round(headerRect.left) : -1,
    headerWidth: headerRect ? Math.round(headerRect.width) : -1,
    brandTop: brandRect ? Math.round(brandRect.top) : -1,
    panelLeft: panelRect ? Math.round(panelRect.left) : -1,
    panelWidth: panelRect ? Math.round(panelRect.width) : -1,
  }
})()`

function readSiteHeaderLayout(devtools: Devtools): Promise<SiteHeaderLayout> {
  return read(devtools, READ_SITE_HEADER_LAYOUT, SITE_HEADER_LAYOUT_UNREAD)
}

/**
 * Opening the panel must not move anything else in the bar.
 *
 * The panel's content is positioned `absolute` against the `<header>` (`position: relative`) rather
 * than sitting in normal flow beside the menu button, which is what `site-header.tsx`'s own doc
 * claims and what this proves: the header's own height and the brand's vertical position, read
 * before the panel opens and again after, have to be the same reading both times, and the panel has
 * to span exactly the header's own width and left edge. A panel back in normal flow — the bug this
 * check was written against — grows the header instead of leaving it alone, which the first
 * assertion below catches, and narrows itself to whatever space is left in its flex row, which the
 * second catches.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller. Forces the panel closed itself before reading the closed layout, rather than assuming
 * whatever ran before it left it that way.
 */
async function siteHeaderLayoutChecks(devtools: Devtools): Promise<void> {
  await ensureSiteHeaderClosed(devtools)

  // `brandTop` is a viewport-relative reading, so a scroll between the two — the card's own smooth
  // scroll settling from whatever the previous check left it doing — moves it exactly as much as a
  // real layout shift would, and a viewport reading taken mid-scroll cannot tell the two apart.
  // Measured: without this, the two readings disagreed by 82px with the header's own height
  // identical both times, which is scroll, not layout.
  await waitForScrollSettle(devtools)
  const closed = await readSiteHeaderLayout(devtools)

  await focusAndClick(devtools, SITE_HEADER_BUTTON)
  const opened = await poll(async () => {
    const state = await readSiteHeader(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)
  await waitForScrollSettle(devtools)
  const open = await readSiteHeaderLayout(devtools)

  check(
    "opening the panel changes neither the header's own height nor the brand's position",
    opened && closed.headerHeight > 0 && closed.headerHeight === open.headerHeight &&
      closed.brandTop >= 0 && closed.brandTop === open.brandTop,
    `header height ${closed.headerHeight}px → ${open.headerHeight}px, ` +
      `brand top ${closed.brandTop}px → ${open.brandTop}px`,
  )
  check(
    "the open panel spans exactly the header's own width and left edge",
    opened && open.panelWidth > 0 && open.panelWidth === open.headerWidth &&
      open.panelLeft === open.headerLeft,
    `panel ${open.panelWidth}px at x=${open.panelLeft}, header ${open.headerWidth}px at x=${open.headerLeft}`,
  )

  await pressKey(devtools, "Escape")
  await poll(async () => !(await readSiteHeader(devtools)).detailsOpen, 3_000)
}

/**
 * Chromium exposes a `<details>` disclosure's open/closed state to assistive tech on its own,
 * through the accessibility tree's `expanded` property — regardless of the `aria-expanded` this
 * component also writes. Read through `Accessibility.getPartialAXTree` rather than off the DOM
 * attribute this file already reads elsewhere, the same way `triggerNameCheck` in `ui.ts` asks
 * Chromium for a trigger's computed name instead of recomputing one: what matters is what the
 * platform reports, not what markup a check can already see.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller, with the panel already closed.
 */
async function siteHeaderNativeExpandedStateCheck(devtools: Devtools): Promise<void> {
  await ensureSiteHeaderClosed(devtools)
  await devtools.send("DOM.enable")
  await devtools.send("Accessibility.enable")

  const readExpanded = async (): Promise<boolean | null> => {
    const { root } = await devtools.send<{ root: { nodeId: number } }>("DOM.getDocument", {
      depth: 1,
    })
    const { nodeIds } = await devtools.send<{ nodeIds: number[] }>("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: SITE_HEADER_BUTTON,
    })
    if (nodeIds.length === 0) return null
    const { nodes } = await devtools.send<
      { nodes: Array<{ properties?: Array<{ name: string; value?: { value?: unknown } }> }> }
    >("Accessibility.getPartialAXTree", { nodeId: nodeIds[0], fetchRelatives: false })
    const property = nodes[0]?.properties?.find((entry) => entry.name === "expanded")
    return property ? Boolean(property.value?.value) : null
  }

  const closed = await readExpanded()

  await focusAndClick(devtools, SITE_HEADER_BUTTON)
  await poll(async () => {
    const state = await readSiteHeader(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)
  const open = await readExpanded()

  check(
    "Chromium reports the disclosure's expanded state on the accessibility tree, natively",
    closed === false && open === true,
    `accessibility tree "expanded" property: closed=${closed}, open=${open}`,
  )

  await pressKey(devtools, "Escape")
  await poll(async () => !(await readSiteHeader(devtools)).detailsOpen, 3_000)
}

/**
 * A click on a link inside the open panel has to close the panel itself, under a client-side
 * router that never lets the click become a real page load — the app shell (#135) needs exactly
 * this for its own navigation.
 *
 * There is no router in this repository to drive, so this stands one up out of the one thing every
 * router agrees on: it calls `event.preventDefault()` on the click before the browser navigates,
 * and changes the address itself, through `history.replaceState` rather than `pushState` — measured
 * to matter: a `pushState` here outlives this check and inflates `history.length` for every later
 * one in the run, which is exactly what turned `ui.ts`'s "that write costs exactly one history
 * entry" red the first time this check existed. A capturing listener attached directly to the first
 * panel link, ahead of `SiteHeader`'s own bubbling one, does exactly that — proving the panel's own
 * listener still runs and still closes the panel even though the browser never left the page.
 *
 * `close(false)` is the other half of the claim, and what it can actually be shown to do is
 * narrower than "focus stays on the link": closing a `<details>` hides its content natively, and
 * this harness's Chromium moves focus off an element that just went hidden — to `<body>` —
 * regardless of `returnFocus`. What `close(false)` controls is whether the panel *additionally*
 * pulls focus back to the button on top of that, the way Escape's `close(true)` deliberately does;
 * a navigating link is not the menu button asking to close, so it must not fight wherever a real
 * router sends focus next. `mobile-panel.ts`'s own doc names this as the reason `close` takes a
 * `returnFocus` argument at all.
 *
 * A `globalThis` mark parked before the click and read back after it is what proves no real
 * navigation happened — the same technique `serviceWorkerChecks` uses for the same reason: a
 * reading taken after a reload would find no mark at all, silently, rather than failing loudly.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller, with the panel already closed.
 */
async function siteHeaderClientNavigationChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")

  try {
    await ensureSiteHeaderClosed(devtools)
    await focusAndClick(devtools, SITE_HEADER_BUTTON)
    const opened = await poll(async () => {
      const state = await readSiteHeader(devtools)
      return state.detailsOpen && state.expanded === "true"
    }, 3_000)

    // Armed with a real, trusted click, not `.click()` run through `Runtime.evaluate` — measured
    // against this exact check: a scripted `.click()` on an `<a>` does not reliably leave focus on
    // it in this harness's Chromium even after an explicit `.focus()` immediately before it, read
    // back a tick later as neither the link nor the button. `clickAt`'s dispatched mouse event is
    // what a real pointer press does, focus included, the same distinction `authFormNoScriptChecks`
    // and `siteHeaderNoScriptCheck` draw for the same reason.
    const armed = await read(
      devtools,
      `(() => {
        globalThis.__siteHeaderNavMark = "still here"
        const link = document.querySelector('${SITE_HEADER_PANEL_LINKS}')
        if (!link) return null
        const handler = (event) => {
          event.preventDefault()
          history.replaceState({}, "", link.getAttribute("href"))
          link.removeEventListener("click", handler, true)
        }
        link.addEventListener("click", handler, true)
        link.scrollIntoView({ block: "center", behavior: "instant" })
        const rect = link.getBoundingClientRect()
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        }
      })()`,
      null as { x: number; y: number } | null,
    )
    if (armed) await clickAt(devtools, armed)

    const closed = await poll(async () => !(await readSiteHeader(devtools)).detailsOpen, 3_000)
    const after = await read(
      devtools,
      `(() => {
        const active = document.activeElement
        return {
          mark: globalThis.__siteHeaderNavMark || "",
          href: location.href,
          focusOnButton: active === document.querySelector('${SITE_HEADER_BUTTON}'),
          activeTag: active ? active.tagName : "none",
        }
      })()`,
      { mark: "", href: "", focusOnButton: false, activeTag: "" },
    )

    check(
      "a client-side navigation on a panel link closes the panel with no real page reload",
      opened && Boolean(armed) && closed && after.mark === "still here" &&
        after.href !== restoreUrl,
      !opened
        ? "the panel was never open"
        : !armed
        ? "the router stand-in could not find the first panel link to click"
        : !closed
        ? "the panel was still open after the link was activated"
        : after.mark !== "still here"
        ? "the mark left the page — a real navigation happened, which proves nothing about the panel's own close"
        : after.href === restoreUrl
        ? "the router stand-in ran, but location never changed, so this proves nothing about a real navigation"
        : `location moved from ${restoreUrl} to ${after.href} with no reload`,
    )
    // Not "focus stays on the link": closing a `<details>` hides its content natively, and a
    // browser moves focus off an element that just became hidden on its own, to `<body>` in this
    // harness's Chromium — measured, and true regardless of `returnFocus`. What `close(false)`
    // actually controls, and all this can honestly check, is that it does not *additionally* pull
    // focus back to the button — fighting wherever a real router sends it next — the way `close(true)`
    // deliberately does for Escape.
    check(
      "closing the panel for a navigating link does not pull focus back to the menu button",
      closed && !after.focusOnButton,
      `document.activeElement is the menu button: ${after.focusOnButton} (tagName: ${after.activeTag})`,
    )
  } finally {
    // `replaceState` left no entry to go `back()` to, and creates none of its own to undo — it
    // restores the address the same way it changed it, in place, leaving `history.length` and the
    // DOM exactly as this check found them for every check that runs after it.
    await read(
      devtools,
      `(history.replaceState({}, "", ${JSON.stringify(restoreUrl)}), true)`,
      false,
    )
      .catch(() => {})
    await waitForScrollSettle(devtools)
  }
}

/**
 * The one behaviour `siteHeaderChecks` cannot prove with a scripted `.click()`: a visitor who taps
 * the menu button before the bundle has run, or with scripts off entirely, still reaches every link
 * inside the panel.
 *
 * **The button is pressed with a real, trusted click.** A `.click()` run through `Runtime.evaluate`
 * is script executing on the page's behalf — fine for the checks above, where the point is the
 * component's own wiring, and exactly what this one check must not rely on, because a pass built on
 * it would prove nothing about a visitor's own tap. So this step alone uses `clickAt`, a
 * press-and-release through the browser's input pipeline aimed at the button's measured position —
 * the same distinction `authFormNoScriptChecks` draws, for the same reason.
 *
 * **Everything from disabling script execution onward runs inside a `try`, and re-enabling it,
 * reloading and waiting for `data-hydrated` run inside the matching `finally`** — the same shape
 * `authFormNoScriptChecks` uses, so a throw or a stalled navigation here cannot leave the page
 * unhydrated for whatever runs after this file.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller.
 */
async function siteHeaderNoScriptCheck(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")

  let unhydrated = false
  let target: { x: number; y: number } | null = null
  let opened = false
  let linkCount = 0
  let visibleLinkCount = 0

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    // `Page.reload`, not `Page.navigate` to the same address — see `authFormNoScriptChecks` for why
    // navigating to the URL already loaded did not reliably tear down an already-hydrated document.
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForLoad(devtools)

    unhydrated = loaded &&
      await read(devtools, `document.documentElement.dataset.hydrated !== "true"`, false)

    target = await read(
      devtools,
      `(() => {
        const button = document.querySelector('${SITE_HEADER_BUTTON}')
        if (!button) return null
        button.scrollIntoView({ block: "center", behavior: "instant" })
        const rect = button.getBoundingClientRect()
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        }
      })()`,
      null as { x: number; y: number } | null,
    )
    if (target) await clickAt(devtools, target)

    opened = await poll(
      () =>
        read(devtools, `document.querySelector('${SITE_HEADER_DETAILS}')?.open === true`, false),
      3_000,
    )
    const linkVisibility = await read(
      devtools,
      `(() => {
        const links = [...document.querySelectorAll('${SITE_HEADER_PANEL_LINKS}')]
        return {
          count: links.length,
          visible: links.filter((link) => link.getBoundingClientRect().height > 0).length,
        }
      })()`,
      { count: 0, visible: 0 },
    )
    linkCount = linkVisibility.count
    visibleLinkCount = linkVisibility.visible
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})
    await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
    await waitForLoad(devtools)

    const strayed = await read(devtools, `location.href !== ${JSON.stringify(restoreUrl)}`, false)
    if (strayed) {
      await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
      await waitForLoad(devtools)
    }

    const scrollSettled = await waitForScrollSettle(devtools)
    check(
      "the page's own route scroll settles after SiteHeader's restoring reload",
      scrollSettled,
      scrollSettled
        ? "scrollY held still for a full second before this check returned"
        : "scrollY never held still — a later block may have read it while it was still moving",
    )
  }

  check(
    "a real click on the menu button opens the panel, and every link in it becomes reachable, " +
      "with script execution disabled",
    unhydrated && Boolean(target) && opened && linkCount > 0 && visibleLinkCount === linkCount,
    !unhydrated
      ? "the fresh load still hydrated, so this proves nothing about a visitor without the bundle"
      : !target
      ? "the menu button was not found on the unhydrated, prerendered page"
      : !opened
      ? "the <details> element never reported open=true after the click"
      : linkCount === 0
      ? "the panel opened but no links were found inside it"
      : visibleLinkCount !== linkCount
      ? `only ${visibleLinkCount} of ${linkCount} links have a rendered height`
      : `the <details> opened and all ${linkCount} links now have a rendered height`,
  )

  const rehydrated = await poll(
    () => read(devtools, `document.documentElement.dataset.hydrated === "true"`, false),
    10_000,
  )
  check(
    "the page rehydrates once script execution is re-enabled again",
    rehydrated,
    rehydrated
      ? "data-hydrated set again after the restoring reload"
      : "the page never rehydrated after script execution was re-enabled",
  )
}
/**
 * A menu opened before the bundle has finished loading — not merely before it has run, which
 * {@link siteHeaderNoScriptCheck} already covers with scripts disabled outright — has to end up
 * correct once hydration catches up: `aria-expanded` true, and Escape able to close it. Without
 * `useMobilePanel`'s mount-time read of `detailsRef.current.open`, the hook only ever learns the
 * open state from a `toggle` event *it* is already listening for, so a panel a visitor opened
 * before that listener existed stays invisible to it — `aria-expanded` stuck at `false` (or absent)
 * and Escape doing nothing, forever, because nothing ever tells the hook the click happened.
 *
 * **The bundle is held with the Fetch domain, not `Emulation.setScriptExecutionDisabled`.** That
 * flag stops every script from ever running, which is exactly what {@link siteHeaderNoScriptCheck}
 * needs and exactly what this check must not use: the whole point here is a script that *does* run,
 * just late. `Fetch.enable`, scoped to the island bundle's own URL, pauses that one request before
 * it is sent; the deferred `type="module"` script tag it belongs to blocks nothing else, so the
 * prerendered markup — the button included — paints and is clickable while the request sits paused.
 * `Fetch.continueRequest` releases it once the pre-hydration click has happened, and only then does
 * the module load, run and hydrate.
 *
 * **The request is intercepted by its own absolute URL**, read off the already-hydrated page before
 * the reload that will hold it — `document.querySelector('script[type=module]').src` — rather than
 * a guessed pattern, so this cannot pause the wrong request or, worse, one the page needs to paint
 * at all.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller.
 */
async function siteHeaderHydrationSyncChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")
  const islandUrl = await read(
    devtools,
    `document.querySelector('script[type="module"]')?.src ?? ""`,
    "",
  )

  let requestId: string | undefined
  let heldRequest = false
  let unhydrated = false
  let openedBeforeHydration = false
  let expandedBeforeHydration: string | null = "(unread)"
  let rehydrated = false
  let syncedAfterHydration = false
  let closedAfterEscape = false

  try {
    if (islandUrl) {
      await devtools.send("Fetch.enable", {
        patterns: [{ urlPattern: islandUrl, requestStage: "Request" }],
      })

      const paused = devtools.once<{ requestId: string }>("Fetch.requestPaused", 20_000)
      await devtools.send("Page.reload", { ignoreCache: true })
      const request = await paused.catch(() => null)
      requestId = request?.requestId
      heldRequest = Boolean(requestId)
    }

    if (heldRequest) {
      const buttonReady = await poll(
        () => read(devtools, `Boolean(document.querySelector('${SITE_HEADER_BUTTON}'))`, false),
        10_000,
      )
      unhydrated = buttonReady &&
        await read(devtools, `document.documentElement.dataset.hydrated !== "true"`, false)

      const target = await read(
        devtools,
        `(() => {
          const button = document.querySelector('${SITE_HEADER_BUTTON}')
          if (!button) return null
          button.scrollIntoView({ block: "center", behavior: "instant" })
          const rect = button.getBoundingClientRect()
          return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          }
        })()`,
        null as { x: number; y: number } | null,
      )
      if (target) await clickAt(devtools, target)

      openedBeforeHydration = await poll(
        () =>
          read(devtools, `document.querySelector('${SITE_HEADER_DETAILS}')?.open === true`, false),
        3_000,
      )
      expandedBeforeHydration = await read(
        devtools,
        `document.querySelector('${SITE_HEADER_BUTTON}')?.getAttribute("aria-expanded") ?? null`,
        "(unread)",
      )

      await devtools.send("Fetch.continueRequest", { requestId })
      requestId = undefined
      await devtools.send("Fetch.disable")

      rehydrated = await poll(
        () => read(devtools, `document.documentElement.dataset.hydrated === "true"`, false),
        10_000,
      )
      syncedAfterHydration = await poll(
        () =>
          read(
            devtools,
            `document.querySelector('${SITE_HEADER_BUTTON}')?.getAttribute("aria-expanded") === "true"`,
            false,
          ),
        3_000,
      )

      await pressKey(devtools, "Escape")
      closedAfterEscape = await poll(
        () =>
          read(devtools, `document.querySelector('${SITE_HEADER_DETAILS}')?.open === false`, false),
        3_000,
      )
    }
  } finally {
    if (requestId) {
      await devtools.send("Fetch.continueRequest", { requestId }).catch(() => {})
    }
    await devtools.send("Fetch.disable").catch(() => {})
    await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
    await waitForLoad(devtools)

    const strayed = await read(devtools, `location.href !== ${JSON.stringify(restoreUrl)}`, false)
    if (strayed) {
      await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
      await waitForLoad(devtools)
    }

    const scrollSettled = await waitForScrollSettle(devtools)
    check(
      "the page's own route scroll settles after the hydration-sync check's restoring reload",
      scrollSettled,
      scrollSettled
        ? "scrollY held still for a full second before this check returned"
        : "scrollY never held still — a later block may have read it while it was still moving",
    )
  }

  check(
    "a menu opened before the bundle loads is still open, unannounced as such, once it arrives",
    Boolean(islandUrl) && heldRequest && unhydrated && openedBeforeHydration &&
      expandedBeforeHydration !== "true",
    !islandUrl
      ? "no <script type=module> was found to hold back"
      : !heldRequest
      ? "the bundle's own request was never paused — Fetch.requestPaused never fired for it"
      : !unhydrated
      ? "the fresh load hydrated before the click, so this proves nothing about a visitor still " +
        "waiting on the bundle"
      : !openedBeforeHydration
      ? "the native <details> never reported open=true after the click"
      : expandedBeforeHydration === "true"
      ? "aria-expanded already read true before hydration, which proves nothing about learning " +
        "the state late"
      : `the <details> reported open=true while aria-expanded still read ` +
        `${JSON.stringify(expandedBeforeHydration)}, unannounced as open`,
  )
  check(
    "aria-expanded and Escape both catch up once the held bundle is released",
    heldRequest && rehydrated && syncedAfterHydration && closedAfterEscape,
    !heldRequest
      ? "the bundle was never held, so this proves nothing about catching up"
      : !rehydrated
      ? "the page never rehydrated after the request was released"
      : !syncedAfterHydration
      ? "aria-expanded never became true after hydration, for a panel that was already open"
      : !closedAfterEscape
      ? "a real Escape press still did not close the panel once hydration had caught up"
      : "aria-expanded turned true and a real Escape press closed the panel, both once hydration " +
        "caught up",
  )
}

/** The card `shellChecks` drives, and the pieces of it it reads. */
const SHELL_CARD = "#demo-Shell"
const SHELL = SHELL_CARD + ' [data-e2e="shell-demo"]'
const SHELL_HEADER = SHELL + ' [data-e2e="shell-header"]'
const SHELL_BRAND = SHELL + ' [data-e2e="shell-brand"]'
const SHELL_MENU_BUTTON = SHELL + ' [data-e2e="shell-menu-button"]'
const SHELL_PANEL = SHELL + ' [data-e2e="shell-panel"]'
const SHELL_SCRIM = SHELL + ' [data-e2e="shell-scrim"]'
const SHELL_DETAILS = SHELL + " details"
const SHELL_PANEL_LINKS = SHELL_PANEL + " nav a"
const SHELL_SKIP_LINK = SHELL + ' [data-e2e="shell-skip-link"]'
const SHELL_CONTENT = SHELL + ' [data-e2e="shell-content"]'
const SHELL_USER_MENU_BUTTON = SHELL + ' [data-e2e="shell-user-menu-button"]'
/** Any item inside the user menu's own panel — where `Dropdown` moves focus once it opens. */
const SHELL_USER_MENU_ITEM = SHELL + ' [role="menuitem"]'

/** A viewport narrow enough to put `Shell` into its drawer layout (`lg` is 1024px). */
const SHELL_VIEWPORT_PHONE = { width: 390, height: 844 }
/** A viewport wide enough to show `Shell`'s desktop sidebar instead of the drawer. */
const SHELL_VIEWPORT_DESKTOP = { width: 1280, height: 900 }

/** What one reading of the drawer's `<details>` and menu button reports. */
interface ShellPanelState {
  found: boolean
  detailsOpen: boolean
  expanded: string | null
}

const READ_SHELL_PANEL = `(() => {
  const details = document.querySelector('${SHELL_DETAILS}')
  const button = document.querySelector('${SHELL_MENU_BUTTON}')
  return {
    found: Boolean(details) && Boolean(button),
    detailsOpen: details ? details.open : false,
    expanded: button ? button.getAttribute("aria-expanded") : null,
  }
})()`

const SHELL_PANEL_UNREAD: ShellPanelState = { found: false, detailsOpen: false, expanded: null }

function readShellPanel(devtools: Devtools): Promise<ShellPanelState> {
  return read(devtools, READ_SHELL_PANEL, SHELL_PANEL_UNREAD)
}

/** Whether the user menu's own trigger currently reports itself open. */
function readShellUserMenuOpen(devtools: Devtools): Promise<boolean> {
  return read(
    devtools,
    `document.querySelector('${SHELL_USER_MENU_BUTTON}')?.getAttribute("aria-expanded") === "true"`,
    false,
  )
}

/**
 * Force both the drawer and the user menu closed before a sub-check needs a known starting state,
 * rather than assuming the previous one's own teardown landed — the same reasoning
 * `ensureSiteHeaderClosed` is built on, extended to the second, independent disclosure `Shell` adds.
 *
 * The drawer's `<details>` can be closed directly, the same way `ensureSiteHeaderClosed` does it.
 * `Dropdown` exposes no such seam — its open state is a signal local to the component — so the only
 * way to close it from outside is the interaction a visitor would use: a click on its own trigger,
 * which toggles it shut when it is already open.
 */
async function ensureShellClosed(devtools: Devtools): Promise<void> {
  await read(
    devtools,
    `(() => {
      const details = document.querySelector('${SHELL_DETAILS}')
      if (details) details.open = false
      return true
    })()`,
    false,
  )
  if (await readShellUserMenuOpen(devtools)) {
    await click(devtools, SHELL_USER_MENU_BUTTON)
  }
  await poll(async () => {
    const panel = await readShellPanel(devtools)
    return !panel.detailsOpen && !(await readShellUserMenuOpen(devtools))
  }, 3_000)
}

/**
 * `Shell`'s mobile drawer: closed by default, opened by a click on the menu button, closed by a
 * real Escape press with focus returned to the button, closed deterministically even when the click
 * and the Escape land in the same task, scoped correctly against `ui/`'s `Dropdown` sharing the same
 * header, reachable from the skip link, and laid out so neither the drawer nor the user menu ever
 * move the header around them.
 *
 * **Phone width, for the panel checks; desktop width for the layout check's own second half.**
 * `Shell` only builds the `<details>` drawer below `lg` (1024px); `siteHeaderChecks`' own doc
 * explains why a check like this one has to narrow the viewport itself rather than trust whatever
 * the rest of the run left it at.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function shellChecks(devtools: Devtools): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    ...SHELL_VIEWPORT_PHONE,
    deviceScaleFactor: 1,
    mobile: false,
  })

  try {
    // Scrolled to the top of the header, not merely into view: `getBoundingClientRect` is
    // viewport-relative, so every geometry read and every `elementFromPoint` call below assumes the
    // header sits at the actual viewport's own top edge — the same assumption the drawer's own
    // `fixed … top-16` styling makes. On the catalogue page, where this card sits well below the
    // page's own top, that assumption does not hold until this scrolls it there, and every
    // coordinate this block reads afterward is meaningless without it.
    await read(
      devtools,
      `(() => {
        const header = document.querySelector('${SHELL_HEADER}')
        if (header) header.scrollIntoView({ block: "start", behavior: "instant" })
        return Boolean(header)
      })()`,
      false,
    )
    await waitForScrollSettle(devtools)

    await ensureShellClosed(devtools)

    const idle = await readShellPanel(devtools)
    check(
      "Shell's mobile drawer starts closed, with aria-expanded false",
      idle.found && !idle.detailsOpen && idle.expanded === "false",
      idle.found
        ? `details.open=${idle.detailsOpen}, aria-expanded=${idle.expanded}`
        : "the Shell card was not found at phone width",
    )

    await focusAndClick(devtools, SHELL_MENU_BUTTON)
    const opened = await poll(async () => {
      const state = await readShellPanel(devtools)
      return state.detailsOpen && state.expanded === "true"
    }, 3_000)
    check(
      "clicking the menu button opens Shell's drawer and flips aria-expanded",
      opened,
      `details.open and aria-expanded both true: ${opened}`,
    )

    const expectedOrder = await read(
      devtools,
      `[...document.querySelectorAll('${SHELL_PANEL_LINKS}')]
        .map((el) => el.textContent.trim())`,
      [] as string[],
    )
    const tabbedThrough: string[] = []
    for (let index = 0; index < expectedOrder.length; index++) {
      await pressKey(devtools, "Tab")
      tabbedThrough.push(
        await read(
          devtools,
          `(document.activeElement ? document.activeElement.textContent.trim() : "")`,
          "",
        ),
      )
    }
    check(
      "Tab walks the open drawer's links, in document order, once the button has focus",
      opened && expectedOrder.length > 0 && tabbedThrough.length === expectedOrder.length &&
        tabbedThrough.every((label, index) => label === expectedOrder[index]),
      `expected ${JSON.stringify(expectedOrder)}, tabbed through ${JSON.stringify(tabbedThrough)}`,
    )

    await pressKey(devtools, "Escape")
    const closed = await poll(async () => !(await readShellPanel(devtools)).detailsOpen, 3_000)
    const focusedButton = await read(
      devtools,
      `document.activeElement === document.querySelector('${SHELL_MENU_BUTTON}')`,
      false,
    )
    check(
      "a real Escape key press closes Shell's drawer and returns focus to the menu button",
      opened && closed && focusedButton,
      !opened
        ? "the drawer was never open, so this proves nothing about Escape"
        : !closed
        ? "the drawer was still open 3s after the key press"
        : `document.activeElement is the menu button: ${focusedButton}`,
    )

    await shellEscapeRaceCheck(devtools)
    await shellEscapeScopingCheck(devtools)
    await shellScrimClickCheck(devtools)
    await shellSkipLinkCheck(devtools)
    await shellClientNavigationChecks(devtools)
    await shellLayoutChecks(devtools)
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
  }
}

/**
 * The same race `siteHeaderEscapeRaceCheck` was written against, forced against `Shell`'s own
 * drawer from the start rather than discovered after the fact: `useMobilePanel`'s Escape listener
 * is attached once, unconditionally, and reads `detailsRef.current.open` directly, so it cannot be
 * gated on a signal that lags a render behind the DOM the way an earlier version of this hook was.
 * Reusing the hook is what makes this check able to reuse the same proof, adapted to `Shell`'s own
 * selectors.
 *
 * `button.click()` and a bubbling, synthetic `keydown` Escape dispatched from the button, back to
 * back inside one `Runtime.evaluate`, land inside the gap deterministically — see
 * `siteHeaderEscapeRaceCheck`'s own doc for why two separate real commands cannot. The two animation
 * frames before the click let the *previous* close's own effect cleanup finish first, the same
 * reason `siteHeaderEscapeRaceCheck` waits for them: without it, a listener left over from a prior
 * open can still be attached when this one clicks, and close the panel for the wrong reason.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller. Waits for the drawer to report closed itself first, rather than assuming it already is.
 */
async function shellEscapeRaceCheck(devtools: Devtools): Promise<void> {
  await ensureShellClosed(devtools)
  await poll(async () => {
    const state = await readShellPanel(devtools)
    return !state.detailsOpen && state.expanded === "false"
  }, 3_000)

  const stillOpen = await read(
    devtools,
    `(async () => {
      for (let k = 0; k < 2; k++) {
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
      }
      const button = document.querySelector('${SHELL_MENU_BUTTON}')
      if (!button) return null
      button.click()
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      )
      const details = button.closest("details")
      return details ? details.open : null
    })()`,
    null as boolean | null,
  )

  check(
    "an Escape dispatched in the same task as the click still closes Shell's drawer",
    stillOpen === false,
    stillOpen === null
      ? "the menu button was not found"
      : stillOpen
      ? "details.open still read true immediately after the click and the same-task Escape"
      : "details.open read false immediately after the click and the same-task Escape",
  )

  await ensureShellClosed(devtools)
}

/**
 * An Escape meant for one of `Shell`'s two independent disclosures must not also close the other —
 * the mobile drawer (`useMobilePanel`, a `document`-level listener scoped by `event.target`
 * containment) and `ui/`'s `Dropdown` (a listener on the dropdown's own root, which only ever sees
 * events bubbling from inside it) sit in the same header, and both can be genuinely open at once.
 *
 * **Both halves use real clicks and a real Escape — deliberately not the synthetic, targeted
 * dispatch `shellEscapeRaceCheck` uses.** A first version of this check dispatched a synthetic
 * Escape from whichever element was "supposed" to receive it, which let it also aim one at the
 * drawer while real focus was still inside the *open* dropdown — a combination a real key press can
 * never produce, because a real `keydown`'s target is always wherever focus actually is. That
 * mismatch is what failed: `close(true)`'s own `triggerRef.current.focus()` moved real focus out of
 * the dropdown, which closed it through `Dropdown`'s own blur handling — a correct, unrelated
 * consequence of restoring focus, not a scoping leak, and not something a real Escape press could
 * ever trigger this way.
 *
 * **`Dropdown` moves focus into its own panel the instant it opens, and closes itself the instant
 * focus leaves it — which is what makes "both open, with focus genuinely in the drawer" impossible
 * to construct at all.** The drawer has no such blur handling, so opening the dropdown on top of an
 * open drawer leaves both genuinely open (checked below). Opening the drawer on top of an open
 * dropdown, by contrast, moves real focus to the drawer's button and closes the dropdown *before*
 * any Escape is pressed — proven below as its own assertion, because it is exactly the mechanism
 * that makes "the reverse" hold: a real Escape aimed at the drawer never has an open dropdown left
 * to threaten.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller. Forces both disclosures closed itself, both before and after.
 */
async function shellEscapeScopingCheck(devtools: Devtools): Promise<void> {
  await ensureShellClosed(devtools)

  // Direction 1: the drawer opens, the user menu opens on top of it — the drawer has no blur
  // handling, so both are genuinely open at once. A real Escape, which goes wherever focus actually
  // is (inside the user menu's panel, moved there when it opened), must close only the user menu.
  await focusAndClick(devtools, SHELL_MENU_BUTTON)
  const drawerOpenedFirst = await poll(async () => {
    const state = await readShellPanel(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)
  await click(devtools, SHELL_USER_MENU_BUTTON)
  const userMenuOpened = await poll(() => readShellUserMenuOpen(devtools), 3_000)
  const drawerStillOpenWithMenuOpen = (await readShellPanel(devtools)).detailsOpen
  // `Dropdown` moves focus into its panel from an effect that runs a render after `aria-expanded`
  // itself commits — the same render-vs-effect gap `mobile-panel.ts`'s own doc explains — so a real
  // Escape pressed right after the `aria-expanded` poll above can still find focus on the button
  // that opened the menu, not inside it. Waiting for focus itself, not merely for the attribute, is
  // what makes this Escape land where a person's actually would.
  const focusInUserMenu = await poll(
    () =>
      read(
        devtools,
        `document.activeElement?.matches('${SHELL_USER_MENU_ITEM}') === true`,
        false,
      ),
    3_000,
  )

  // Focus reaching the item (above) proves the keyboard path; a stacking-context bug can still leave
  // it unreachable to a pointer. The drawer's own panel and the user menu's panel are both
  // descendants of the same `sticky z-30` header, so their z-index is compared inside that one
  // stacking context — the drawer sat at `z-20` and the menu's default `z-10` put it underneath,
  // so a real tap on "Your profile" landed on the drawer instead and closed the menu through its own
  // outside-click handler before the item's own click ever ran. `elementFromPoint` at the item's own
  // centre catches the geometry half of that; dispatching a real click and reading back whether the
  // item's own capturing listener fired catches the rest, including anything `elementFromPoint`
  // alone would miss.
  const aim = await read(
    devtools,
    `(() => {
      const item = document.querySelector('${SHELL_USER_MENU_ITEM}')
      if (!item) return { onTarget: false, x: 0, y: 0, landedOn: "nothing", reason: "no menu item found" }
      const rect = item.getBoundingClientRect()
      const x = Math.round(rect.left + rect.width / 2)
      const y = Math.round(rect.top + rect.height / 2)
      const at = document.elementFromPoint(x, y)
      const onTarget = at === item || item.contains(at)
      if (onTarget) {
        globalThis.__shellMenuItemClickReached = false
        item.addEventListener("click", (event) => {
          globalThis.__shellMenuItemClickReached = true
          // Neither a real navigation nor the panel's own "activating an item closes the menu"
          // handling is what this check is about, so both are headed off here rather than left to
          // unwind the state the Escape assertions below still need.
          event.preventDefault()
          event.stopPropagation()
        }, { capture: true, once: true })
      }
      return {
        onTarget,
        x,
        y,
        landedOn: at ? (at.tagName ? at.tagName.toLowerCase() : String(at)) : "nothing",
        reason: onTarget ? "" : "the topmost element there is not the menu item",
      }
    })()`,
    MISSED,
  )
  if (aim.onTarget) await clickAt(devtools, aim)
  const handlerFired = aim.onTarget &&
    await read(devtools, "globalThis.__shellMenuItemClickReached === true", false)

  check(
    "the open user menu sits above the open drawer, so a tap on its first item reaches it",
    drawerOpenedFirst && userMenuOpened && focusInUserMenu && aim.onTarget && handlerFired,
    !drawerOpenedFirst || !userMenuOpened
      ? "the setup above did not reach the state this check needs, so this proves nothing"
      : !focusInUserMenu
      ? "focus never moved into the user menu's panel, so this proves nothing about a pointer either"
      : !aim.onTarget
      ? `a point at (${aim.x},${aim.y}), the item's own centre, lands on ${aim.landedOn} instead — ` +
        "the drawer is drawn on top of the open user menu"
      : !handlerFired
      ? `elementFromPoint reported the item at (${aim.x},${aim.y}), but a real click there never ` +
        "reached the item's own listener"
      : `a real click at (${aim.x},${aim.y}) landed on the item and reached its own listener, on ` +
        "top of the open drawer",
  )

  await pressKey(devtools, "Escape")
  const userMenuClosedByEscape = await poll(
    () => readShellUserMenuOpen(devtools).then((v) => !v),
    3_000,
  )
  const drawerStillOpenAfterUserMenuEscape = (await readShellPanel(devtools)).detailsOpen

  check(
    "an Escape meant for the open user menu does not also close the mobile drawer",
    drawerOpenedFirst && userMenuOpened && drawerStillOpenWithMenuOpen && focusInUserMenu &&
      userMenuClosedByEscape && drawerStillOpenAfterUserMenuEscape,
    !drawerOpenedFirst
      ? "the drawer never opened, so this proves nothing"
      : !userMenuOpened
      ? "the user menu never opened, so this proves nothing"
      : !drawerStillOpenWithMenuOpen
      ? "opening the user menu closed the drawer on its own, before Escape was even pressed"
      : !focusInUserMenu
      ? "focus never moved into the user menu's panel, so a real Escape proves nothing about it"
      : !userMenuClosedByEscape
      ? "the user menu was still open after Escape"
      : "focus was inside the user menu when Escape was pressed, and it closed the user menu " +
        "alone, leaving the drawer open behind it",
  )

  await ensureShellClosed(devtools)

  // Direction 2 ("the reverse"): the user menu opens, then the drawer opens on top of it. Opening
  // the drawer moves real focus to its own button — outside the user menu's root — which closes the
  // user menu through its own blur handling, before any Escape is pressed at all. A real Escape,
  // now aimed at the drawer because that is where focus actually is, closes the drawer; the user
  // menu — already closed — has nothing left for it to threaten.
  await click(devtools, SHELL_USER_MENU_BUTTON)
  const userMenuOpenedSecond = await poll(() => readShellUserMenuOpen(devtools), 3_000)
  // `Dropdown`'s own "move focus into the panel" effect runs a render behind `aria-expanded`, the
  // same gap direction 1 waits out above. Left unwaited here, that effect can fire *after* the
  // drawer's own `.focus()` below, stealing focus back into the user menu's first item and making
  // the drawer's own Escape land on the wrong element a moment later — measured, not assumed: this
  // is exactly what turned this direction red the first time it was written.
  await poll(
    () =>
      read(devtools, `document.activeElement?.matches('${SHELL_USER_MENU_ITEM}') === true`, false),
    3_000,
  )
  await focusAndClick(devtools, SHELL_MENU_BUTTON)
  const drawerOpenedSecond = await poll(async () => {
    const state = await readShellPanel(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)
  const userMenuClosedByBlur = await poll(
    () => readShellUserMenuOpen(devtools).then((v) => !v),
    3_000,
  )
  await pressKey(devtools, "Escape")
  const drawerClosedSecond = await poll(
    async () => !(await readShellPanel(devtools)).detailsOpen,
    3_000,
  )
  const userMenuStillClosedAfterDrawerEscape = !(await readShellUserMenuOpen(devtools))

  check(
    "opening the mobile drawer closes an open user menu on its own, before Escape is involved",
    userMenuOpenedSecond && drawerOpenedSecond && userMenuClosedByBlur,
    !userMenuOpenedSecond
      ? "the user menu never opened, so this proves nothing"
      : !drawerOpenedSecond
      ? "the drawer never opened, so this proves nothing"
      : "opening the drawer moved focus to its own button, outside the user menu's root, and " +
        "the user menu's own blur handling closed it before any Escape was pressed",
  )
  check(
    "an Escape meant for the open mobile drawer does not reopen or otherwise affect the user menu",
    drawerOpenedSecond && userMenuClosedByBlur && drawerClosedSecond &&
      userMenuStillClosedAfterDrawerEscape,
    !drawerOpenedSecond || !userMenuClosedByBlur
      ? "the setup above did not reach the state this check needs, so this proves nothing"
      : !drawerClosedSecond
      ? "the drawer was still open after Escape"
      : "Escape closed the drawer, and the user menu — already closed — stayed closed",
  )

  await ensureShellClosed(devtools)
}

/**
 * A tap on the drawer's own scrim has to close it — the scrim's whole reason to exist is to give a
 * pointer user a target to dismiss the drawer with, since it is otherwise the entire area beside a
 * 288px-wide panel. `close(false)`, not `close(true)`: a scrim tap is a dismiss by pointer, the same
 * as activating a link inside the panel, not a request to have keyboard focus handed back to a
 * button the tap never touched — `system/README.md`'s `Shell` section records this decision.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller, with the drawer already closed.
 */
async function shellScrimClickCheck(devtools: Devtools): Promise<void> {
  await ensureShellClosed(devtools)
  await focusAndClick(devtools, SHELL_MENU_BUTTON)
  const opened = await poll(async () => {
    const state = await readShellPanel(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)

  // Tabbed onto the first link inside the panel, deliberately, rather than left on the button that
  // opened it: the button stays in the DOM and focusable after the panel hides, so leaving focus
  // there would make `close(true)` and `close(false)` look identical — focus never actually left it
  // either way. Moving focus onto a link the closing panel is about to hide is what gives this
  // anything to observe, the same reason `shellClientNavigationChecks`' own link click needs to.
  await pressKey(devtools, "Tab")
  const focusOnLink = await read(
    devtools,
    `document.activeElement?.matches('${SHELL_PANEL_LINKS}') === true`,
    false,
  )

  await click(devtools, SHELL_SCRIM)
  const closed = await poll(async () => !(await readShellPanel(devtools)).detailsOpen, 3_000)
  const focusedButton = await read(
    devtools,
    `document.activeElement === document.querySelector('${SHELL_MENU_BUTTON}')`,
    false,
  )

  check(
    "a tap on the drawer's scrim closes it, without pulling focus back to the menu button",
    opened && focusOnLink && closed && !focusedButton,
    !opened
      ? "the drawer was never open, so this proves nothing about the scrim"
      : !focusOnLink
      ? "focus never reached a link inside the panel, so this proves nothing about where the " +
        "scrim leaves it"
      : !closed
      ? "the drawer was still open after the scrim was tapped"
      : `document.activeElement is the menu button: ${focusedButton}`,
  )

  await ensureShellClosed(devtools)
}

/**
 * The skip link is the first focusable element on the page, and activating it has to move focus to
 * the content area — not only change the address bar's hash, which a person tabbing through the
 * page afterwards would never notice.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller.
 */
async function shellSkipLinkCheck(devtools: Devtools): Promise<void> {
  const focused = await focusAndClick(devtools, SHELL_SKIP_LINK)
  const after = await read(
    devtools,
    `(() => ({
      activeIsContent: document.activeElement === document.querySelector('${SHELL_CONTENT}'),
      hashMatches: location.hash === document.querySelector('${SHELL_SKIP_LINK}')?.getAttribute("href"),
    }))()`,
    { activeIsContent: false, hashMatches: false },
  )

  check(
    "activating the skip link moves focus to the content area, not only the address hash",
    focused && after.activeIsContent,
    !focused
      ? "the skip link was not found"
      : !after.activeIsContent
      ? `the hash changed (${after.hashMatches}) but document.activeElement is not the content area`
      : "document.activeElement is the content area, and the hash changed to match",
  )
}

/**
 * A click on a link inside the open drawer has to close the drawer, under a client-side router that
 * never lets the click become a real page load — ported from `siteHeaderClientNavigationChecks`
 * against `Shell`'s own selectors, since `Shell`'s `ShellNavLink` wires the identical
 * `onNavigate={() => close(false)}` `SiteHeader` does. Removing that wiring left every other check in
 * this file green, `onNavigate` being the one thing nothing else here exercises: the drawer's own
 * Escape and Tab-order checks never activate a link, and `shell.test.tsx`'s render-to-string tests
 * can see the `onClick` prop is wired but cannot fire a `click` event to prove it runs.
 *
 * See `siteHeaderClientNavigationChecks`'s own doc for why the router stand-in exists at all, why it
 * uses `history.replaceState` rather than `pushState`, and why "focus stays on the link" is not
 * something this can honestly claim.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller, with the drawer already closed.
 */
async function shellClientNavigationChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")

  try {
    await ensureShellClosed(devtools)
    await focusAndClick(devtools, SHELL_MENU_BUTTON)
    const opened = await poll(async () => {
      const state = await readShellPanel(devtools)
      return state.detailsOpen && state.expanded === "true"
    }, 3_000)

    const armed = await read(
      devtools,
      `(() => {
        globalThis.__shellNavMark = "still here"
        const link = document.querySelector('${SHELL_PANEL_LINKS}')
        if (!link) return null
        const handler = (event) => {
          event.preventDefault()
          history.replaceState({}, "", link.getAttribute("href"))
          link.removeEventListener("click", handler, true)
        }
        link.addEventListener("click", handler, true)
        link.scrollIntoView({ block: "center", behavior: "instant" })
        const rect = link.getBoundingClientRect()
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        }
      })()`,
      null as { x: number; y: number } | null,
    )
    if (armed) await clickAt(devtools, armed)

    const closed = await poll(async () => !(await readShellPanel(devtools)).detailsOpen, 3_000)
    const after = await read(
      devtools,
      `(() => {
        const active = document.activeElement
        return {
          mark: globalThis.__shellNavMark || "",
          href: location.href,
          focusOnButton: active === document.querySelector('${SHELL_MENU_BUTTON}'),
          activeTag: active ? active.tagName : "none",
        }
      })()`,
      { mark: "", href: "", focusOnButton: false, activeTag: "" },
    )

    check(
      "a client-side navigation on a drawer link closes the drawer with no real page reload",
      opened && Boolean(armed) && closed && after.mark === "still here" &&
        after.href !== restoreUrl,
      !opened
        ? "the drawer was never open"
        : !armed
        ? "the router stand-in could not find the first drawer link to click"
        : !closed
        ? "the drawer was still open after the link was activated"
        : after.mark !== "still here"
        ? "the mark left the page — a real navigation happened, which proves nothing about the " +
          "drawer's own close"
        : after.href === restoreUrl
        ? "the router stand-in ran, but location never changed, so this proves nothing about a " +
          "real navigation"
        : `location moved from ${restoreUrl} to ${after.href} with no reload`,
    )
    check(
      "closing the drawer for a navigating link does not pull focus back to the menu button",
      closed && !after.focusOnButton,
      `document.activeElement is the menu button: ${after.focusOnButton} (tagName: ${after.activeTag})`,
    )
  } finally {
    await read(
      devtools,
      `(history.replaceState({}, "", ${JSON.stringify(restoreUrl)}), true)`,
      false,
    )
      .catch(() => {})
    await waitForScrollSettle(devtools)
  }
}

/** One reading of `Shell`'s header geometry, taken by {@link shellLayoutChecks}. */
interface ShellLayoutSnapshot {
  found: boolean
  headerHeight: number
  brandRect: { x: number; y: number; width: number; height: number }
  avatarRect: { x: number; y: number; width: number; height: number }
  /** Whether the topmost element at the brand's own centre is the brand, or something over it. */
  brandOnTop: boolean
}

const NO_SHELL_LAYOUT: ShellLayoutSnapshot = {
  found: false,
  headerHeight: 0,
  brandRect: { x: 0, y: 0, width: 0, height: 0 },
  avatarRect: { x: 0, y: 0, width: 0, height: 0 },
  brandOnTop: false,
}

const READ_SHELL_LAYOUT = `(() => {
  const header = document.querySelector('${SHELL_HEADER}')
  const brand = document.querySelector('${SHELL_BRAND}')
  const avatar = document.querySelector('${SHELL_USER_MENU_BUTTON}')
  if (!header || !brand || !avatar) return { found: false }
  const rectOf = (el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
  }
  const brandRect = rectOf(brand)
  const x = Math.round(brandRect.x + brandRect.width / 2)
  const y = Math.round(brandRect.y + brandRect.height / 2)
  const at = document.elementFromPoint(x, y)
  return {
    found: true,
    headerHeight: Math.round(header.getBoundingClientRect().height),
    brandRect,
    avatarRect: rectOf(avatar),
    brandOnTop: at === brand || brand.contains(at),
  }
})()`

function sameShellLayout(a: ShellLayoutSnapshot, b: ShellLayoutSnapshot): boolean {
  return a.headerHeight === b.headerHeight &&
    JSON.stringify(a.brandRect) === JSON.stringify(b.brandRect) &&
    JSON.stringify(a.avatarRect) === JSON.stringify(b.avatarRect)
}

/**
 * Opening a panel must not move anything else in `Shell`'s header — at phone width, opening the
 * drawer; at desktop width, opening the user menu, since the drawer does not exist there at all.
 *
 * An earlier version of this check compared `Page.captureScreenshot` clips instead of geometry, and
 * stayed green even when the drawer was moved to `top-0 z-40`, covering the header completely: the
 * clip rectangle came straight from `getBoundingClientRect`, which is viewport-relative, while
 * `captureScreenshot`'s own `clip` is page-relative — the two only agree when the page happens to be
 * scrolled to the very top. On the catalogue page, where `Shell`'s card sits well below the top, the
 * clips landed at negative or otherwise nonsensical page coordinates (measured: `(50,-64)` and
 * `(330,-5217)`), so both screenshots were blank and "matched" no matter what the drawer did.
 * Asserting geometry directly — the header's own height, the brand's and the avatar's rects, and
 * that the element at the brand's own centre is still the brand — needs no page/viewport coordinate
 * conversion at all, and is what the reading below does instead. The card is scrolled into view
 * first and the scroll given a chance to settle, so the geometry read is not taken mid-scroll.
 *
 * @param devtools The connected session, on a hydrated page. Switches the viewport itself for each
 * half and restores phone width — `shellChecks`' own viewport — before returning.
 */
async function shellLayoutChecks(devtools: Devtools): Promise<void> {
  await ensureShellClosed(devtools)
  await read(
    devtools,
    `(() => {
      const header = document.querySelector('${SHELL_HEADER}')
      if (header) header.scrollIntoView({ block: "start", behavior: "instant" })
      return Boolean(header)
    })()`,
    false,
  )
  await waitForScrollSettle(devtools)

  const closed = await read(devtools, READ_SHELL_LAYOUT, NO_SHELL_LAYOUT)
  await focusAndClick(devtools, SHELL_MENU_BUTTON)
  await poll(async () => {
    const state = await readShellPanel(devtools)
    return state.detailsOpen && state.expanded === "true"
  }, 3_000)
  const openWithDrawer = await read(devtools, READ_SHELL_LAYOUT, NO_SHELL_LAYOUT)

  check(
    "opening the mobile drawer at phone width leaves the header's own geometry unchanged",
    closed.found && openWithDrawer.found && closed.brandOnTop && openWithDrawer.brandOnTop &&
      sameShellLayout(closed, openWithDrawer),
    !closed.found || !openWithDrawer.found
      ? "the header, the brand or the avatar was not found"
      : !closed.brandOnTop
      ? "something already covers the brand's own centre before the drawer even opens"
      : !openWithDrawer.brandOnTop
      ? "the drawer now covers the brand's own centre, which the header bar must stay clear of"
      : !sameShellLayout(closed, openWithDrawer)
      ? `header height ${closed.headerHeight} → ${openWithDrawer.headerHeight}, brand ` +
        `${JSON.stringify(closed.brandRect)} → ${
          JSON.stringify(openWithDrawer.brandRect)
        }, avatar ` +
        `${JSON.stringify(closed.avatarRect)} → ${JSON.stringify(openWithDrawer.avatarRect)}`
      : `header height ${closed.headerHeight}px held still, brand and avatar rects unchanged, and ` +
        "the brand's own centre stayed on top, open and closed",
  )

  await ensureShellClosed(devtools)

  await devtools.send("Emulation.setDeviceMetricsOverride", {
    ...SHELL_VIEWPORT_DESKTOP,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await read(
    devtools,
    `(() => {
      const header = document.querySelector('${SHELL_HEADER}')
      if (header) header.scrollIntoView({ block: "start", behavior: "instant" })
      return Boolean(header)
    })()`,
    false,
  )
  await waitForScrollSettle(devtools)

  const desktopClosed = await read(devtools, READ_SHELL_LAYOUT, NO_SHELL_LAYOUT)
  await click(devtools, SHELL_USER_MENU_BUTTON)
  await poll(() => readShellUserMenuOpen(devtools), 3_000)
  const openWithMenu = await read(devtools, READ_SHELL_LAYOUT, NO_SHELL_LAYOUT)

  check(
    "opening the user menu at desktop width leaves the header's own geometry unchanged",
    desktopClosed.found && openWithMenu.found && desktopClosed.brandOnTop &&
      openWithMenu.brandOnTop && sameShellLayout(desktopClosed, openWithMenu),
    !desktopClosed.found || !openWithMenu.found
      ? "the header, the brand or the avatar was not found"
      : !desktopClosed.brandOnTop
      ? "something already covers the brand's own centre before the user menu even opens"
      : !openWithMenu.brandOnTop
      ? "the user menu now covers the brand's own centre, which the header bar must stay clear of"
      : !sameShellLayout(desktopClosed, openWithMenu)
      ? `header height ${desktopClosed.headerHeight} → ${openWithMenu.headerHeight}, brand ` +
        `${JSON.stringify(desktopClosed.brandRect)} → ${JSON.stringify(openWithMenu.brandRect)}, ` +
        `avatar ${JSON.stringify(desktopClosed.avatarRect)} → ${
          JSON.stringify(openWithMenu.avatarRect)
        }`
      : `header height ${desktopClosed.headerHeight}px held still, brand and avatar rects ` +
        "unchanged, and the brand's own centre stayed on top, open and closed",
  )

  await ensureShellClosed(devtools)
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    ...SHELL_VIEWPORT_PHONE,
    deviceScaleFactor: 1,
    mobile: false,
  })
}

/** The `RailShell` card, and the pieces of it the checks below read. */
const RAIL_SHELL = "#demo-RailShell"
const RAIL_SHELL_FRAME = RAIL_SHELL + ' [data-e2e="rail-shell-demo"]'
const RAIL_SHELL_RAIL = RAIL_SHELL + ' [data-e2e="rail-shell-rail"]'
const RAIL_SHELL_TABBAR = RAIL_SHELL + ' [data-e2e="rail-shell-tabbar"]'
const RAIL_SHELL_MORE = RAIL_SHELL + ' [data-e2e="rail-shell-more"]'
const RAIL_SHELL_DIALOG = RAIL_SHELL + ' [data-e2e="rail-shell-dialog"]'
const RAIL_SHELL_CLOSE = RAIL_SHELL + ' [data-e2e="rail-shell-close"]'
const RAIL_SHELL_CONTENT = RAIL_SHELL + ' [data-e2e="rail-shell-content"]'
const RAIL_SHELL_SKIP_LINK = RAIL_SHELL + ' [data-e2e="rail-shell-skip-link"]'
const RAIL_SHELL_CURRENT = RAIL_SHELL + ' [data-e2e="rail-shell-demo-current"]'
const RAIL_SHELL_LAST_LINE = RAIL_SHELL + ' [data-e2e="rail-shell-demo-last-line"]'

/** A desktop-sized viewport, well past the `md` breakpoint the rail appears at. */
const RAIL_SHELL_VIEWPORT_DESKTOP = { width: 1280, height: 900 }
/** The phone width the brief names. */
const RAIL_SHELL_VIEWPORT_PHONE = { width: 375, height: 812 }

/** What one reading of the rail shell's layout reports. */
interface RailShellLayout {
  /** Whether the card's frame, rail and tab bar are all in the page. */
  found: boolean
  /** Whether the rail is drawn at all (`display` is not `none` and it has a box). */
  railShown: boolean
  /** Whether the tab bar is drawn at all. */
  tabBarShown: boolean
  /** How far the rail's right edge reaches past `<main>`'s left edge; `<= 0` means no overlap. */
  railOverlap: number
  /** How far the frame's content is wider than the frame; `<= 0` means no sideways scroll. */
  frameOverflowX: number
  /** How far the widest tab bar entry reaches past the bar's right edge; `<= 0` means none. */
  tabOverflowX: number
  /** How many slots the tab bar draws. */
  tabSlots: number
  /** How far the whole document is wider than the viewport; `<= 0` means no sideways scroll. */
  pageOverflowX: number
}

const RAIL_SHELL_LAYOUT_UNREAD: RailShellLayout = {
  found: false,
  railShown: false,
  tabBarShown: false,
  railOverlap: Infinity,
  frameOverflowX: Infinity,
  tabOverflowX: Infinity,
  tabSlots: -1,
  pageOverflowX: Infinity,
}

function readRailShellLayout(devtools: Devtools): Promise<RailShellLayout> {
  return read(
    devtools,
    `(() => {
      const frame = document.querySelector('${RAIL_SHELL_FRAME}')
      const rail = document.querySelector('${RAIL_SHELL_RAIL}')
      const bar = document.querySelector('${RAIL_SHELL_TABBAR}')
      const main = document.querySelector('${RAIL_SHELL_CONTENT}')
      if (!frame || !rail || !bar || !main) return { found: false }
      const shown = (el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0
      const barBox = bar.getBoundingClientRect()
      const slots = [...bar.querySelectorAll("li")]
      const widest = Math.max(barBox.left, ...slots.map((li) => li.getBoundingClientRect().right))
      return {
        found: true,
        railShown: shown(rail),
        tabBarShown: shown(bar),
        railOverlap: rail.getBoundingClientRect().right - main.getBoundingClientRect().left,
        frameOverflowX: frame.scrollWidth - frame.clientWidth,
        tabOverflowX: widest - barBox.right,
        tabSlots: slots.length,
        pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })()`,
    RAIL_SHELL_LAYOUT_UNREAD,
  )
}

/** Whether the overlay is open, and where focus is relative to it and to "More". */
interface RailShellDialogState {
  open: boolean
  /** Focus is on an element inside the dialog, not the dialog itself. */
  focusInside: boolean
  /** Focus is on the "More" button. */
  focusOnMore: boolean
}

const RAIL_SHELL_DIALOG_UNREAD: RailShellDialogState = {
  open: false,
  focusInside: false,
  focusOnMore: false,
}

function readRailShellDialog(devtools: Devtools): Promise<RailShellDialogState> {
  return read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${RAIL_SHELL_DIALOG}')
      const more = document.querySelector('${RAIL_SHELL_MORE}')
      const active = document.activeElement
      return {
        open: Boolean(dialog && dialog.open),
        focusInside: Boolean(dialog && active && active !== dialog && dialog.contains(active)),
        focusOnMore: Boolean(more && active === more),
      }
    })()`,
    RAIL_SHELL_DIALOG_UNREAD,
  )
}

/** Close the overlay without asserting anything, so a sub-check starts from a known state. */
async function ensureRailShellClosed(devtools: Devtools): Promise<void> {
  await read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${RAIL_SHELL_DIALOG}')
      if (dialog && dialog.open) dialog.close()
      return true
    })()`,
    false,
  )
  await poll(async () => !(await readRailShellDialog(devtools)).open, 3_000)
}

/** Focus "More" and open the overlay with one real key press. */
async function openRailShellByKey(devtools: Devtools, key: "Enter" | "Space"): Promise<boolean> {
  await ensureRailShellClosed(devtools)
  await read(devtools, `document.querySelector('${RAIL_SHELL_MORE}')?.focus() ?? false`, false)
  await pressKey(devtools, key)
  return await poll(async () => {
    const state = await readRailShellDialog(devtools)
    return state.open && state.focusInside
  }, 3_000)
}

/**
 * `RailShell`: the rail at desktop width and the tab bar at phone width, switched by CSS alone; the
 * "More" overlay opened by real Enter and Space presses with focus moved inside, closed by a real
 * Escape and by a real backdrop click with focus back on "More", and closed by choosing an entry;
 * and the skip link reaching `<main>`.
 *
 * The viewport is set with `Emulation.setDeviceMetricsOverride` and cleared in `finally`, so every
 * block after this one sees the run's normal size. The overlay is a modal dialog in the top layer,
 * which would make the rest of the page inert for every later check, so `finally` also closes it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function railShellChecks(devtools: Devtools): Promise<void> {
  try {
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      ...RAIL_SHELL_VIEWPORT_DESKTOP,
      deviceScaleFactor: 1,
      mobile: false,
    })
    const desktop = await readRailShellLayout(devtools)
    check(
      "at 1280px RailShell draws its rail beside the page, not over it, and no tab bar",
      desktop.found && desktop.railShown && !desktop.tabBarShown && desktop.railOverlap <= 0,
      JSON.stringify(desktop),
    )

    await railShellSkipLinkCheck(devtools)

    await devtools.send("Emulation.setDeviceMetricsOverride", {
      ...RAIL_SHELL_VIEWPORT_PHONE,
      deviceScaleFactor: 1,
      mobile: false,
    })
    const phone = await readRailShellLayout(devtools)
    check(
      "at 375px RailShell draws a five-slot tab bar and no rail, and nothing in it scrolls sideways",
      phone.found && !phone.railShown && phone.tabBarShown && phone.tabSlots === 5 &&
        phone.frameOverflowX <= 0 && phone.tabOverflowX <= 0.5,
      JSON.stringify(phone),
    )

    const lastLine = await read(
      devtools,
      `(async () => {
        const frame = document.querySelector('${RAIL_SHELL_FRAME}')
        const last = document.querySelector('${RAIL_SHELL_LAST_LINE}')
        const bar = document.querySelector('${RAIL_SHELL_TABBAR}')
        if (!frame || !last || !bar) return null
        frame.scrollTop = frame.scrollHeight
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const gap = bar.getBoundingClientRect().top - last.getBoundingClientRect().bottom
        frame.scrollTop = 0
        return gap
      })()`,
      null as number | null,
    )
    check(
      "scrolled to the end, the page's last line sits above RailShell's tab bar, not under it",
      lastLine !== null && lastLine >= 0,
      `tab bar top minus last line bottom: ${lastLine}px`,
    )

    await centreInView(devtools, `document.querySelector('${RAIL_SHELL_TABBAR}')`)

    const byEnter = await openRailShellByKey(devtools, "Enter")
    check(
      "a real Enter press on More opens RailShell's overlay and moves focus inside it",
      byEnter,
      JSON.stringify(await readRailShellDialog(devtools)),
    )

    await pressKey(devtools, "Escape")
    const escaped = await poll(async () => {
      const state = await readRailShellDialog(devtools)
      return !state.open && state.focusOnMore
    }, 3_000)
    check(
      "a real Escape press closes RailShell's overlay and returns focus to More",
      byEnter && escaped,
      byEnter
        ? JSON.stringify(await readRailShellDialog(devtools))
        : "the overlay never opened, so this proves nothing about Escape",
    )

    const bySpace = await openRailShellByKey(devtools, "Space")
    check(
      "a real Space press on More opens RailShell's overlay and moves focus inside it",
      bySpace,
      JSON.stringify(await readRailShellDialog(devtools)),
    )

    await railShellBackdropCheck(devtools)
    await railShellChooseCheck(devtools)
    await railShellCloseButtonCheck(devtools)
    await railShellNoScriptCheck(devtools)
  } finally {
    await ensureRailShellClosed(devtools).catch(() => {})
    await devtools.send("Emulation.clearDeviceMetricsOverride", {}).catch(() => {})
  }
}

/**
 * A real mouse click on the backdrop, above the bottom-sheet overlay, closes it and puts focus back
 * on "More". The point is checked with `elementFromPoint` first: a click on the backdrop hit-tests
 * to the dialog element itself, so anything else there means the click would miss.
 */
async function railShellBackdropCheck(devtools: Devtools): Promise<void> {
  if (!(await readRailShellDialog(devtools)).open) {
    await openRailShellByKey(devtools, "Space")
  }
  const aim = await read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${RAIL_SHELL_DIALOG}')
      if (!dialog || !dialog.open) return null
      const box = dialog.getBoundingClientRect()
      const x = Math.round(box.left + box.width / 2)
      const y = Math.round(box.top / 2)
      return { x, y, onBackdrop: document.elementFromPoint(x, y) === dialog }
    })()`,
    null as { x: number; y: number; onBackdrop: boolean } | null,
  )
  if (aim?.onBackdrop) await clickAt(devtools, aim)
  const closed = await poll(async () => {
    const state = await readRailShellDialog(devtools)
    return !state.open && state.focusOnMore
  }, 3_000)
  check(
    "a real click on the backdrop closes RailShell's overlay and returns focus to More",
    Boolean(aim?.onBackdrop) && closed,
    aim === null
      ? "the overlay was not open to click beside"
      : !aim.onBackdrop
      ? `the point ${aim.x},${aim.y} above the sheet does not hit the backdrop`
      : JSON.stringify(await readRailShellDialog(devtools)),
  )
}

/**
 * Choosing an entry inside the overlay, with a real click, calls `navigate` with its key (the
 * card prints it) and closes the overlay.
 */
async function railShellChooseCheck(devtools: Devtools): Promise<void> {
  await openRailShellByKey(devtools, "Enter")
  const aim = await read(
    devtools,
    `(() => {
      const dialog = document.querySelector('${RAIL_SHELL_DIALOG}')
      if (!dialog || !dialog.open) return null
      const entry = [...dialog.querySelectorAll('[data-e2e="rail-shell-entry"]')]
        .find((el) => el.textContent.trim() === "Search")
      if (!entry) return null
      const box = entry.getBoundingClientRect()
      const x = Math.round(box.left + box.width / 2)
      const y = Math.round(box.top + box.height / 2)
      return { x, y, onEntry: entry.contains(document.elementFromPoint(x, y)) }
    })()`,
    null as { x: number; y: number; onEntry: boolean } | null,
  )
  if (aim?.onEntry) await clickAt(devtools, aim)
  const chosen = await poll(async () => {
    const state = await readRailShellDialog(devtools)
    const current = await read(
      devtools,
      `document.querySelector('${RAIL_SHELL_CURRENT}')?.textContent ?? ""`,
      "",
    )
    return !state.open && current === "search"
  }, 3_000)
  check(
    "choosing an entry in RailShell's overlay calls navigate with its key and closes the overlay",
    Boolean(aim?.onEntry) && chosen,
    aim === null
      ? "the overlay was not open, or it has no Search entry"
      : !aim.onEntry
      ? `the point ${aim.x},${aim.y} does not hit the Search entry`
      : JSON.stringify(await readRailShellDialog(devtools)),
  )
  // Put the demo back on its first entry, so a rerun reads the same card.
  await read(
    devtools,
    `(() => {
      const home = [...document.querySelectorAll('${RAIL_SHELL_TABBAR} [data-e2e="rail-shell-entry"]')]
        .find((el) => el.textContent.trim() === "Home")
      home?.click()
      return Boolean(home)
    })()`,
    false,
  )
}

/** The skip link, activated with a real Enter press, moves focus to the shell's `<main>`. */
async function railShellSkipLinkCheck(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")
  try {
    const focused = await read(
      devtools,
      `(() => {
        const link = document.querySelector('${RAIL_SHELL_SKIP_LINK}')
        link?.focus()
        return Boolean(link) && document.activeElement === link
      })()`,
      false,
    )
    if (focused) await pressKey(devtools, "Enter")
    const reached = await poll(
      () =>
        read(
          devtools,
          `document.activeElement === document.querySelector('${RAIL_SHELL_CONTENT}')`,
          false,
        ),
      3_000,
    )
    check(
      "a real Enter press on RailShell's skip link moves focus to its main content",
      focused && reached,
      focused ? `document.activeElement is main: ${reached}` : "the skip link could not be focused",
    )
  } finally {
    if (restoreUrl) {
      await read(
        devtools,
        `history.replaceState(history.state, "", ${JSON.stringify(restoreUrl)})`,
        0,
      )
    }
  }
}

/**
 * The overlay's close button, activated with a real Enter press, closes it and puts focus back on
 * "More". `showModal()` puts focus on the close button, the first control in the dialog, so the
 * check first confirms that is where focus is before pressing.
 */
async function railShellCloseButtonCheck(devtools: Devtools): Promise<void> {
  const opened = await openRailShellByKey(devtools, "Enter")
  const onClose = opened &&
    await read(
      devtools,
      `document.activeElement === document.querySelector('${RAIL_SHELL_CLOSE}')`,
      false,
    )
  if (onClose) await pressKey(devtools, "Enter")
  const closed = await poll(async () => {
    const state = await readRailShellDialog(devtools)
    return !state.open && state.focusOnMore
  }, 3_000)
  check(
    "a real Enter press on the overlay's close button closes RailShell's overlay and returns focus " +
      "to More",
    onClose && closed,
    !opened
      ? "the overlay never opened"
      : !onClose
      ? "focus was not on the close button after the overlay opened"
      : JSON.stringify(await readRailShellDialog(devtools)),
  )
}

/** Where a real click has to land on an element, and whether that point actually hits it. */
interface RailShellAim {
  x: number
  y: number
  onTarget: boolean
}

/** Aim at the middle of an element, checked with `elementFromPoint`, or `null` without one. */
function aimAt(
  devtools: Devtools,
  selector: string,
  scroll: boolean,
): Promise<RailShellAim | null> {
  return read(
    devtools,
    `(() => {
      const element = document.querySelector('${selector}')
      if (!element) return null
      if (${scroll}) element.scrollIntoView({ block: "center", behavior: "instant" })
      const box = element.getBoundingClientRect()
      const x = Math.round(box.left + box.width / 2)
      const y = Math.round(box.top + box.height / 2)
      return { x, y, onTarget: element.contains(document.elementFromPoint(x, y)) }
    })()`,
    null as RailShellAim | null,
  )
}

/**
 * With script execution disabled, a real click on "More" opens the overlay and a real click on its
 * close button shuts it — the browser's own `command`/`commandfor` invokers, with no component code
 * running. The page is the prerendered, unhydrated catalogue, reloaded with scripts off; the
 * `finally` re-enables scripts and reloads, and the page must rehydrate before later checks run —
 * the same shape as `siteHeaderNoScriptCheck`.
 *
 * @param devtools The connected session, on a hydrated page, viewport already narrowed by the
 * caller.
 */
async function railShellNoScriptCheck(devtools: Devtools): Promise<void> {
  const restoreUrl = await read(devtools, "location.href", "")
  let unhydrated = false
  let moreAim: RailShellAim | null = null
  let closeAim: RailShellAim | null = null
  let opened = false
  let closed = false

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForLoad(devtools)
    unhydrated = loaded &&
      await read(devtools, `document.documentElement.dataset.hydrated !== "true"`, false)

    moreAim = await aimAt(devtools, RAIL_SHELL_MORE, true)
    if (moreAim?.onTarget) await clickAt(devtools, moreAim)
    opened = await poll(
      () => read(devtools, `document.querySelector('${RAIL_SHELL_DIALOG}')?.open === true`, false),
      3_000,
    )

    if (opened) closeAim = await aimAt(devtools, RAIL_SHELL_CLOSE, false)
    if (closeAim?.onTarget) await clickAt(devtools, closeAim)
    closed = Boolean(closeAim?.onTarget) && await poll(
      () => read(devtools, `document.querySelector('${RAIL_SHELL_DIALOG}')?.open === false`, false),
      3_000,
    )
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})
    await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
    await waitForLoad(devtools)
    const strayed = await read(devtools, `location.href !== ${JSON.stringify(restoreUrl)}`, false)
    if (strayed) {
      await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
      await waitForLoad(devtools)
    }
    await waitForScrollSettle(devtools)
  }

  check(
    "with script execution disabled, a real click on More opens RailShell's overlay and a real " +
      "click on its close button shuts it",
    unhydrated && opened && closed,
    !unhydrated
      ? "the fresh load still hydrated, so this proves nothing about a visitor without the bundle"
      : !moreAim?.onTarget
      ? `More could not be clicked: ${JSON.stringify(moreAim)}`
      : !opened
      ? "the dialog never reported open=true after the click on More"
      : !closeAim?.onTarget
      ? `the close button could not be clicked: ${JSON.stringify(closeAim)}`
      : !closed
      ? "the dialog was still open 3s after the click on the close button"
      : "the dialog opened on More and closed on the close button with no script running",
  )

  const rehydrated = await poll(
    () => read(devtools, `document.documentElement.dataset.hydrated === "true"`, false),
    10_000,
  )
  check(
    "the page rehydrates after RailShell's no-script check re-enables script execution",
    rehydrated,
    rehydrated ? "data-hydrated set again" : "the page never rehydrated",
  )
}
