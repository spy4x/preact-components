import type { RefObject } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import {
  createHotkeyMatcher,
  isApplePlatform,
  isTypingTarget,
  matchesHotkey,
  parseHotkey,
} from "@spy4x/platform/browser/hotkeys"
import { isImeKeyPress } from "./ime.ts"
import type { KbdLabels } from "./kbd-keys.tsx"

/**
 * One keyboard shortcut for {@link useHotkeys}: a combination, what it does and how it is listed.
 */
export interface HotkeyBinding {
  /**
   * The combination: `"?"`, `"/"`, `"shift+n"`, `"mod+k"`, `"esc"`. `mod` is Command on Apple
   * platforms and Control elsewhere. A sequence of presses is written with spaces between them,
   * `"g i"`: the second key must follow within a second. A sequence never fires while the reader
   * types in a field, inside a dialog or a menu, or while a modal dialog is open, whatever
   * `inFields` and `inDialogs` say.
   */
  keys: string
  /** Runs when the combination is pressed. */
  handler: (event: KeyboardEvent) => void
  /** What the shortcut does, as `ShortcutsDialog` lists it. A binding without one is not listed. */
  description?: string
  /** The heading `ShortcutsDialog` lists it under. */
  group?: string
  /** Also fire while the reader types in a text field, a select or editable content. */
  inFields?: boolean
  /** Also fire while focus is inside a dialog or a menu, or while a modal dialog is open. */
  inDialogs?: boolean
  /** Whether to cancel the key press's default action. Defaults to `true`. */
  preventDefault?: boolean
}

/** Options of {@link useHotkeys}. */
export interface UseHotkeysOptions {
  /** Whether the shortcuts listen at all. Defaults to `true`. */
  enabled?: boolean
  /**
   * Whether `mod` means Command. Left out, it is read from the browser's platform when the
   * listener is attached, never during render.
   */
  apple?: boolean
}

/** A key press as {@link pickHotkey} sees it: the key, the modifiers and where it landed. */
export interface HotkeyPress {
  key: string
  /** The physical key (`"KeyK"`), which a letter or digit also matches by. */
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  /**
   * The event's `getModifierState`, which the matcher asks whether AltGr is held. Without it,
   * Control and Alt held together are read as AltGr.
   */
  getModifierState?(key: string): boolean
  /** The press landed in a text field, a select or editable content. */
  typing: boolean
  /** The press landed inside a dialog or a menu, or a modal dialog is open. */
  inDialog: boolean
}

/**
 * The binding a key press runs, or `undefined`: the first binding whose combination matches and
 * that may fire where the press landed. A press while typing only runs a binding with `inFields`,
 * and one inside a dialog or a menu only a binding with `inDialogs`. Sequences (`"g i"`) are
 * skipped: they need the presses before this one, which {@link createHotkeyListener} keeps.
 *
 * @param bindings The shortcuts, in priority order.
 * @param press The key press.
 * @param apple Whether `mod` means Command.
 * @throws {Error} When a binding's combination cannot be read.
 */
export function pickHotkey<Binding extends HotkeyBinding>(
  bindings: readonly Binding[],
  press: HotkeyPress,
  apple: boolean,
): Binding | undefined {
  return bindings.find((binding) =>
    !isSequence(binding.keys) &&
    (!press.typing || binding.inFields === true) &&
    (!press.inDialog || binding.inDialogs === true) &&
    matchesHotkey(parseHotkey(binding.keys), press, apple)
  )
}

/** Elements that count as a dialog for {@link HotkeyBinding.inDialogs} and `clickByHotkey`. */
const DIALOG_SELECTOR = "dialog, [role='dialog'], [role='alertdialog']"

/** Elements a press inside of skips every binding without {@link HotkeyBinding.inDialogs}. */
const SCOPE_SELECTOR = `${DIALOG_SELECTOR}, [role='menu']`

