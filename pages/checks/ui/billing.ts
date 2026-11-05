import {
  centreInView,
  check,
  CONTRAST_HELPERS,
  type Devtools,
  PAGE_UNTIL,
  pointerToCorner,
  poll,
  pressKey,
} from "../harness.ts"
import {
  clickAtPoint,
  elementCenter,
  requestBody,
  waitForNavigation,
  waitForRequest,
} from "./shared-forms.ts"
import { restoreHydratedPage } from "./shared-links.ts"

/** The pricing table's catalogue card. */
const PRICING = "#demo-PricingTable"

/** The interval toggle's label for `interval` (`month` or `year`) in the pricing card. */
function intervalLabel(interval: "month" | "year"): string {
  return `${PRICING} label:has(> input[data-pricing-interval="${interval}"])`
}

/** The "Choose" button of one plan in the pricing card. */
function chooseButton(plan: string): string {
  return `${PRICING} li[data-plan="${plan}"] button[type="submit"]`
}

/** What the pricing card shows: which interval is checked, which plans are on screen. */
interface PricingState {
  checked: string
  visible: string[]
  focused: string
  focusRing: string
}

/** Reads the pricing card's checked interval, its plans on screen and the focused radio. */
function pricingState(devtools: Devtools): Promise<PricingState> {
  return devtools.evaluate<PricingState>(`(() => {
    const card = document.querySelector('${PRICING}')
    const checked = card?.querySelector("input[data-pricing-interval]:checked")
    const focused = document.activeElement?.closest?.('${PRICING}')
      ? document.activeElement.dataset.pricingInterval ?? document.activeElement.tagName
      : "outside the card"
    const label = document.activeElement?.closest?.("label")
    return {
      checked: checked ? checked.dataset.pricingInterval : "none",
      visible: [...(card?.querySelectorAll("li[data-plan]") ?? [])]
        .filter((item) => item.getBoundingClientRect().height > 0)
        .map((item) => item.dataset.plan),
      focused,
      focusRing: label ? getComputedStyle(label).boxShadow : "no label",
    }
  })()`).catch(() => ({ checked: "unreadable", visible: [], focused: "", focusRing: "" }))
}

/**
 * Every billing check: the interval toggle by keyboard, choosing a plan through `onChoose` and
 * through the plain form post, the same toggle and post on a page that runs no script, the
 * past-due warning, a pending form refusing a submit, focus staying on or returning to the
 * submit button, a failing callback reported and shown, and the contrast of every new text in
 * both palettes.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function billingChecks(devtools: Devtools): Promise<void> {
  await pricingIntervalKeyboardCheck(devtools)
  await pricingCallbackCheck(devtools)
  await pricingPendingCheck(devtools)
  await billingSyncFocusCheck(devtools, PRICING_DEMO)
  await billingPendingFocusCheck(devtools, PRICING_DEMO)
  await billingFailureCheck(devtools, PRICING_DEMO, "Enter", true)
  await pricingFormPostCheck(devtools)
  await pricingNoScriptChecks(devtools)
  await planCardPastDueCheck(devtools)
  await planCardPendingCheck(devtools)
  await billingSyncFocusCheck(devtools, PLAN_DEMO)
  await billingPendingFocusCheck(devtools, PLAN_DEMO)
  await billingFailureCheck(devtools, PLAN_DEMO, "click", false)
  await planCardPausedCheck(devtools)
  await billingContrastCheck(devtools)
}

/**
 * The pricing card's interval toggle moves with the arrow keys and shows only that interval's
 * plans, with the free plan under both. A real click on "Monthly" gives the radio focus first, so
 * the arrow keys reach it the way they do after Tab.
 */
async function pricingIntervalKeyboardCheck(devtools: Devtools): Promise<void> {
  const monthly = await elementCenter(devtools, intervalLabel("month"))
  if (monthly.ok) await clickAtPoint(devtools, monthly)
  const before = await pricingState(devtools)
  await pressKey(devtools, "ArrowRight")
  await poll(async () => (await pricingState(devtools)).checked === "year", 2_000)
  const yearly = await pricingState(devtools)
  await pressKey(devtools, "ArrowLeft")
  await poll(async () => (await pricingState(devtools)).checked === "month", 2_000)
  const back = await pricingState(devtools)

  check(
    "the PricingTable interval toggle moves to yearly with ArrowRight and shows only yearly plans",
    monthly.ok && before.checked === "month" &&
      before.visible.join() === "free,pro-month,business-month" &&
      yearly.checked === "year" && yearly.focused === "year" &&
      yearly.visible.join() === "free,pro-year,business-year",
    !monthly.ok
      ? `could not aim at the Monthly option: ${monthly.reason}`
      : `before ${JSON.stringify(before)}, after ArrowRight ${JSON.stringify(yearly)}`,
  )
  check(
    "the PricingTable interval toggle draws a focus ring on the focused option",
    // ring-2 with ring-offset-2 draws a 4px spread; no ring leaves only transparent 0px shadows.
    yearly.focusRing.includes(" 0px 0px 0px 4px"),
    `box-shadow of the focused option's label: ${yearly.focusRing}`,
  )
  check(
    "the PricingTable interval toggle moves back to monthly with ArrowLeft",
    back.checked === "month" && back.visible.join() === "free,pro-month,business-month",
    JSON.stringify(back),
  )
}

