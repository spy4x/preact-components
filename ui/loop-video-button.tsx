/**
 * The pause/play button of a `LoopVideo`, with its hint. Internal: not one of the package's entry
 * points.
 *
 * @module
 */

import { useSignal } from "@preact/signals"
import { IconPlaySolid } from "@spy4x/preact-icons"
import type { JSX } from "preact"
import { hintBubbleClasses } from "./hint-bubble.ts"

/**
 * The 44 px round button on the scrim, inset 12 px from the bottom and the inline end, so it sits
 * on the left in a right-to-left page. Its focus ring is the scrim's foreground colour, which
 * shows on any frame of the clip.
 */
const buttonClass =
  "flex size-11 cursor-pointer items-center justify-center rounded-full bg-scrim text-scrim-foreground shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--color-scrim-foreground)"

/**
 * The hint above the button, end-aligned, shown on hover and focus. Its bottom padding bridges
 * the gap, so the pointer can rest on it while it is read; it is the library's tooltip bubble.
 */
const hintClass =
  "invisible absolute bottom-full end-0 z-10 w-max max-w-xs pb-2 opacity-0 transition-opacity duration-150 group-hover/loop:visible group-hover/loop:opacity-100 group-focus-within/loop:visible group-focus-within/loop:opacity-100"

/** The pause glyph: two rounded bars, in the text colour. The icon set has no pause glyph. */
function PauseGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" class="size-5" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

/** Props of {@link LoopVideoButton}. */
export interface LoopVideoButtonProps {
  /** Whether the clip plays now: the button then pauses it. */
  playing: boolean
  /** The clip's short name, after the label. */
  name: string
  /** The first words while the clip plays. */
  pauseLabel: string
  /** The first words while it is stopped. */
  playLabel: string
  /** Pauses a playing clip and plays a stopped one. */
  onToggle: () => void
}

/**
 * The 44 px button at the clip's bottom-end corner, named `{pauseLabel}: {name}` while the clip
 * plays and `{playLabel}: {name}` while it is stopped, with a pause or play glyph. The same words
 * show in a hint above it on hover and focus; Escape hides the hint until the pointer or focus
 * leaves. The hint is hidden from assistive tech, since it repeats the name.
 *
 * @param props See {@link LoopVideoButtonProps}.
 * @returns The button and its hint, positioned in the clip's box.
 */
export function LoopVideoButton(
  { playing, name, pauseLabel, playLabel, onToggle }: LoopVideoButtonProps,
): JSX.Element {
  const hintHidden = useSignal(false)
  const label = `${playing ? pauseLabel : playLabel}: ${name}`
  return (
    <span
      class="group/loop absolute end-3 bottom-3"
      onKeyDown={(event) => {
        if (event.key === "Escape") hintHidden.value = true
      }}
      onPointerLeave={() => hintHidden.value = false}
      onFocusOut={() => hintHidden.value = false}
    >
      <button type="button" aria-label={label} class={buttonClass} onClick={onToggle}>
        {playing ? <PauseGlyph /> : <IconPlaySolid class="size-5 translate-x-px" />}
      </button>
      <span aria-hidden="true" hidden={hintHidden.value} class={hintClass}>
        <span class={hintBubbleClasses}>{label}</span>
      </span>
    </span>
  )
}
