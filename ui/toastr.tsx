import { cn } from "@preact-components/cn"
import type { ComponentChildren } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"

/** Kind of a toast, selecting its colour and glyph. */
export type ToastVariant = "success" | "error" | "info" | "warning"

export interface ToastItem {
  id: string | number
  body: ComponentChildren
  /** Defaults to `"info"`. */
  type?: ToastVariant
  /** Auto-dismiss delay in milliseconds. `0` keeps the toast until it is dismissed. Defaults to 5000. */
  duration?: number
  /**
   * Accessible name of this toast's own dismiss control, overriding
   * {@link ToastrProps.dismissLabel} for this toast alone.
   *
   * Every control in the stack is otherwise named the same, so somebody tabbing through three
   * toasts hears one word three times with nothing to tell them apart. A caller that knows what a
   * toast is about can say so here — "Dismiss the upload error".
   */
  dismissLabel?: string
}

export interface ToastrProps {
  /** Current toast stack, newest first. Owned by the caller. */
  toasts: ToastItem[]
  /** Injected dismiss port; also called by the auto-dismiss timer. */
  onDismiss: (id: string | number) => void
  /** Accessible name of the stack. Defaults to `"Notifications"`. */
  label?: string
  /**
   * Accessible name of every toast's dismiss control. Defaults to `"Dismiss"`; one toast overrides
   * it through {@link ToastItem.dismissLabel}.
   */
  dismissLabel?: string
  /**
   * Value of the `data-e2e` attribute on the stack. The attribute is absent when this prop is, so a
   * consumer's markup carries a test hook only when that consumer asked for one.
   */
  dataE2E?: string
  class?: string
}

const variantClasses: Record<ToastVariant, string> = {
  success: "bg-green-700",
  error: "bg-red-600",
  info: "bg-blue-700",
  warning: "bg-yellow-700",
}

const defaultDuration = 5000

/**
 * Stack of transient notifications in the top-right corner.
 *
 * The source component read `state.toast.list` and called `state.toast.remove`. Here the stack
 * arrives as the `toasts` prop and removal is the `onDismiss` port, so the host app keeps
 * ownership of its store. Auto-dismiss is per toast: the timer calls `onDismiss` with that id.
 *
 * **The stack is in the document at all times, including when it is empty**, which is a change from
 * the version that returned `null` for an empty stack. That is what makes an arriving toast a
 * *change* to an area the screen reader is already watching: a live region created in the same
 * breath as its first message is commonly not announced at all, because the reader sees a new
 * subtree rather than a mutation of one it is following. The `aria-live` marking below would be
 * worth very little without it. An empty stack has no children, no padding and no minimum height,
 * so it paints nothing and reserves no space — laid out `fixed` it is out of flow anyway, and a
 * caller that makes it `static` gets a zero-height box. The cost is one named landmark per page.
 *
 * Politeness is set twice over, and deliberately. The stack is polite, so an ordinary toast is
 * announced once the reader has finished what it is saying; an error toast additionally carries
 * `role="alert"`, which is assertive, so it interrupts. Both roles imply `aria-atomic`, which is
 * what makes the reader announce a whole toast rather than only the text that changed.
 *
 * The auto-dismiss timer pauses while the pointer is over the stack or focus is inside it, and
 * resumes with the time it had left. Without that, reaching the dismiss control — or a link in a
 * toast's body — is a race against a five-second timer.
 */
export function Toastr(
  {
    toasts,
    onDismiss,
    label = "Notifications",
    dismissLabel = "Dismiss",
    dataE2E,
    class: className,
  }: ToastrProps,
) {
  const [paused, setPaused] = useState(false)

  return (
    <div
      data-e2e={dataE2E}
      class={cn("fixed top-8 right-8 z-50 w-full max-w-xs space-y-4 md:max-w-sm", className)}
      role="region"
      aria-label={label}
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusIn={() => setPaused(true)}
      onFocusOut={(event) => {
        // `focusout` fires for a move *inside* the stack too — from a link in a toast's body to its
        // dismiss control, say — and resuming there would restart the timer under the reader's
        // hands. A `relatedTarget` of `null` means focus left the document, which counts as leaving.
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        setPaused(false)
      }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          paused={paused}
          onDismiss={onDismiss}
          dismissLabel={toast.dismissLabel ?? dismissLabel}
        />
      ))}
    </div>
  )
}

/** What the stack hands one toast. */
interface ToastProps {
  toast: ToastItem
  /** Whether the stack is being read right now: the pointer is over it, or focus is inside it. */
  paused: boolean
  onDismiss: (id: string | number) => void
  /** Accessible name for this toast's dismiss control, already resolved by the stack. */
  dismissLabel: string
}

/**
 * One toast in the stack: its timer and its dismiss button.
 *
 * Split out so each toast owns exactly one timer, keyed to its own id and duration.
 *
 * The timer is a budget rather than a deadline. `remaining` starts at the toast's duration, every
 * pause clears the pending timeout and subtracts what ran, and every resume starts a fresh timeout
 * for what is left. Hovering a five-second toast three times therefore dismisses it five seconds
 * after it was last left alone, instead of restarting the clock or losing the time already spent.
 *
 * `onDismiss` is read through a ref rather than named as a dependency of the timer effect. Callers
 * pass an inline arrow — the port is `(id) => stack.value = stack.value.filter(…)` in every example
 * this library ships — so its identity changes on every render of the host, and a dependency on it
 * would tear the timer down and build it again each time the page around the stack re-rendered.
 */
function Toast({ toast, paused, onDismiss, dismissLabel }: ToastProps) {
  const duration = toast.duration ?? defaultDuration
  const remaining = useRef(duration)
  const dismiss = useRef(onDismiss)

  useEffect(() => {
    dismiss.current = onDismiss
  })

  // Runs before the timer effect below, and only when this toast's own budget changes, so a caller
  // that lengthens a toast already on screen gets the new budget in full while a pause does not.
  useEffect(() => {
    remaining.current = duration
  }, [toast.id, duration])

  useEffect(() => {
    if (!duration || paused) return
    const startedAt = Date.now()
    const timer = setTimeout(() => dismiss.current(toast.id), remaining.current)

    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt))
    }
  }, [toast.id, duration, paused])

  const variant = toast.type ?? "info"

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      class={cn("space-y-4 rounded-lg px-6 py-4 text-white", variantClasses[variant])}
    >
      <div class="flex justify-between gap-4">
        <p class="flex gap-2 text-sm">
          <ToastGlyph variant={variant} />
          {toast.body}
        </p>
        <button type="button" onClick={() => onDismiss(toast.id)} aria-label={dismissLabel}>
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** Variant glyph, inlined so the package carries no icon dependency. */
function ToastGlyph({ variant }: { variant: ToastVariant }) {
  return (
    <svg
      class="size-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {variant === "success" && <path d="m5 13 4 4L19 7" />}
      {variant === "info" && <path d="M12 8h.01M11 12h1v5h1" />}
      {(variant === "warning" || variant === "error") && (
        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      )}
    </svg>
  )
}