/**
 * With `onChoose` given, a real click on a plan's "Choose" hands the plan to the callback and sends
 * no request: the page stays where it is.
 */
async function pricingCallbackCheck(devtools: Devtools): Promise<void> {
  const before = await devtools.evaluate<string>("location.href")
  const button = await elementCenter(devtools, chooseButton("pro-month"))
  const request = waitForRequest(devtools, "form-demo", 1_500)
  if (button.ok) await clickAtPoint(devtools, button)
  const sent = await request
  const chosen = await devtools.evaluate<string>(
    `document.querySelector('${PRICING} [data-e2e="pricing-chosen"]')?.textContent ?? ""`,
  ).catch(() => "")
  const after = await devtools.evaluate<string>("location.href").catch(() => "")

  check(
    "choosing a PricingTable plan with onChoose hands its plan to the callback and posts nothing",
    button.ok && chosen === "pro-month" && sent === null && after === before,
    !button.ok
      ? `could not aim at Choose Pro: ${button.reason}`
      : `callback got "${chosen}", request ${sent ? sent.method : "none"}, ` +
        `location ${before} → ${after}`,
  )
}

/**
 * With `onChoose` switched off, a real click on "Choose" posts the plan's form: a POST to the
 * form's action carrying `planId`. The page is reloaded and rehydrated afterwards.
 */
async function pricingFormPostCheck(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")
  try {
    const toggle = await elementCenter(
      devtools,
      `${PRICING} [data-e2e="pricing-callback-toggle"]`,
    )
    if (toggle.ok) await clickAtPoint(devtools, toggle)
    const off = await poll(
      () =>
        devtools.evaluate<boolean>(
          `document.querySelector('${PRICING} [data-e2e="pricing-callback-toggle"]')?.checked === false`,
        ).catch(() => false),
      2_000,
    )
    const button = await elementCenter(devtools, chooseButton("business-month"))
    const request = waitForRequest(devtools, "form-demo", 10_000)
    if (off && button.ok) await clickAtPoint(devtools, button)
    const sent = off && button.ok ? await request : null
    const body = sent ? await requestBody(devtools, sent) : ""
    const navigated = sent !== null && await waitForNavigation(devtools)

    check(
      "choosing a PricingTable plan without onChoose posts its form with the plan's ID",
      sent !== null && sent.method === "POST" && body === "planId=business-month" && navigated,
      !off
        ? "the onChoose toggle did not switch off"
        : !button.ok
        ? `could not aim at Choose Business: ${button.reason}`
        : sent === null
        ? "no request to form-demo/ was captured"
        : `method ${sent.method}, body ${JSON.stringify(body)}, navigated ${navigated}`,
    )
  } finally {
    await restoreHydratedPage(devtools, restoreUrl, "the plain PricingTable post")
  }
}

/**
 * On a page that runs no script, the pricing card's interval toggle still moves with the arrow
 * keys and hides the other interval's plans (a CSS rule does it), and "Choose" posts the plan's
 * form. Script execution is disabled before a reload, as `enhancedFormsNoScriptChecks` does.
 */
