/**
 * `ConflictChooser` — the changes the server did not take, each with what happened in plain words
 * and a choice: keep this person's version, or take the server's.
 *
 * It takes plain items and two callbacks, not an outbox, so it works with any queue. It renders an
 * inline list; for a dialog, put it inside `Modal` from `@spy4x/preact-ui`.
 */

import { cn } from "@spy4x/preact-cn"
import { Button } from "@spy4x/preact-ui/button"
import { useFocusFallback } from "@spy4x/preact-ui/use-focus-after-removal"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import { useT } from "@spy4x/preact-ui/i18n"
import { translate } from "./i18n.ts"
import type { Translator } from "@spy4x/platform/universal/i18n"

/**
 * Why a change was not taken, the same three words `ConflictReason` in `@spy4x/realtime/outbox`
 * uses: `version` (changed elsewhere), `gone` (deleted elsewhere), `rejected` (the server refused).
 */
export type ConflictKind = "version" | "gone" | "rejected"

/** One conflict to show. */
export interface ConflictItem {
  /** Unique in the list; handed back to the callbacks. An outbox entry's `seq` fits. */
  id: string
  /** What the change was about, such as the item's title. */
  label: ComponentChildren
  /** Why it was not taken. Picks the explanation and the buttons. */
  reason: ConflictKind
  /** Replaces the explanation, such as the server's own reason for a refusal. */
  message?: ComponentChildren
  /**
   * Whether "Keep mine" is offered. Defaults to `true` only for `version`. A `gone` item opts in
   * with `true` when the caller's `onKeepMine` re-creates a deleted item (the button then reads
   * "Restore mine"); a `rejected` one stays off by default because sending it again would be
   * refused again.
   */
  canKeepMine?: boolean
}

/** Every word {@link ConflictChooser} shows, each with an English default. */
export interface ConflictChooserLabels {
  /** The list's heading. Defaults to `"1 change needs your choice"`. */
  heading: (count: number) => string
  /** The explanation per reason. */
  explanation: Record<ConflictKind, string>
  /** "Keep mine", per reason: `gone` defaults to `"Restore mine"`. */
  keepMine: Record<ConflictKind, string>
  /** "Use theirs", per reason: `gone` and `rejected` default to `"Discard mine"`. */
  useTheirs: Record<ConflictKind, string>
  /** Said once nothing is left. Defaults to `"All conflicts resolved"`. */
  resolved: string
  /** Shown under an item, and announced, when its callback's promise rejects. */
  failed: string
}

/** The English words {@link ConflictChooser} shows when the caller passes none. */
export const DEFAULT_CONFLICT_CHOOSER_LABELS: ConflictChooserLabels = {
  heading: (count) =>
    count === 1 ? "1 change needs your choice" : `${count} changes need your choice`,
  explanation: {
    version: "Changed elsewhere while you were offline.",
    gone: "Deleted elsewhere while you were offline.",
    rejected: "The server didn't accept this change.",
  },
  keepMine: { version: "Keep mine", gone: "Restore mine", rejected: "Keep mine" },
  useTheirs: { version: "Use theirs", gone: "Discard mine", rejected: "Discard mine" },
  resolved: "All conflicts resolved",
  failed: "Couldn't save your choice. Try again.",
}

/** The words a caller replaces: any of them, and per reason inside the records. */
export interface ConflictChooserLabelOverrides {
  heading?: ConflictChooserLabels["heading"]
  explanation?: Partial<ConflictChooserLabels["explanation"]>
  keepMine?: Partial<ConflictChooserLabels["keepMine"]>
  useTheirs?: Partial<ConflictChooserLabels["useTheirs"]>
  resolved?: string
  failed?: string
}

export interface ConflictChooserProps {
  /** The conflicts, in the order to show them. An empty list renders only the resolved line. */
  conflicts: readonly ConflictItem[]
  /** Keep this person's version. A returned promise keeps the item's buttons busy until it ends. */
  onKeepMine: (id: string) => void | Promise<unknown>
  /** Take the server's version. A returned promise keeps the item's buttons busy until it ends. */
  onUseTheirs: (id: string) => void | Promise<unknown>
  /** Words to replace. The nested records merge per reason. */
  labels?: ConflictChooserLabelOverrides
  /** The heading's level, so the outline fits the page or the dialog around it. Defaults to `2`. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Utilities for the outer element. */
  class?: string
}

/** The labels with the caller's replacements merged in, per reason where the field is a record. */
function mergeLabels(
  labels: ConflictChooserLabelOverrides = {},
  translator: Translator<string>,
): ConflictChooserLabels {
  const english = DEFAULT_CONFLICT_CHOOSER_LABELS
  const perReason = (field: "explanation" | "keepMine" | "useTheirs") => ({
    version: translate(translator, `ConflictChooser.${field}.version`, english[field].version),
    gone: translate(translator, `ConflictChooser.${field}.gone`, english[field].gone),
    rejected: translate(translator, `ConflictChooser.${field}.rejected`, english[field].rejected),
  })
  const base: ConflictChooserLabels = {
    heading: (count) =>
      translate(translator, "ConflictChooser.heading", english.heading(count), { count }),
    explanation: perReason("explanation"),
    keepMine: perReason("keepMine"),
    useTheirs: perReason("useTheirs"),
    resolved: translate(translator, "ConflictChooser.resolved", english.resolved),
    failed: translate(translator, "ConflictChooser.failed", english.failed),
  }
  return {
    heading: labels.heading ?? base.heading,
    explanation: { ...base.explanation, ...labels.explanation },
    keepMine: { ...base.keepMine, ...labels.keepMine },
    useTheirs: { ...base.useTheirs, ...labels.useTheirs },
    resolved: labels.resolved ?? base.resolved,
    failed: labels.failed ?? base.failed,
  }
}

