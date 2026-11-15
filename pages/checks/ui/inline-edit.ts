import { centreInView, check, type Devtools, poll, pressKey } from "../harness.ts"
import { inlineEditState } from "./shared.ts"
import { typeInto } from "./shared-typing.ts"

/** What one read of an `InlineEdit` demo sees. */
interface InlineEditState {
  /** `true` while the text field is shown, `false` while the value's button is. */
  editing: boolean
  /** The field's text, or the button's visible text when closed. */
  text: string
  /** `true` when the whole text of the field is selected. */
  allSelected: boolean
  /** `aria-busy` on the field, or `null`. */
  busy: string | null
  /** `true` when the field is read-only. */
  readOnly: boolean
  /** The text of the field's `role="alert"`, or `""` when there is none. */
  alert: string
  /** `true` when the focused element is the value's button. */
  onTrigger: boolean
  /** `true` when the focused element is the text field. */
  onField: boolean
  /** The demo's echo of the saved value and the save count. */
  saved: string
}

/**
 * Three ways an open `InlineEdit` is interrupted without the user confirming anything, each on the
 * card's first demo, whose save takes 400ms and then changes the demo's echo.
 *
 * Removing the component while its field has focus saves nothing, although Chromium fires `blur` on
 * the removed field. An Enter or Escape keydown sent while an input method is composing a word
 * (`isComposing`) neither saves nor cancels, and nor does one with keyCode 229, which is how Safari
 * sends the Enter that ends a composition. Turning `disabled` on while the field is open cancels
 * the edit: the old value is back and nothing is saved. The demo's Remove and Lock buttons are
 * pressed with a scripted `.click()`, which leaves focus in the field, as a keyboard shortcut or a
 * change from elsewhere in an app would.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function inlineEditInterruptionChecks(devtools: Devtools): Promise<void> {
  const ok = inlineEditState("inline-edit-ok")
  const root = `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-ok"]')`
  const trigger = `${root}.querySelector("button")`
  const echo =
    `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-saved"]').textContent.trim()`
  const remove = `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-remove"]')`
  const lock = `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-lock"]')`
  // Long enough for the demo's 400ms save to finish and change the echo, had one started. A fixed
  // wait, not a poll: every caller proves a save does not happen, and an absence has no state to
  // poll for.
  const saveWindow = () => new Promise((done) => setTimeout(done, 700))
  const open = async (text: string) => {
    await centreInView(devtools, trigger)
    await devtools.evaluate<null>(`(${trigger}.focus(), null)`)
    await pressKey(devtools, "Enter")
    await poll(() => devtools.evaluate<boolean>(`${ok}.onField`), 2_000)
    await typeInto(devtools, text)
  }

  const beforeRemoval = await devtools.evaluate<string>(echo)
  await open("Deleted")
  const focusedTag = await devtools.evaluate<string>(`(() => {
    const tag = document.activeElement?.tagName ?? ""
    ${remove}.click()
    return tag
  })()`)
  await poll(
    () => devtools.evaluate<boolean>(`${root}.querySelector("input, button") === null`),
    2_000,
  )
  await saveWindow()
  const afterRemoval = await devtools.evaluate<string>(echo)
  check(
    "removing an InlineEdit while its field has focus does not save the typed text",
    focusedTag === "INPUT" && afterRemoval === beforeRemoval,
    `focus was on ${focusedTag} when removed; echo "${beforeRemoval}" → "${afterRemoval}"`,
  )
  await devtools.evaluate<null>(`(${remove}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${trigger} !== null`), 2_000)

  await open("Composing")
  await devtools.evaluate<null>(`(() => {
    const field = ${root}.querySelector("input")
    for (const key of ["Enter", "Escape"]) {
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key, isComposing: true, bubbles: true, cancelable: true }),
      )
    }
    return null
  })()`)
  await saveWindow()
  const composing = await devtools.evaluate<InlineEditState>(ok)
  check(
    "Enter and Escape sent while an input method composes leave an InlineEdit open and unsaved",
    composing.editing && composing.text === "Composing" && composing.busy === null &&
      composing.saved === afterRemoval,
    `editing ${composing.editing}, "${composing.text}", busy ${composing.busy}, ` +
      `echo "${afterRemoval}" → "${composing.saved}"`,
  )
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`!${ok}.editing`), 2_000)

  // Safari's Enter that ends a composition: `isComposing` false, keyCode 229. Sent as real key
  // presses, and the field records what reached it, so a press that arrived as something else
  // reports itself instead of passing as ignored.
  await open("Kana")
  await devtools.evaluate<null>(`(() => {
    const field = ${root}.querySelector("input")
    globalThis.__verifyImeKeys = []
    field.addEventListener("keydown", (event) => {
      globalThis.__verifyImeKeys.push(event.key + " " + event.keyCode + " " + event.isComposing)
    }, { capture: true })
    return null
  })()`)
  for (const key of ["Enter", "Escape"]) {
    for (const type of ["rawKeyDown", "keyUp"]) {
      await devtools.send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: 229,
        nativeVirtualKeyCode: 229,
      })
    }
  }
  await saveWindow()
  const ime = await devtools.evaluate<InlineEditState & { keys: string[] }>(
    `({ ...${ok}, keys: globalThis.__verifyImeKeys ?? [] })`,
  )
  check(
    "Enter and Escape with keyCode 229 and isComposing false leave an InlineEdit open and unsaved",
    ime.keys.join(", ") === "Enter 229 false, Escape 229 false" && ime.editing &&
      ime.text === "Kana" && ime.busy === null && ime.saved === afterRemoval,
    `the field saw [${ime.keys.join(", ")}]; editing ${ime.editing}, "${ime.text}", busy ` +
      `${ime.busy}, echo "${afterRemoval}" → "${ime.saved}"`,
  )
  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`!${ok}.editing`), 2_000)

  const beforeLock = await devtools.evaluate<InlineEditState>(ok)
  await open("Locked")
  await devtools.evaluate<null>(`(${lock}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`!${ok}.editing`), 2_000)
  await saveWindow()
  const locked = await devtools.evaluate<InlineEditState & { disabled: boolean }>(
    `({ ...${ok}, disabled: ${trigger}?.disabled ?? false })`,
  )
  check(
    "turning disabled on while an InlineEdit is open cancels the edit without saving",
    !locked.editing && locked.disabled && locked.text === beforeLock.text &&
      locked.saved === beforeLock.saved,
    `editing ${locked.editing}, disabled ${locked.disabled}, "${beforeLock.text}" → ` +
      `"${locked.text}", echo "${beforeLock.saved}" → "${locked.saved}"`,
  )
  await devtools.evaluate<null>(`(${lock}.click(), null)`)
  await poll(() => devtools.evaluate<boolean>(`${trigger}?.disabled === false`), 2_000)
}

/**
 * The accessible name Chromium computes for the element `expression` evaluates to, or `null` when
 * it evaluates to nothing.
 *
 * @param devtools The connected session.
 * @param expression A page expression that returns one element.
 */