async function pricingNoScriptChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")
  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForNavigation(devtools)
    const unhydrated = loaded &&
      await devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated !== "true"`)
        .catch(() => false)

    const monthly = await elementCenter(devtools, intervalLabel("month"))
    if (monthly.ok) await clickAtPoint(devtools, monthly)
    await pressKey(devtools, "ArrowRight")
    await poll(async () => (await pricingState(devtools)).checked === "year", 2_000)
    const yearly = await pricingState(devtools)

    check(
      "with no script running, the PricingTable interval toggle moves by keyboard and hides the " +
        "other interval's plans",
      unhydrated && monthly.ok && yearly.checked === "year" &&
        yearly.visible.join() === "free,pro-year,business-year",
      !unhydrated
        ? "the fresh load still hydrated, so this proves nothing about a page with no script"
        : !monthly.ok
        ? `could not aim at the Monthly option: ${monthly.reason}`
        : JSON.stringify(yearly),
    )

    const button = await elementCenter(devtools, chooseButton("pro-year"))
    const request = waitForRequest(devtools, "form-demo", 10_000)
    if (button.ok) await clickAtPoint(devtools, button)
    const sent = button.ok ? await request : null
    const body = sent ? await requestBody(devtools, sent) : ""
    const navigated = sent !== null && await waitForNavigation(devtools)
    const answer = navigated
      ? await devtools.evaluate<string>(
        `document.querySelector('[data-e2e="form-demo-answer"]')?.textContent ?? ""`,
      ).catch(() => "")
      : ""

    check(
      "with no script running, choosing a PricingTable plan posts its form with the plan's ID",
      unhydrated && sent !== null && sent.method === "POST" && body === "planId=pro-year" &&
        answer.includes("Thanks"),
      !button.ok
        ? `could not aim at Choose Pro (yearly): ${button.reason}`
        : sent === null
        ? "no request to form-demo/ was captured"
        : `method ${sent.method}, body ${JSON.stringify(body)}, answer ${
          JSON.stringify(answer.slice(0, 40))
        }`,
    )
  } finally {
    await restoreHydratedPage(devtools, restoreUrl, "the no-script PricingTable checks")
  }
}

/** What a billing card's pending forms show, read by {@link billingPendingState}. */
interface BillingPendingState {
  /** The demo's count of `onChoose` or `onSubmit` calls. */
  calls: string
  /** How many forms the card holds, hidden ones included. */
  forms: number
  /** How many of the card's forms sit in a disabled fieldset. */
  disabled: number
  /** Each form's live region text, in page order. */
  regions: string[]
  location: string
}

/**
 * Reads a billing card's call count, its disabled forms and their live regions.
 *
 * @param card The card's selector.
 * @param calls The selector of the demo's call count.
 */
function billingPendingState(
  devtools: Devtools,
  card: string,
  calls: string,
): Promise<BillingPendingState> {
  return devtools.evaluate<BillingPendingState>(`(() => {
    const card = document.querySelector('${card}')
    return {
      calls: document.querySelector('${calls}')?.textContent ?? "",
      forms: card?.querySelectorAll("form").length ?? -1,
      disabled: card?.querySelectorAll("form fieldset:disabled").length ?? -1,
      regions: [...(card?.querySelectorAll("form [role=status]") ?? [])]
        .map((region) => region.textContent),
      location: location.href,
    }
  })()`).catch(() => ({ calls: "unreadable", forms: -1, disabled: -1, regions: [], location: "" }))
}

/**
 * The middle of an element, read straight from its box. A disabled button takes no pointer
 * events, so `elementCenter`'s hit test would refuse to aim at it; a click here lands on
 * whatever the page puts under that point, the way a person's click on a greyed button does.
 */
async function boxCenter(
  devtools: Devtools,
  selector: string,
): Promise<{ x: number; y: number } | null> {
  await centreInView(devtools, `document.querySelector('${selector}')`)
  return await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const el = document.querySelector('${selector}')
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })()`).catch(() => null)
}

/**
 * Gives a button focus the way a script can, then presses a real Enter. A disabled button cannot
 * take focus, so a pending form's button is left unfocused and the Enter reaches nothing.
 *
 * @returns Whether the button held focus when Enter was pressed.
 */
async function focusAndEnter(devtools: Devtools, selector: string): Promise<boolean> {
  const focused = await devtools.evaluate<boolean>(`(() => {
    const el = document.querySelector('${selector}')
    el?.focus()
    return document.activeElement === el
  })()`).catch(() => false)
  await pressKey(devtools, "Enter")
  return focused
}

/** Clicks a demo's "Clear pending" button and waits until no form of the card is disabled. */
async function clearPending(devtools: Devtools, button: string, card: string): Promise<boolean> {
  const clear = await elementCenter(devtools, button)
  if (clear.ok) await clickAtPoint(devtools, clear)
  return await poll(
    async () => (await billingPendingState(devtools, card, button)).disabled === 0,
    2_000,
  )
}

/**
 * A pending `PricingTable` refuses a second choice. The demo's `onChoose` marks the table pending,
 * as an app does while it opens checkout, and {@link pricingCallbackCheck} has just chosen once, so
 * a real click on the now greyed "Choose" calls nothing and posts nothing. After "Clear pending", a
 * real Enter on a focused "Choose" calls `onChoose` once, announces the wait from that plan's form
 * alone, and a second Enter finds the button unfocusable and calls nothing.
 */
