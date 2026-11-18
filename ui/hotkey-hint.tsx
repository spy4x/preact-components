import { Fragment, type JSX } from "preact"
import {
  GROUP_CLASS,
  KBD_LABELS,
  KbdKeys,
  type KbdLabels,
  KEY_CLASS,
  keyFaces,
  SEQUENCE_CLASS,
  sequenceSteps,
} from "./kbd-keys.tsx"
import { useLabels } from "./i18n.tsx"

/** Props of {@link HotkeyHint}. */
export interface HotkeyHintProps {
  /** The combination or sequence, written the way `useHotkeys` takes it. */
  keys: string
  /** Whether to draw Apple's modifier glyphs. */
  apple: boolean
  /** The words the keys show. */
  labels?: Partial<KbdLabels>
  /** Utilities added to the hint's own, such as `ms-auto` to push it to the end of a row. */
  class?: string
  /** Replaces the classes around a sequence's keys, which set the colour of its "then". */
  sequenceClass?: string
}

/**
 * The keys a component with a `hotkey` prop shows inside its button, drawn as `Kbd` draws them.
 * Package-internal: not in `deno.json`'s exports. A sequence reads "G then P", as in `Kbd`.
 *
 * Hidden from screen readers, which hear the key through `aria-keyshortcuts` instead, so it adds
 * nothing to the button's accessible name. Shown only where the main pointer is fine, such as a
 * mouse or a trackpad: a phone has no keyboard to press it with.
 */
export function HotkeyHint(
  { keys, apple, labels, class: className, sequenceClass = SEQUENCE_CLASS }: HotkeyHintProps,
): JSX.Element {
  const words = useLabels("Kbd", KBD_LABELS, labels)
  // Joined by hand rather than with `cn`, which would pull tailwind-merge into island bundles.
  const classes = className === undefined
    ? "hidden pointer-fine:inline-flex"
    : `hidden pointer-fine:inline-flex ${className}`
  const steps = sequenceSteps(keys).map((step) => (
    <KbdKeys
      faces={keyFaces(step, apple, words)}
      apple={apple}
      singleClass={KEY_CLASS}
      groupClass={GROUP_CLASS}
    />
  ))
  return (
    <span aria-hidden="true" data-hotkey-hint="" class={classes}>
      {steps.length === 1 ? steps[0] : (
        // Inline in one `<kbd>`, so the spaces around "then" stay inside this flex row.
        <kbd class={sequenceClass}>
          {steps.map((step, index) => (
            <Fragment key={index}>
              {index > 0 && ` ${words.then} `}
              {step}
            </Fragment>
          ))}
        </kbd>
      )}
    </span>
  )
}
