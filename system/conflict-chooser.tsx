/**
 * `ConflictChooser` — the changes the server did not take, each with what happened in plain words
 * and a choice: keep this person's version, or take the server's.
 *
 * It takes plain items and two callbacks, not an outbox, so it works with any queue. It renders an
 * inline list; for a dialog, put it inside `Modal` from `@spy4x/preact-ui`.
 */

import { cn } from "@spy4x/preact-cn"
import { Button } from "@spy4x/preact-ui/button"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"

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
   * Whether "Keep mine" is offered. Defaults to `true` for `version` and `gone` (keeping mine
   * re-creates the item) and `false` for `rejected`, where sending it again would be refused again.
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
}

/** The English words {@link ConflictChooser} shows when the caller passes none. */
export const DEFAULT_CONFLICT_CHOOSER_LABELS: ConflictChooserLabels = {
  heading: (count) =>
    count === 1 ? "1 change needs your choice" : `${count} changes need your choice`,
  explanation: {
    version: "Changed elsewhere while you were offline.",
    gone: "Deleted elsewhere while you were offline.",
    rejected: "The server refused this change.",
  },
  keepMine: { version: "Keep mine", gone: "Restore mine", rejected: "Keep mine" },
  useTheirs: { version: "Use theirs", gone: "Discard mine", rejected: "Discard mine" },
  resolved: "All conflicts resolved",
}

/** The words a caller replaces: any of them, and per reason inside the records. */
export interface ConflictChooserLabelOverrides {
  heading?: ConflictChooserLabels["heading"]
  explanation?: Partial<ConflictChooserLabels["explanation"]>
  keepMine?: Partial<ConflictChooserLabels["keepMine"]>
  useTheirs?: Partial<ConflictChooserLabels["useTheirs"]>
  resolved?: string
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
  /** Utilities for the outer element. */
  class?: string
}

/** The labels with the caller's replacements merged in, per reason where the field is a record. */
function mergeLabels(labels: ConflictChooserLabelOverrides = {}): ConflictChooserLabels {
  const base = DEFAULT_CONFLICT_CHOOSER_LABELS
  return {
    heading: labels.heading ?? base.heading,
    explanation: { ...base.explanation, ...labels.explanation },
    keepMine: { ...base.keepMine, ...labels.keepMine },
    useTheirs: { ...base.useTheirs, ...labels.useTheirs },
    resolved: labels.resolved ?? base.resolved,
  }
}

/** Whether an item offers "Keep mine": the item says, or its reason decides. */
export function offersKeepMine(item: ConflictItem): boolean {
  return item.canKeepMine ?? item.reason !== "rejected"
}

/**
 * A list of conflicts, each explained in plain words, with "Keep mine" and "Use theirs".
 *
 * A choice runs the caller's callback; the caller removes the item from `conflicts` once it is
 * settled. When that removes the item whose button had focus, focus moves to the next item's first
 * button, or to the heading when none is left, so a keyboard user is never dropped at the top of the
 * page. Nothing else moves focus. A polite live region says when the list is empty.
 */
export function ConflictChooser(
  { conflicts, onKeepMine, onUseTheirs, labels, class: className }: ConflictChooserProps,
): JSX.Element {
  const words = mergeLabels(labels)
  const headingId = useId()
  const root = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /** The position of the item whose button was pressed, while its removal is awaited. */
  const chosenAt = useRef<number | null>(null)
  const [hadConflicts, setHadConflicts] = useState(conflicts.length > 0)

  useEffect(() => {
    if (conflicts.length > 0) setHadConflicts(true)
    const index = chosenAt.current
    if (index === null || !root.current) return
    chosenAt.current = null
    const document = root.current.ownerDocument
    // Only when the pressed button is gone and focus fell to the body: anything else the person did
    // in the meantime wins.
    if (document.activeElement && document.activeElement !== document.body) return
    const items = root.current.querySelectorAll<HTMLElement>("[data-conflict-id]")
    const next = items[Math.min(index, items.length - 1)]
    const target = next?.querySelector<HTMLElement>("button") ??
      root.current.querySelector<HTMLElement>("h2")
    target?.focus()
  }, [conflicts])

  const choose = (id: string, index: number, run: (id: string) => void | Promise<unknown>) => {
    if (busy !== null) return
    chosenAt.current = index
    const result = run(id)
    if (!result) return
    setBusy(id)
    result.finally(() => setBusy((current) => (current === id ? null : current)))
  }

  return (
    <section
      ref={root}
      aria-labelledby={headingId}
      class={cn("flex flex-col gap-3", className)}
    >
      <h2 id={headingId} tabIndex={-1} class="text-base font-semibold outline-hidden">
        {conflicts.length > 0 ? words.heading(conflicts.length) : words.resolved}
      </h2>
      <p role="status" aria-live="polite" class="sr-only">
        {conflicts.length === 0 && hadConflicts ? words.resolved : ""}
      </p>
      {conflicts.length > 0
        ? (
          <ul class="flex flex-col gap-3">
            {conflicts.map((item, index) => {
              const itemBusy = busy === item.id
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