/** Whether `keys` is a sequence of presses, such as `"g i"`. */
function isSequence(keys: string): boolean {
  return /\s/.test(keys.trim())
}

/** The presses of `keys`: one for a combination, several for a sequence. */
function presses(keys: string): string[] {
  return keys.trim().split(/\s+/)
}

/**
 * The `keydown` listener {@link useHotkeys} attaches, on its own: it reads the bindings on every
 * press, runs the first that matches and cancels the press's default action. Single presses go
 * through {@link pickHotkey}: one without `inDialogs` is skipped inside a dialog or a menu and while
 * a modal dialog is open. Sequences go through ts-libs' `createHotkeyMatcher`, which keeps the first
 * key for a second; a press in a field, while composing, inside a dialog or a menu or under a modal
 * dialog matches no sequence and drops a waiting key. The matcher is rebuilt only when the
 * sequences change. A completed sequence wins over a single press of its last key.
 *
 * @param bindings Reads the bindings, in priority order, when a key is pressed.
 * @param apple Whether `mod` means Command.
 */
export function createHotkeyListener(
  bindings: () => readonly HotkeyBinding[],
  apple: boolean,
): (event: KeyboardEvent) => void {
  return keydownListener(bindings, apple, sequenceMatcher(apple))
}

/** Finds the sequence a press completes, given the bindings and whether the press is in scope. */
type SequenceMatch = (
  event: KeyboardEvent,
  bindings: readonly HotkeyBinding[],
  inDialog: boolean,
) => HotkeyBinding | undefined

/**
 * The sequence half of {@link createHotkeyListener}: one ts-libs matcher over the bindings with a
 * space in their keys, rebuilt when those change, so a waiting first key survives a re-render.
 */
function sequenceMatcher(apple: boolean): SequenceMatch {
  let matcher: { signature: string; match: (event: KeyboardEvent) => number | undefined } | null =
    null
  let scoped = false
  return (event, bindings, inDialog) => {
    const sequences = bindings.flatMap((binding, index) => isSequence(binding.keys) ? [index] : [])
    const signature = sequences.map((index) => bindings[index].keys).join("\n")
    if (matcher?.signature !== signature) {
      matcher = {
        signature,
        match: createHotkeyMatcher<number, KeyboardEvent>(
          sequences.map((index) => ({ id: index, keys: presses(bindings[index].keys) })),
          { apple, ignore: () => scoped },
        ),
      }
    }
    scoped = inDialog
    const done = matcher.match(event)
    return done === undefined ? undefined : bindings[done]
  }
}

/**
 * A `keydown` listener over single presses, plus sequences when `sequences` is given. Kept apart
 * so `useHotkeyClick`, which every `Button` with a `hotkey` uses, does not bundle the sequence
 * matcher.
 */
function keydownListener(
  bindings: () => readonly HotkeyBinding[],
  apple: boolean,
  sequences?: SequenceMatch,
): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.defaultPrevented || isImeKeyPress(event)) return
    // The target can be the document or a text node, which have no `closest`.
    const target = event.target as Partial<Element> | null
    const inDialog = (target?.closest?.(SCOPE_SELECTOR) ?? null) !== null || openModal() !== null
    const current = bindings()
    const binding = sequences?.(event, current, inDialog) ?? pickHotkey(current, {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      // A plain `Event`, which some browsers send on autofill, has no `getModifierState`.
      getModifierState: event.getModifierState?.bind(event),
      typing: isTypingTarget(target as HTMLElement | null),
      inDialog,
    }, apple)
    if (binding === undefined) return
    if (binding.preventDefault !== false) event.preventDefault()
    binding.handler(event)
  }
}

