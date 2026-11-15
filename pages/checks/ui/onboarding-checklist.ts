import {
  centreInView,
  check,
  type Devtools,
  openGuidePage,
  poll,
  pressKey,
  settledScroll,
} from "../harness.ts"
import { clickAtPoint } from "./shared-forms.ts"

/** What {@link onboardingChecklistChecks} reads off the `OnboardingChecklist` card. */
interface OnboardingReading {
  /** `false` when the card's checklist is not on the page, as after Dismiss. */
  present: boolean
  /** The progress bar's `aria-valuenow`. */
  progress: string | null
  /** The progress caption. */
  caption: string
  /** The text of the step marked `aria-current="step"`, or `null` when none is. */
  current: string | null
  /** The footer's primary control's text, or `null` when there is none. */
  primary: string | null
  /** The footer's primary control's tag, `BUTTON` or `A`, or `null` when there is none. */
  primaryTag: string | null
  /** `true` when the footer's primary control has focus. */
  onPrimary: boolean
  /** `true` when the header's Dismiss button has focus. */
  onDismiss: boolean
  /** `true` when the card's heading has focus. */
  onHeading: boolean
  /** The status region's text. */
  status: string
  /** How many times the demo's `onDismiss` ran, from its readout. */
  dismissed: number
  /** The focused element, for a failure message. */
  active: string
}

/** Reads {@link OnboardingReading} off the `OnboardingChecklist` card in one round trip. */
const ONBOARDING_READING = `(() => {
  const demo = document.querySelector("#demo-OnboardingChecklist")
  const card = demo?.querySelector('[role="region"]') ?? null
  const active = document.activeElement
  const primary = card?.querySelector(".pc-card-footer :is(button, a)") ?? null
  const dismiss = card?.querySelector(".pc-card-header button") ?? null
  const heading = card?.querySelector(".pc-card-header :is(h2, h3, h4, h5, h6)") ?? null
  const count = demo?.querySelector('[data-e2e="onboarding-dismissed"]')?.textContent
    .match(/onDismiss calls: (\\d+)/)
  return {
    present: card !== null,
    progress: card?.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow") ?? null,
    caption: card?.querySelector(".pc-kpi-label")?.textContent ?? "",
    current: card?.querySelector('[aria-current="step"]')?.textContent.trim() ?? null,
    primary: primary?.textContent.trim() ?? null,
    primaryTag: primary?.tagName ?? null,
    onPrimary: primary !== null && active === primary,
    onDismiss: dismiss !== null && active === dismiss,
    onHeading: heading !== null && active === heading,
    status: card?.querySelector('[role="status"]')?.textContent.trim() ?? "",
    dismissed: count ? Number(count[1]) : -1,
    active: active === null || active === document.body
      ? "the page"
      : active.tagName + " " + (active.textContent ?? "").trim().slice(0, 40),
  }
})()`

/** Brings the card's checklist back in its starting state, through the demo's own button. */
const ONBOARDING_SHOW_AGAIN =
  `(document.querySelector('#demo-OnboardingChecklist [data-e2e="onboarding-show-again"]')?.click(), null)`

/**
 * `OnboardingChecklist`, driven by keyboard on its catalogue card (#583). The card starts with two
 * of six steps done; then come a step whose action is a button, one whose action is a link, one with
 * no action (the demo's "Pretend the e-mail link was opened" button completes it from outside the
 * card), and a last button step.
 *
 * From a real click on the heading, Tab reaches Dismiss and then the next step's action. Enter on
 * that button completes the step, and the next action is a link, a different element: focus has to
 * follow it into the footer rather than fall to the page. Enter on the link completes that step and
 * leaves a step with no action, so the footer goes away and focus moves to the heading. Once the
 * last step is done the same button turns into Finish with focus kept, and the status region fills.
 * Finish and the header's Dismiss each call the `onDismiss` port, which the demo counts.
 *
 * Link clicks are cancelled by a `document` listener for the whole function, so a broken
 * `navigate` cannot really move the page under the checks that follow.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function onboardingChecklistChecks(devtools: Devtools): Promise<void> {
  const read = () => devtools.evaluate<OnboardingReading>(ONBOARDING_READING)
  await openGuidePage(devtools, "ui")
  await devtools.evaluate<null>(`(() => {
    globalThis.__verifyOnboardingGuard = (event) => {
      if (event.target instanceof Element && event.target.closest("#demo-OnboardingChecklist a")) {
        event.preventDefault()
      }
    }
    document.addEventListener("click", globalThis.__verifyOnboardingGuard)
    return null
  })()`)
  try {
    await onboardingChecklistKeyboardChecks(devtools, read)
  } finally {
    await devtools.evaluate<null>(`(() => {
      document.removeEventListener("click", globalThis.__verifyOnboardingGuard)
      return null
    })()`)
    if (!(await read()).present) await devtools.evaluate<null>(ONBOARDING_SHOW_AGAIN)
  }
  try {
    await onboardingChecklistClickAwayCheck(devtools, read)
  } finally {
    await devtools.evaluate<null>(ONBOARDING_SHOW_AGAIN)
  }
}

/**
 * After the user clicks away from the footer's action, a step completed by a script leaves focus
 * and scroll where they are. Tab puts focus on the first open step's button, a real click on the
 * card's description (not focusable) drops it to the page, and the page goes back to the top. A
 * script then completes the step, so the button turns into a link: the card must not pull focus
 * into that link, which would also scroll the page back down to it.
 *
 * @param devtools The connected session, on the guide's `ui` page, with the card in its start state.
 * @param read Reads the card's {@link OnboardingReading}.
 */