async function pricingPendingCheck(devtools: Devtools): Promise<void> {
  const calls = `${PRICING} [data-e2e="pricing-calls"]`
  const clearButton = `${PRICING} [data-e2e="pricing-clear-pending"]`
  const state = () => billingPendingState(devtools, PRICING, calls)

  const before = await state()
  const point = await boxCenter(devtools, chooseButton("pro-month"))
  const clickRequest = waitForRequest(devtools, "form-demo", 1_500)
  if (point) await clickAtPoint(devtools, point)
  const clickSent = await clickRequest
  const afterClick = await state()

  check(
    "a pending PricingTable refuses a real click on Choose: onChoose is not called and nothing posts",
    point !== null && before.calls === "1" && before.forms > 1 &&
      before.disabled === before.forms &&
      afterClick.calls === "1" && clickSent === null && afterClick.location === before.location,
    point === null
      ? "could not find Choose Pro"
      : `before ${JSON.stringify(before)}, after the click ${JSON.stringify(afterClick)}, ` +
        `request ${clickSent ? clickSent.method : "none"}`,
  )

  const cleared = await clearPending(devtools, clearButton, PRICING)
  const firstFocused = await focusAndEnter(devtools, chooseButton("business-month"))
  await poll(async () => (await state()).disabled === before.forms, 2_000)
  const afterFirst = await state()
  const enterRequest = waitForRequest(devtools, "form-demo", 1_500)
  const secondFocused = await focusAndEnter(devtools, chooseButton("business-month"))
  const enterSent = await enterRequest
  const afterSecond = await state()
  const restored = await clearPending(devtools, clearButton, PRICING)

  check(
    "a PricingTable choice by Enter calls onChoose once, and the pending table refuses a second Enter",
    cleared && firstFocused && afterFirst.calls === "2" &&
      afterFirst.disabled === before.forms &&
      !secondFocused && afterSecond.calls === "2" && enterSent === null &&
      afterSecond.location === before.location && restored,
    `cleared ${cleared}, first Enter focused ${firstFocused} → ${JSON.stringify(afterFirst)}, ` +
      `second Enter focused ${secondFocused} → ${JSON.stringify(afterSecond)}, ` +
      `request ${enterSent ? enterSent.method : "none"}, cleared again ${restored}`,
  )
  check(
    "a pending PricingTable announces the wait from the chosen plan's form alone",
    afterFirst.regions.filter((text) => text === "One moment…").length === 1 &&
      afterFirst.regions.filter((text) => text !== "").length === 1,
    JSON.stringify(afterFirst.regions),
  )
}

/** The `PlanCard` catalogue card. */
const PLAN_CARDS = "#demo-PlanCard"

/** The first card's "Manage billing", the one whose `onSubmit` the demo wires up. */
const PLAN_MANAGE = `${PLAN_CARDS} [data-status="2"] button[type="submit"]`

/**
 * A pending `PlanCard` refuses a second submit. The demo's first card hands "Manage billing" to
 * `onSubmit`, which marks the card pending. A real Enter calls it once and announces the wait; a
 * real click on the greyed button and a second Enter then call nothing and post nothing. Once
 * cleared, a real click calls it again, so the click path reaches `onSubmit` too.
 */
async function planCardPendingCheck(devtools: Devtools): Promise<void> {
  const calls = `${PLAN_CARDS} [data-e2e="plan-calls"]`
  const clearButton = `${PLAN_CARDS} [data-e2e="plan-clear-pending"]`
  const state = () => billingPendingState(devtools, PLAN_CARDS, calls)
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")
  let posted = false
  try {
    const before = await state()
    const firstFocused = await focusAndEnter(devtools, PLAN_MANAGE)
    await poll(async () => (await state()).disabled === 1, 2_000)
    const afterFirst = await state()

    const point = await boxCenter(devtools, PLAN_MANAGE)
    const request = waitForRequest(devtools, "form-demo", 1_500)
    if (point) await clickAtPoint(devtools, point)
    const secondFocused = await focusAndEnter(devtools, PLAN_MANAGE)
    const sent = await request
    posted = sent !== null
    const afterRefused = await state()

    check(
      "a PlanCard submit by Enter calls onSubmit once, and the pending card refuses a real click and a second Enter",
      before.calls === "0" && before.disabled === 0 && firstFocused &&
        afterFirst.calls === "1" && afterFirst.disabled === 1 && point !== null &&
        !secondFocused && afterRefused.calls === "1" && sent === null &&
        afterRefused.location === before.location,
      `before ${JSON.stringify(before)}, first Enter focused ${firstFocused} → ` +
        `${JSON.stringify(afterFirst)}, then a click and an Enter (focused ${secondFocused}) → ` +
        `${JSON.stringify(afterRefused)}, request ${sent ? sent.method : "none"}`,
    )
    check(
      "a pending PlanCard announces the wait from its live region",
      afterFirst.regions.includes("One moment…"),
      JSON.stringify(afterFirst.regions),
    )

    const cleared = await clearPending(devtools, clearButton, PLAN_CARDS)
    const manage = await elementCenter(devtools, PLAN_MANAGE)
    if (manage.ok) await clickAtPoint(devtools, manage)
    await poll(async () => (await state()).calls === "2", 2_000)
    const afterClick = await state()
    const restored = await clearPending(devtools, clearButton, PLAN_CARDS)

    check(
      "a PlanCard submit by a real click calls onSubmit once",
      cleared && manage.ok && afterClick.calls === "2" && restored,
      !manage.ok
        ? `could not aim at Manage billing: ${manage.reason}`
        : `cleared ${cleared}, after the click ${
          JSON.stringify(afterClick)
        }, cleared again ${restored}`,
    )
  } finally {
    // A broken card posts natively and leaves the catalogue, so the later checks need it back.
    const here = await devtools.evaluate<string>("location.href").catch(() => "")
    if (posted || here !== restoreUrl) {
      await restoreHydratedPage(devtools, restoreUrl, "the pending PlanCard checks")
    }
  }
}

