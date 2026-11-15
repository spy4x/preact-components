import {
  check,
  CONTRAST_HELPERS,
  type Devtools,
  pointerToCorner,
  poll,
  settledScroll,
} from "../harness.ts"
import {
  cardCanSubmit,
  clickAtPoint,
  elementCenter,
  enhancedFormReading,
  fillContact,
  HONEYPOT_INPUT_SELECTOR,
  regionHasFocus,
  requestBody,
  setToggle,
  startOver,
  waitForNavigation,
  waitForRequest,
} from "./shared-forms.ts"

/**
 * Mark the card's current live-region node, so a later {@link regionIdentityHeld} can prove it is
 * still the exact same, connected node — not a new one Preact created because an unkeyed `<p>`
 * elsewhere in the same children array matched it by type. See `EnhancedForm`'s own doc for the
 * defect this guards.
 */
async function stashRegionIdentity(devtools: Devtools, card: string): Promise<void> {
  await devtools.evaluate<null>(`(() => {
    globalThis.__verifyRegionIdentity = document.querySelector('${card} [role="status"]')
    return null
  })()`)
}

/** Whether the card's live region is still the exact node {@link stashRegionIdentity} marked. */
async function regionIdentityHeld(devtools: Devtools, card: string): Promise<boolean> {
  return await devtools.evaluate<boolean>(`(() => {
    const current = document.querySelector('${card} [role="status"]')
    return current !== null && current === globalThis.__verifyRegionIdentity && current.isConnected
  })()`)
}

/**
 * `EnhancedForm`'s own card, failing through a rejected promise — the ordinary async path, and the
 * first of two failure proofs this card runs before the success proof that finally consumes it
 * (see this section's own module doc).
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormAsyncFailureCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'
  const toggle = `${card} [data-e2e="enhanced-form-fail-toggle"]`

  const ready = await cardCanSubmit(devtools, card)
  const toggledOn = ready.ok && await setToggle(devtools, toggle, true)
  check(
    "EnhancedForm's card is ready and its fail toggle switches on",
    ready.ok && toggledOn,
    ready.ok ? `fail toggle switched on: ${toggledOn}` : ready.reason,
  )
  if (!ready.ok || !toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const failed = await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Try again.",
    2_000,
  )
  const after = await enhancedFormReading(devtools, card)

  check(
    'EnhancedForm\'s own card: a rejected promise ends in "failed", with no failed slot given',
    failed && !after.disabled,
    `region reached the default failure text: ${failed} ("${after.region}"); fieldset ` +
      `re-enabled once settled: ${!after.disabled}`,
  )

  // Turn the toggle back off — the synchronous-throw check below reuses this same card.
  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "EnhancedForm's fail toggle switches back off",
    toggledOff,
    `fail toggle switched off: ${toggledOff}`,
  )
}

/**
 * The failure text's colour and contrast in one palette, read by
 * {@link enhancedFormFailureColourCheck}.
 */
interface EnhancedFormFailureColour {
  /** Whether the region carries the `enhanced-form-error` hook. */
  hooked: boolean
  /** The region's computed text colour. */
  color: string
  /** Whether that colour paints the same pixel as `--color-danger` in this palette. */
  isDanger: boolean
  /** Contrast of the text against the backgrounds composited behind it. */
  onBackdrop: number
}

