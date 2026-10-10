/**
 * `PushSettings` — the block in an app's settings that answers "will this device notify me?" and
 * turns notifications on or off for this device.
 *
 * It takes the state and three callbacks and touches no browser API, so it renders from
 * `usePushSubscription` in `@spy4x/preact-signals` or from anything else that knows the same
 * states. It never asks for permission by itself: the caller does, from `onEnable`.
 */

import { cn } from "@spy4x/preact-cn"
import { Button } from "@spy4x/preact-ui/button"
import { useSignal } from "@preact/signals"
import type { JSX } from "preact"
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks"

/**
 * What the block shows.
 *
 * - `checking`: nothing is known yet; no button.
 * - `unsupported`: this browser has no push notifications.
 * - `needs-install`: an iPhone or iPad, where they work only in the app on the home screen.
 * - `unavailable`: the server cannot send any.
 * - `blocked`: denied in the browser's settings; says how to allow them, with no button.
 * - `off`: a button to turn on.
 * - `on`: a button to turn off and, with `onTest`, one to send a test notification.
 */
export type PushSettingsStatus =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "unavailable"
  | "blocked"
  | "off"
  | "on"

/** The three things a person can ask for here. */
export type PushSettingsAction = "enable" | "disable" | "test"

/** Every word {@link PushSettings} shows or announces, each with an English default. */
export interface PushSettingsLabels {
  /** The block's accessible name and heading. Defaults to `"Notifications"`. */
  title: string
  /** Shown while the state is `checking`. */
  checking: string
  /** Shown when the browser has no push notifications. */
  unsupported: string
  /** Shown on an iPhone or iPad outside the home-screen app: how to add the app first. */
  needsInstall: string
  /** Shown when the server cannot send notifications. */
  unavailable: string
  /** Shown when the browser blocks notifications for the site: how to allow them. */
  blocked: string
  /** Shown when notifications are off on this device. */
  off: string
  /** Shown when notifications are on for this device. */
  on: string
  /** The button that turns notifications on. */
  enable: string
  /** The button that turns notifications off. */
  disable: string
  /** The button that sends a test notification. */
  test: string
  /** Shown beside the button when turning on failed. */
  enableFailed: string
  /** Shown beside the button when turning off failed. */
  disableFailed: string
  /** Shown beside the button when the test notification could not be sent. */
  testFailed: string
  /** Shown once the test notification was sent. */
  testSent: string
  /** Announced to a screen reader when the state becomes `on`. */
  turnedOn: string
  /** Announced to a screen reader when the state becomes `off`. */
  turnedOff: string
}

/** The English words {@link PushSettings} shows when the caller passes none. */
export const DEFAULT_PUSH_SETTINGS_LABELS: PushSettingsLabels = {
  title: "Notifications",
  checking: "Checking this device…",
  unsupported: "This browser cannot show notifications.",
  needsInstall:
    "On an iPhone or iPad, notifications work once the app is on your home screen. Tap Share, then Add to Home Screen, and open the app from there.",
  unavailable: "Notifications are not set up on this server.",
  blocked:
    "Your browser is blocking notifications from this site. To allow them, open the site settings next to the address bar, set Notifications to Allow, then come back here.",
  off: "Notifications are off on this device.",
  on: "Notifications are on for this device.",
  enable: "Turn on notifications",
  disable: "Turn off notifications",
  test: "Send a test notification",
  enableFailed: "Notifications could not be turned on. Try again.",
  disableFailed: "Notifications could not be turned off. Try again.",
  testFailed: "The test notification could not be sent. Try again.",
  testSent: "Test notification sent. It should arrive in a moment.",
  turnedOn: "Notifications turned on.",
  turnedOff: "Notifications turned off.",
}

/** The label that describes each state. */
const DESCRIPTIONS: Record<PushSettingsStatus, keyof PushSettingsLabels> = {
  checking: "checking",
  unsupported: "unsupported",
  "needs-install": "needsInstall",
  unavailable: "unavailable",
  blocked: "blocked",
  off: "off",
  on: "on",
}

/** The label shown when each action failed. */
const FAILURES: Record<PushSettingsAction, keyof PushSettingsLabels> = {
  enable: "enableFailed",
  disable: "disableFailed",
  test: "testFailed",
}

