import { cn } from "@spy4x/preact-cn"
import type { JSX } from "preact"
import { useLabels } from "./i18n.tsx"

/**
 * A project's or feature's lifecycle state (`ready` to `offline`), or the state of a background job
 * or a queued task (`running` to `claimed`).
 */
export type StatusMarkStatus =
  | "ready"
  | "in-use"
  | "beta"
  | "wip"
  | "paused"
  | "archived"
  | "known-issue"
  | "outcome"
  | "live"
  | "offline"
  | "running"
  | "done"
  | "parked"
  | "blocked"
  | "waiting"
  | "failed"
  | "out-of-time"
  | "out-of-budget"
  | "out-of-turns"
  | "stopped"
  | "queued"
  | "claimed"

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
  wip: "In progress",
  paused: "Paused",
  archived: "Archived",
  "known-issue": "Known issue",
  "in-use": "In use",
  outcome: "Outcome",
  live: "Live",
  offline: "Offline",
  running: "Running",
  done: "Done",
  parked: "Parked",
  blocked: "Blocked",
  waiting: "Waiting",
  failed: "Failed",
  "out-of-time": "Out of time",
  "out-of-budget": "Out of budget",
  "out-of-turns": "Out of turns",
  stopped: "Stopped",
  queued: "Queued",
  claimed: "Claimed",
}

/**
 * Tone per status, read through the shared colour tokens — never a literal palette value. `beta`
 * is `text-muted` rather than `text-primary`: ink (#257) reserves the accent for a page's one
 * primary action, and a status tone is not that. `outcome` is `text-foreground`: a result such as
 * "Acquired 2023" is neither good nor bad news about the project's health. A job's tones: `running`
 * is `text-info`, the live one; `blocked` and `waiting` ask for attention; `failed` and the three
 * "Out of" states are failures; `parked`, `stopped`, `queued` and `claimed` are neutral.
 */
const TONES: Record<StatusMarkStatus, string> = {
  ready: "text-success",
  beta: "text-muted",
  wip: "text-warning",
  paused: "text-muted",
  archived: "text-muted",
  "known-issue": "text-danger",
  "in-use": "text-success",
  outcome: "text-foreground",
  live: "text-success",
  offline: "text-muted",
  running: "text-info",
  done: "text-success",
  parked: "text-muted",
  blocked: "text-warning",
  waiting: "text-warning",
  failed: "text-danger",
  "out-of-time": "text-danger",
  "out-of-budget": "text-danger",
  "out-of-turns": "text-danger",
  stopped: "text-muted",
  queued: "text-muted",
  claimed: "text-muted",
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

/** Outlined ring with a check: in daily use, not only finished. */
function InUseShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M5.3 8.2 6.9 9.8 10.6 6.1"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

/** Filled five-point star: a result worth naming. */
function OutcomeShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 1.5 9.9 5.6 14.2 6 10.9 8.9 11.9 13.3 8 11 4.1 13.3 5.1 8.9 1.8 6 6.1 5.6Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Dot inside a ring: running now, like a broadcast light. */
function LiveShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}

/** Ring crossed by a slash: no longer running. */
function OfflineShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M3.8 12.2 12.2 3.8"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  )
}

/** Ring with clock hands: waiting for something outside the job. */
function WaitingShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M8 4.75V8l2.25 1.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

/** Filled circle with a cross: it ended in an error. */
function FailedShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" fill="currentColor" />
      <path
        d="M5.9 5.9 10.1 10.1M10.1 5.9 5.9 10.1"
        stroke="var(--color-surface, oklch(1 0 0))"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  )
}

/** Hourglass: its time ran out. */
function OutOfTimeShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 3h7L8 8ZM4.5 13h7L8 8Z" fill="currentColor" />
      <path d="M3.5 2h9M3.5 14h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}

/** Empty battery: its budget ran out. */
function OutOfBudgetShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <rect
        x="1.75"
        y="4.25"
        width="10.5"
        height="7.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <rect x="13" y="6.5" width="1.75" height="3" rx="0.5" fill="currentColor" />
    </svg>
  )
}

/** Circular arrow: it used up its rounds. */
function OutOfTurnsShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M12.25 1.75v2.75H9.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

/** Half-filled ring: taken by a worker, not started yet. */
function ClaimedShape({ class: className }: { class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" class={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 2.75a5.25 5.25 0 0 1 0 10.5Z" fill="currentColor" />
    </svg>
  )
}

/**
 * One glyph per status, so the mark is told apart by shape rather than by colour alone — a filled
 * circle with a check, an outlined ring with a check, an empty ring, a diamond, two bars, a box, a
 * warning triangle, a star, a dot in a ring and a crossed ring are ten different silhouettes even in
 * greyscale. A job's statuses reuse a glyph where the meaning is the same (running is the dot in a
 * ring, done the filled check, parked the two bars, blocked the crossed ring, stopped the box,
 * queued the empty ring) and add a clock, a filled cross, an hourglass, an empty battery, a circular
 * arrow and a half-filled ring, so the twelve job statuses are twelve silhouettes too. Inline SVG,
 * matching this package's own rule ("no dependency on `icons/`" — `ui/README.md`), not a shared
 * icon component.
 */
const SHAPES: Record<StatusMarkStatus, (props: { class?: string }) => JSX.Element> = {
  ready: ReadyShape,
  beta: BetaShape,
  wip: WipShape,
  paused: PausedShape,
  archived: ArchivedShape,
  "known-issue": KnownIssueShape,
  "in-use": InUseShape,
  outcome: OutcomeShape,
  live: LiveShape,
  offline: OfflineShape,
  running: LiveShape,
  done: ReadyShape,
  parked: PausedShape,
  blocked: OfflineShape,
  waiting: WaitingShape,
  failed: FailedShape,
  "out-of-time": OutOfTimeShape,
  "out-of-budget": OutOfBudgetShape,
  "out-of-turns": OutOfTurnsShape,
  stopped: ArchivedShape,
  queued: BetaShape,
  claimed: ClaimedShape,
}

/**
 * A shape paired with a word: `Ready`, `In use`, `Beta`, `In progress`, `Paused`, `Archived`,
 * `Known issue`, `Outcome`, `Live`, `Offline` for a project; `Running`, `Done`, `Parked`, `Blocked`,
 * `Waiting`, `Failed`, `Out of time`, `Out of budget`, `Out of turns`, `Stopped`, `Queued`,
 * `Claimed` for a job or a queued task. `running` pulses softly, and holds still under reduced
 * motion.
 *
 * The shape alone never carries the meaning — `label` is real text, and the glyph is wrapped
 * `aria-hidden`, so a screen reader announces only the word. A distinct silhouette per status
 * within each set ({@link SHAPES}) means the status is told apart without colour too, for a reader
 * who cannot see tone.
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
  const words = useLabels("StatusMark", DEFAULT_LABELS)
  return (
    <span class={cn("inline-flex items-center gap-1 text-sm font-medium", className)}>
      <span
        aria-hidden="true"
        class={cn(
          "shrink-0",
          TONES[status],
          status === "running" && "animate-pulse motion-reduce:animate-none",
        )}
      >
        <Shape class="size-4" />
      </span>
      {label ?? words[status]}
    </span>
  )
}