/**
 * `EnhancedForm`'s own card, failed once more so its region shows the failure text (#632): in the
 * light, the dark and the ink palette the text carries `enhanced-form-error`, paints
 * `--color-danger`, and reaches 4.5:1 against the card behind it. The fail toggle is switched back
 * off afterwards, leaving the card where {@link enhancedFormAsyncFailureCheck} left it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormFailureColourCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'
  const toggle = `${card} [data-e2e="enhanced-form-fail-toggle"]`

  const ready = await cardCanSubmit(devtools, card)
  const toggledOn = ready.ok && await setToggle(devtools, toggle, true)
  if (toggledOn) {
    await devtools.evaluate<null>(
      `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
    )
  }
  const failed = toggledOn && await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Try again.",
    2_000,
  )
  await pointerToCorner(devtools)

  const reading = failed
    ? await devtools.evaluate<Record<"light" | "dark" | "ink", EnhancedFormFailureColour>>(
      `(async () => {
      ${CONTRAST_HELPERS}
      const root = document.documentElement
      const wasDark = root.classList.contains("dark")
      const wasTheme = root.getAttribute("data-theme")
      const region = document.querySelector('${card} [role="status"]')
      const frames = () =>
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      const settle = async () => {
        await frames()
        await Promise.all(
          region.getAnimations().map((animation) => animation.finished.catch(() => {})),
        )
      }
      const token = (name) => {
        const probe = document.createElement("div")
        probe.style.backgroundColor = "var(" + name + ")"
        document.body.appendChild(probe)
        const color = paint(getComputedStyle(probe).backgroundColor)
        probe.remove()
        return color
      }
      const measure = () => {
        const text = paint(getComputedStyle(region).color)
        const danger = token("--color-danger")
        return {
          hooked: region.classList.contains("enhanced-form-error"),
          color: getComputedStyle(region).color,
          isDanger: text.every((channel, index) => channel === danger[index]),
          onBackdrop: seenRatio(region),
        }
      }
      try {
        root.removeAttribute("data-theme")
        root.classList.remove("dark")
        await settle()
        const light = measure()
        root.classList.add("dark")
        await settle()
        const dark = measure()
        root.setAttribute("data-theme", "ink")
        await settle()
        const ink = measure()
        return { light, dark, ink }
      } finally {
        root.classList.toggle("dark", wasDark)
        if (wasTheme === null) root.removeAttribute("data-theme")
        else root.setAttribute("data-theme", wasTheme)
      }
    })()`,
    )
    : null

  for (const palette of ["light", "dark", "ink"] as const) {
    const colour = reading?.[palette]
    check(
      `in the ${palette} palette EnhancedForm's failure text carries enhanced-form-error and ` +
        "paints --color-danger at 4.5:1 or better on its card",
      colour !== undefined && colour.hooked && colour.isDanger && colour.onBackdrop >= 4.5,
      colour === undefined
        ? `the card never reached its failure text (ready: ${ready.ok}, toggled: ${toggledOn})`
        : `hooked: ${colour.hooked}, colour ${colour.color} is --color-danger: ` +
          `${colour.isDanger}, contrast ${colour.onBackdrop.toFixed(2)}`,
    )
  }

  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "EnhancedForm's fail toggle switches back off after the colour reading",
    toggledOff,
    `fail toggle switched off: ${toggledOff}`,
  )
}

/**
 * `EnhancedForm`'s own card again, failing through a throw before `onSubmit` ever returns a
 * promise. `Promise.resolve().then(() => onSubmit(data))` is what folds a synchronous throw into
 * the same `"failed"` path a rejection takes; this is the check that proves the fold rather than
 * assuming it works because the rejection path does.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormSynchronousThrowCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'
  const toggle = `${card} [data-e2e="enhanced-form-throw-sync-toggle"]`

  const ready = await cardCanSubmit(devtools, card)
  const toggledOn = ready.ok && await setToggle(devtools, toggle, true)
  check(
    "EnhancedForm's card is ready and its synchronous-throw toggle switches on",
    ready.ok && toggledOn,
    ready.ok ? `throw-sync toggle switched on: ${toggledOn}` : ready.reason,
  )
  if (!ready.ok || !toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const failed = await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Try again.",
    2_000,
  )
  const after = await enhancedFormReading(devtools, card)

  check(
    'EnhancedForm\'s own card: a synchronous throw from onSubmit also ends in "failed"',
    failed && !after.disabled,
    `region reached the default failure text: ${failed} ("${after.region}"); fieldset ` +
      `re-enabled once settled: ${!after.disabled}`,
  )

  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "EnhancedForm's synchronous-throw toggle switches back off",
    toggledOff,
    `throw-sync toggle switched off: ${toggledOff}`,
  )
}

/**
 * `EnhancedForm`'s own card, last of its three checks because this is the one that succeeds and
 * consumes it for good (see this section's own module doc): a submit announces `"Sending…"`, then
 * replaces the field with the card's explicit `done` slot and announces `"Sent."` — on the *same*
 * live-region node the page started with, which is what proves the key/wrapper fix actually stops
 * Preact from reusing that node for the slot's own content (see `EnhancedForm`'s own doc). It also
 * proves the region hides itself from sighted users once the slot is showing, and that focus lands
 * on the region rather than being dropped onto `<body>` once the pressed button is gone.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormResultChecks(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="enhanced-form"]'

  const ready = await cardCanSubmit(devtools, card)
  check(
    "EnhancedForm's card is ready to submit before its success check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  const before = await enhancedFormReading(devtools, card)
  await stashRegionIdentity(devtools, card)

  // A real, dispatched click rather than a scripted `.click()`: the focus-restoring effect only
  // acts when focus was inside the form at submit time, which a script-triggered `.click()` does
  // not reliably produce (unlike a real pointer press, `.click()` fires the click event without
  // necessarily moving focus first) — this check's own "focus moves to the region" assertion needs
  // a genuine press for that reason, not only for realism.
  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the click that starts EnhancedForm's success run lands on its own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return
  await clickAtPoint(devtools, point)

  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).region === "Sending…",
    1_000,
  )
  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region === "Sent.",
    3_000,
  )
  const after = await enhancedFormReading(devtools, card)
  const identityHeld = await regionIdentityHeld(devtools, card)
  const doneSlotShown = await devtools.evaluate<boolean>(
    `document.querySelector('${card}').textContent.includes("Done.")`,
  )
  const focusedRegion = await regionHasFocus(devtools, card)

  check(
    'EnhancedForm announces "Sending…", then replaces its field with the done slot and ' +
      'announces "Sent." on the same live-region node the card started this submit with',
    sending && settled && doneSlotShown && identityHeld,
    `region "${before.region}" (leftover from this card's own earlier failure checks) → reached ` +
      `"Sending…": ${sending} → reached "Sent.": ${settled} ("${after.region}"), done slot on ` +
      `screen: ${doneSlotShown}, same connected region node throughout: ${identityHeld}`,
  )
  check(
    "the region hides itself from sighted users once the done slot shows the same result in view",
    after.regionSrOnly,
    `region class ${after.regionSrOnly ? "carries" : "does not carry"} sr-only once done`,
  )
  check(
    "focus moves to the live region once the submit button the visitor pressed is gone",
    focusedRegion,
    focusedRegion
      ? "document.activeElement is the live region"
      : "focus did not land on the region — a keyboard user may have been dropped onto <body>",
  )
}

/**
 * The sign-up form, whose honeypot is on. Two things, both about the same off-screen field:
 *
 * 1. Its computed style, not the literal absence of `display:none` in the markup (a render-to-string
 *    unit test can only show that much, and `ui/honeypot.test.tsx` says so): a real `getComputedStyle`
 *    read proves the field is not `display: none` and is nonetheless invisible, clipped to a
 *    fraction of a pixel.
 * 2. Filling it and submitting: `onSubmit`'s own counter must stay at zero while the card still
 *    reaches its ordinary success text, since a bot that filled the trap is told nothing different
 *    from a person who did not.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormsHoneypotChecks(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const counter = `${card} [data-e2e="signup-form-subscribes"]`

  const ready = await startOver(devtools, card)

  const style = await devtools.evaluate<
    { display: string; wrapperDisplay: string; width: number; height: number } | null
  >(`(() => {
    const input = document.querySelector('${card} ${HONEYPOT_INPUT_SELECTOR}')
    if (!input) return null
    const wrapper = input.closest("div")
    const inputStyle = getComputedStyle(input)
    const wrapperStyle = getComputedStyle(wrapper)
    const rect = wrapper.getBoundingClientRect()
    return {
      display: inputStyle.display,
      wrapperDisplay: wrapperStyle.display,
      width: rect.width,
      height: rect.height,
    }
  })()`)

  check(
    "the honeypot field is hidden by layout, not by display:none — read from its computed style",
    style !== null && style.display !== "none" && style.wrapperDisplay !== "none" &&
      style.width <= 1 && style.height <= 1,
    style === null
      ? "no honeypot field found on the card"
      : `input display: "${style.display}", wrapper display: "${style.wrapperDisplay}", ` +
        `wrapper size ${style.width}×${style.height}px`,
  )

  check("the sign-up form's honeypot card is ready to submit", ready.ok, ready.reason)
  if (!ready.ok) return

  // The email field is required: an empty one fails the browser's own constraint validation and
  // blocks the submit before it ever fires, silently — this card's honeypot proof needs a form
  // that would otherwise submit cleanly, so a bot filling only the trap still has to fill the
  // field a bot filling everything would.
  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    const hp = document.querySelector('${card} ${HONEYPOT_INPUT_SELECTOR}')
    if (email) email.value = "bot@example.com"
    if (hp) hp.value = "http://spam.example"
    return null
  })()`)

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  const calls = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "a filled honeypot resolves as a success without ever calling onSubmit",
    settled && calls.includes("subscribes: 0"),
    `region reached "You're subscribed…": ${settled} even though onSubmit's own counter reads ` +
      `"${calls.trim()}"`,
  )
}

/** One entry of `Page.getNavigationHistory`'s own list. */
interface HistoryEntry {
  id: number
  url: string
}