async function onboardingChecklistClickAwayCheck(
  devtools: Devtools,
  read: () => Promise<OnboardingReading>,
): Promise<void> {
  const card = `document.querySelector('#demo-OnboardingChecklist [role="region"]')`
  await centreInView(devtools, `${card}?.querySelector("h2")`)
  const spots = await devtools.evaluate<{ x: number; y: number }[] | null>(`(() => {
    const heading = ${card}?.querySelector("h2")?.getBoundingClientRect()
    const blank = ${card}?.querySelector(".pc-card-body > p")?.getBoundingClientRect()
    if (!heading || !blank) return null
    return [
      { x: Math.round(heading.left + 4), y: Math.round(heading.top + heading.height / 2) },
      { x: Math.round(blank.left + 4), y: Math.round(blank.top + blank.height / 2) },
    ]
  })()`)
  if (spots !== null) await clickAtPoint(devtools, spots[0])
  await pressKey(devtools, "Tab")
  await pressKey(devtools, "Tab")
  const onButton = await read()
  if (spots !== null) await clickAtPoint(devtools, spots[1])
  const clickedAway = await read()
  await devtools.evaluate<null>(`(scrollTo({ top: 0, behavior: "instant" }), null)`)
  await settledScroll(devtools, { target: 0 })
  const before = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
  const offscreen = await devtools.evaluate<boolean>(
    `(${card}?.getBoundingClientRect().top ?? 0) > innerHeight`,
  )
  await devtools.evaluate<null>(`(${card}?.querySelector(".pc-card-footer button")?.click(), null)`)
  await poll(async () => (await read()).progress === "3", 3000)
  // A focus move would scroll smoothly and may start a few frames late, so watch for a full second
  // and keep the farthest the page moved.
  const scrolled = await devtools.evaluate<number>(`new Promise((resolve) => {
    let farthest = Math.round(globalThis.scrollY)
    const started = performance.now()
    const tick = () => {
      const now = Math.round(globalThis.scrollY)
      if (Math.abs(now - ${before}) > Math.abs(farthest - ${before})) farthest = now
      if (performance.now() - started < 1000) requestAnimationFrame(tick)
      else resolve(farthest)
    }
    requestAnimationFrame(tick)
  })`)
  const after = await read()
  check(
    "OnboardingChecklist: after the user clicks away, a step completed by script leaves focus and scroll alone",
    spots !== null && onButton.onPrimary && onButton.primary === "Invite a teammate" &&
      clickedAway.active === "the page" && offscreen && after.progress === "3" &&
      after.primaryTag === "A" && after.active === "the page" && scrolled === before,
    spots === null
      ? "no heading or description in the OnboardingChecklist card"
      : !onButton.onPrimary || onButton.primary !== "Invite a teammate"
      ? `two Tabs from the heading landed on ${onButton.active}, not "Invite a teammate"`
      : clickedAway.active !== "the page"
      ? `clicking the description left focus on ${clickedAway.active}`
      : !offscreen
      ? `the card was still in view after scrolling to the top (scrollY ${before})`
      : after.progress !== "3" || after.primaryTag !== "A"
      ? `the scripted click did not complete the step (aria-valuenow ${after.progress}, ` +
        `footer ${after.primaryTag})`
      : `focus on ${after.active}, scrollY ${before} before and up to ${scrolled} after`,
  )
}

/**
 * The body of {@link onboardingChecklistChecks}, inside its link guard.
 *
 * @param devtools The connected session, on the guide's `ui` page.
 * @param read Reads the card's {@link OnboardingReading}.
 */