/** One billing demo that the focus and failure checks drive. */
interface BillingDemo {
  /** The component's name, for check names. */
  name: string
  card: string
  /** The submit button whose form the demo's callback takes over. */
  button: string
  /** What that button says, for check names. */
  buttonName: string
  /** The demo's count of callback calls. */
  calls: string
  /** The demo's "Clear pending" button. */
  clear: string
  /** The switch that has the callback mark the demo pending. */
  pendingToggle: string
  /** The switch that has the callback fail. */
  failToggle: string
}

const PRICING_DEMO: BillingDemo = {
  name: "PricingTable",
  card: PRICING,
  button: chooseButton("business-month"),
  buttonName: "Choose",
  calls: `${PRICING} [data-e2e="pricing-calls"]`,
  clear: `${PRICING} [data-e2e="pricing-clear-pending"]`,
  pendingToggle: `${PRICING} [data-e2e="pricing-pending-toggle"]`,
  failToggle: `${PRICING} [data-e2e="pricing-fail-toggle"]`,
}

const PLAN_DEMO: BillingDemo = {
  name: "PlanCard",
  card: PLAN_CARDS,
  button: PLAN_MANAGE,
  buttonName: "Manage billing",
  calls: `${PLAN_CARDS} [data-e2e="plan-calls"]`,
  clear: `${PLAN_CARDS} [data-e2e="plan-clear-pending"]`,
  pendingToggle: `${PLAN_CARDS} [data-e2e="plan-pending-toggle"]`,
  failToggle: `${PLAN_CARDS} [data-e2e="plan-fail-toggle"]`,
}

/**
 * Sets a demo switch with a scripted click, which leaves focus where it was, and waits until the
 * checkbox reads `on`.
 */
async function setDemoToggle(devtools: Devtools, selector: string, on: boolean): Promise<boolean> {
  await devtools.evaluate(`(() => {
    const box = document.querySelector('${selector}')
    if (box && box.checked !== ${on}) box.click()
  })()`).catch(() => undefined)
  return await poll(
    () =>
      devtools.evaluate<boolean>(`document.querySelector('${selector}')?.checked === ${on}`)
        .catch(() => false),
    2_000,
  )
}

/** The demo's call count as a number, `-1` when it cannot be read. */
async function demoCalls(devtools: Devtools, demo: BillingDemo): Promise<number> {
  const text = await devtools.evaluate<string>(
    `document.querySelector('${demo.calls}')?.textContent ?? ""`,
  ).catch(() => "")
  return text === "" ? -1 : Number(text)
}

/** Where focus is, relative to the demo's button: `"button"`, or what holds it instead. */
function demoFocus(devtools: Devtools, demo: BillingDemo): Promise<string> {
  return devtools.evaluate<string>(`(() => {
    const active = document.activeElement
    if (active === document.querySelector('${demo.button}')) return "button"
    if (!active || active === document.body) return "body"
    return active.tagName.toLowerCase() + (active.getAttribute("role") ? "[" +
      active.getAttribute("role") + "]" : "")
  })()`).catch(() => "unreadable")
}

/** Waits two frames and a little more, long enough for a render and its effects to run. */
async function settleRender(devtools: Devtools): Promise<void> {
  await devtools.evaluate(`new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 150))))`)
    .catch(() => undefined)
}

/** Submits the demo's form with a real Enter on its focused button or with a real click on it. */
async function submitDemo(
  devtools: Devtools,
  demo: BillingDemo,
  how: "Enter" | "click",
): Promise<boolean> {
  if (how === "Enter") return await focusAndEnter(devtools, demo.button)
  const point = await elementCenter(devtools, demo.button)
  if (point.ok) await clickAtPoint(devtools, point)
  return point.ok
}

/**
 * A billing callback that returns at once and leaves `pending` alone never disables the form, so
 * focus stays on the button the visitor pressed, after a real Enter and after a real click.
 */
async function billingSyncFocusCheck(devtools: Devtools, demo: BillingDemo): Promise<void> {
  const off = await setDemoToggle(devtools, demo.pendingToggle, false)
  const start = await demoCalls(devtools, demo)
  const results = []
  for (const how of ["Enter", "click"] as const) {
    const before = await demoCalls(devtools, demo)
    const sent = await submitDemo(devtools, demo, how)
    const called = await poll(async () => await demoCalls(devtools, demo) === before + 1, 2_000)
    await settleRender(devtools)
    results.push({ how, sent, called, focus: await demoFocus(devtools, demo) })
  }
  const on = await setDemoToggle(devtools, demo.pendingToggle, true)
  check(
    `a ${demo.name} callback that returns at once leaves focus on ${demo.buttonName} after a real Enter and a real click`,
    off && on && start >= 0 &&
      results.every((result) => result.sent && result.called && result.focus === "button"),
    `switch off ${off}, back on ${on}, ${JSON.stringify(results)}`,
  )
}