/** Attaches the listener `create` makes to `document` while mounted and `enabled`. */
function useKeydown(
  bindings: readonly HotkeyBinding[],
  { enabled = true, apple }: UseHotkeysOptions,
  create: (bindings: () => readonly HotkeyBinding[], apple: boolean) => (e: KeyboardEvent) => void,
): void {
  for (const binding of bindings) presses(binding.keys).forEach((keys) => parseHotkey(keys))
  const latest = useRef(bindings)
  latest.current = bindings

  useEffect(() => {
    if (!enabled) return
    const listener = create(() => latest.current, apple ?? isApplePlatform())
    document.addEventListener("keydown", listener)
    return () => document.removeEventListener("keydown", listener)
  }, [enabled, apple])
}

/**
 * Page-wide keyboard shortcuts: listens for `keydown` on `document` while the component is
 * mounted, and runs the first binding that matches.
 *
 * Key presses in a text field, a select or `contenteditable` content are left alone, and so are
 * presses inside a dialog or a menu and while a modal dialog is open, unless a binding opts in with
 * `inFields` or `inDialogs`. A sequence such as `"g i"` fires on its last key, and never in those
 * places. A press another handler already cancelled, and a press that composes text through an
 * input method, run nothing. A matched press has its default action cancelled unless the binding
 * says `preventDefault: false`. The listener itself is {@link createHotkeyListener}.
 *
 * The bindings are read when a key is pressed, so an inline array with inline handlers is fine:
 * the listener is attached once and always runs the handlers of the latest render. Every
 * combination is parsed during render too, so a mistyped one throws where it is written instead of
 * on the first key press.
 *
 * @param bindings The shortcuts, in priority order.
 * @param options See {@link UseHotkeysOptions}.
 */
export function useHotkeys(
  bindings: readonly HotkeyBinding[],
  options: UseHotkeysOptions = {},
): void {
  useKeydown(bindings, options, createHotkeyListener)
}

/**
 * Whether a switch for single-key shortcuts turns these keys off: every press is a plain key, with
 * no Control, Command, Alt or `mod`, such as `"?"`, `"n"` or `"g i"`. Escape and Enter are not,
 * because they type nothing, and a reader who turns single keys off (WCAG 2.1.4, a page must let
 * them) still needs them.
 *
 * @param keys A combination or a sequence, as {@link HotkeyBinding.keys} takes it.
 * @throws {Error} When a press cannot be read.
 */
export function isSingleKey(keys: string): boolean {
  return presses(keys).every((press) => {
    const hotkey = parseHotkey(press)
    return !hotkey.mod && !hotkey.ctrl && !hotkey.meta && !hotkey.alt &&
      hotkey.key !== "escape" && hotkey.key !== "enter"
  })
}

/**
 * The shortcuts that work now: all of them, or, while single keys are off, the ones that are not
 * {@link isSingleKey}. Pass the result to both `useHotkeys` and `ShortcutsDialog`, so the dialog
 * never lists a key that does nothing.
 *
 * @param shortcuts Bindings or dialog rows; anything with `keys`.
 * @param singleKeys Whether single-key shortcuts are on.
 */
export function activeShortcuts<Shortcut extends { keys: string }>(
  shortcuts: readonly Shortcut[],
  singleKeys: boolean,
): Shortcut[] {
  return singleKeys ? [...shortcuts] : shortcuts.filter((shortcut) => !isSingleKey(shortcut.keys))
}

/**
 * The props a component takes to bind a key to its own button: `hotkey` binds it and announces it,
 * and a `Kbd` hint inside the button shows it.
 */
export interface HotkeyProps {
  /**
   * A combination such as `"n"`, `"shift+n"` or `"mod+k"`, written the way `useHotkeys` takes it.
   * Pressing it clicks the button while the button is mounted, enabled and shown. A plain key typed
   * in a text field does nothing, but a combination holding Control, Command or `mod` fires there
   * too, because it types no text. The field keeps its own editing chords (`mod+a`, `mod+c`,
   * `mod+v`, `mod+x`, `mod+z`, `mod+y`). A press outside a dialog that holds the button does
   * nothing. It also sets `aria-keyshortcuts`.
   */
  hotkey?: string
  /**
   * Whether a `Kbd` hint inside the button shows the key. Defaults to `true`, but to `false` on an
   * icon-only button, which has no room for one. The hint is never shown on a screen whose main
   * pointer is coarse, such as a phone, and screen readers skip it: they read `aria-keyshortcuts`.
   */
  hotkeyHint?: boolean
  /** The words the hint shows for a key; see `KBD_LABELS`. */
  kbdLabels?: Partial<KbdLabels>
}

