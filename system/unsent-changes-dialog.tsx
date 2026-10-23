/**
 * `UnsentChangesDialog` — asked before a person signs out while changes made offline still wait to
 * reach the server: send them first, sign out anyway, or stay.
 *
 * It takes plain counts and a state, not an outbox, so it works with any queue. The caller owns the
 * waiting: it starts sending on `onSend`, passes the counts as they drop, and signs out itself once
 * nothing sendable is left. The dialog only shows where that stands.
 */

import { Button } from "@spy4x/preact-ui/button"
import { Modal } from "@spy4x/preact-ui/modal"
import { Progress } from "@spy4x/preact-ui/progress"
import type { JSX } from "preact"
import { useId } from "preact/hooks"
import { useLabels } from "@spy4x/preact-ui/i18n"

/**
 * Where the dialog stands. `ask` is before the person chose; the other three are while the caller
 * waits for the changes to go out: `sending` (a send is running), `offline` (no connection, it
 * waits for one) and `retrying` (the last send failed and the caller tries again on its own).
 */
export type UnsentChangesState = "ask" | "sending" | "offline" | "retrying"

/** Every word {@link UnsentChangesDialog} shows. The counted ones are functions of the counts. */
export interface UnsentChangesDialogLabels {
  /** The title while some changes can still be sent. Defaults to `"You have 3 unsent changes"`. */
  title: (unsent: number) => string
  /** Why they have not gone out yet. */
  body: string
  /** What signing out now does to them. */
  kept: string
  /** Said when some of them wait on a choice. Defaults to `"1 of them needs your choice…"`. */
  conflicts: (conflicts: number) => string
  /** The title once only changes that wait on a choice are left. */
  needsChoiceTitle: (conflicts: number) => string
  /** The explanation once only changes that wait on a choice are left. */
  needsChoiceBody: (conflicts: number) => string
  /** The status line while a send runs. Defaults to `"Sending changes…"`. */
  sending: string
  /** The status line while there is no connection. */
  offline: string
  /** The status line after a failed send, while the caller tries again. */
  retrying: string
  /** The progress caption. Defaults to `"1 of 3 sent"`. */
  progress: (sent: number, total: number) => string
  /** The primary action. Defaults to `"Send, then sign out"`. */
  send: string
  /** The primary action while it waits. Defaults to `"Sending…"`. */
  sendBusy: string
  /** The primary action once only changes that wait on a choice are left. */
  review: string
  /** Signs out without waiting. Defaults to `"Sign out anyway"`. */
  signOut: string
  /** Closes the dialog and stays signed in. Defaults to `"Cancel"`. */
  cancel: string
  /** The name of the header's close control. Defaults to `"Close"`. */
  close: string
}

const englishPlurals = new Intl.PluralRules("en")

/** `"1 change"`, `"3 changes"`. */
function changes(count: number): string {
  return englishPlurals.select(count) === "one" ? `${count} change` : `${count} changes`
}

/** The English words {@link UnsentChangesDialog} shows when the caller passes none. */
export const DEFAULT_UNSENT_CHANGES_DIALOG_LABELS: UnsentChangesDialogLabels = {
  title: (unsent) =>
    englishPlurals.select(unsent) === "one"
      ? `You have ${unsent} unsent change`
      : `You have ${unsent} unsent changes`,
  body:
    "You made them while offline or the connection was slow. They haven't reached the server yet.",
  kept:
    "If you sign out now, they stay on this browser and are sent only when you sign in here again.",
  conflicts: (conflicts) =>
    englishPlurals.select(conflicts) === "one"
      ? `${conflicts} of them needs your choice before it can be sent.`
      : `${conflicts} of them need your choice before they can be sent.`,
  needsChoiceTitle: (conflicts) =>
    englishPlurals.select(conflicts) === "one"
      ? `${changes(conflicts)} needs your choice`
      : `${changes(conflicts)} need your choice`,
  needsChoiceBody: (conflicts) =>
    englishPlurals.select(conflicts) === "one"
      ? "The server didn't accept it as it is. Choose what to keep, then sign out."
      : "The server didn't accept them as they are. Choose what to keep for each, then sign out.",
  sending: "Sending changes…",
  offline: "You're offline. We'll send your changes when you're back online, then sign you out.",
  retrying: "Couldn't reach the server. Trying again…",
  progress: (sent, total) => `${sent} of ${total} sent`,
  send: "Send, then sign out",
  sendBusy: "Sending…",
  review: "Review changes",
  signOut: "Sign out anyway",
  cancel: "Cancel",
  close: "Close",
}

