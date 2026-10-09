import { cn } from "@spy4x/preact-cn"
import { type ComponentChildren, Fragment, type JSX } from "preact"
import { parseHotkey } from "@spy4x/platform/browser/hotkeys"
import { useApplePlatform } from "./hotkeys.ts"

/**
 * The words {@link Kbd} shows or reads out for a key. Each has an English default in
 * {@link KBD_LABELS}; pass only the ones you want to change.
 */
export interface KbdLabels {
  /** Name of ⌘ on Apple platforms. */
  command: string
  /** Name of ⌃ on Apple platforms. */
  control: string
  /** Name of ⌥ on Apple platforms. */
  option: string
  /** Name of ⇧ on Apple platforms, and the Shift key's text elsewhere. */
  shift: string
  /** The Control key's text outside Apple platforms. */
  ctrl: string
  /** The Alt key's text outside Apple platforms. */
  alt: string
  /** The Meta key's text outside Apple platforms (the Windows or Super key). */
  meta: string
  /** The Escape key's text. */
  escape: string
  /** The Enter key's text. */
  enter: string
  /** The space bar's text. */
  space: string
  /** The Tab key's text. */
  tab: string
  /** The Backspace key's text. */
  backspace: string
  /** The Delete key's text. */
  delete: string
  /** Name of the ↑ key. */
  up: string
  /** Name of the ↓ key. */
  down: string
  /** Name of the ← key. */
  left: string
  /** Name of the → key. */
  right: string
}

/** English defaults for every {@link KbdLabels} entry. */
export const KBD_LABELS: Readonly<KbdLabels> = {
  command: "Command",
  control: "Control",
  option: "Option",
  shift: "Shift",
  ctrl: "Ctrl",
  alt: "Alt",
  meta: "Meta",
  escape: "Esc",
  enter: "Enter",
  space: "Space",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  up: "Up arrow",
  down: "Down arrow",
  left: "Left arrow",
  right: "Right arrow",
}

/** How one key of a combination is drawn: what is on the key, and its name when that is a glyph. */
export interface KeyFace {
  /** What the key shows. */
  text: string
  /** The accessible name, only when {@link KeyFace.text} is a glyph a screen reader may not read. */
  name?: string
}

/** Keys named by a word in {@link KbdLabels}, by their lowercased `KeyboardEvent.key`. */
const WORD_KEYS: Readonly<Record<string, keyof KbdLabels>> = {
  escape: "escape",
  enter: "enter",
  " ": "space",
  tab: "tab",
  backspace: "backspace",
  delete: "delete",
}

/** Arrow keys: the glyph on the key and the label that names it. */
const ARROW_KEYS: Readonly<Record<string, [string, keyof KbdLabels]>> = {
  arrowup: ["↑", "up"],
  arrowdown: ["↓", "down"],
  arrowleft: ["←", "left"],
  arrowright: ["→", "right"],
}

/**
 * The faces of every key in a combination, modifiers first, in the order the platform
 * writes them: ⌃ ⌥ ⇧ ⌘ on Apple platforms, Ctrl Alt Shift Meta elsewhere.
 *
 * `mod` becomes ⌘ (named "Command") on Apple platforms and Ctrl elsewhere.
 *
 * @param keys The combination, such as `"mod+shift+k"`, written the way `useHotkeys` takes it.
 * @param apple Whether to draw Apple's modifier glyphs.
 * @param labels The words to use; see {@link KBD_LABELS}.
 * @throws {Error} When the combination cannot be read.
 */