async function onboardingChecklistKeyboardChecks(
  devtools: Devtools,
  read: () => Promise<OnboardingReading>,
): Promise<void> {
  const heading = `document.querySelector('#demo-OnboardingChecklist [role="region"] h2')`
  await centreInView(devtools, heading)
  const spot = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const box = ${heading}?.getBoundingClientRect()
    return box ? { x: Math.round(box.left + 4), y: Math.round(box.top + box.height / 2) } : null
  })()`)
  const start = await read()
  if (spot !== null) await clickAtPoint(devtools, spot)

  await pressKey(devtools, "Tab")
  const first = await read()
  await pressKey(devtools, "Tab")
  const second = await read()
  check(
    "OnboardingChecklist: Tab reaches Dismiss and then the next step's action",
    spot !== null && start.progress === "2" && first.onDismiss && second.onPrimary &&
      second.primary === "Invite a teammate",
    spot === null
      ? "no OnboardingChecklist heading in the card"
      : start.progress !== "2"
      ? `the card did not start with 2 steps done (aria-valuenow ${start.progress})`
      : !first.onDismiss
      ? `the first Tab from the heading landed on ${first.active}, not Dismiss`
      : !second.onPrimary
      ? `the second Tab landed on ${second.active}, not the footer's action`
      : second.primary !== "Invite a teammate"
      ? `the footer offers "${second.primary}", not the first open step`
      : `Dismiss, then the footer's "${second.primary}"`,
  )

  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).progress === "3", 3000)
  const toLink = await read()
  check(
    "OnboardingChecklist: when a button step is done and the next action is a link, focus moves to that link",
    toLink.progress === "3" && toLink.caption === "3 of 6 done" && toLink.primaryTag === "A" &&
      toLink.primary === "Turn on notifications" && toLink.onPrimary &&
      (toLink.current ?? "").includes("Turn on notifications"),
    `progress ${toLink.progress}, caption "${toLink.caption}", footer ${toLink.primaryTag} ` +
      `"${toLink.primary}", current step "${toLink.current}", focus on ${toLink.active}`,
  )

  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).progress === "4", 3000)
  const noAction = await read()
  check(
    "OnboardingChecklist: when the next step has no action, the footer goes and focus moves to the heading",
    noAction.progress === "4" && noAction.primary === null && noAction.onHeading &&
      (noAction.current ?? "").includes("Confirm your e-mail"),
    `progress ${noAction.progress}, footer "${noAction.primary}", current step ` +
      `"${noAction.current}", focus on ${noAction.active}`,
  )

  await devtools.evaluate<null>(
    `(document.querySelector('#demo-OnboardingChecklist [data-e2e="onboarding-confirm-email"]')?.click(), null)`,
  )
  await poll(async () => (await read()).progress === "5", 3000)
  await pressKey(devtools, "Tab")
  await pressKey(devtools, "Tab")
  const lastStep = await read()
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).progress === "6", 3000)
  const finished = await read()
  check(
    "OnboardingChecklist: completing the last step turns the action into Finish, keeps focus and announces the message",
    lastStep.onPrimary && lastStep.primary === "Import your data" && finished.progress === "6" &&
      finished.primary === "Finish" && finished.onPrimary && finished.current === null &&
      finished.status === "All done. You're set up.",
    !lastStep.onPrimary || lastStep.primary !== "Import your data"
      ? `two Tabs from the heading reached ${lastStep.active}, not "Import your data"`
      : `progress ${finished.progress}, footer "${finished.primary}", current step ` +
        `"${finished.current}", status "${finished.status}", focus on ${finished.active}`,
  )

  await pressKey(devtools, "Enter")
  await poll(async () => !(await read()).present, 3000)
  const afterFinish = await read()
  await devtools.evaluate<null>(ONBOARDING_SHOW_AGAIN)
  await poll(async () => (await read()).progress === "2", 3000)
  const shown = await read()
  await devtools.evaluate<null>(
    `(document.querySelector('#demo-OnboardingChecklist .pc-card-header button')?.focus(), null)`,
  )
  const focusedDismiss = (await read()).onDismiss
  await pressKey(devtools, "Enter")
  await poll(async () => !(await read()).present, 3000)
  const afterDismiss = await read()
  check(
    "OnboardingChecklist: Finish and Dismiss each call the onDismiss port once",
    !afterFinish.present && afterFinish.dismissed === start.dismissed + 1 &&
      shown.present && focusedDismiss && !afterDismiss.present &&
      afterDismiss.dismissed === start.dismissed + 2,
    `dismissed ${start.dismissed} at the start, ${afterFinish.dismissed} after Finish ` +
      `(card ${afterFinish.present ? "still shown" : "gone"}), ${afterDismiss.dismissed} after ` +
      `Dismiss (card ${afterDismiss.present ? "still shown" : "gone"}, Dismiss ` +
      `${focusedDismiss ? "had" : "did not have"} focus)`,
  )
}