export interface UnsentChangesDialogProps {
  /** Changes still waiting, those that wait on a choice included. */
  unsent: number
  /** How many of `unsent` wait on a choice: the server refused them, so they never send alone. */
  conflicts?: number
  /** Changes sent since the person chose to send, for the progress bar. Defaults to `0`. */
  sent?: number
  /** Where the dialog stands. Defaults to `"ask"`. */
  state?: UnsentChangesState
  /** "Send, then sign out": start sending. The dialog stays until the caller unmounts it. */
  onSend: () => void
  /** "Sign out anyway": sign out without waiting. */
  onSignOut: () => void
  /** "Cancel", Escape, the close control or the backdrop: stay signed in. */
  onCancel: () => void
  /** "Review changes", once only changes that wait on a choice are left: go and choose. */
  onReview: () => void
  /** Words to replace. */
  labels?: Partial<UnsentChangesDialogLabels>
  /** Utilities for the dialog element. */
  class?: string
}

/**
 * The dialog to show when a person signs out with changes that have not reached the server.
 *
 * **Mount it to open it**, as `ConfirmDialog`: `{asking && <UnsentChangesDialog … />}`. Unmounting
 * closes it and returns focus to what had it before, such as the menu's trigger.
 *
 * It opens on the one primary action, "Send, then sign out". After it is pressed the caller passes
 * `state` and the falling counts, and the same dialog shows the wait: the primary stays focused and
 * becomes busy (`aria-disabled`, so focus is not dropped), and one polite `role="status"` line with a
 * progress bar says what is happening. That line changes only when the state or a count does, so a
 * screen reader hears each step once. "Sign out anyway" and "Cancel" stay usable throughout.
 *
 * When every change left waits on a choice (`unsent` equals `conflicts`), waiting cannot help: the
 * title says so and the primary turns into "Review changes", on the same button, so focus stays.
 *
 * Every control has a fixed `data-e2e`: `unsent-dialog`, `unsent-wait`, `unsent-review`,
 * `unsent-sign-out-anyway`, `unsent-cancel` and `unsent-status`.
 */
export function UnsentChangesDialog(
  {
    unsent,
    conflicts = 0,
    sent = 0,
    state = "ask",
    onSend,
    onSignOut,
    onCancel,
    onReview,
    labels,
    class: className,
  }: UnsentChangesDialogProps,
): JSX.Element {
  const words = useLabels("UnsentChangesDialog", DEFAULT_UNSENT_CHANGES_DIALOG_LABELS, labels, {
    title: ["count"],
    conflicts: ["count"],
    needsChoiceTitle: ["count"],
    needsChoiceBody: ["count"],
    progress: ["sent", "total"],
  })
  const id = useId()
  const bodyId = `unsent-body-${id}`
  const statusId = `unsent-status-${id}`
  const needsChoice = conflicts > 0 && unsent <= conflicts
  const waiting = state !== "ask" && !needsChoice
  const sendable = Math.max(0, unsent - conflicts)
  const total = sent + sendable

  return (
    <Modal
      open
      onClose={() => onCancel()}
      title={needsChoice ? words.needsChoiceTitle(conflicts) : words.title(unsent)}
      ariaDescribedBy={needsChoice ? statusId : bodyId}
      cancelLabel={words.close}
      dataE2E="unsent-dialog"
      class={className}
      footer={
        <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="ghost" data-e2e="unsent-cancel" onClick={() => onCancel()}>
            {words.cancel}
          </Button>
          <Button variant="ghost" data-e2e="unsent-sign-out-anyway" onClick={() => onSignOut()}>
            {words.signOut}
          </Button>
          {
            // One button for both primaries, so focus stays on it when it turns into "Review".
          }
          <Button
            variant="primary"
            autofocus
            busy={waiting}
            busyLabel={words.sendBusy}
            data-e2e={needsChoice ? "unsent-review" : "unsent-wait"}
            onClick={() => needsChoice ? onReview() : onSend()}
          >
            {needsChoice ? words.review : words.send}
          </Button>
        </div>
      }
    >
      <div class="flex flex-col gap-4">
        {needsChoice ? null : (
          <div id={bodyId} class="flex flex-col gap-2 text-sm text-muted">
            <p>{words.body}</p>
            <p>{words.kept}</p>
            {conflicts > 0 ? <p>{words.conflicts(conflicts)}</p> : null}
          </div>
        )}
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-e2e="unsent-status"
          class="flex flex-col gap-2 text-sm empty:sr-only"
        >
          {needsChoice ? <p class="text-muted">{words.needsChoiceBody(conflicts)}</p> : waiting
            ? (
              <>
                <p>
                  {state === "offline"
                    ? words.offline
                    : state === "retrying"
                    ? words.retrying
                    : words.sending}
                </p>
                <Progress
                  id={`unsent-progress-${id}`}
                  label={words.progress(sent, total)}
                  value={state === "offline" ? null : sent}
                  max={total}
                  showValue={false}
                />
              </>
            )
            : null}
        </div>
      </div>
    </Modal>
  )
}