/**
 * The contact form's card, stuck `"sending"` forever (the hang toggle) and recovered by a genuine
 * back/forward-cache restore: `Page.navigate` away to `form-demo/`, then
 * `Page.navigateToHistoryEntry` back to the catalogue's own entry — a real round trip through the
 * browser's own history, not `history.back()` run through page script and not a synthetic event.
 * Standalone: it fills and readies the card itself rather than assuming an earlier check in the
 * same run already left it filled.
 *
 * **`Page.frameNavigated`'s own `type` field, checked for the literal `"BackForwardCacheRestore"`,
 * is what decides this check** — see the comment beside where it is asserted, further down, for why
 * a held `performance.getEntriesByType("navigation")` entry (kept as corroborating evidence, along
 * with `PerformanceObserver`'s own `back-forward-cache-restoration` entry when this repository's
 * Chromium build implements it, which measured it does not) is not strong enough evidence on its
 * own: it is ambiguous about a fresh reload of a previously-`"reload"`-typed page, and this exact
 * check happened to only ever exercise the case where that ambiguity does not arise.
 *
 * **Everything from the navigation away onward runs inside a `try`, and restoring runs inside the
 * matching `finally`** — the same shape {@link enhancedFormsNoScriptChecks} and `system/`'s
 * `authFormNoScriptChecks` use, for the same reason: a throw or a stalled navigation partway
 * through must not leave every check after this one running against the wrong page.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormBackForwardCacheCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'
  const toggle = `${card} [data-e2e="contact-form-hang-toggle"]`
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  // Standalone: this check fills the card itself rather than assuming an earlier one in the same
  // run left it filled, and confirms it is actually ready before touching anything.
  const ready = await startOver(devtools, card)
  check(
    "the contact form's card is ready to submit before the back/forward-cache check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await fillContact(devtools, card)
  const toggledOn = await setToggle(devtools, toggle, true)
  check(
    "the contact form's hang toggle switches on",
    toggledOn,
    `hang toggle switched on: ${toggledOn}`,
  )
  if (!toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )
  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  let restored = false
  let genuineRestore = false
  let frameNavigatedType = "(never fired)"
  let bfcacheObserverFired = false
  let recovered = false

  let beforeNav = { type: "", count: -1 }
  let afterNav = { type: "", count: -1 }

  try {
    // Registered on *this* document, before it is frozen, so both survive a genuine back/forward
    // resume the same way the rest of this page's JS state does. Neither is what this check's
    // pass/fail rests on — see the note further down for why — but both are read back as
    // corroborating evidence.
    await devtools.evaluate<null>(`(() => {
      globalThis.__verifyBfcacheRestorations = []
      try {
        new PerformanceObserver((list) => {
          globalThis.__verifyBfcacheRestorations.push(...list.getEntries())
        }).observe({ type: "back-forward-cache-restoration", buffered: true })
      } catch {
        // Not every Chromium build implements this observer entry type at all.
      }
      return null
    })()`).catch(() => null)

    beforeNav = await devtools.evaluate<{ type: string; count: number }>(`(() => {
      const entries = performance.getEntriesByType("navigation")
      return { type: entries[0] ? entries[0].type : "", count: entries.length }
    })()`).catch(() => beforeNav)

    const away = new URL(restoreUrl)
    away.hash = ""
    const formDemoUrl = new URL("form-demo/", away).href
    await devtools.send("Page.navigate", { url: formDemoUrl })
    await waitForNavigation(devtools)

    const history = await devtools.send<{ currentIndex: number; entries: HistoryEntry[] }>(
      "Page.getNavigationHistory",
    )
    const previous = history.entries[history.currentIndex - 1]

    if (previous) {
      // Registered before the navigation it is meant to observe — a waiter only sees events that
      // arrive after it starts listening, so this has to be armed before `navigateToHistoryEntry`,
      // not read after the fact the way the navigation-timing comparison below can be.
      const frameNavigatedPromise = devtools.once<{ type?: string }>(
        "Page.frameNavigated",
        8_000,
      ).then((event) => event.type ?? "(no type field)").catch(() => "(the event never arrived)")

      await devtools.send("Page.navigateToHistoryEntry", { entryId: previous.id })
      frameNavigatedType = await frameNavigatedPromise
      genuineRestore = frameNavigatedType === "BackForwardCacheRestore"

      restored = await poll(
        () =>
          devtools.evaluate<boolean>(`document.querySelector('${card}') !== null`)
            .catch(() => false),
        5_000,
      )
    }

    afterNav = restored
      ? await devtools.evaluate<{ type: string; count: number }>(`(() => {
        const entries = performance.getEntriesByType("navigation")
        return { type: entries[0] ? entries[0].type : "", count: entries.length }
      })()`).catch(() => afterNav)
      : afterNav

    bfcacheObserverFired = restored &&
      await devtools.evaluate<boolean>(
        `(globalThis.__verifyBfcacheRestorations ?? []).length > 0`,
      ).catch(() => false)

    recovered = restored && await poll(async () => {
      const reading = await enhancedFormReading(devtools, card)
      return !reading.disabled && reading.region === ""
    }, 2_000)
  } finally {
    const strayed = await devtools.evaluate<boolean>(
      `location.href !== ${JSON.stringify(restoreUrl)}`,
    ).catch(() => true)
    if (strayed) {
      await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
      await waitForNavigation(devtools)
    }
    await settledScroll(devtools)

    // Leave the hang toggle as it was found, whether or not the round trip above succeeded.
    const toggledOff = await setToggle(devtools, toggle, false)
    check(
      "the contact form's hang toggle switches back off",
      toggledOff,
      `hang toggle switched off: ${toggledOff}`,
    )
  }

  // **`Page.frameNavigated`'s own `type` field — checked for the literal value
  // `"BackForwardCacheRestore"` — is what decides this check, not the navigation-timing comparison
  // below.** That comparison only works because the entry type this exact run happens to start
  // with is one a fresh, non-cached history fetch would also produce under some circumstances (a
  // "reload"-typed entry survives a same-document restore exactly as a "navigate"-typed one does,
  // but a *fresh* load reachable by reloading first would also read "reload", making the comparison
  // alone ambiguous about which one actually happened); `frameNavigated`'s `type` names the
  // outcome directly, from the browser's own navigation state machine, regardless of what the
  // previous entry happened to be. `PerformanceObserver`'s own `back-forward-cache-restoration`
  // entry is read too, and would be stronger evidence than the timing comparison if this repository's
  // Chromium build implemented it — measured: `PerformanceObserver.supportedEntryTypes` does not
  // list it at all — so it is kept only as corroborating evidence, never required.
  const timingHeld = restored && afterNav.count === 1 && beforeNav.count === 1 &&
    afterNav.type === beforeNav.type

  check(
    "a real back/forward-cache restore ends a sending state whose promise will never settle",
    sending && restored && genuineRestore && recovered,
    `fieldset disabled while the promise was pending: ${sending}; landed back on the catalogue: ` +
      `${restored}; Page.frameNavigated reported "${frameNavigatedType}"` +
      `; recovered to idle: ${recovered} — corroborating evidence: navigation-timing entry held ` +
      `(${beforeNav.count} "${beforeNav.type}" → ${afterNav.count} "${afterNav.type}"): ` +
      `${timingHeld}, PerformanceObserver fired: ${bfcacheObserverFired}`,
  )
}

/** One card driven by {@link enhancedFormsNoScriptChecks}: its selector and the fields to fill. */
interface NoScriptTarget {
  label: string
  card: string
  fields: ReadonlyArray<{ selector: string; value: string }>
}