/**
 * When the app clears `pending`, focus that the wait parked on the form goes back to the button
 * that started it, whether a real Enter or a real click started it. The demo's "Clear pending" is
 * pressed by a script, as an app ends its work, so the press itself moves no focus.
 */
async function billingPendingFocusCheck(devtools: Devtools, demo: BillingDemo): Promise<void> {
  const disabled = async () => (await billingPendingState(devtools, demo.card, demo.calls)).disabled
  const results = []
  for (const how of ["Enter", "click"] as const) {
    const sent = await submitDemo(devtools, demo, how)
    const waited = await poll(async () => await disabled() > 0, 2_000)
    const parked = await demoFocus(devtools, demo)
    await devtools.evaluate(`document.querySelector('${demo.clear}')?.click()`)
      .catch(() => undefined)
    const cleared = await poll(async () => await disabled() === 0, 2_000)
    const back = await poll(async () => await demoFocus(devtools, demo) === "button", 2_000)
    results.push({ how, sent, waited, parked, cleared, back })
  }
  check(
    `when a pending ${demo.name} ends, focus returns to ${demo.buttonName} after a real Enter and a real click`,
    results.every((result) =>
      result.sent && result.waited && result.parked !== "button" && result.cleared && result.back
    ),
    JSON.stringify(results),
  )
}

/** What a billing form shows after its callback failed. */
interface BillingFailure {
  /** The messages the page's `error` listener caught from `reportError`. */
  errors: string[]
  region: string
  /** Whether the region is drawn on screen rather than kept for screen readers alone. */
  regionShown: boolean
  /** Whether the form's fieldset is disabled. */
  disabled: boolean
}

/** Reads the failure state of the form that holds the demo's button. */
function billingFailure(devtools: Devtools, demo: BillingDemo): Promise<BillingFailure> {
  return devtools.evaluate<BillingFailure>(`(() => {
    const form = document.querySelector('${demo.button}')?.closest("form")
    const region = form?.querySelector("[role=status]")
    const rect = region?.getBoundingClientRect()
    return {
      errors: [...(globalThis.__billingErrors ?? [])],
      region: region?.textContent ?? "no region",
      regionShown: !!region && !region.classList.contains("sr-only") && rect.height > 1,
      disabled: !!form?.querySelector("fieldset:disabled"),
    }
  })()`).catch(() => ({ errors: [], region: "unreadable", regionShown: false, disabled: true }))
}

/**
 * A billing callback that fails is not swallowed: the error reaches the page's `error` listener
 * through `reportError`, and the form shows the English `failed` words under its button, with the
 * form still enabled and focus still on the button. The listener cancels the event, as an app's
 * error handler may, so the console stays clean for `verify`'s own error check.
 *
 * @param how How the visitor submits.
 * @param clearAfter Whether to submit once more, with the callback working, and require the next
 *   submit to clear the failure. Left out, the failure stays on screen for the contrast check.
 */
async function billingFailureCheck(
  devtools: Devtools,
  demo: BillingDemo,
  how: "Enter" | "click",
  clearAfter: boolean,
): Promise<void> {
  const failedWords = "Something went wrong. Try again."
  await devtools.evaluate(`(() => {
    globalThis.__billingErrors = []
    globalThis.__billingErrorListener = (event) => {
      const message = String(event.error?.message ?? event.message)
      if (!message.includes("failed on purpose")) return
      globalThis.__billingErrors.push(message)
      event.preventDefault()
    }
    addEventListener("error", globalThis.__billingErrorListener)
  })()`)
  try {
    const failing = await setDemoToggle(devtools, demo.failToggle, true)
    const before = await demoCalls(devtools, demo)
    const sent = await submitDemo(devtools, demo, how)
    const shown = await poll(
      async () => (await billingFailure(devtools, demo)).region === failedWords,
      2_000,
    )
    await settleRender(devtools)
    const failure = await billingFailure(devtools, demo)
    const calls = await demoCalls(devtools, demo)
    const focus = await demoFocus(devtools, demo)
    const working = await setDemoToggle(devtools, demo.failToggle, false)

    let cleared: BillingFailure | null = null
    if (clearAfter) {
      await setDemoToggle(devtools, demo.pendingToggle, false)
      await submitDemo(devtools, demo, "Enter")
      await poll(async () => (await billingFailure(devtools, demo)).region === "", 2_000)
      cleared = await billingFailure(devtools, demo)
      await setDemoToggle(devtools, demo.pendingToggle, true)
    }

    check(
      `a ${demo.name} callback that fails reaches reportError and shows the failed words under ${demo.buttonName}` +
        (clearAfter ? ", until the next submit" : ""),
      failing && working && sent && shown && calls === before + 1 &&
        failure.errors.length === 1 && failure.regionShown && !failure.disabled &&
        focus === "button" &&
        (!clearAfter || (cleared !== null && cleared.region === "" && !cleared.regionShown)),
      `switch on ${failing}, off ${working}, calls ${before} → ${calls}, focus ${focus}, ` +
        `${JSON.stringify(failure)}, after the next submit ${JSON.stringify(cleared)}`,
    )
  } finally {
    await devtools.evaluate(
      `removeEventListener("error", globalThis.__billingErrorListener)`,
    ).catch(() => undefined)
  }
}