/** Whether an item offers "Keep mine": the item says, or its reason decides. */
export function offersKeepMine(item: ConflictItem): boolean {
  return item.canKeepMine ?? item.reason === "version"
}

/**
 * A list of conflicts, each explained in plain words, with "Keep mine" and "Use theirs".
 *
 * A choice runs the caller's callback; the caller removes the item from `conflicts` once it is
 * settled. When that removes the item whose button had focus, focus moves to the next item's first
 * button, or to the heading when none is left, so a keyboard user is never dropped at the top of the
 * page. Nothing else moves focus. The list becoming empty is said once: by the heading, when focus
 * moves there, or else by a polite live region. That region also says when a callback's promise
 * rejects; the rejection is caught here, and that item shows `labels.failed`.
 */
export function ConflictChooser(
  { conflicts, onKeepMine, onUseTheirs, labels, headingLevel = 2, class: className }:
    ConflictChooserProps,
): JSX.Element {
  const words = mergeLabels(labels, useT())
  const headingId = useId()
  const root = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  /** The items whose callback is still running. Other items stay usable meanwhile. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  /** The item whose last callback rejected, to say so under it. */
  const [failedId, setFailedId] = useState<string | null>(null)
  /** The position of the item whose button was pressed, while its removal is awaited. */
  const chosenAt = useRef<number | null>(null)
  /** What the last focus move after a choice went to, so the live region does not repeat it. */
  const movedTo = useRef<HTMLElement | null>(null)
  /** How many conflicts the last effect saw, to tell the moment the list becomes empty. */
  const seenCount = useRef(conflicts.length)
  /** Whether the live region says the list is empty: only when focus did not move to the heading. */
  const [announceResolved, setAnnounceResolved] = useState(false)

  // After a choice removed its item and focus fell to the body, focus the item now in its place,
  // else the one before it, else the heading. A removal nobody chose here moves nothing.
  useFocusFallback(root, () => {
    const index = chosenAt.current
    if (index === null || !root.current) return null
    const items = root.current.querySelectorAll<HTMLElement>("[data-conflict-id]")
    const next = items[Math.min(index, items.length - 1)]
    movedTo.current = next?.querySelector<HTMLElement>("button") ?? heading.current
    return movedTo.current
  })

  useEffect(() => {
    const emptied = conflicts.length === 0 && seenCount.current > 0
    seenCount.current = conflicts.length
    // A changed list ends the wait for the chosen item, whether it left or stayed.
    chosenAt.current = null
    const moved = movedTo.current
    movedTo.current = null
    const onHeading = moved !== null && moved === heading.current &&
      moved.ownerDocument.activeElement === moved
    if (conflicts.length > 0) setAnnounceResolved(false)
    // The focused heading already reads "All conflicts resolved"; the live region saying it too
    // would announce it twice.
    else if (emptied) setAnnounceResolved(!onHeading)
  }, [conflicts])

  const choose = (id: string, index: number, run: (id: string) => void | Promise<unknown>) => {
    if (busy.has(id)) return
    chosenAt.current = index
    setFailedId((current) => (current === id ? null : current))
    const result = run(id)
    if (!result) return
    setBusy((current) => new Set(current).add(id))
    result.then(
      () => {},
      () => {
        // The item stays, so no focus move is due for this choice.
        chosenAt.current = null
        setFailedId(id)
      },
    ).finally(() =>
      setBusy((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    )
  }

  const Heading = `h${headingLevel}` as "h2"
  const failedLabel = failedId !== null && conflicts.some((item) => item.id === failedId)
    ? words.failed
    : ""

  return (
    <section
      ref={root}
      aria-labelledby={headingId}
      class={cn("flex flex-col gap-3", className)}
    >
      <Heading
        ref={heading}
        id={headingId}
        tabIndex={-1}
        class="text-base font-semibold outline-hidden"
      >
        {conflicts.length > 0 ? words.heading(conflicts.length) : words.resolved}
      </Heading>
      <p role="status" aria-live="polite" class="sr-only">
        {failedLabel || (conflicts.length === 0 && announceResolved ? words.resolved : "")}
      </p>
      {conflicts.length > 0
        ? (
          <ul class="flex flex-col gap-3">
            {conflicts.map((item, index) => {
              const itemBusy = busy.has(item.id)
              return (
                <li
                  key={item.id}
                  data-conflict-id={item.id}
                  data-conflict-reason={item.reason}
                  class="pc-card flex flex-col gap-3 p-4"
                >
                  <div class="flex min-w-0 flex-col gap-1">
                    <p class="font-medium break-words">{item.label}</p>
                    <p class="text-sm text-muted">
                      {item.message ?? words.explanation[item.reason]}
                    </p>
                    {failedLabel && failedId === item.id
                      ? <p class="text-sm text-danger">{words.failed}</p>
                      : null}
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {offersKeepMine(item)
                      ? (
                        <Button
                          variant="primary"
                          busy={itemBusy}
                          data-conflict-choice="mine"
                          onClick={() => choose(item.id, index, onKeepMine)}
                        >
                          {words.keepMine[item.reason]}
                        </Button>
                      )
                      : null}
                    <Button
                      variant="outline"
                      busy={itemBusy}
                      data-conflict-choice="theirs"
                      onClick={() => choose(item.id, index, onUseTheirs)}
                    >
                      {words.useTheirs[item.reason]}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
        : null}
    </section>
  )
}