const NO_SCRIPT_TARGETS: readonly NoScriptTarget[] = [
  {
    label: "the sign-up form",
    card: '#demo-EnhancedForm [data-e2e="signup-form"]',
    fields: [{ selector: 'input[name="email"]', value: "ada@example.com" }],
  },
  {
    label: "the contact form",
    card: '#demo-EnhancedForm [data-e2e="contact-form"]',
    fields: [
      { selector: 'input[name="name"]', value: "Ada Lovelace" },
      { selector: 'input[name="email"]', value: "ada@example.com" },
      { selector: 'textarea[name="message"]', value: "Hello there." },
    ],
  },
]

/**
 * The sign-up form and the contact form, submitted on a page where no script has run at all —
 * `Emulation.setScriptExecutionDisabled` before a reload buys that, the same way `system/`'s
 * `authFormNoScriptChecks` does, and for the same reason: every other check in this file runs
 * against Preact's own hydrated submit handler, and this is the one behaviour that needs a page
 * that never ran the bundle. `Runtime.evaluate` keeps working the whole time — DevTools reads and
 * writes the page through its own privileged channel — so this can still fill fields and read
 * `location.href` even though nothing the page itself authored can run; the submit button itself is
 * pressed with a real, dispatched pointer, because a `.click()` run through `Runtime.evaluate` is
 * script executing on the page's behalf where genuinely none should be able to.
 *
 * **What "the server's answer shows" is checked against, twice.** The landed-on page's own marker
 * is read the same way the earlier version of this check did. On top of that, this reads the
 * *network request itself* — `Network.requestWillBeSent`, captured before the click so nothing is
 * missed — and asserts its method is `POST` and its body carries the field this target filled in.
 * That is the one proof in this file that does not merely observe where the browser ended up: it
 * observes what the browser actually sent, which is what a caller integrating a real backend cares
 * about. Only the local preview server answers that POST with content; see this section's own
 * module doc for why nothing here claims the published site does.
 *
 * **Everything from disabling script execution onward runs inside a `try`, and re-enabling it,
 * navigating back and waiting for rehydration all run inside the matching `finally`.** A throw or a
 * stalled navigation partway through must not leave every check after this one running against an
 * unhydrated page — and if the first restoring navigation does not rehydrate the page either, a
 * second attempt with `Page.reload({ ignoreCache: true })` is what keeps a single flaky navigation
 * from cascading into the Modal checks that run right after this file's own.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function enhancedFormsNoScriptChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })

    for (const [index, target] of NO_SCRIPT_TARGETS.entries()) {
      if (index === 0) {
        await devtools.send("Page.reload", { ignoreCache: true })
      } else {
        // A fresh, still-unhydrated load of the catalogue itself, not a reload of wherever the
        // previous target's submit landed — `Page.reload` at that point would reload `form-demo/`.
        await devtools.send("Page.navigate", { url: restoreUrl })
      }
      const loaded = await waitForNavigation(devtools)
      const unhydrated = loaded &&
        await devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated !== "true"`)
          .catch(() => false)

      for (const field of target.fields) {
        await devtools.evaluate<null>(`(() => {
          const card = document.querySelector('${target.card}')
          const el = card ? card.querySelector('${field.selector}') : null
          if (el) el.value = ${JSON.stringify(field.value)}
          return null
        })()`).catch(() => null)
      }

      const buttonPoint = await elementCenter(devtools, `${target.card} form button[type="submit"]`)

      const requestPromise = waitForRequest(devtools, "form-demo", 10_000)
      if (buttonPoint.ok) {
        for (const type of ["mousePressed", "mouseReleased"]) {
          await devtools.send("Input.dispatchMouseEvent", {
            type,
            x: buttonPoint.x,
            y: buttonPoint.y,
            button: "left",
            buttons: type === "mousePressed" ? 1 : 0,
            clickCount: 1,
          })
        }
      }

      const request = buttonPoint.ok ? await requestPromise : null
      const navigated = await waitForNavigation(devtools)
      const answer = navigated
        ? await devtools.evaluate<string>(
          `document.querySelector('[data-e2e="form-demo-answer"]')?.textContent ?? ""`,
        ).catch(() => "")
        : ""

      check(
        `${target.label} submits with no script running, and the server's answer shows`,
        unhydrated && buttonPoint.ok && navigated && answer.includes("Thanks"),
        !unhydrated
          ? "the fresh load still hydrated, so this proves nothing about a visitor without the bundle"
          : !buttonPoint.ok
          ? `no submit button found or aimed at on the unhydrated, prerendered ${target.label} ` +
            `card: ${buttonPoint.reason}`
          : !navigated
          ? "the submit never navigated anywhere within the timeout"
          : `landed on a page whose own marker reads ${JSON.stringify(answer.slice(0, 60))}`,
      )

      const firstField = target.fields[0]
      const expectedPair = `${
        encodeURIComponent(firstField.selector.match(/name="([^"]+)"/)?.[1] ?? "")
      }=`
      const body = request ? await requestBody(devtools, request) : ""

      check(
        `${target.label}'s no-script submit is recorded as a real POST carrying its fields`,
        request !== null && request.method === "POST" && body.includes(expectedPair),
        request === null
          ? "no network request to form-demo/ was captured"
          : `method "${request.method}", body ${JSON.stringify(body.slice(0, 120))}`,
      )
    }
  } finally {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: false }).catch(() => {})

    await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
    await waitForNavigation(devtools)
    let rehydrated = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      10_000,
    )

    // One restoring navigation was occasionally not enough on its own — a second, harder attempt
    // before giving up is what keeps a single flaky one from taking the Modal checks with it.
    if (!rehydrated) {
      await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
      await waitForNavigation(devtools)
      rehydrated = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        10_000,
      )
    }

    check(
      "the page rehydrates once script execution is re-enabled again",
      rehydrated,
      rehydrated
        ? "data-hydrated set again after the restoring navigation"
        : "the page never rehydrated after script execution was re-enabled, even after a retry",
    )

    await settledScroll(devtools)
  }
}