/**
 * A paused `PlanCard` says so in its status pill, in words, and shows no payment warning. Its
 * contrast is measured with the other billing texts in {@link billingContrastCheck}.
 */
async function planCardPausedCheck(devtools: Devtools): Promise<void> {
  const reading = await devtools.evaluate<{ found: boolean; pill: string; warning: boolean }>(
    `(() => {
    const card = document.querySelector('${PLAN_CARDS} [data-status="6"]')
    return {
      found: Boolean(card),
      pill: card?.querySelector(".pc-card-header span")?.textContent ?? "",
      warning: Boolean(card?.querySelector("[data-plan-warning]")),
    }
  })()`,
  ).catch(() => ({ found: false, pill: "", warning: true }))

  check(
    "a paused PlanCard reads Paused in its status pill and shows no payment warning",
    reading.found && reading.pill === "Paused" && !reading.warning,
    JSON.stringify(reading),
  )
}

/** What the past-due `PlanCard` shows. */
interface PastDueReading {
  found: boolean
  status: string
  text: string
  shown: boolean
  icon: { shown: boolean; hidden: string | null }
}

/**
 * The past-due `PlanCard` says so in words, twice: its status pill reads "Past due", and a warning
 * sentence sits on screen beside a warning icon. A trial, active or canceled card shows no warning,
 * and the catalogue shows each of those, so the count below covers all three.
 */
async function planCardPastDueCheck(devtools: Devtools): Promise<void> {
  const reading = await devtools.evaluate<
    PastDueReading & { healthy: string[]; healthyWarnings: number }
  >(`(() => {
    const cards = [...document.querySelectorAll("#demo-PlanCard [data-status]")]
    const card = cards.find((each) => each.dataset.status === "3")
    const warning = card?.querySelector("[data-plan-warning]")
    const icon = warning?.querySelector("svg")
    const shown = (element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility === "visible"
    }
    return {
      found: Boolean(card),
      status: card?.querySelector(".pc-card-header span")?.textContent ?? "",
      text: warning?.textContent ?? "",
      shown: warning ? shown(warning) : false,
      icon: { shown: icon ? shown(icon) : false, hidden: icon?.getAttribute("aria-hidden") ?? null },
      healthy: [...new Set(cards.map((each) => each.dataset.status)
        .filter((status) => ["1", "2", "4"].includes(status)))].sort(),
      healthyWarnings: cards.filter((each) => ["1", "2", "4"].includes(each.dataset.status))
        .filter((each) => each.querySelector("[data-plan-warning]")).length,
    }
  })()`)

  check(
    "a past-due PlanCard warns in words beside a warning icon, and a trial, active or canceled one does not",
    reading.found && reading.status === "Past due" && reading.shown &&
      reading.text.includes("payment failed") && reading.icon.shown &&
      reading.healthy.join() === "1,2,4" && reading.healthyWarnings === 0,
    JSON.stringify(reading),
  )
}

/** One measured text or edge of the billing cards, in one palette. */
interface BillingContrast {
  name: string
  ratio: number
  /** `3` for an edge or an icon, `4.5` for text. */
  needs: number
}

/**
 * How the checked billing interval is told apart from the unchecked one, in one palette. Its fill
 * alone is 2.65:1 against the track in the dark palette, so the option also carries a check icon
 * and bolder text.
 */
interface IntervalCue {
  /** The checked option's fill against the toggle's track, reported but not required. */
  fillVsTrack: number
  checkedIcon: boolean
  uncheckedIcon: boolean
  /** The check icon's colour against the checked option's fill. */
  iconRatio: number
  checkedWeight: number
  uncheckedWeight: number
}

/**
 * Every text the billing components draw reaches 4.5:1 on what it sits on, and the highlighted
 * plan's border and the warning's icon and border reach 3:1, in the light and the dark palette.
 * The checked interval option shows a check icon at 3:1 and bolder text, and the unchecked one
 * neither, so the choice never rests on the fill alone.
 */
