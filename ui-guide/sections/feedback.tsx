import {
  ErrorState,
  LoadingScreen,
  LoadingSkeleton,
  LoadingSpinner,
  type SpinnerSize,
  type ToastItem,
  Toastr,
  type ToastVariant,
} from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import { entries } from "../record.ts"
import type { DemoFragment } from "../registry.ts"

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: "small",
  md: "medium (default)",
  lg: "large",
}

/** One button per toast variant — a variant with no button does not compile. */
const toastVariants: Record<ToastVariant, string> = {
  success: "success",
  error: "error",
  info: "info",
  warning: "warning",
}

const toastButton =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"

function SpinnerDemo() {
  return (
    <div class="flex flex-wrap items-start gap-8">
      {entries(spinnerSizes).map(([size, label]) => (
        <LoadingSpinner key={size} size={size} label={label} class="py-0" />
      ))}
      <LoadingSpinner class="py-0" />
    </div>
  )
}

/**
 * `LoadingScreen` is a full-viewport overlay, so the demo pins it inside a positioned box with a
 * `class` override rather than covering the catalogue. The override works because the package
 * merges classes through `cn`, where a later position utility wins.
 */
function LoadingScreenDemo() {
  return (
    <div class="relative h-56 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <LoadingScreen class="absolute" message="Loading…" description="Please wait…" />
    </div>
  )
}

/**
 * `Toastr` is also positioned for the page corner. The stack is owned here, not by the component:
 * `onDismiss` is the port, and `duration: 0` keeps each toast until the demo dismisses it.
 */
function ToastrDemo() {
  const stack = useSignal<ToastItem[]>([])
  const nextId = useSignal(0)

  const push = (type: ToastVariant) => {
    nextId.value += 1
    stack.value = [
      { id: nextId.value, type, duration: 0, body: `${type} — pushed by the demo stack` },
      ...stack.value,
    ]
  }

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        {entries(toastVariants).map(([variant, label]) => (
          <button
            key={variant}
            type="button"
            class={toastButton}
            onClick={() => push(variant)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          class={toastButton}
          onClick={() => stack.value = []}
        >
          clear {stack.value.length ? `(${stack.value.length})` : ""}
        </button>
      </div>
      <div class="min-h-24 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
        {stack.value.length === 0
          ? (
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Nothing pushed yet — `Toastr` renders nothing for an empty stack.
            </p>
          )
          : null}
        <Toastr
          toasts={stack.value}
          onDismiss={(id) => stack.value = stack.value.filter((toast) => toast.id !== id)}
          class="static max-w-sm"
        />
      </div>
    </div>
  )
}

export const feedbackDemos = {
  ErrorState: {
    summary:
      "Inline error banner. Renders nothing for an empty, `null` or `undefined` message, so a possibly-empty value can be passed straight through.",
    snippet: `<ErrorState message={error.value} />`,
    render: () => (
      <div class="space-y-3">
        <ErrorState message="The report could not be generated: no accounts are connected." />
        <ErrorState message="" />
        <p class="text-sm text-gray-500 dark:text-gray-400">
          The block above is empty on purpose — <code>message=""</code> returns <code>null</code>.
        </p>
      </div>
    ),
  },
  LoadingSpinner: {
    summary:
      "Inline spinner in a polite live region. `label` is the visible caption; without one only a screen-reader “Loading” remains.",
    snippet: `<LoadingSpinner size="lg" label="Loading transactions…" />`,
    render: () => <SpinnerDemo />,
  },
  LoadingSkeleton: {
    summary:
      "Placeholder layout shown while a result loads. The whole tree is `aria-hidden`, so a screen reader hears the caller's status message instead of empty boxes.",
    snippet: `<LoadingSkeleton rows={2} />`,
    render: () => (
      <div class="space-y-6">
        <LoadingSkeleton rows={1} class="mt-0" />
        <LoadingSkeleton rows={3} class="mt-0" />
      </div>
    ),
  },
  LoadingScreen: {
    summary: "Full-viewport loading overlay: `message` plus an optional second line.",
    snippet: `<LoadingScreen message="Syncing" description="This can take a minute." />`,
    render: () => <LoadingScreenDemo />,
  },
  Toastr: {
    summary:
      "Stack of transient notifications. The caller owns the stack: it arrives as `toasts` and removal is the `onDismiss` port, which the per-toast auto-dismiss timer also calls.",
    snippet: `<Toastr toasts={app.toast.list.value} onDismiss={(id) => app.toast.remove(id)} />`,
    render: () => <ToastrDemo />,
  },
} satisfies DemoFragment<
  "ErrorState" | "LoadingScreen" | "LoadingSkeleton" | "LoadingSpinner" | "Toastr"
>
