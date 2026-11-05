import { check, type Devtools, poll } from "../harness.ts"
import {
  enhancedFormReading,
  fillContact,
  HONEYPOT_INPUT_SELECTOR,
  setToggle,
  startOver,
} from "./shared-forms.ts"

/**
 * The contact form — the same proof {@link enhancedFormsHoneypotChecks}
 * runs against the sign-up form, on the three-field form instead: a filled honeypot resolves as a
 * success without ever calling `onSubmit`.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function contactFormHoneypotCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'
  const counter = `${card} [data-e2e="contact-form-leads"]`

  const ready = await startOver(devtools, card)
  check("the contact form's honeypot card is ready to submit", ready.ok, ready.reason)
  if (!ready.ok) return

  await devtools.evaluate<null>(`(() => {
    const name = document.querySelector('${card} input[name="name"]')
    const email = document.querySelector('${card} input[name="email"]')
    const message = document.querySelector('${card} textarea[name="message"]')
    const hp = document.querySelector('${card} ${HONEYPOT_INPUT_SELECTOR}')
    if (name) name.value = "Bot Botson"
    if (email) email.value = "bot@example.com"
    if (message) message.value = "Automated message."
    if (hp) hp.value = "http://spam.example"
    return null
  })()`)

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const settled = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("Thanks"),
    2_000,
  )
  const calls = await devtools.evaluate<string>(
    `document.querySelector('${counter}')?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")

  check(
    "the contact form: a filled honeypot resolves as a success without ever calling onSubmit",
    settled && calls.includes("leads: 0"),
    `region reached "Thanks…": ${settled} even though onSubmit's own counter reads "${calls.trim()}"`,
  )
}

/**
 * The contact form's card, submitted normally (no failure, no hang) and reset via a synthetic
 * `pageshow` while its 200ms submit is still outstanding.
 *
 * This is *not* a proof that a genuine back/forward-cache restore fires `pageshow` — that proof is
 * {@link enhancedFormBackForwardCacheCheck}, which drives a real one. This check needs a
 * deterministic, precisely-timed trigger for a narrower thing: does a promise that settles *after*
 * a reset get ignored, rather than resurrecting a status the reset already moved past. A dispatched
 * event is the right tool for that — it tests this component's own listener reacting to the event
 * it is written to handle, not whether the browser's bfcache genuinely produces one, which is a
 * platform contract and not this library's to prove.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function contactFormStaleSubmitCheck(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'

  const ready = await startOver(devtools, card)
  check(
    "the contact form's card is ready to submit before the stale-submit check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await fillContact(devtools, card)
  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const sending = await poll(
    async () => (await enhancedFormReading(devtools, card)).disabled,
    1_000,
  )

  await devtools.evaluate<null>(
    `(globalThis.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })), null)`,
  )
  const resetToIdle = await poll(async () => {
    const reading = await enhancedFormReading(devtools, card)
    return !reading.disabled && reading.region === ""
  }, 1_000)

  // A fixed wait, not a poll: it proves the sending state does not come back, and an absence has no
  // state to poll for. The demo's own submit resolves after 200ms; wait past it so the now-stale
  // promise has settled.
  await new Promise((resolve) => setTimeout(resolve, 500))
  const stillIdle = await enhancedFormReading(devtools, card)

  check(
    "a submit that settles after a pageshow reset does not resurrect the sending state",
    sending && resetToIdle && stillIdle.region === "" && !stillIdle.disabled,
    `fieldset disabled while pending: ${sending}; reset to idle: ${resetToIdle}; half a second ` +
      `after the reset, region reads "${stillIdle.region}" and fieldset disabled: ` +
      `${stillIdle.disabled}`,
  )
}

/**
 * The contact form's card: a rejected submit ends the sending state and leaves every field on
 * screen, still holding what the visitor typed, and then an actual second submit — the failure
 * toggle turned off, the same fields resubmitted rather than refilled — proves "leaves the fields
 * for a retry" is true of a real retry, not only of what happens to still be on screen a moment
 * after the first submit failed.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function contactFormFailureRetryChecks(devtools: Devtools): Promise<void> {
  const card = '#demo-EnhancedForm [data-e2e="contact-form"]'
  const toggle = `${card} [data-e2e="contact-form-fail-toggle"]`

  const ready = await startOver(devtools, card)
  check(
    "the contact form's card is ready to submit before the failure-retry check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return

  await fillContact(devtools, card)
  const toggledOn = await setToggle(devtools, toggle, true)
  check(
    "the contact form's fail toggle switches on",
    toggledOn,
    `fail toggle switched on: ${toggledOn}`,
  )
  if (!toggledOn) return

  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )

  const failed = await poll(
    async () =>
      (await enhancedFormReading(devtools, card)).region ===
        "Something went wrong. Try again.",
    2_000,
  )
  const afterFailure = await enhancedFormReading(devtools, card)
  const nameKept = await devtools.evaluate<string>(
    `document.querySelector('${card} input[name="name"]')?.value ?? ""`,
  ).catch(() => "")

  check(
    "a rejected contact-form submit ends the sending state and leaves the fields on screen",
    failed && !afterFailure.disabled && nameKept === "Ada Lovelace",
    `region reached the failure text: ${failed} ("${afterFailure.region}"); fieldset disabled ` +
      `once settled: ${afterFailure.disabled}; name field kept "${nameKept}"`,
  )

  const toggledOff = await setToggle(devtools, toggle, false)
  check(
    "the contact form's fail toggle switches back off",
    toggledOff,
    `fail toggle switched off: ${toggledOff}`,
  )
  if (!toggledOff) return

  // The actual retry: the same fields, submitted again, with no refill.
  await devtools.evaluate<null>(
    `(document.querySelector('${card} button[type="submit"]')?.click(), null)`,
  )
  const succeeded = await poll(
    async () => (await enhancedFormReading(devtools, card)).region.startsWith("Thanks"),
    2_000,
  )
  const doneShown = await devtools.evaluate<boolean>(
    `document.querySelector('${card}')?.textContent.includes("Thanks") ?? false`,
  ).catch(() => false)

  check(
    "turning the failure off and pressing submit again — the actual retry — succeeds",
    succeeded && doneShown,
    `region reached "Thanks…": ${succeeded}; the done slot is on screen: ${doneShown}`,
  )
}
