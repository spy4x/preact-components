import { check, type Devtools, poll } from "../harness.ts"
import {
  cardCanSubmit,
  clickAtPoint,
  elementCenter,
  enhancedFormReading,
  regionHasFocus,
  setToggle,
  startOver,
} from "./shared-forms.ts"

/** The controlled `EnhancedForm` demo: its caller holds the status and the form says nothing. */
const CONTROLLED_CARD = '#demo-EnhancedForm [data-e2e="controlled-form"]'

/** The caller's own message line under the controlled demo, or `"MISSING"`. */
async function controlledMessage(devtools: Devtools): Promise<string> {
  return await devtools.evaluate<string>(
    `document.querySelector('${CONTROLLED_CARD} [data-e2e="controlled-form-message"]')` +
      `?.textContent ?? "MISSING"`,
  ).catch(() => "MISSING")
}

/** The controlled demo's submit counter text, or `"MISSING"`. */
async function controlledSubmits(devtools: Devtools): Promise<string> {
  return await devtools.evaluate<string>(
    `document.querySelector('${CONTROLLED_CARD} [data-e2e="controlled-form-submits"]')` +
      `?.textContent.trim() ?? "MISSING"`,
  ).catch(() => "MISSING")
}

/**
 * The controlled demo: a second `form.requestSubmit()` while the caller's `status` reads
 * `"sending"` is refused.
 *
 * The demo's `onSubmit` returns at once and its "request" finishes 600ms later on a timer, so the
 * promise `EnhancedForm` itself waits on settles within a few microtasks. By the time the fieldset
 * reads disabled — the caller's `"sending"` has rendered — that promise is long settled, and the
 * only thing left that can refuse the second submit is the guard on the caller's status.
 * `requestSubmit()` is not stopped by a disabled `<fieldset>`, so the fieldset cannot do it either.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function controlledFormBusyGuardCheck(devtools: Devtools): Promise<void> {
  const ready = await startOver(devtools, CONTROLLED_CARD)
  check(
    "the controlled EnhancedForm demo is ready to submit before its busy-guard check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return
  const off = await setToggle(
    devtools,
    `${CONTROLLED_CARD} [data-e2e="controlled-form-fail-toggle"]`,
    false,
  )
  check(
    "the controlled demo's fail toggle is off before its busy-guard check",
    off,
    off ? "the toggle reads off" : "the toggle could not be switched off",
  )

  await devtools.evaluate<null>(`(() => {
    document.activeElement?.blur?.()
    document.querySelector('${CONTROLLED_CARD} form')?.requestSubmit()
    return null
  })()`)
  const sending = await poll(
    async () => (await enhancedFormReading(devtools, CONTROLLED_CARD)).disabled,
    1_000,
  )
  const second = await devtools.evaluate<string>(`(() => {
    const form = document.querySelector('${CONTROLLED_CARD} form')
    if (!form) return "no form"
    form.requestSubmit()
    return "submitted"
  })()`)
  const settled = await poll(
    async () => (await controlledMessage(devtools)) === "Your note is saved.",
    3_000,
  )
  const submits = await controlledSubmits(devtools)
  const reading = await enhancedFormReading(devtools, CONTROLLED_CARD)

  check(
    "the controlled EnhancedForm refuses a second submit while the caller's status is sending",
    sending && second === "submitted" && settled && submits === "submits: 1",
    `fieldset disabled by the caller's "sending": ${sending}; second requestSubmit: ${second}; ` +
      `caller reached "done": ${settled}; counter once settled: "${submits}"`,
  )
  check(
    "the controlled EnhancedForm with empty labels announces nothing once the caller reaches done",
    settled && reading.region === "",
    `region text "${reading.region}"`,
  )
}

/**
 * The controlled demo, submitted by a real click with the fail toggle on: the fieldset stays
 * disabled for as long as the caller says `"sending"`, focus moves to the form's own region once
 * the pressed button is disabled, and the caller's `"failed"` re-enables the fields for a retry
 * while the form itself says nothing.
 *
 * The 150ms wait after the caller's "Saving…" appears is what tells the caller's status from the
 * form's own: the form's own promise settles within microtasks of the submit, so a fieldset that
 * followed the form's state instead of the caller's would already be enabled again by then.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function controlledFormFailureFocusCheck(devtools: Devtools): Promise<void> {
  const toggle = `${CONTROLLED_CARD} [data-e2e="controlled-form-fail-toggle"]`
  const ready = await startOver(devtools, CONTROLLED_CARD)
  check(
    "the controlled EnhancedForm demo is ready to submit before its failure check",
    ready.ok,
    ready.reason,
  )
  if (!ready.ok) return
  const on = await setToggle(devtools, toggle, true)
  check(
    "the controlled demo's fail toggle switches on",
    on,
    on ? "the toggle reads on" : "the toggle could not be switched on",
  )

  try {
    const point = await elementCenter(devtools, `${CONTROLLED_CARD} button[type="submit"]`)
    check(
      "the click that submits the controlled demo lands on its own submit button",
      point.ok,
      point.ok ? `(${point.x}, ${point.y})` : point.reason,
    )
    if (!point.ok) return
    await clickAtPoint(devtools, point)

    const saving = await poll(
      async () => (await controlledMessage(devtools)) === "Saving your note…",
      1_000,
    )
    await poll(
      async () =>
        (await enhancedFormReading(devtools, CONTROLLED_CARD)).disabled &&
        await regionHasFocus(devtools, CONTROLLED_CARD),
      1_000,
    )
    const during = await enhancedFormReading(devtools, CONTROLLED_CARD)
    const focusedDuring = await regionHasFocus(devtools, CONTROLLED_CARD)
    check(
      "the controlled EnhancedForm keeps its fieldset disabled while the caller's status is sending",
      saving && during.disabled,
      `caller showed "Saving your note…": ${saving}; fieldset disabled while saving: ` +
        `${during.disabled}`,
    )
    check(
      "the controlled EnhancedForm moves focus to its region once the pressed button is disabled",
      focusedDuring,
      focusedDuring ? "the region holds focus" : "focus is not on the region",
    )

    const failed = await poll(
      async () => (await controlledMessage(devtools)) === "The server said no. Try again.",
      3_000,
    )
    const after = await enhancedFormReading(devtools, CONTROLLED_CARD)
    const canRetry = await cardCanSubmit(devtools, CONTROLLED_CARD)
    check(
      "the caller's failed status re-enables the controlled form's fields, and the form says nothing",
      failed && canRetry.ok && after.region === "",
      `caller reached "failed": ${failed}; ready to retry: ${canRetry.ok || canRetry.reason}; ` +
        `region text "${after.region}"`,
    )
  } finally {
    await setToggle(devtools, toggle, false)
  }
}
