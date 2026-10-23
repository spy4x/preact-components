/**
 * `SyncStatus` — one compact line for a header or a status bar that says whether the app's offline
 * changes have reached the server: offline, waiting, syncing, failed with a Retry, or synced.
 *
 * It takes plain values, not an outbox, so it works with any queue. The words sit in a polite live
 * region that is in the page from the first render, so a change is announced without moving focus.
 */

import { useSignal } from "@preact/signals"
import { cn } from "@spy4x/preact-cn"
import { Button } from "@spy4x/preact-ui/button"
import { StatusMark, type StatusMarkStatus } from "@spy4x/preact-ui/status-mark"
import { useFocusFallback } from "@spy4x/preact-ui/use-focus-after-removal"
import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { useLabels, useT } from "@spy4x/preact-ui/i18n"
import { translate } from "./i18n.ts"

/** Which of the five states the line shows. */
export type SyncState = "offline" | "failed" | "syncing" | "waiting" | "synced"

/** Every word {@link SyncStatus} shows. The counted ones are functions of the waiting count. */
export interface SyncStatusLabels {
  /** No network. Defaults to `"Offline"`, plus how many changes wait, when any do. */
  offline: (pending: number) => string
  /** The last attempt failed. Defaults to `"Sync failed"`. */
  failed: (pending: number) => string
  /** A sync is running. Defaults to `"Syncing…"`. */
  syncing: (pending: number) => string
  /** Changes wait and nothing is running. Defaults to `"1 change waiting to sync"`. */
  waiting: (pending: number) => string
  /** Nothing waits. Defaults to `"All changes synced"`; an empty string shows nothing. */
  synced: string
  /** The retry button. Defaults to `"Retry"`. */
  retry: string
}

/** `"1 change"`, `"3 changes"`. */
function changes(count: number): string {
  return count === 1 ? "1 change" : `${count} changes`
}

/** The English words {@link SyncStatus} shows when the caller passes none. */
export const DEFAULT_SYNC_STATUS_LABELS: SyncStatusLabels = {
  offline: (pending) => pending > 0 ? `Offline, ${changes(pending)} waiting` : "Offline",
  failed: () => "Sync failed",
  syncing: () => "Syncing…",
  waiting: (pending) => `${changes(pending)} waiting to sync`,
  synced: "All changes synced",
  retry: "Retry",
}

/** What {@link syncState} reads. */
export interface SyncStateInput {
  /** Whether the browser has a network: `createOnlineStatus().online` from preact-signals. */
  online: boolean
  /** How many changes wait to be sent. */
  pending: number
  /** Whether a sync is running now. */
  syncing?: boolean
  /** Whether the last sync failed for a reason other than the network. */
  failed?: boolean
}

/**
 * The state to show, most urgent first: offline, then failed, then syncing, then waiting.
 *
 * Offline wins over a failure because the failure is then almost always the network, and Retry
 * cannot help until it is back.
 */
export function syncState({ online, pending, syncing, failed }: SyncStateInput): SyncState {
  if (!online) return "offline"
  if (failed) return "failed"
  if (syncing) return "syncing"
  return pending > 0 ? "waiting" : "synced"
}

/** The mark each state shows: a distinct shape, so the state reads without colour. */
const MARKS: Record<SyncState, StatusMarkStatus> = {
  offline: "offline",
  failed: "known-issue",
  syncing: "live",
  waiting: "paused",
  synced: "ready",
}

export interface SyncStatusProps extends SyncStateInput {
  /** Starts a sync again. The Retry button shows only when the last sync failed and this is given. */
  onRetry?: () => void
  /** Words to replace, each with an English default. */
  labels?: Partial<SyncStatusLabels>
  /** Utilities for the outer element. */
  class?: string
}

/**
 * Whether the app's offline changes have reached the server, in one compact line.
 *
 * The words live in a `role="status"` region that is always rendered, so a screen reader announces
 * each change of state politely, and nothing here ever moves focus on its own. The one exception is
 * focus that would otherwise be lost: Retry turns into a busy button while the retry runs, and when
 * the sync then succeeds and the button leaves, focus moves to this element instead of falling to
 * the page's body.
 */
export function SyncStatus(
  { online, pending, syncing, failed, onRetry, labels, class: className }: SyncStatusProps,
): JSX.Element {
  const translator = useT()
  const words = {
    ...useLabels("SyncStatus", DEFAULT_SYNC_STATUS_LABELS, labels, {
      failed: ["count"],
      syncing: ["count"],
      waiting: ["count"],
    }),
    // "Offline" alone and "Offline, 3 changes waiting" are two messages, not one plural.
    offline: labels?.offline ??
      ((pending: number) =>
        pending > 0
          ? translate(
            translator,
            "SyncStatus.offlineWaiting",
            DEFAULT_SYNC_STATUS_LABELS.offline(pending),
            { count: pending },
          )
          : translate(translator, "SyncStatus.offline", DEFAULT_SYNC_STATUS_LABELS.offline(0))),
  }
  const state = syncState({ online, pending, syncing, failed })
  const retrying = useSignal(false)
  const root = useRef<HTMLDivElement>(null)

  // A retry that this button started stays on screen, busy, until the sync it started ends.
  const retryRunning = retrying.value && state === "syncing"
  const showRetry = Boolean(onRetry) && (state === "failed" || retryRunning)

  // Retry leaving with focus on it hands focus to this element, which stays.
  useFocusFallback(root, () => root.current)

  useEffect(() => {
    if (state !== "syncing") retrying.value = false
  }, [state])

  const text = state === "synced" ? words.synced : words[state](pending)

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-sync-state={state}
      class={cn("inline-flex min-h-8 items-center gap-2 text-sm outline-hidden", className)}
    >
      <span role="status" aria-live="polite" aria-atomic="true">
        {text ? <StatusMark status={MARKS[state]} label={text} class="font-normal" /> : null}
      </span>
      {showRetry
        ? (
          <Button
            variant="ghost"
            size="sm"
            busy={retryRunning}
            onClick={() => {
              retrying.value = true
              onRetry?.()
            }}
          >
            {words.retry}
          </Button>
        )
        : null}
    </div>
  )
}