export function keyFaces(keys: string, apple: boolean, labels: KbdLabels = KBD_LABELS): KeyFace[] {
  const hotkey = parseHotkey(keys)
  const ctrl = hotkey.ctrl || (hotkey.mod && !apple)
  const meta = hotkey.meta || (hotkey.mod && apple)
  const faces: KeyFace[] = []
  if (apple) {
    if (ctrl) faces.push({ text: "⌃", name: labels.control })
    if (hotkey.alt) faces.push({ text: "⌥", name: labels.option })
    if (hotkey.shift) faces.push({ text: "⇧", name: labels.shift })
    if (meta) faces.push({ text: "⌘", name: labels.command })
  } else {
    if (ctrl) faces.push({ text: labels.ctrl })
    if (hotkey.alt) faces.push({ text: labels.alt })
    if (hotkey.shift) faces.push({ text: labels.shift })
    if (meta) faces.push({ text: labels.meta })
  }
  faces.push(keyFace(hotkey.key, labels))
  return faces
}

/** The face of the one key that is not a modifier. */
function keyFace(key: string, labels: KbdLabels): KeyFace {
  const word = WORD_KEYS[key]
  if (word !== undefined) return { text: labels[word] }
  const arrow = ARROW_KEYS[key]
  if (arrow !== undefined) return { text: arrow[0], name: labels[arrow[1]] }
  if (key.length === 1 || /^f\d+$/.test(key)) return { text: key.toUpperCase() }
  return { text: key.charAt(0).toUpperCase() + key.slice(1) }
}

/** Props of {@link Kbd}. Pass `keys` or `children`. */
export interface KbdProps {
  /**
   * A combination such as `"mod+k"`, `"?"` or `"esc"`, written the way `useHotkeys` takes it.
   * `mod` is ⌘ on Apple platforms and Ctrl elsewhere. Throws when the combination cannot be read.
   */
  keys?: string
  /** A key written by hand, used when there is no `keys`: `<Kbd>Tab</Kbd>`. */
  children?: ComponentChildren
  /**
   * Whether to draw Apple's modifier glyphs. Left out, the server and the first browser render draw
   * Ctrl, and an effect then switches to ⌘ on an Apple platform, so both renders match.
   */
  apple?: boolean
  /** The words the keys show or are read as; see {@link KBD_LABELS}. */
  labels?: Partial<KbdLabels>
  /** Extra classes for the outer element. */
  class?: string
}

const keyClass =
  "inline-flex h-6 min-w-6 items-center justify-center rounded border border-control bg-canvas px-1 font-mono text-xs font-medium text-foreground shadow-raised"

/**
 * One key or a combination of keys, as the HTML `<kbd>` element: `<Kbd keys="mod+k" />` renders
 * an outer `<kbd>` holding one `<kbd>` per key.
 *
 * A glyph that a screen reader may not read (⌘, ⌥, ⇧, ⌃ and the arrows) is hidden from it and
 * followed by its name in visually hidden text, so ⌘K is read as "Command K". Outside Apple
 * platforms the keys are words, joined by `+`.
 *
 * The platform is never read during render: see {@link KbdProps.apple}.
 */
export function Kbd({ keys, children, apple, labels, class: className }: KbdProps): JSX.Element {
  const isApple = useApplePlatform(apple)
  if (keys === undefined) return <kbd class={cn(keyClass, className)}>{children}</kbd>

  const faces = keyFaces(keys, isApple, { ...KBD_LABELS, ...labels })
  if (faces.length === 1) return <KeyCap face={faces[0]} class={className} />
  return (
    <kbd
      class={cn(
        "inline-flex items-center gap-1 text-xs text-muted",
        className,
      )}
    >
      {faces.map((face, index) => (
        <Fragment key={index}>
          {index > 0 && !isApple && <span>+</span>}
          <KeyCap face={face} />
        </Fragment>
      ))}
    </kbd>
  )
}

/** One key: its text, or its glyph hidden from assistive technology and its name in hidden text. */
function KeyCap({ face, class: className }: { face: KeyFace; class?: string }): JSX.Element {
  if (face.name === undefined) return <kbd class={cn(keyClass, className)}>{face.text}</kbd>
  return (
    <kbd class={cn(keyClass, className)} title={face.name}>
      <span aria-hidden="true">{face.text}</span>
      <span class="sr-only">{face.name}</span>
    </kbd>
  )
}