/** ARIA's name of each key whose `KeyboardEvent.key` value is not its character in upper case. */
const ARIA_KEYS: Readonly<Record<string, string>> = {
  " ": "Space",
  "+": "Plus",
  escape: "Escape",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  contextmenu: "ContextMenu",
}

/**
 * A combination written the way `useHotkeys` takes it (`"mod+k"`), in the syntax of the
 * `aria-keyshortcuts` attribute (`"Control+K"`): modifiers first, named as `KeyboardEvent.key`
 * names them, joined by `+`.
 *
 * `mod` becomes `Meta` on Apple platforms and `Control` elsewhere. A letter is upper case, the
 * space bar is `Space`, a named key keeps its `KeyboardEvent.key` spelling (`ArrowUp`, `PageDown`),
 * and the `+` key is `Plus`, because a bare `+` would read as the separator.
 *
 * Any other character stays as it is: `"?"` is `?`, not `Shift+/`. The specification prefers the
 * keys that produce a shifted character, but which keys those are depends on the keyboard layout,
 * and `useHotkeys` matches the character, not the keys.
 *
 * @param keys The combination, such as `"mod+shift+k"`.
 * @param apple Whether `mod` means Command.
 * @throws {Error} When the combination cannot be read.
 */
export function ariaKeyShortcuts(keys: string, apple: boolean): string {
  const hotkey = parseHotkey(keys)
  const parts: string[] = []
  if (hotkey.ctrl || (hotkey.mod && !apple)) parts.push("Control")
  if (hotkey.alt) parts.push("Alt")
  if (hotkey.shift) parts.push("Shift")
  if (hotkey.meta || (hotkey.mod && apple)) parts.push("Meta")
  parts.push(ARIA_KEYS[hotkey.key] ?? hotkey.key.toUpperCase())
  return parts.join("+")
}

/** The open modal `<dialog>`, or `null`; `null` too in a browser that cannot match `:modal`. */
function openModal(): Element | null {
  try {
    return document.querySelector("dialog:modal")
  } catch {
    return null
  }
}

/**
 * Click an element for a key press, the way a hotkey should: only when the reader could have
 * clicked it themselves. Returns whether it clicked; when it did, it also cancelled the key press's
 * default action, so no other hotkey listener runs for it.
 *
 * It does nothing when the element is gone, disabled (`disabled`, or `aria-disabled="true"` as a
 * busy `Button` sets), inert, not rendered (inside a closed `<details>`, a hidden tab panel or a
 * closed dialog), or outside the dialog the press landed in. While a modal dialog is open, only an
 * element inside it is clicked.
 *
 * A key held down repeats its press. A repeat is cancelled, as the first press was, but clicks
 * nothing: holding N makes one note, not twenty.
 *
 * An element that is hidden on purpose until it is wanted, such as an item of a closed menu, names
 * the element that stands for it on screen as `shown`, such as the menu's trigger: the press then
 * clicks the hidden element while `shown` is rendered.
 *
 * @param element The element to click, such as the button a hotkey belongs to.
 * @param event The key press.
 * @param shown The element that has to be rendered; `element` itself by default.
 */
export function clickByHotkey(
  element: HTMLElement | null,
  event: KeyboardEvent,
  shown: Element | null = element,
): boolean {
  if (element === null || !element.isConnected) return false
  if (element.matches(":disabled, [aria-disabled='true']")) return false
  if (element.closest("[inert]") !== null) return false
  if (shown === null || shown.getClientRects().length === 0) return false
  // The target can be the document, which has no `closest`.
  const target = event.target as Partial<Element> | null
  const scope = target?.closest?.(DIALOG_SELECTOR) ?? openModal()
  if (scope !== null && !scope.contains(element)) return false
  event.preventDefault()
  if (!event.repeat) element.click()
  return true
}

