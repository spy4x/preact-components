import { useEffect, useRef } from "preact/hooks"
import { isApplePlatform, isTypingTarget, matchesHotkey, parseHotkey } from "./hotkey-matcher.ts"

/**
 * One keyboard shortcut for {@link useHotkeys}: a combination, what it does and how it is listed.
 */
export interface HotkeyBinding {
  /**
   * The combination: `"?"`, `"/"`, `"shift+n"`, `"mod+k"`, `"esc"`. `mod` is Command on Apple
   * platforms and Control elsewhere. One key press only; a sequence such as `"g i"` throws.
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
  /** Also fire while focus is inside a dialog. */
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
  /** The press landed in a text field, a select or editable content. */
  typing: boolean
  /** The press landed inside a dialog. */
  inDialog: boolean
}

/**
 * The binding a key press runs, or `undefined`: the first binding whose combination matches and
 * that may fire where the press landed. A press while typing only runs a binding with `inFields`,
 * and one inside a dialog only a binding with `inDialogs`.
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
    (!press.typing || binding.inFields === true) &&
    (!press.inDialog || binding.inDialogs === true) &&
    matchesHotkey(parseHotkey(binding.keys), press, apple)
  )
}

/** Elements that count as a dialog for {@link HotkeyBinding.inDialogs}. */
const DIALOG_SELECTOR = "dialog, [role='dialog'], [role='alertdialog']"

/**
 * Page-wide keyboard shortcuts: listens for `keydown` on `document` while the component is
 * mounted, and runs the first binding that matches.
 *
 * Key presses in a text field, a select or `contenteditable` content are left alone, and so are
 * presses inside a dialog, unless a binding opts in with `inFields` or `inDialogs`. A press another
 * handler already cancelled, and a press that composes text through an input method, run nothing.
 * A matched press has its default action cancelled unless the binding says `preventDefault: false`.
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
  { enabled = true, apple }: UseHotkeysOptions = {},
): void {
  for (const binding of bindings) parseHotkey(binding.keys)
  const latest = useRef(bindings)
  latest.current = bindings

  useEffect(() => {
    if (!enabled) return
    const isApple = apple ?? isApplePlatform()
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof Element ? event.target : null
      const binding = pickHotkey(latest.current, {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        typing: isTypingTarget(target as HTMLElement | null),
        inDialog: (target?.closest(DIALOG_SELECTOR) ?? null) !== null,
      }, isApple)
      if (binding === undefined) return
      if (binding.preventDefault !== false) event.preventDefault()
      binding.handler(event)
    }
    document.addEventListener("keydown", listener)
    return () => document.removeEventListener("keydown", listener)
  }, [enabled, apple])
}
