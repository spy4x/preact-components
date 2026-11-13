import { centreInView, check, type Devtools, poll, pressKey } from "../harness.ts"
import { type Chord, pressChord, SHORTCUTS_STATE } from "./shared.ts"
import { pressImeKey, RECORD_IME_KEYS, TAKE_IME_KEYS } from "./shared-typing.ts"

/** `?` as a US keyboard types it: Shift and the slash key. */
const QUESTION_MARK: Chord = { key: "?", code: "Slash", keyCode: 191, text: "?", modifiers: 8 }

/** Control+Alt+? on a US keyboard, which has no AltGr: Control, Alt, Shift and the slash key. */
const CONTROL_ALT_QUESTION_MARK: Chord = { key: "?", code: "Slash", keyCode: 191, modifiers: 11 }

/** The modifiers the page saw on one key press, as {@link RECORD_NEXT_PRESS} stores them. */
interface SeenModifiers {
  ctrl: boolean
  alt: boolean
  /** `getModifierState("AltGraph")`. */
  altGraph: boolean
}

/** Stores the modifiers of the page's next key press in `window.__shortcutsSeen`, once. */
const RECORD_NEXT_PRESS = `document.addEventListener("keydown", (event) => {
  window.__shortcutsSeen = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    altGraph: event.getModifierState("AltGraph"),
  }
}, { capture: true, once: true })`

/** Reads and clears what {@link RECORD_NEXT_PRESS} stored: `null` when no press came. */
const TAKE_SEEN_PRESS = `(() => {
  const seen = window.__shortcutsSeen ?? null
  delete window.__shortcutsSeen
  return seen
})()`

/** What one read of the `ShortcutsDialog` card sees. */
interface ShortcutsState {
  /** The dialog is open and in the top layer. */
  modal: boolean
  /** Presses the demo's plain `i` binding counted. */
  plain: number
  /** Presses the demo's `mod+i` binding counted. */
  combo: number
  /** Presses the demo's `enter` binding counted. */
  enter: number
  /** Presses the demo's `esc` binding counted. */
  escape: number
  /** The demo's text field's value. */
  field: string
  /** `data-e2e` of the focused element, or its tag name. */
  active: string
  /** Focus is inside the dialog. */
  focusInDialog: boolean
}

