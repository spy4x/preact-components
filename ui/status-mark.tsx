import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"

/** A project or feature's lifecycle state. */
export type StatusMarkStatus = "ready" | "beta" | "wip" | "paused" | "archived" | "known-issue"

export interface StatusMarkProps {
  status: StatusMarkStatus
  /** Visible label. Defaults to the status's own English name (`"Ready"`, `"Known issue"`, …). */
  label?: string
  class?: string
}

/** Every status's default English label. */
const DEFAULT_LABELS: Record<StatusMarkStatus, string> = {
  ready: "Ready",
  beta: "Beta",
  wip: "WIP",
  paused: "Paused",
  archived: "Archived",
  "known-issue": "Known issue",
}

/**
 * Tone per status, read through the shared colour tokens — never a literal palette value. `beta`
 * is `text-muted` rather than `text-primary`: ink (#257) reserves the accent for a page's one
 * primary action, and a status tone is not that.
 */
const TONES: Record<StatusMarkStatus, string> = {
  ready: "text-success",
  beta: "text-muted",
  wip: "text-warning",
  paused: "text-muted",
  archived: "text-muted",
  "known-issue": "text-danger",
}

/** Filled circle: done, nothing left to check. */
function ReadyShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" fill="currentColor" />
      <path
        d="M5.3 8.2 6.9 9.8 10.6 6.1"
        fill="none"
        stroke="var(--color-surface, oklch(1 0 0))"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

/** Open ring: still forming, not filled in yet. */
function BetaShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.75" />
    </svg>
  )
}

/** Diamond: in motion. */
function WipShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2 14 8 8 14 2 8Z" fill="currentColor" />
    </svg>
  )
}

/** Two bars: paused, like a media player's pause glyph. */
function PausedShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
      <rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
    </svg>
  )
}

/** Filled square: boxed away. */
function ArchivedShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="currentColor" />
    </svg>
  )
}

/** Outlined triangle with an exclamation: worth a second look. */
function KnownIssueShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 2.5 14.5 13.5H1.5Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path d="M8 6.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="8" cy="11.2" r="0.75" fill="currentColor" />
    </svg>
  )
}

/**
 * One glyph per status, so the mark is told apart by shape rather than by colour alone — a filled
 * circle, an outlined ring, a diamond, two bars, a box and a warning triangle are six different
 * silhouettes even in greyscale. Inline SVG, matching this package's own rule ("no dependency on
 * `icons/`" — `ui/README.md`), not a shared icon component.
 */
const SHAPES: Record<StatusMarkStatus, (props: { class?: string }) => JSX.Element> = {
  ready: ReadyShape,
  beta: BetaShape,
  wip: WipShape,
  paused: PausedShape,
  archived: ArchivedShape,
  "known-issue": KnownIssueShape,
}

/**
 * A shape paired with a word: `Ready`, `Beta`, `WIP`, `Paused`, `Archived`, `Known issue`.
 *
 * The shape alone never carries the meaning — `label` is real text, and the glyph is wrapped
 * `aria-hidden`, so a screen reader announces only the word. Six distinct silhouettes ({@link
 * SHAPES}) mean the status is told apart without colour too, for a reader who cannot see tone.
 *
 * The tone colours the shape only, not the word: the `aria-hidden` wrapper carries `TONES[status]`
 * and the word sits outside it, inheriting whatever text colour the surrounding page already set.
 * A status's tone can be low-contrast against some surfaces (`"Ready"`'s green reads 2.97:1 on the
 * default dark card, short of WCAG's 4.5:1 for text) without that ever being the word's own colour
 * — the shape carries the tone as a supplementary cue, the word stays as legible as any other text
 * on the page.
 *
 * A sibling of `Badge`, not an extension of it: `Badge` is colour-plus-text with no shape, and
 * giving it one would mean every existing `Badge` caller inheriting an icon it never asked for.
 */
export function StatusMark({ status, label, class: className }: StatusMarkProps): JSX.Element {
  const Shape = SHAPES[status]
  return (
    <span class={cn("inline-flex items-center gap-1 text-sm font-medium", className)}>
      <span aria-hidden="true" class={cn("shrink-0", TONES[status])}>
        <Shape class="size-4" />
      </span>
      {label ?? DEFAULT_LABELS[status]}
    </span>
  )
}
