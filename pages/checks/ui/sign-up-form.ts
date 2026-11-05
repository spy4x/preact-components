import { check, type Devtools, poll, settledScroll } from "../harness.ts"
import {
  clickAtPoint,
  elementCenter,
  enhancedFormReading,
  regionHasFocus,
  startOver,
} from "./shared-forms.ts"

/**
 * Press and release the left mouse button twice at one point, back to back — a real double click,
 * `clickCount` incrementing the way a person's second press does, rather than two scripted
 * `.click()` calls a page's own code could never tell apart from one call made twice.
 */
async function doubleClickAt(devtools: Devtools, point: { x: number; y: number }): Promise<void> {
  await clickAtPoint(devtools, point, 1)
  await clickAtPoint(devtools, point, 2)
}

/**
 * The sign-up form: a real double click on the submit button, dispatched through
 * `Input.dispatchMouseEvent` rather than two scripted `.click()` calls, still calls `onSubmit`
 * once.
 *
 * **This does not isolate the synchronous `busyRef` guard from the disabled `<fieldset>`.** A real
 * double click carries the round trip a `Runtime.evaluate` call to dispatch each press costs, and
 * that gap was measured to be enough for Preact to have already disabled the fieldset by the time
 * the second press lands — with the guard itself removed, this check stays green, because the
 * disabled button alone already stops the second press from doing anything. What isolates the guard
 * on its own, with no gap for a re-render to close, is {@link signUpFormRequestSubmitGuardCheck}:
 * two `form.requestSubmit()` calls made in the same script turn, before either can yield back to the
 * event loop. This check still matters on its own terms — a real double click is closer to what a
 * person actually does than a scripted call ever proves — it just proves a different thing.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signUpFormDoubleClickCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const counter = `${card} [data-e2e="signup-form-subscribes"]`

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's primary card is ready to submit before the double click",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    return null
  })()`)

  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the double click's aim lands on the sign-up form's own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return

  await doubleClickAt(devtools, point)

  // `onSubmit`'s own increment runs before its 300ms delay, so the counter settles almost at once;
  // the region only reaches "done" once that delay elapses. Reading the counter at both moments is
  // what catches a second call whose increment landed late, after the first read below.
  const reachedOne = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${counter}')?.textContent.includes("subscribes: 1") ?? false`,
      ),
    500,
  )
  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  const final = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "a real double click on the sign-up form's submit button calls onSubmit once",
    reachedOne && settled && final.includes("subscribes: 1"),
    `counter reached "subscribes: 1" shortly after the double click: ${reachedOne}; region ` +
      `reached "You're subscribed…": ${settled}; counter once settled: "${final.trim()}"`,
  )
}

/**
 * The sign-up form: two `form.requestSubmit()` calls made in the same script turn,
 * with no real click and so no focus ever placed anywhere in the form.
 *
 * This is what isolates `EnhancedForm`'s synchronous busy guard from the disabled `<fieldset>` a
 * slower, real double click is also stopped by (see {@link signUpFormDoubleClickCheck}'s own
 * doc for the measurement) — `requestSubmit()` calls the form's submit algorithm directly, twice,
 * before either call yields back to the event loop for Preact to re-render anything. Only the ref
 * checked synchronously inside `handleSubmit`, before either branch runs, can catch that.
 *
 * The same run also proves the focus-theft fix: since nothing here ever focuses the form, the
 * region must never take focus once the (single, guarded) submit resolves, and the page must not
 * scroll — both of which the earlier version of this component did, for any submit that happened to
 * settle while `document.activeElement` was `<body>`, whether or not a visitor was ever engaging
 * with this particular form.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signUpFormRequestSubmitGuardCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const counter = `${card} [data-e2e="signup-form-subscribes"]`

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's request-submit card is ready to submit before this check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  // Blurred explicitly, rather than assumed: whatever an earlier check left focused (the live
  // region from `enhancedFormResultChecks`, say) must not still be inside this card by accident,
  // since this check's whole point is that nothing here ever focuses anything.
  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    document.activeElement?.blur?.()
    return null
  })()`)

  const scrollBefore = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
    .catch(() => -1)
  const focusedBefore = await devtools.evaluate<string>(
    `document.activeElement === document.body ? "body" : document.activeElement.tagName`,
  ).catch(() => "unreadable")

  await devtools.evaluate<null>(`(() => {
    const form = document.querySelector('${card} form')
    if (form) {
      form.requestSubmit()
      form.requestSubmit()
    }
    return null
  })()`)

  const reachedOne = await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.querySelector('${counter}')?.textContent.includes("subscribes: 1") ?? false`,
      ),
    1_000,
  )
  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  const final = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "two form.requestSubmit() calls in the same script turn call onSubmit once",
    focusedBefore === "body" && reachedOne && settled && final.includes("subscribes: 1"),
    focusedBefore !== "body"
      ? `focus was not on <body> before this check even started (${focusedBefore}), so it proves ` +
        "nothing about a submit nobody focused"
      : `counter reached "subscribes: 1" shortly after both calls: ${reachedOne}; region reached ` +
        `"You're subscribed…": ${settled}; counter once settled: "${final.trim()}"`,
  )

  const focusedRegionAfter = await regionHasFocus(devtools, card)
  const scrollAfter = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
    .catch(() => -2)

  check(
    "a submit nobody focused never steals focus or scrolls the page once it settles",
    !focusedRegionAfter && Math.abs(scrollAfter - scrollBefore) < 5,
    `region focused after settling: ${focusedRegionAfter}; scrollY ${scrollBefore} → ${scrollAfter}`,
  )
}

/**
 * The sign-up form: a real click on the submit button — focus genuinely lands
 * there, unlike {@link signUpFormRequestSubmitGuardCheck}'s `requestSubmit()` calls — and then,
 * while the 300ms submit is still outstanding, focus is moved to an unrelated element elsewhere on
 * the page, standing in for a visitor who submitted and then clicked or tabbed to read something
 * else entirely before the result came back.
 *
 * This is the second half of the focus-theft fix: focus being inside the form *at submit time* is
 * only one of the two conditions `EnhancedForm`'s effect checks. Once the result lands, focus must
 * still be sitting on `<body>` — the state disabling or removing the pressed control actually
 * produces — for the region to take it. A visitor who has since put focus somewhere specific of
 * their own accord is left exactly there, which is what this check asserts by aiming the dummy
 * element it creates for the purpose.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signUpFormFocusElsewhereCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const dummyId = "verify-focus-elsewhere-dummy"

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's focus-elsewhere card is ready to submit before this check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    return null
  })()`)

  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the click that starts this check lands on its own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return
  await clickAtPoint(devtools, point)

  // Moved away as soon as the submit is confirmed outstanding — a real visitor could not click
  // anywhere before the browser had actually disabled the button, and this check should not either.
  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  // The dummy control's whole lifetime — creating it, reading it back once settled — sits inside
  // this `try`, and removing it again sits inside the matching `finally`, so a throw in between
  // (a stalled poll, a page exception) does not leave a stray element behind on a page every check
  // after this one in the same run still shares.
  let movedAway = false
  let settled = false
  let stillOnDummy = false
  try {
    movedAway = await devtools.evaluate<boolean>(`(() => {
      const dummy = document.createElement("button")
      dummy.type = "button"
      dummy.id = ${JSON.stringify(dummyId)}
      dummy.textContent = "unrelated control"
      dummy.style.cssText = "position:fixed;top:0;left:0"
      document.body.appendChild(dummy)
      dummy.focus()
      return document.activeElement === dummy
    })()`).catch(() => false)

    settled = await poll(
      async () =>
        (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
      2_000,
    )
    stillOnDummy = await devtools.evaluate<boolean>(
      `document.activeElement === document.getElementById(${JSON.stringify(dummyId)})`,
    ).catch(() => false)
  } finally {
    await devtools.evaluate<null>(`(() => {
      document.getElementById(${JSON.stringify(dummyId)})?.remove()
      return null
    })()`).catch(() => null)
  }

  check(
    "a visitor who moved focus elsewhere mid-submit keeps it there once the result lands",
    sending && movedAway && settled && stillOnDummy,
    !sending
      ? "the fieldset never disabled — the click may not have started a real submit"
      : !movedAway
      ? "could not move focus to the dummy control"
      : `settled: ${settled}; focus still on the dummy control once it did: ${stillOnDummy}`,
  )
}

/**
 * The sign-up form: a real click on the submit button, then a blur to `<body>` —
 * not to a specific other control, {@link signUpFormFocusElsewhereCheck}'s own case — while the
 * submit is still outstanding, together with a scroll back to the top of the page.
 *
 * This is the one case the previous round's fix did not cover, because it is not a visitor whose
 * focus was never in the form ({@link signUpFormRequestSubmitGuardCheck}'s case): disabling the
 * fieldset for `"sending"` already drops focus to `<body>` in this browser, so the focus-restoring
 * effect recovers it there — correctly, the first time — before this same submit ever reaches
 * `"done"`. Without clearing the flag that let that first recovery happen, the effect's second run,
 * on the transition to `"done"`, would see the flag still set and `document.activeElement` back on
 * `<body>` — exactly what a visitor clicking on plain text and reading elsewhere also produces — and
 * pull focus back a second time for a visitor this component had already, correctly, let go of.
 *
 * **`#249`: two changes from how this check used to read the page.** First, it waits for the
 * component's own one-time recovery to land — the region holding focus — *before* it does its own
 * blur, rather than racing it: blurring to `<body>` while that recovery is still outstanding would
 * hand the still-set flag exactly the state (`<body>` focused) it treats as its own cue to recover
 * into, for a visitor this check had not yet finished setting up. Second, the blur, the scroll and
 * the first reading of both happen inside one `Runtime.evaluate`, before this check waits on
 * anything else — a separate, later read (the previous shape) can be a read of the *result's* own
 * effects if the submit happens to settle in between, which is a check reading its own setup after
 * the thing it means to guard against has already run. The scroll is `behavior: "instant"` for the
 * same reason `pages/verify.ts`'s own doc gives for `resetAfterThrow`'s identical call:
 * `pages/styles.css` sets `scroll-behavior: smooth` on the document, so a plain `scrollTo(0, 0)`
 * starts an animation still running when this reads `scrollY` right back — instant is what makes
 * that same-evaluate reading the settled position rather than a frame of the animation.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function signUpFormBlurWhileSendingCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="signup-form"]'
  const region = `${card} [role="status"]`

  const ready = await startOver(devtools, card)
  check(
    "the sign-up form's blur-while-sending card is ready to submit before this check begins",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const email = document.querySelector('${card} input[name="email"]')
    if (email) email.value = "ada@example.com"
    return null
  })()`)

  const point = await elementCenter(devtools, `${card} button[type="submit"]`)
  check(
    "the click that starts this check lands on its own submit button",
    point.ok,
    point.ok ? `(${point.x}, ${point.y})` : point.reason,
  )
  if (!point.ok) return
  await clickAtPoint(devtools, point)

  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  // Wait out the component's own one-time recovery before this check does its own blur — see the
  // JSDoc above. Not a formality: without this, the check's blur can land before that recovery has,
  // and the still-set flag then reads the check's own blur as its cue to recover into.
  const recovered = await poll(() => regionHasFocus(devtools, card), 2_000)

  // Blur, scroll and the first reading of both, in the one evaluate — before this waits on
  // anything else. `behavior: "instant"` is what makes `scrollY` already the settled value here
  // rather than a frame of a smooth-scroll animation still in flight.
  const scrollTarget = await devtools.evaluate<{ blurred: boolean; scrollY: number }>(`(() => {
    document.activeElement?.blur?.()
    globalThis.scrollTo({ top: 0, left: 0, behavior: "instant" })
    return {
      blurred: document.activeElement === document.body,
      scrollY: Math.round(globalThis.scrollY),
    }
  })()`).catch(() => ({ blurred: false, scrollY: -1 }))

  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("You're subscribed"),
    2_000,
  )
  await settledScroll(devtools)
  const after = await devtools.evaluate<{ onBody: boolean; onRegion: boolean; scrollY: number }>(
    `(() => ({
      onBody: document.activeElement === document.body,
      onRegion: document.activeElement === document.querySelector('${region}'),
      scrollY: Math.round(globalThis.scrollY),
    }))()`,
  ).catch(() => ({ onBody: false, onRegion: false, scrollY: -2 }))

  check(
    "a visitor who blurs to <body> and scrolls away while sending is not pulled back once it settles",
    sending && recovered && scrollTarget.blurred && settled && after.onBody &&
      after.scrollY === scrollTarget.scrollY,
    !sending
      ? "the fieldset never disabled — the click may not have started a real submit"
      : !recovered
      ? "the component's own one-time recovery never moved focus onto the live region before " +
        "this check blurred, so the blur below cannot be told apart from that recovery's own moment"
      : !scrollTarget.blurred
      ? "could not blur back to <body> — read in the same evaluate as the blur itself"
      : !settled
      ? "the card never reached its 'You're subscribed' result"
      : !after.onBody
      ? after.onRegion
        ? "the result pulled focus back onto the live region after this check had already, " +
          "deliberately, blurred to <body> — a visitor who had moved on to reading something " +
          "else would be dragged back to the form"
        : "focus left <body> for something other than the live region once the result landed"
      : `settled: ${settled}; scrollY ${scrollTarget.scrollY} → ${after.scrollY}`,
  )
}