async function billingContrastCheck(devtools: Devtools): Promise<void> {
  await pointerToCorner(devtools)
  const reading = await devtools.evaluate<{
    light: BillingContrast[]
    dark: BillingContrast[]
    lightCue: IntervalCue
    darkCue: IntervalCue
  }>(
    `(async () => {
    ${CONTRAST_HELPERS}
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    const pricing = document.querySelector('${PRICING}')
    const plans = document.querySelector("#demo-PlanCard")
    const upgrade = document.querySelector("#demo-UpgradePrompt")
    const highlighted = pricing.querySelector('li[data-plan="pro-month"]')
    const plain = pricing.querySelector('li[data-plan="free"]')
    const pastDue = [...plans.querySelectorAll("[data-status]")]
      .find((card) => card.dataset.status === "3")
    const warning = pastDue.querySelector("[data-plan-warning]")
    const texts = [
      ["plan name", highlighted.querySelector("h4")],
      ["plan description", highlighted.querySelector("p.text-sm")],
      ["price", highlighted.querySelector(".text-3xl")],
      ["per month", highlighted.querySelector(".text-3xl + span")],
      ["feature", highlighted.querySelector("ul li")],
      ["Most popular", highlighted.querySelector("span.bg-selected")],
      ["checked interval", pricing.querySelector("fieldset label:has(:checked)")],
      ["unchecked interval", pricing.querySelector("fieldset label:not(:has(:checked))")],
      ["status pill", pastDue.querySelector(".pc-card-header span")],
      ["paused pill", plans.querySelector("[data-status='6'] .pc-card-header span")],
      ["plan card price", pastDue.querySelector(".text-xl")],
      ["date line", plans.querySelector("[data-status='2'] .pc-card-body p.text-muted")],
      ["warning", warning.querySelector("span")],
      ["failed words", plans.querySelector("[data-status='2'] form [role=status]")],
      ["upgrade title", upgrade.querySelector("h4")],
      ["upgrade message", upgrade.querySelector("p")],
    ]
    const edgeRatio = (element) =>
      seenRatio(element, getComputedStyle(element).borderTopColor, { outside: true })
    const checked = pricing.querySelector("fieldset label:has(:checked)")
    const unchecked = pricing.querySelector("fieldset label:not(:has(:checked))")
    const iconShown = (label) => {
      const icon = label.querySelector("svg")
      if (!icon) return false
      const rect = icon.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(icon).visibility === "visible"
    }
    const cue = () => ({
      fillVsTrack: seenRatio(checked, getComputedStyle(checked).backgroundColor, { outside: true }),
      checkedIcon: iconShown(checked),
      uncheckedIcon: iconShown(unchecked),
      iconRatio: checked.querySelector("svg")
        ? seenRatio(checked.querySelector("svg"))
        : 0,
      checkedWeight: Number(getComputedStyle(checked).fontWeight),
      uncheckedWeight: Number(getComputedStyle(unchecked).fontWeight),
    })
    const measure = () => [
      ...texts.map(([name, element]) => ({
        name,
        ratio: element ? seenRatio(element) : 0,
        needs: 4.5,
      })),
      {
        name: "highlighted plan border",
        ratio: edgeRatio(highlighted),
        needs: 3,
      },
      {
        name: "highlighted against a plain plan's border",
        ratio: ratio(
          paint(getComputedStyle(highlighted).borderTopColor),
          paint(getComputedStyle(plain).borderTopColor),
        ),
        needs: 1.5,
      },
      {
        name: "warning border",
        ratio: edgeRatio(warning),
        needs: 3,
      },
      {
        name: "warning icon",
        ratio: seenRatio(warning.querySelector("svg")),
        needs: 3,
      },
    ]
    // The palette switch starts its colour transitions on the next frames; read once every finite
    // one on the page has finished. Infinite ones, a spinner's, never finish and are left out.
    const until = ${PAGE_UNTIL}
    const settle = async () => {
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      await until(() =>
        document.getAnimations().every((animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().endTime === Infinity
        )
      )
    }
    try {
      root.classList.remove("dark")
      await settle()
      const light = measure()
      const lightCue = cue()
      root.classList.add("dark")
      await settle()
      const dark = measure()
      const darkCue = cue()
      return { light, dark, lightCue, darkCue }
    } finally {
      root.classList.toggle("dark", wasDark)
    }
  })()`,
  )

  for (const palette of ["light", "dark"] as const) {
    const rows = reading[palette]
    check(
      `in the ${palette} palette every billing text reaches 4.5:1 and every edge and icon 3:1`,
      rows.length > 0 && rows.every((row) => row.ratio >= row.needs),
      rows.map((row) => `${row.name} ${row.ratio.toFixed(2)}`).join(", "),
    )
    const cue = reading[`${palette}Cue`]
    check(
      `in the ${palette} palette the checked billing interval shows a check icon at 3:1 and bolder text, and the unchecked one neither`,
      cue.checkedIcon && !cue.uncheckedIcon && cue.iconRatio >= 3 &&
        cue.checkedWeight > cue.uncheckedWeight,
      JSON.stringify(cue),
    )
  }
}
