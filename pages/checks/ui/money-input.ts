import { check, type Devtools, PAGE_UNTIL, poll, pressKey, settledScroll } from "../harness.ts"
import { clickAtPoint, elementCenter } from "./shared-forms.ts"
import { typeInto } from "./shared-typing.ts"

/** `MoneyInput`'s card: `Field`-wired, `EUR`, German locale, `name="guide-money-amount"`. */
const MONEY_INPUT_CARD = "#demo-MoneyInput"

/** One typed-then-read snapshot from {@link moneyInputChecks}'s first, single-`evaluate` pass. */
interface MoneyInputReading {
  initialEcho: string
  groupedParseEcho: string
  groupedHiddenValue: string
  invalidEcho: string
  invalidMessage: string
  invalidAriaInvalid: string | null
  invalidDescribedBy: string
  invalidHiddenValue: string
  invalidCheckValidity: boolean
  invalidValidationMessage: string
  clearedEcho: string
  clearedMessage: string
  clearedAriaInvalid: string | null
}

/**
 * `MoneyInput`'s behaviour that only a real browser can prove: a genuine grouping mark parses into
 * the smallest-unit integer the demo echoes, unparsable text leaves that integer unchanged while
 * announcing a message through the live region present since the first render and blocking a real
 * form submit through `setCustomValidity`, a real blur (`Tab`, not a dispatched `blur` event) keeps
 * the typed text and the message rather than reverting them, an external change to `value` re-syncs
 * the shown text while the field is not focused, and a real click on the demo's own submit button
 * is refused while the field is invalid and succeeds once it is fixed, posting the parsed integer.
 */
