import { cn } from "@preact-components/cn"
import type { ComponentChildren } from "preact"
import { useEffect } from "preact/hooks"

/** Kind of a toast, selecting its colour and glyph. */
export type ToastVariant = "success" | "error" | "info" | "warning"

export interface ToastItem {
  id: string | number
  body: ComponentChildren
  /** Defaults to `"info"`. */
  type?: ToastVariant
  /** Auto-dismiss delay in milliseconds. `0` keeps the toast until it is dismissed. Defaults to 5000. */
  duration?: number
}

export interface ToastrProps {
  /** Current toast stack, newest first. Owned by the caller. */
  toasts: ToastItem[]
  /** Injected dismiss port; also called by the auto-dismiss timer. */
  onDismiss: (id: string | number) => void
  /** Accessible name of the stack. Defaults to `"Notifications"`. */
  label?: string
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
 */
export function Toastr(
  { toasts, onDismiss, label = "Notifications", class: className }: ToastrProps,
) {
  if (!toasts.length) return null

  return (
    <div
      data-e2e="toastr"
      class={cn("fixed top-8 right-8 z-50 w-full max-w-xs space-y-4 md:max-w-sm", className)}
      role="region"
      aria-label={label}
    >
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </div>
  )
}

/**
 * One toast in the stack: its timer and its dismiss button.
 *
 * Split out so each toast owns exactly one timer, keyed to its own id and duration.
 */
function Toast(
  { toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string | number) => void },
) {
  const duration = toast.duration ?? defaultDuration

  useEffect(() => {
    if (!duration) return
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])

  return (
    <div
      class={cn("space-y-4 rounded-lg px-6 py-4 text-white", variantClasses[toast.type ?? "info"])}
    >
      <div class="flex justify-between gap-4">
        <p class="flex gap-2 text-sm">
          <ToastGlyph variant={toast.type ?? "info"} />
          {toast.body}
        </p>
        <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
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
