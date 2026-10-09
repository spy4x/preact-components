import type { JSX } from "preact"
import {
  GROUP_CLASS,
  KBD_LABELS,
  KbdKeys,
  type KbdLabels,
  KEY_CLASS,
  keyFaces,
} from "./kbd-keys.tsx"

/** Props of {@link HotkeyHint}. */
export interface HotkeyHintProps {
  /** The combination, written the way `useHotkeys` takes it. */
  keys: string
  /** Whether to draw Apple's modifier glyphs. */
  apple: boolean
  /** The words the keys show. */
  labels?: Partial<KbdLabels>
}

/**
 * The keys a component with a `hotkey` prop shows inside its button, drawn as `Kbd` draws them.
 * Package-internal: not in `deno.json`'s exports.
 *
 * Hidden from screen readers, which hear the key through `aria-keyshortcuts` instead, so it adds
 * nothing to the button's accessible name. Shown only where the main pointer is fine, such as a
 * mouse or a trackpad: a phone has no keyboard to press it with.
 */
export function HotkeyHint({ keys, apple, labels }: HotkeyHintProps): JSX.Element {
  return (
    <span aria-hidden="true" data-hotkey-hint="" class="hidden pointer-fine:inline-flex">
      <KbdKeys
        faces={keyFaces(keys, apple, { ...KBD_LABELS, ...labels })}
        apple={apple}
        singleClass={KEY_CLASS}
        groupClass={GROUP_CLASS}
      />
    </span>
  )
}