async function computedName(devtools: Devtools, expression: string): Promise<string | null> {
  const { result } = await devtools.send<{ result: { objectId?: string } }>("Runtime.evaluate", {
    expression,
  })
  if (result.objectId === undefined) return null
  const { nodes } = await devtools.send<{ nodes: Array<{ name?: { value?: string } }> }>(
    "Accessibility.getPartialAXTree",
    { objectId: result.objectId, fetchRelatives: false },
  )
  return (nodes[0]?.name?.value ?? "").trim()
}

/**
 * An `InlineEdit` inside a heading, given `textId` that the heading's `aria-labelledby` points at,
 * leaves the heading's accessible name as the value alone, while the button inside it keeps its own
 * name, "Edit …". Without the id the heading would be named after the button.
 *
 * @param devtools The connected session, on the `ui` page.
 */
export async function inlineEditHeadingNameCheck(devtools: Devtools): Promise<void> {
  const heading = await computedName(
    devtools,
    `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-heading"]')`,
  )
  const button = await computedName(
    devtools,
    `document.querySelector('#demo-InlineEdit [data-e2e="inline-edit-in-heading"] button')`,
  )
  check(
    "a heading around an InlineEdit given textId is named by the value, not the edit button",
    heading === "Trip to Lisbon" && button === "Edit Trip to Lisbon",
    heading === null || button === null
      ? "the InlineEdit heading demo or its button is missing"
      : `heading "${heading}", button "${button}"`,
  )
}