/**
 * Keys a text field answers with Control or Command held: select all, copy, paste, cut, undo and
 * redo.
 */
const FIELD_EDITING_KEYS: ReadonlySet<string> = new Set(["a", "c", "v", "x", "z", "y"])

/**
 * Whether a combination may fire while the reader types in a field: it holds Control, Command or
 * `mod`, so pressing it types no text. Alt does not count, because on a Mac Option types a
 * character. A field's own editing chords (`mod+a`, `mod+c`, `mod+v`, `mod+x`, `mod+z`, `mod+y`,
 * with or without Shift) stay with the field, so a button with `hotkey="mod+z"` never takes Undo
 * away from the text being typed.
 *
 * @param keys The combination, such as `"mod+enter"`.
 * @throws {Error} When the combination cannot be read.
 */
export function firesInFields(keys: string): boolean {
  const hotkey = parseHotkey(keys)
  if (FIELD_EDITING_KEYS.has(hotkey.key)) return false
  return hotkey.ctrl || hotkey.meta || hotkey.mod
}

/**
 * The {@link useHotkeys} binding that clicks an element through {@link clickByHotkey}. It fires in
 * a dialog, and in a text field only for a combination that holds Control, Command or `mod` and
 * is not one of the field's own editing chords, such as `mod+z`. It leaves the key press alone
 * unless it clicks, so a disabled button passes its key on.
 *
 * @param keys The combination, such as `"n"` or `"mod+enter"`.
 * @param element Reads the element when the key is pressed.
 * @param shown Reads the element that has to be rendered, when it is not `element` itself; see
 * {@link clickByHotkey}.
 * @throws {Error} When the combination cannot be read.
 */
export function hotkeyClickBinding(
  keys: string,
  element: () => HTMLElement | null,
  shown?: () => Element | null,
): HotkeyBinding {
  return {
    keys,
    inDialogs: true,
    inFields: firesInFields(keys),
    preventDefault: false,
    handler: (event) => {
      const target = element()
      void clickByHotkey(target, event, shown === undefined ? target : shown())
    },
  }
}

/**
 * Bind a key to one element: pressing it clicks the element through {@link clickByHotkey}. Returns
 * the ref to put on that element. With `keys` left out, or `enabled` false, nothing listens.
 *
 * A plain key pressed in a text field, a select or editable content does nothing, so typing never
 * clicks anything; a combination holding Control, Command or `mod` fires there too, except the
 * field's own editing chords, such as `mod+z`.
 *
 * @param keys The combination, such as `"n"` or `"mod+enter"`.
 * @param options See {@link UseHotkeysOptions}.
 */
export function useHotkeyClick<Target extends HTMLElement>(
  keys: string | undefined,
  options: UseHotkeysOptions = {},
): RefObject<Target> {
  const ref = useRef<Target>(null)
  useKeydown(
    keys === undefined ? [] : [hotkeyClickBinding(keys, () => ref.current)],
    { ...options, enabled: keys !== undefined && (options.enabled ?? true) },
    (bindings, apple) => keydownListener(bindings, apple),
  )
  return ref
}

/**
 * Whether this browser is an Apple platform, for drawing or announcing `mod` as Command. Read in an
 * effect, so a server render and the first browser render agree on `false`. When `apple` is given,
 * that is the answer and nothing is read.
 *
 * @param apple The caller's answer, when it has one.
 */
export function useApplePlatform(apple?: boolean): boolean {
  const [detected, setDetected] = useState(false)
  useEffect(() => {
    if (apple === undefined) setDetected(isApplePlatform())
  }, [apple])
  return apple ?? detected
}
