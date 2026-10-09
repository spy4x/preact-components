import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { useApplePlatform } from "./hotkeys.ts"
import {
  GROUP_CLASS,
  KBD_LABELS,
  KbdKeys,
  type KbdLabels,
  KEY_CLASS,
  keyFaces,
} from "./kbd-keys.tsx"

export { KBD_LABELS, type KbdLabels, type KeyFace, keyFaces } from "./kbd-keys.tsx"

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
  if (keys === undefined) return <kbd class={cn(KEY_CLASS, className)}>{children}</kbd>

  const faces = keyFaces(keys, isApple, { ...KBD_LABELS, ...labels })
  return (
    <KbdKeys
      faces={faces}
      apple={isApple}
      singleClass={cn(KEY_CLASS, className)}
      groupClass={cn(GROUP_CLASS, className)}
    />
  )
}