/** Props of {@link PushSettings}. `usePushSubscription` in `@spy4x/preact-signals` returns them. */
export interface PushSettingsProps {
  /** Which state to show. See {@link PushSettingsStatus}. */
  status: PushSettingsStatus
  /** The action running now. Its button shows a spinner, and every button ignores presses. */
  busy?: PushSettingsAction | null
  /** The action that failed last. Its message shows beside the buttons and is announced. */
  failed?: PushSettingsAction | null
  /** `true` once a test notification was sent: shows and announces `labels.testSent`. */
  sent?: boolean
  /** Turns notifications on for this device. This is where the caller asks for permission. */
  onEnable: () => void
  /** Turns notifications off for this device. */
  onDisable: () => void
  /** Sends a test notification. The button shows only when this is given and the state is `on`. */
  onTest?: () => void
  /** Words to replace. */
  labels?: Partial<PushSettingsLabels>
  /** Utilities for the block, such as `pc-card p-4`. */
  class?: string
}

/**
 * Say whether this device gets notifications, and turn them on or off.
 *
 * One `role="status"` region is in the block from the first render and stays empty until something
 * changes, so a screen reader hears "turned on", "turned off", a failure or a sent test, and
 * nothing on page load. Turn on and Turn off are the same button, so focus stays on it through the
 * change; a failure message is the description of the button it belongs to; when the button leaves (the browser blocked notifications), focus moves to the sentence
 * that explains why instead of falling to the page body.
 */
export function PushSettings(
  { status, busy, failed, sent, onEnable, onDisable, onTest, labels, class: className }:
    PushSettingsProps,
): JSX.Element {
  const words = { ...DEFAULT_PUSH_SETTINGS_LABELS, ...labels }
  const block = useRef<HTMLElement>(null)
  const description = useRef<HTMLParagraphElement>(null)
  const messageId = useId()
  const announcement = useSignal("")
  const previous = useRef(status)
  /** Set while rendering with focus inside the block, read once the render is in the page. */
  const hadFocus = useRef(false)

  // Read before this render reaches the page: once a focused button is gone, focus has already
  // fallen to the body. A server render has no document.
  hadFocus.current = Boolean(
    block.current?.contains(globalThis.document?.activeElement ?? null),
  )

  // A layout effect runs in the commit that removed the button, so focus never rests on the body.
  useLayoutEffect(() => {
    const element = block.current
    if (hadFocus.current && element && !element.contains(element.ownerDocument.activeElement)) {
      description.current?.focus()
    }
  })

  const message = failed ? words[FAILURES[failed]] : sent ? words.testSent : ""

  useEffect(() => {
    const before = previous.current
    previous.current = status
    // The first reading of the device is not news; a change after it is.
    if (before === status || before === "checking") return
    announcement.value = status === "on"
      ? words.turnedOn
      : status === "off"
      ? words.turnedOff
      : words[DESCRIPTIONS[status]]
  }, [status])

  useEffect(() => {
    // Emptied when an action starts, so the same failure twice in a row is announced twice.
    if (busy) announcement.value = ""
    else if (message) announcement.value = message
  }, [busy, message])

  const toggling = busy === "enable" || busy === "disable"
  const press = (action: (() => void) | undefined) => () => {
    if (!busy) action?.()
  }

  return (
    <section
      ref={block}
      aria-label={words.title}
      data-push-status={status}
      class={cn("flex flex-col gap-3", className)}
    >
      <div class="flex flex-col gap-1">
        <p class="font-medium">{words.title}</p>
        <p ref={description} tabIndex={-1} class="text-sm text-muted outline-hidden">
          {words[DESCRIPTIONS[status]]}
        </p>
      </div>
      {status === "off" || status === "on"
        ? (
          <div class="flex flex-wrap gap-2">
            <Button
              variant={status === "on" ? "outline" : "primary"}
              busy={toggling}
              data-push-action="toggle"
              aria-describedby={failed && failed !== "test" ? messageId : undefined}
              onClick={press(status === "on" ? onDisable : onEnable)}
            >
              {status === "on" ? words.disable : words.enable}
            </Button>
            {status === "on" && onTest
              ? (
                <Button
                  variant="ghost"
                  busy={busy === "test"}
                  data-push-action="test"
                  aria-describedby={failed === "test" || sent ? messageId : undefined}
                  onClick={press(onTest)}
                >
                  {words.test}
                </Button>
              )
              : null}
          </div>
        )
        : null}
      {message
        ? (
          <p
            id={messageId}
            aria-hidden="true"
            data-push-message={failed ?? "sent"}
            class={cn("text-sm", failed ? "text-danger" : "text-muted")}
          >
            {message}
          </p>
        )
        : null}
      <p role="status" class="sr-only">{announcement.value}</p>
    </section>
  )
}