export async function moneyInputChecks(devtools: Devtools): Promise<void> {
  const cardPresent = await devtools.evaluate<boolean>(
    `document.querySelector('${MONEY_INPUT_CARD}') !== null`,
  )
  check("the MoneyInput card is on the page", cardPresent)
  if (!cardPresent) return

  const read = await devtools.evaluate<MoneyInputReading>(`(async () => {
    const until = ${PAGE_UNTIL}
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const hidden = card.querySelector('input[type=hidden][name="guide-money-amount"]')
    const status = card.querySelector('#guide-money-input-status')
    const echo = () => card.querySelector('[data-e2e="controlled-value"]').textContent.trim()
    const setValue = (el, text) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, text)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }

    const initialEcho = echo()

    // A real thousands separator, not just a decimal mark — proves grouping is understood, not
    // only decoded.
    setValue(input, "1.234,56")
    await until(() => echo().includes("123456") && hidden.value === "123456")
    const groupedParseEcho = echo()
    const groupedHiddenValue = hidden.value

    setValue(input, "abc")
    await until(() =>
      status.textContent.trim() === "Enter a valid amount" &&
      input.getAttribute("aria-invalid") === "true"
    )
    const invalidEcho = echo()
    const invalidMessage = status.textContent.trim()
    const invalidAriaInvalid = input.getAttribute("aria-invalid")
    const invalidDescribedBy = input.getAttribute("aria-describedby") ?? ""
    const invalidHiddenValue = hidden.value
    const invalidCheckValidity = input.checkValidity()
    const invalidValidationMessage = input.validationMessage

    setValue(input, "")
    await until(() => echo().includes("(empty)") && status.textContent.trim() === "")
    const clearedEcho = echo()
    const clearedMessage = status.textContent.trim()
    const clearedAriaInvalid = input.getAttribute("aria-invalid")

    return {
      initialEcho,
      groupedParseEcho,
      groupedHiddenValue,
      invalidEcho,
      invalidMessage,
      invalidAriaInvalid,
      invalidDescribedBy,
      invalidHiddenValue,
      invalidCheckValidity,
      invalidValidationMessage,
      clearedEcho,
      clearedMessage,
      clearedAriaInvalid,
    }
  })()`)

  check(
    "starts from the demo's own initial amount",
    read.initialEcho.includes("1999"),
    read.initialEcho,
  )
  check(
    "typing '1.234,56' in the German demo parses to 123456, a real grouping mark understood too",
    read.groupedParseEcho.includes("123456") && read.groupedHiddenValue === "123456",
    `echo "${read.groupedParseEcho}", hidden value "${read.groupedHiddenValue}"`,
  )
  check(
    "typing letters leaves the posted integer unchanged and shows the invalid message",
    read.invalidEcho.includes("123456") && read.invalidHiddenValue === "123456" &&
      read.invalidMessage === "Enter a valid amount",
    `echo "${read.invalidEcho}", hidden value "${read.invalidHiddenValue}", message "${read.invalidMessage}"`,
  )
  check(
    "marks the control invalid and describes it by the live region while the message stands",
    read.invalidAriaInvalid === "true" &&
      read.invalidDescribedBy.includes("guide-money-input-status"),
    `aria-invalid="${read.invalidAriaInvalid}" aria-describedby="${read.invalidDescribedBy}"`,
  )
  check(
    "sets the visible control's own custom validity to the message, so a real submit would be refused",
    read.invalidCheckValidity === false && read.invalidValidationMessage === "Enter a valid amount",
    `checkValidity()=${read.invalidCheckValidity}, validationMessage="${read.invalidValidationMessage}"`,
  )
  check(
    "clearing the field posts nothing and drops the message",
    read.clearedEcho.includes("(empty)") && read.clearedMessage === "" &&
      read.clearedAriaInvalid === null,
    `echo "${read.clearedEcho}", message "${read.clearedMessage}", aria-invalid="${read.clearedAriaInvalid}"`,
  )
  // A real click focuses the field — through the browser's own input pipeline, not a scripted
  // `.focus()` call — so the Tab press right after this has something real to blur away from.
  const fieldPoint = await elementCenter(devtools, `${MONEY_INPUT_CARD} #guide-money-input`)
  check(
    "the field itself is reachable for a real click",
    fieldPoint.ok,
    fieldPoint.ok ? `(${fieldPoint.x}, ${fieldPoint.y})` : fieldPoint.reason,
  )
  if (!fieldPoint.ok) return
  await clickAtPoint(devtools, fieldPoint)

  const typed = await devtools.evaluate<
    {
      beforeUnresolvedEcho: string
      beforeUnresolvedValue: string
      midEditValue: string
      midEditMessage: string
    }
  >(`(async () => {
    const until = ${PAGE_UNTIL}
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const status = card.querySelector('#guide-money-input-status')
    const echo = () => card.querySelector('[data-e2e="controlled-value"]').textContent.trim()
    const setValue = (el, text) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, text)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }

    setValue(input, "3,50")
    await until(() => echo().includes("350"))
    const beforeUnresolvedEcho = echo()
    const beforeUnresolvedValue = input.value

    setValue(input, "not a number")
    await until(() => status.textContent.trim() === "Enter a valid amount")
    const midEditValue = input.value
    const midEditMessage = status.textContent.trim()

    return { beforeUnresolvedEcho, beforeUnresolvedValue, midEditValue, midEditMessage }
  })()`)
  check(
    "an unresolved edit still shows its own typed text right up to the blur",
    typed.beforeUnresolvedEcho.includes("350") && typed.midEditValue === "not a number" &&
      typed.midEditMessage === "Enter a valid amount",
    `before blur echo "${typed.beforeUnresolvedEcho}" "${typed.beforeUnresolvedValue}", mid-edit "${typed.midEditValue}" message "${typed.midEditMessage}"`,
  )

  // A real blur — Tab through the browser's own input pipeline, not a dispatched `blur` event —
  // while the field's text is still refused. Text and message must stay exactly as they are.
  // `onBlur` runs synchronously on the DOM's own blur event, but the re-render it triggers is not
  // synchronous with it. A fixed wait, not a poll: it proves that render does not revert the text,
  // and an absence has no state to poll for.
  await pressKey(devtools, "Tab")
  await new Promise((resolve) => setTimeout(resolve, 60))
  const afterRealBlur = await devtools.evaluate<{
    value: string
    message: string
    ariaInvalid: string | null
    stillFocused: boolean
  }>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const status = card.querySelector('#guide-money-input-status')
    return {
      value: input.value,
      message: status.textContent.trim(),
      ariaInvalid: input.getAttribute("aria-invalid"),
      stillFocused: document.activeElement === input,
    }
  })()`)
  check(
    "a real blur (Tab) keeps the typed text and the message instead of silently reverting them",
    afterRealBlur.value === "not a number" && afterRealBlur.message === "Enter a valid amount" &&
      afterRealBlur.ariaInvalid === "true" && !afterRealBlur.stillFocused,
    `after Tab: value "${afterRealBlur.value}", message "${afterRealBlur.message}", ` +
      `aria-invalid="${afterRealBlur.ariaInvalid}", still focused=${afterRealBlur.stillFocused}`,
  )

  // Fix the field, blur it for real again, then change `value` from outside the field entirely
  // (the demo's own "Add 5.00" button) — the shown text must re-sync while unfocused.
  await devtools.evaluate<null>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, "10,00")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return null
  })()`)
  await pressKey(devtools, "Tab")
  await poll(
    () =>
      devtools.evaluate<boolean>(
        `document.activeElement !== document.querySelector('${MONEY_INPUT_CARD} #guide-money-input')`,
      ),
    3_000,
  )

  const beforeAdd = await devtools.evaluate<string>(
    `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
  )
  const addPoint = await elementCenter(
    devtools,
    `${MONEY_INPUT_CARD} [data-e2e="money-input-add-five"]`,
  )
  check(
    "the demo's Add 5.00 button is reachable for a real click",
    addPoint.ok,
    addPoint.ok ? `(${addPoint.x}, ${addPoint.y})` : addPoint.reason,
  )
  if (addPoint.ok) {
    await clickAtPoint(devtools, addPoint)
    await poll(
      () =>
        devtools.evaluate<boolean>(
          `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value !== ${
            JSON.stringify(beforeAdd)
          }`,
        ),
      3_000,
    )
    const afterAdd = await devtools.evaluate<string>(
      `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
    )
    check(
      "an external change to value re-syncs the shown text while the field is not focused",
      afterAdd === "15,00" && afterAdd !== beforeAdd,
      `before "${beforeAdd}", after a real click on Add 5.00 "${afterAdd}"`,
    )
  }

  // A real form submit — a real click on the demo's own submit button, never a scripted
  // `form.requestSubmit()` or `dispatchEvent(new Event("submit"))`. Refused while the field's own
  // text is invalid; posts the parsed integer once it is fixed.
  await devtools.evaluate<null>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, "abc")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return null
  })()`)

  const submitsSelector = `${MONEY_INPUT_CARD} [data-e2e="money-input-submits"]`
  const beforeBlockedSubmit = await devtools.evaluate<string>(
    `document.querySelector('${submitsSelector}').textContent`,
  )
  const blockedSubmitPoint = await elementCenter(
    devtools,
    `${MONEY_INPUT_CARD} [data-e2e="money-input-submit"]`,
  )
  check(
    "the demo's Save button is reachable for a real click while the field is invalid",
    blockedSubmitPoint.ok,
    blockedSubmitPoint.ok
      ? `(${blockedSubmitPoint.x}, ${blockedSubmitPoint.y})`
      : blockedSubmitPoint.reason,
  )
  if (blockedSubmitPoint.ok) {
    await clickAtPoint(devtools, blockedSubmitPoint)
    const afterBlockedSubmit = await devtools.evaluate<string>(
      `document.querySelector('${submitsSelector}').textContent`,
    )
    check(
      "a real click on Save does not submit the form while the field's text is refused",
      afterBlockedSubmit === beforeBlockedSubmit,
      `before "${beforeBlockedSubmit}", after clicking Save while invalid "${afterBlockedSubmit}"`,
    )
  }

  await devtools.evaluate<null>(`(() => {
    const card = document.querySelector('${MONEY_INPUT_CARD}')
    const input = card.querySelector('#guide-money-input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, "7,00")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return null
  })()`)
  const fixedSubmitPoint = await elementCenter(
    devtools,
    `${MONEY_INPUT_CARD} [data-e2e="money-input-submit"]`,
  )
  check(
    "the demo's Save button is reachable for a real click once the field is fixed",
    fixedSubmitPoint.ok,
    fixedSubmitPoint.ok
      ? `(${fixedSubmitPoint.x}, ${fixedSubmitPoint.y})`
      : fixedSubmitPoint.reason,
  )
  if (fixedSubmitPoint.ok) {
    await clickAtPoint(devtools, fixedSubmitPoint)
    await poll(
      () =>
        devtools.evaluate<boolean>(
          `document.querySelector('${submitsSelector}').textContent !== ${
            JSON.stringify(beforeBlockedSubmit)
          }`,
        ),
      3_000,
    )
    // A fixed wait, not a poll: it proves no second submit follows the first, and an absence has
    // no state to poll for.
    await new Promise((done) => setTimeout(done, 150))
    const afterFixedSubmit = await devtools.evaluate<string>(
      `document.querySelector('${submitsSelector}').textContent`,
    )
    check(
      "a real click on Save submits once the field's text is fixed, posting the parsed integer",
      afterFixedSubmit.trim() === "submits: 1, posted: 700",
      `after fixing and clicking Save: "${afterFixedSubmit.trim()}"`,
    )
  }
}

/**
 * The bug review found: Preact does not overwrite an input's `value` while hydrating, so text typed
 * into `MoneyInput` before its bundle has even finished loading stays exactly where a visitor left
 * it, while `draft`, `value` and the hidden amount input all still carry whatever the server
 * rendered. A form submitted in that gap used to post the stale server amount, silently. The fix is
 * a mount effect that parses whatever text is already in the field and a hidden input that stays
 * `disabled` — dropped from `FormData` entirely — until that effect has run; this proves both
 * halves against a real, unhydrated load rather than a scripted `dispatchEvent`.
 *
 * The bundle is held back with `Fetch.enable` on `resourceType: "Script"`, not
 * `Emulation.setScriptExecutionDisabled` the way `enhancedFormsNoScriptChecks` above holds a whole
 * page back: that flag skips a blocked `<script>` permanently, so re-enabling it cannot retroactively
 * run one already parsed past, and the restoring navigation those checks use to get a hydrated page
 * back would also throw away whatever was typed. `Fetch.requestPaused` instead leaves the request
 * outstanding — the document still parses and renders fully around it — so continuing it later runs
 * the very bundle this check needs, against the very DOM the typing already changed. Chromium's
 * preload scanner can dispatch that request before the parser has reached the field's own markup, so
 * this polls for the field rather than waiting on a `Page` lifecycle event, and the pause is
 * registered before the reload that triggers it — a promise started after the click that is meant to
 * produce it would race whatever the click actually produced, the same hazard `waitForRequest`'s own
 * doc above states.
 *
 * Runs on the shared page, like `system/`'s `authFormNoScriptChecks`, and restores it the same way:
 * `Fetch.disable` and a restoring navigation, both inside a `finally` so a throw partway through
 * cannot leave every check after this one running against an unhydrated page, with a second, harder
 * attempt if the first restoring navigation does not rehydrate, and a wait for the route's own scroll
 * to settle before returning.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function moneyInputPreHydrationChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  let fieldReady = false
  let unhydratedWhileTyping = false
  let typedValue = "(page unreadable)"
  let hiddenDisabledWhileTyping: boolean | null = null
  let rehydrated = false
  let submitResult = "(not read)"
  let continuedValue = "(not read)"

  try {
    await devtools.send("Fetch.enable", {
      patterns: [{
        urlPattern: "*/assets/main.*.js",
        resourceType: "Script",
        requestStage: "Request",
      }],
    })
    const paused = devtools.once<{ requestId: string }>("Fetch.requestPaused", 20_000)
    await devtools.send("Page.reload", { ignoreCache: true })
    const { requestId } = await paused

    fieldReady = await poll(
      () =>
        devtools.evaluate<boolean>(
          `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input') !== null`,
        ).catch(() => false),
      10_000,
    )

    if (fieldReady) {
      unhydratedWhileTyping = await devtools.evaluate<boolean>(
        `document.documentElement.dataset.hydrated !== "true"`,
      ).catch(() => false)

      const fieldPoint = await elementCenter(devtools, `${MONEY_INPUT_CARD} #guide-money-input`)
      if (fieldPoint.ok) {
        await clickAtPoint(devtools, fieldPoint)
        // A native, JS-free selection — the field carries no listener at all yet — so the
        // insertion right after it replaces the server-rendered text rather than appending to it.
        await devtools.evaluate<null>(`(() => {
          document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').select()
          return null
        })()`)
        await typeInto(devtools, "12")
      }

      typedValue = await devtools.evaluate<string>(
        `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
      ).catch(() => "(unreadable)")
      hiddenDisabledWhileTyping = await devtools.evaluate<boolean>(
        `document.querySelector(
          '${MONEY_INPUT_CARD} input[type=hidden][name="guide-money-amount"]',
        ).disabled`,
      ).catch(() => null)
    }

    // Release the bundle — the document already carries whatever was typed above, untouched.
    await devtools.send("Fetch.continueRequest", { requestId }).catch(() => {})

    rehydrated = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      15_000,
    )

    if (rehydrated) {
      // The visitor keeps typing after the bundle has run, focus still where they put it before
      // hydration. The component must treat the field as focused and leave the text alone. One
      // character at a time, as a person types: sent as one insertion, "3,45" re-formats to itself.
      for (const character of "3,45") await typeInto(devtools, character)
      continuedValue = await devtools.evaluate<string>(
        `document.querySelector('${MONEY_INPUT_CARD} #guide-money-input').value`,
      ).catch(() => "(unreadable)")
      const submitPoint = await elementCenter(
        devtools,
        `${MONEY_INPUT_CARD} [data-e2e="money-input-submit"]`,
      )
      if (submitPoint.ok) {
        await clickAtPoint(devtools, submitPoint)
        await poll(
          () =>
            devtools.evaluate<boolean>(
              `/submits: [1-9]/.test(document.querySelector(
                '${MONEY_INPUT_CARD} [data-e2e="money-input-submits"]',
              ).textContent)`,
            ).catch(() => false),
          3_000,
        )
        // A fixed wait, not a poll: it proves no second submit follows the first, and an absence
        // has no state to poll for.
        await new Promise((done) => setTimeout(done, 150))
        submitResult = await devtools.evaluate<string>(
          `document.querySelector(
            '${MONEY_INPUT_CARD} [data-e2e="money-input-submits"]',
          ).textContent.trim()`,
        ).catch(() => "(unreadable)")
      }
    }
  } finally {
    await devtools.send("Fetch.disable", {}).catch(() => {})

    await devtools.send("Page.navigate", { url: restoreUrl }).catch(() => {})
    let restored = await poll(
      () =>
        devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
          .catch(() => false),
      15_000,
    )
    if (!restored) {
      await devtools.send("Page.reload", { ignoreCache: true }).catch(() => {})
      restored = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        15_000,
      )
    }
    check(
      "the page rehydrates once the pre-hydration MoneyInput check restores it",
      restored,
      restored
        ? "data-hydrated set again after the restoring navigation"
        : "the page never rehydrated after the restoring navigation, even after a retry",
    )
    await settledScroll(devtools)
  }

  check(
    "text typed before the bundle has even loaded sits in the field unparsed, and the hidden amount stays disabled",
    fieldReady && unhydratedWhileTyping && typedValue === "12" &&
      hiddenDisabledWhileTyping === true,
    `field ready: ${fieldReady}, unhydrated while typing: ${unhydratedWhileTyping}, ` +
      `field value "${typedValue}", hidden input disabled: ${hiddenDisabledWhileTyping}`,
  )
  check(
    "the field hydrates once the held-back bundle is released",
    rehydrated,
    rehydrated ? "data-hydrated set" : "never hydrated after the bundle was released",
  )
  check(
    "typing that starts before hydration and continues after it is left as typed, not re-formatted",
    continuedValue === "123,45",
    `"12" typed before hydration, "3,45" after: field shows "${continuedValue}"`,
  )
  check(
    "a real submit after hydration posts what was typed before and after the bundle loaded, never the stale server amount",
    submitResult === "submits: 1, posted: 12345",
    `after a real click on Save: "${submitResult}"`,
  )
}
