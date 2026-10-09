import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { Fragment } from "preact"
import { useApplePlatform } from "./hotkeys.ts"
import {
  GROUP_CLASS,
  KBD_LABELS,
  KbdKeys,
  type KbdLabels,
  KEY_CLASS,
  keyFaces,
  sequenceSteps,
} from "./kbd-keys.tsx"

export { KBD_LABELS, type KbdLabels, type KeyFace, keyFaces } from "./kbd-keys.tsx"

/** Props of {@link Kbd}. Pass `keys` or `children`. */
export interface KbdProps {
  /**
   * A combination such as `"mod+k"`, `"?"` or `"esc"`, written the way `useHotkeys` takes it, or a
   * sequence of them separated by whitespace, such as `"g t"`: press `g`, then `t`. `mod` is ⌘ on
   * Apple platforms and Ctrl elsewhere. In a sequence, write the `+` key as `plus`: `"g +"` reads as
   * an unfinished combination. Throws when a combination cannot be read.
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
 * One key, a combination of keys or a sequence of presses, as the HTML `<kbd>` element:
 * `<Kbd keys="mod+k" />` renders an outer `<kbd>` holding one `<kbd>` per key.
 *
 * A sequence such as `<Kbd keys="g t" />` renders an outer `<kbd>` holding each press as above,
 * with the word "then" between them as plain text with a space on each side; it is read
 * "G then T". The word is {@link KbdLabels.then}.
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

  const words = { ...KBD_LABELS, ...labels }
  const steps = sequenceSteps(keys).map((step) => keyFaces(step, isApple, words))
  if (steps.length === 1) {
    return (
      <KbdKeys
        faces={steps[0]}
        apple={isApple}
        singleClass={cn(KEY_CLASS, className)}
        groupClass={cn(GROUP_CLASS, className)}
      />
    )
  }
  // Inline, with real spaces around "then": they space the word from the keys on screen and in
  // copied text. Chromium's accessible name puts spaces between the keys either way.
  return (
    <kbd class={cn(SEQUENCE_CLASS, className)}>
      {steps.map((faces, index) => (
        <Fragment key={index}>
          {index > 0 && ` ${words.then} `}
          <KbdKeys faces={faces} apple={isApple} singleClass={KEY_CLASS} groupClass={GROUP_CLASS} />
        </Fragment>
      ))}
    </kbd>
  )
}

/** The classes of the outer `<kbd>` around a sequence of presses. */
const SEQUENCE_CLASS = "text-xs text-muted"
