import { useSignal } from "@preact/signals"
import { cn } from "@spy4x/preact-cn"
import { IconArrowDown } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX, RefObject } from "preact"
import { useEffect, useLayoutEffect, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { useLabels } from "./i18n.tsx"

/** The colour of an entry's dot. */
export type TimelineTone = "neutral" | "success" | "warning" | "danger"

/** One thing that happened. */
export interface TimelineItem {
  /** Stable key for the entry. */
  id: string | number
  /** What happened, in a few words. */
  title: ComponentChildren
  /** When it happened, as an ISO 8601 instant; it becomes the `<time>`'s `dateTime`. */
  at: string
  /** What the time reads, such as "3 days ago" or a formatted date. */
  when: ComponentChildren
  /** A second line: who, from where, what changed. Shown whenever it is not `null` or `undefined`. */
  description?: ComponentChildren
  /** The dot's colour. Defaults to `"neutral"`. */
  tone?: TimelineTone
  dataE2E?: string
}

/** The words of a `live` {@link Timeline}'s toolbar, jump button and announcements. */
export interface TimelineLiveLabels {
  /** The state while new entries are followed. Default: `"Following"`. */
  following: string
  /** The state while following is paused. Default: `"Paused"`. */
  paused: string
  /** The button that pauses following. Default: `"Pause"`. */
  pause: string
  /** The button that resumes following. Default: `"Follow"`. */
  follow: string
  /** The jump button and the announcement. Default: `"1 new event"`, `"3 new events"`. */
  newEvents: (count: number) => string
}

export interface TimelineProps {
  /**
   * The entries in the order to show them: usually newest first, and oldest first when `live`,
   * with each new entry added at the end.
   */
  items: readonly TimelineItem[]
  /** The list's accessible name. Defaults to `"Timeline"`. */
  label?: string
  /** What shows in place of an empty list. Defaults to `"Nothing yet."`. */
  empty?: ComponentChildren
  /**
   * Follows entries as they arrive at the end, as a log view does: a toolbar shows the state with
   * a Pause or Follow button, a new entry scrolls into view while following with the end on
   * screen, a "3 new events" button counts the rest, and a polite live region announces them.
   */
  live?: boolean
  /**
   * Whether a `live` timeline follows new entries, for a caller that drives it (a hotkey). Left
   * out, the timeline keeps its own state, starting at `true`.
   */
  following?: boolean
  /** Called with the new state when the Pause or Follow button is pressed. */
  onFollowingChange?: (following: boolean) => void
  /** The words of a `live` timeline; see {@link TimelineLiveLabels}. */
  labels?: Partial<TimelineLiveLabels>
  class?: string
  dataE2E?: string
}

/**
 * How long a `live` timeline gathers new entries before its live region announces them, so a
 * fast stream is one announcement, not one per entry.
 */
export const TIMELINE_ANNOUNCE_MS = 3000

/** Each tone's dot, read through the shared colour tokens. */
const DOTS: Record<TimelineTone, string> = {
  neutral: "bg-track",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
}

/** The English words of `Timeline`, each one a prop of its own. */
const TIMELINE_LABELS: Required<Pick<TimelineProps, "label" | "empty">> = {
  label: "Timeline",
  empty: "Nothing yet.",
}

/** The English words of a `live` `Timeline`. */
const TIMELINE_LIVE_LABELS: TimelineLiveLabels = {
  following: "Following",
  paused: "Paused",
  pause: "Pause",
  follow: "Follow",
  newEvents: (count) => count === 1 ? "1 new event" : `${count} new events`,
}

/** The secondary button of the toolbar and the jump: 44 px tall on a phone, 36 px from `sm`. */
const LIVE_BUTTON = "min-h-9 max-sm:min-h-11"

/** The entries as list items: the dot, the line to the next one, the title, time and description. */
function entries(items: readonly TimelineItem[]): JSX.Element[] {
  return items.map((item, index) => (
    <li key={item.id} class="relative flex gap-3 pb-6 last:pb-0" data-e2e={item.dataE2E}>
      {index < items.length - 1 && (
        <span
          aria-hidden="true"
          data-timeline-line=""
          class="absolute top-4 bottom-0 start-1.5 w-px -translate-x-1/2 [&:dir(rtl)]:translate-x-1/2 bg-track"
        />
      )}
      <span
        aria-hidden="true"
        data-timeline-dot={item.tone ?? "neutral"}
        class={cn(
          "relative mt-1 size-3 shrink-0 rounded-full ring-4 ring-surface",
          DOTS[item.tone ?? "neutral"],
        )}
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <span class="font-medium">{item.title}</span>
          <time class="text-xs text-muted" dateTime={item.at}>
            {item.when}
          </time>
        </div>
        {item.description != null && (
          <div class="text-sm text-muted wrap-anywhere">{item.description}</div>
        )}
      </div>
    </li>
  ))
}

/**
 * A vertical list of events: a dot per entry on a line that joins them, the title and its time on
 * the first line, and an optional description under them. For an audit trail, an order's history
 * or a person's activity.
 *
 * An ordered list (`<ol>`) with an accessible name, so a screen reader announces how many entries
 * there are. The dots and the line are decoration, hidden from assistive tech: the tone never
 * carries meaning alone, so a caller that needs a state names it in the title. The time is a
 * `<time>` with the exact instant in `dateTime`. An empty list renders `empty` instead, so the
 * caller does not draw a bare frame.
 *
 * `live` follows a stream, oldest first: a toolbar says "Following" or "Paused" beside a Pause or
 * Follow button, a new entry scrolls into view while following with the end on screen (at once
 * under reduced motion), and otherwise a sticky "3 new events" button counts what arrived and
 * jumps to the newest. One polite live region announces new entries, gathered over
 * `TIMELINE_ANNOUNCE_MS`. `following` with `onFollowingChange` lets the caller drive the state.
 */
export function Timeline(props: TimelineProps): JSX.Element {
  const { items, label: labelProp, empty: emptyProp, live, class: className, dataE2E } = props
  const { label, empty } = useLabels(
    "Timeline",
    TIMELINE_LABELS,
    { label: labelProp, empty: emptyProp },
  )
  if (live) return <LiveTimeline {...props} label={label} empty={empty} />
  if (items.length === 0) {
    return <p class={cn("text-sm text-muted", className)} data-e2e={dataE2E}>{empty}</p>
  }
  return (
    <ol aria-label={label} class={cn("flex flex-col", className)} data-e2e={dataE2E}>
      {entries(items)}
    </ol>
  )
}

/** Props of {@link LiveTimeline}: the timeline's, with its two words already resolved. */
interface LiveTimelineProps extends Omit<TimelineProps, "label" | "empty" | "live"> {
  label: string
  empty: ComponentChildren
}

/**
 * Brings the end of a live timeline into view: smoothly, or at once under reduced motion. The
 * nearest edge, so a timeline inside a scrolling box scrolls the box and the page only as needed.
 */
function scrollToEnd(end: RefObject<HTMLElement>): void {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  end.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
}

/**
 * The `live` mode of {@link Timeline}. An IntersectionObserver on a sentinel after the list says
 * whether the end is on screen. A new entry is one whose `id` the previous `items` lacked, so a
 * caller that keeps only the latest entries, or replaces the list, is counted right.
 */
function LiveTimeline(
  {
    items,
    label,
    empty,
    following: followingProp,
    onFollowingChange,
    labels,
    class: className,
    dataE2E,
  }: LiveTimelineProps,
): JSX.Element {
  const words = useLabels("Timeline", TIMELINE_LIVE_LABELS, labels, { newEvents: ["count"] })
  const ownFollowing = useSignal(true)
  const following = followingProp ?? ownFollowing.value
  /** Entries that arrived while the end was off screen or following was paused. */
  const unseen = useSignal(0)
  /** What the live region says; a new `id` redraws it, so the same words are read again. */
  const spoken = useSignal<{ id: number; text: string } | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const seen = useRef<Set<TimelineItem["id"]> | null>(null)
  /** Whether the end was on screen when the observer last reported, readable at once. */
  const atEnd = useRef(false)
  /**
   * Entries that arrived, not followed, while the end was on screen: unseen only if the observer's
   * next report, after they are drawn, finds the end off screen.
   */
  const held = useRef(0)
  const observer = useRef<IntersectionObserver | null>(null)
  /**
   * True from a scroll to the end until the end is on screen, or the person scrolls or presses
   * anywhere, the scrollbar included: a new entry pushes the end off screen while the smooth
   * scroll runs, and must not count as unseen then.
   */
  const pinned = useRef(false)
  const pending = useRef(0)
  const announceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wasFollowing = useRef(following)

  /**
   * Asks the observer where the end is now. It reports only changes, so an end that never left
   * the screen would otherwise never clear the count; a fresh `observe` always reports once.
   */
  function recheck(): void {
    const sentinel = end.current
    if (!sentinel || !observer.current) return
    observer.current.unobserve(sentinel)
    observer.current.observe(sentinel)
  }

  function jumpToEnd(): void {
    pinned.current = true
    scrollToEnd(end)
    recheck()
  }

  useEffect(() => {
    const sentinel = end.current
    if (!sentinel) return
    observer.current = new IntersectionObserver((entries) => {
      // Several changes can arrive at once; the last one is where the end is now.
      const entry = entries[entries.length - 1]
      atEnd.current = entry.isIntersecting
      if (!entry.isIntersecting) {
        unseen.value += held.current
        held.current = 0
        return
      }
      pinned.current = false
      held.current = 0
      unseen.value = 0
    })
    observer.current.observe(sentinel)
    const release = () => pinned.current = false
    const intents = ["wheel", "touchstart", "pointerdown", "keydown"] as const
    for (const type of intents) addEventListener(type, release, { passive: true })
    return () => {
      observer.current?.disconnect()
      for (const type of intents) removeEventListener(type, release)
      clearTimeout(announceTimer.current)
    }
  }, [])

  // A layout effect: it runs before the browser draws the new entry, so `atEnd` still says where
  // the end was before the entry pushed it down.
  useLayoutEffect(() => {
    const before = seen.current
    seen.current = new Set(items.map((item) => item.id))
    // The first render shows what was already there: nothing is new.
    if (!before) return
    const fresh = items.filter((item) => !before.has(item.id)).length
    if (fresh === 0) return
    pending.current += fresh
    announceTimer.current ??= setTimeout(() => {
      announceTimer.current = undefined
      spoken.value = { id: (spoken.peek()?.id ?? 0) + 1, text: words.newEvents(pending.current) }
      pending.current = 0
    }, TIMELINE_ANNOUNCE_MS)
    if (following && (atEnd.current || pinned.current)) jumpToEnd()
    else if (atEnd.current) {
      // The new entries may still fit on screen: the observer decides once they are drawn.
      held.current += fresh
      recheck()
    } else unseen.value += fresh
  }, [items])

  // Following again, from the button or the caller's own control, jumps to the newest.
  useEffect(() => {
    if (following && !wasFollowing.current) jumpToEnd()
    wasFollowing.current = following
  }, [following])

  function toggle(): void {
    if (followingProp === undefined) ownFollowing.value = !following
    onFollowingChange?.(!following)
  }

  function showNewest(): void {
    jumpToEnd()
    // The button goes once the end is on screen, so focus moves to the list rather than the page.
    list.current?.focus({ preventScroll: true })
  }

  return (
    <div class={cn("flex flex-col gap-3", className)} data-e2e={dataE2E}>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <span
          class="inline-flex items-center gap-2 text-sm text-muted"
          data-timeline-state={following ? "following" : "paused"}
        >
          {following && (
            <span
              aria-hidden="true"
              class="size-2 rounded-full bg-success motion-safe:animate-pulse"
            />
          )}
          {following ? words.following : words.paused}
        </span>
        <Button variant="secondary" size="sm" class={LIVE_BUTTON} onClick={toggle}>
          {following ? words.pause : words.follow}
        </Button>
      </div>
      <div>
        {items.length === 0 ? <p class="text-sm text-muted">{empty}</p> : (
          <ol
            ref={list}
            tabIndex={-1}
            aria-label={label}
            class="flex flex-col rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
          >
            {entries(items)}
          </ol>
        )}
        <div ref={end} aria-hidden="true" data-timeline-end="" class="h-px" />
        {unseen.value > 0 && (
          <div class="pointer-events-none sticky bottom-4 flex h-0 justify-center">
            <Button
              variant="secondary"
              size="sm"
              class={`${LIVE_BUTTON} pointer-events-auto -translate-y-full shadow-popover`}
              onClick={showNewest}
              data-timeline-jump=""
            >
              <IconArrowDown class="size-4" />
              {words.newEvents(unseen.value)}
            </Button>
          </div>
        )}
      </div>
      <div aria-live="polite" class="sr-only" data-timeline-announcer="">
        {spoken.value && <span key={spoken.value.id}>{spoken.value.text}</span>}
      </div>
    </div>
  )
}