/**
 * `useHotkeys` and `ShortcutsDialog`, driven with real key presses on the `ShortcutsDialog` card.
 *
 * The hook listens on `document`, so what it does depends on where a press lands and which
 * modifiers it carries, and a string render sees neither. A plain `i` and `mod+i` are each counted
 * by their own binding, and each press has to move its own count and leave the other alone. `?`
 * typed in the card's text field has to stay in the field. Control+Alt+? on the card's button has
 * to open nothing: the browser reports AltGr released, so the hook has to pass the event's
 * `getModifierState` to the matcher, which then reads the press as a Control+Alt chord rather
 * than as AltGr typing `?`. `?` pressed with focus on the card's button has to open the dialog,
 * and Escape has to close it and put focus back on that button. While the dialog is open, a plain
 * `i` has to run nothing, because the hook skips presses inside a dialog. After Escape, `?` has to
 * open the dialog again, which fails when the dialog's close never reaches the caller's `open`
 * state. Last, the card's checkbox turns the hook's `enabled` option off, and a plain `i` has to
 * stop counting; it is turned back on before the function returns. With focus on the page itself,
 * an Enter and an Escape sent with keyCode 229, as an input method's own presses arrive, have to run
 * neither of the demo's Enter and Escape bindings, and a plain Enter and Escape then have to run both.
 *
 * `mod` is Control in the Linux browser `verify` drives; the check still reads the page's platform
 * and sends Command on an Apple one, so it tests the same combination the demo binds.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function shortcutsChecks(devtools: Devtools): Promise<void> {
  const button = `document.querySelector('#demo-ShortcutsDialog [data-e2e="shortcuts-open"]')`
  const field = `document.querySelector('#demo-ShortcutsDialog [data-e2e="shortcuts-field"]')`
  const present = await devtools.evaluate<boolean>(`${button} !== null && ${field} !== null`)
  check("the ShortcutsDialog card is on the page, with its button and its text field", present)
  if (!present) return
  await centreInView(devtools, button)

  const apple = await devtools.evaluate<boolean>(
    `/mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform || navigator.platform || "")`,
  )
  const plainI: Chord = { key: "i", code: "KeyI", keyCode: 73, text: "i", modifiers: 0 }
  const modI: Chord = { key: "i", code: "KeyI", keyCode: 73, modifiers: apple ? 4 : 2 }
  const read = () => devtools.evaluate<ShortcutsState>(SHORTCUTS_STATE)
  // A fixed wait, not a poll, for the checks below that prove a press does nothing: an absence has
  // no state to poll for. A press that ran a handler re-renders the counts at once; give a wrong
  // one time to show up.
  const settle = () => new Promise((done) => setTimeout(done, 200))
  // The toggle reaches useHotkeys through an effect, which leaves nothing on the page to poll for.
  // Preact runs effects after the next paint, in a task after an animation frame; two such yields
  // in the page are past it, however loaded the machine.
  const effectsRan = () =>
    devtools.evaluate<null>(`(async () => {
      for (let k = 0; k < 2; k++) {
        await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)))
      }
      return null
    })()`)
  const until = (expression: string) =>
    poll(
      () =>
        devtools.evaluate<boolean>(
          `(() => { const state = ${SHORTCUTS_STATE}; return ${expression} })()`,
        ),
      3_000,
    )

  await devtools.evaluate<null>(`(${button}.focus(), null)`)
  const start = await read()
  await pressChord(devtools, plainI)
  await until(`state.plain === ${start.plain + 1}`)
  const afterPlain = await read()
  await pressChord(devtools, modI)
  await until(`state.combo === ${start.combo + 1}`)
  const afterCombo = await read()
  check(
    "useHotkeys runs mod+I's handler for mod+I and not for a plain I, and the reverse",
    afterPlain.plain === start.plain + 1 && afterPlain.combo === start.combo &&
      afterCombo.combo === start.combo + 1 && afterCombo.plain === afterPlain.plain,
    `plain I: plain ${start.plain} → ${afterPlain.plain}, mod ${start.combo} → ` +
      `${afterPlain.combo}; ${apple ? "Command" : "Control"}+I: plain ${afterPlain.plain} → ` +
      `${afterCombo.plain}, mod ${afterPlain.combo} → ${afterCombo.combo}`,
  )

  await devtools.evaluate<null>(`(${field}.focus(), ${field}.value = "", null)`)
  await pressChord(devtools, QUESTION_MARK)
  await settle()
  const typed = await read()
  check(
    "? typed in a text field stays in the field and does not open the ShortcutsDialog",
    typed.field === "?" && !typed.modal,
    `field "${typed.field}", dialog ${typed.modal ? "opened" : "stayed closed"}`,
  )

  await devtools.evaluate<null>(`(${button}.focus(), ${RECORD_NEXT_PRESS}, null)`)
  const beforeChord = await read()
  await pressChord(devtools, CONTROL_ALT_QUESTION_MARK)
  await settle()
  const afterChord = await read()
  const seen = await devtools.evaluate<SeenModifiers | null>(TAKE_SEEN_PRESS)
  check(
    "useHotkeys reads Control+Alt+? with AltGr released as a chord and opens no ShortcutsDialog",
    seen !== null && seen.ctrl && seen.alt && !seen.altGraph && !beforeChord.modal &&
      !afterChord.modal,
    `page saw ${seen === null ? "no press" : JSON.stringify(seen)}, dialog ` +
      `${beforeChord.modal ? "open" : "closed"} → ${afterChord.modal ? "open" : "closed"}`,
  )

  await devtools.evaluate<null>(`(${button}.focus(), null)`)
  await pressChord(devtools, QUESTION_MARK)
  await poll(() => devtools.evaluate<boolean>(`${SHORTCUTS_STATE}.modal`), 3_000)
  const opened = await read()
  check(
    "? pressed on the page opens the ShortcutsDialog and moves focus into it",
    opened.modal && opened.focusInDialog,
    `dialog ${opened.modal ? "open" : "closed"}, focus on ${opened.active}`,
  )

  await pressChord(devtools, plainI)
  await settle()
  const insideDialog = await read()
  check(
    "a plain I pressed inside the open ShortcutsDialog runs no shortcut",
    opened.modal && insideDialog.focusInDialog && insideDialog.plain === opened.plain,
    `dialog ${opened.modal ? "open" : "closed"}, focus in dialog ${insideDialog.focusInDialog}, ` +
      `plain ${opened.plain} → ${insideDialog.plain}`,
  )

  await pressKey(devtools, "Escape")
  await poll(() => devtools.evaluate<boolean>(`!${SHORTCUTS_STATE}.modal`), 3_000)
  const closed = await read()
  check(
    "Escape closes the ShortcutsDialog and returns focus to the button that had it",
    opened.modal && !closed.modal && closed.active === "shortcuts-open",
    `dialog ${opened.modal ? "open" : "never opened"} → ${closed.modal ? "open" : "closed"}, ` +
      `focus on ${closed.active}`,
  )

  await devtools.evaluate<null>(`(${button}.focus(), null)`)
  await pressChord(devtools, QUESTION_MARK)
  const reopened = await poll(() => devtools.evaluate<boolean>(`${SHORTCUTS_STATE}.modal`), 3_000)
  await pressKey(devtools, "Escape")
  const reclosed = await poll(() => devtools.evaluate<boolean>(`!${SHORTCUTS_STATE}.modal`), 3_000)
  check(
    "? opens the ShortcutsDialog again after Escape closed it",
    !closed.modal && reopened && reclosed,
    `closed first ${!closed.modal}, reopened ${reopened}, closed again ${reclosed}`,
  )

  const toggle = `document.querySelector('#demo-ShortcutsDialog [data-e2e="shortcuts-enabled"]')`
  const wasOn = await devtools.evaluate<boolean>(`${toggle}?.checked === true`)
  await devtools.evaluate<null>(`(${toggle}.click(), null)`)
  await effectsRan()
  await devtools.evaluate<null>(`(${button}.focus(), null)`)
  const off = await read()
  await pressChord(devtools, plainI)
  await settle()
  const afterOff = await read()
  check(
    "turning the ShortcutsDialog demo's shortcuts off (useHotkeys enabled: false) stops a plain I",
    wasOn && afterOff.plain === off.plain,
    `checkbox on before ${wasOn}, plain ${off.plain} → ${afterOff.plain} after I with it off`,
  )
  // Back on, so the card is left as the page loaded it.
  await devtools.evaluate<null>(`(${toggle}.click(), null)`)
  await effectsRan()

  // Safari's Enter that ends an input method's composition: keyCode 229, `isComposing` false. The
  // presses land on the page itself, outside any field or dialog, where the demo's `enter` and
  // `esc` bindings would run. A plain Enter and Escape after them has to run both.
  await devtools.evaluate<null>(`(document.activeElement?.blur(), ${RECORD_IME_KEYS})`)
  const beforeIme = await read()
  await pressImeKey(devtools, "Enter")
  await pressImeKey(devtools, "Escape")
  await settle()
  const keys = await devtools.evaluate<string>(TAKE_IME_KEYS)
  const afterIme = await read()
  check(
    "useHotkeys runs no Enter or Escape binding for a key press with keyCode 229",
    keys === "Enter 229 false, Escape 229 false" && afterIme.enter === beforeIme.enter &&
      afterIme.escape === beforeIme.escape,
    `the page saw [${keys}]; Enter ${beforeIme.enter} → ${afterIme.enter}, Escape ` +
      `${beforeIme.escape} → ${afterIme.escape}`,
  )
  await pressKey(devtools, "Enter")
  await pressKey(devtools, "Escape")
  await until(`state.enter === ${afterIme.enter + 1} && state.escape === ${afterIme.escape + 1}`)
  const plainKeys = await read()
  check(
    "useHotkeys still runs the Enter and Escape bindings for a plain Enter and Escape",
    plainKeys.enter === afterIme.enter + 1 && plainKeys.escape === afterIme.escape + 1 &&
      !plainKeys.modal,
    `Enter ${afterIme.enter} → ${plainKeys.enter}, Escape ${afterIme.escape} → ` +
      `${plainKeys.escape}, dialog ${plainKeys.modal ? "open" : "closed"}`,
  )
}
