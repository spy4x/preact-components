import { useSignal } from "@preact/signals"
import { cn } from "@spy4x/preact-cn"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { TOUCH_TARGET } from "./touch-target.ts"

export interface ResendButtonProps {
  /** Called when the person presses the button. The caller sends the mail again. */
  onResend: () => void
  /**
   * The resend is running: the button shows `busyLabel` and keeps focus. Set the new `readyAt` no
   * later than the render that clears this, so the component knows the resend went out.
   */
  busy?: boolean
  /**
   * When the button may be pressed again, in milliseconds since the epoch, such as
   * `sentAt + 60_000`. Until then the line is a sentence counting the seconds down. Left out, or in
   * the past, the button shows at once.
   */
  readyAt?: number
  /** The button's text. Defaults to `"Send it again"`. */
  label?: string
  /** The button's text while `busy`. Defaults to `"Sending…"`. */
  busyLabel?: string
  /**
   * The sentence shown while counting down, given the whole seconds left (1 or more). Defaults to
   * "Not there? Check your spam folder. You can send it again in 45 seconds."
   */
  waitingText?: (seconds: number) => ComponentChildren
  /** The words before the button once it is ready. Defaults to "Not there? Check your spam folder, or". */
  readyText?: ComponentChildren
  /**
   * The line that takes focus after a resend went out. Defaults to "Sent again. Check your inbox."
   */
  sentText?: ComponentChildren
  /** Utilities for the root element. */
  class?: string
}

/** One second: how often the countdown ticks. */
const TICK_MS = 1_000

/** Whole seconds left until `readyAt`, rounded up, and 0 once it has passed. */
function secondsLeft(readyAt: number | undefined): number {
  return readyAt === undefined ? 0 : Math.max(0, Math.ceil((readyAt - Date.now()) / TICK_MS))
}

/**
 * The "Not there?" line under a "Check your inbox" message: a sentence counting down until the
 * mail may be sent again, then a ghost button that sends it.
 *
 * The cooldown is a sentence, never a disabled button: a disabled control says nothing about when
 * it will work and cannot be reached with Tab. The countdown sits in `aria-live="off"`, so a screen
 * reader is not told the time every second, even when a caller puts this inside a live region.
 * One interval ticks it while counting down, and is cleared once the time is up or on unmount.
 *
 * After a press, once `readyAt` moves into the future, focus moves to a `role="status"` line with
 * `sentText`, since the button that had focus is gone. That line stays until the next press. A
 * resend that failed leaves `readyAt` as it was: the button stays, and the caller shows the error.
 */
export function ResendButton(
  {
    onResend,
    busy = false,
    readyAt,
    label = "Send it again",
    busyLabel = "Sending…",
    waitingText = (seconds) =>
      `Not there? Check your spam folder. You can send it again in ${seconds} ${
        seconds === 1 ? "second" : "seconds"
      }.`,
    readyText = "Not there? Check your spam folder, or",
    sentText = "Sent again. Check your inbox.",
    class: className,
  }: ResendButtonProps,
): JSX.Element {
  const tick = useSignal(0)
  const sent = useSignal(false)
  const pressed = useRef(false)
  const status = useRef<HTMLParagraphElement>(null)

  // Read to re-render on every tick; the time itself comes from the clock.
  void tick.value
  const seconds = secondsLeft(readyAt)

  useEffect(() => {
    if (secondsLeft(readyAt) === 0) return
    const timer = setInterval(() => {
      tick.value += 1
      if (secondsLeft(readyAt) === 0) clearInterval(timer)
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [readyAt])

  useEffect(() => {
    if (!pressed.current || busy || secondsLeft(readyAt) === 0) return
    pressed.current = false
    sent.value = true
  }, [readyAt, busy])

  useEffect(() => {
    if (sent.value) status.current?.focus()
  }, [sent.value])

  return (
    <div class={cn("flex flex-col gap-2 text-sm text-muted", className)} data-e2e="resend-button">
      {
        /* Always in the page, empty until a resend went out, so its text is announced when it
           arrives; it takes focus too, which reads it out on its own. */
      }
      <p
        ref={status}
        role="status"
        tabIndex={-1}
        class="text-foreground empty:hidden"
        data-e2e="resend-button-sent"
      >
        {sent.value ? sentText : null}
      </p>
      {seconds > 0
        ? (
          <p aria-live="off" data-e2e="resend-button-waiting">
            {waitingText(seconds)}
          </p>
        )
        : (
          <p>
            {readyText}{" "}
            <Button
              variant="ghost"
              size="sm"
              class={TOUCH_TARGET}
              busy={busy}
              busyLabel={busyLabel}
              onClick={() => {
                pressed.current = true
                sent.value = false
                onResend()
              }}
              data-e2e="resend-button-send"
            >
              {label}
            </Button>
          </p>
        )}
    </div>
  )
}
