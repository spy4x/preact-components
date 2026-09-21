/**
 * The `ui/` feedback surfaces: empty and error states, the loading placeholders, the transient
 * notification stack, and the two dialogs.
 *
 * The overlay-style components are pinned inside a positioned box, the same way this section has
 * always shown `LoadingScreen` and `Toastr`. `Modal` and `ConfirmDialog` need no pinning — they are
 * native `<dialog>` elements in the browser's top layer, and they render **nothing** until they are
 * opened through `showModal()` in an effect. The card therefore carries a real trigger, so the
 * dialog is one press away, and the markup a reader sees here is the closed DOM.
 */

import {
  Button,
  ConfirmDialog,
  type DialogTone,
  EmptyState,
  ErrorState,
  LoadingScreen,
  LoadingSkeleton,
  LoadingSpinner,
  Modal,
  SkeletonCards,
  type SkeletonLineWidth,
  SkeletonStatus,
  SkeletonTable,
  SkeletonText,
  type SpinnerSize,
  tableGeometry,
  textGeometry,
  type ToastItem,
  Toastr,
  type ToastVariant,
} from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import { useState } from "preact/hooks"
import { IconFolder, IconPlus, IconTrashBin } from "@preact-components/icons"
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

/**
 * Every tone a dialog takes — the record is the coverage guard for `DialogTone`, and the two
 * variants are what `confirmVariant` maps a tone onto.
 */
const dialogTones: Record<DialogTone, string> = {
  default: "default — confirms with the primary button",
  danger: "danger — tints the surface and confirms in red",
}

/**
 * One width list per vocabulary entry the card demonstrates, in render order.
 *
 * `SkeletonLineWidth` is a union of a number, `"full"` and `undefined`, so an omitted list is a case
 * of its own rather than an empty one — and the two must not be conflated, because `[]` is what a
 * caller reaches for when it means "the default".
 */
const lineWidthSets: Array<{ label: string; widths?: SkeletonLineWidth[] }> = [
  { label: "full lines (no widths prop)" },
  { label: "explicit percentages", widths: [100, 85, 60] },
  { label: "a cycled pattern", widths: [90, 40] },
  { label: "the full keyword", widths: ["full", 70] },
]

/**
 * The three line widths `SkeletonText` resolves from one `widths` list, as its own text.
 *
 * Printed under each paragraph so the cycling rule is readable rather than inferred. The numbers are
 * read back out of `textGeometry` rather than recomputed here: an earlier revision of this helper
 * had the cycling rule of its own, and it printed `full` where the component resolves `100` for a
 * literal `"full"` in a list — a card quoting the wrong number while its own test passed, because
 * the test was measuring the copy. Delegating to the component's function is what makes the card
 * report what the placeholder really renders, and it is the same rule the sibling
 * {@link skeletonTableNote} follows with `tableGeometry`.
 *
 * @param widths The list the card passed, or `undefined` for the no-`widths` case.
 * @returns Three resolved widths, joined for display.
 */
export function skeletonWidthReport(widths?: readonly SkeletonLineWidth[]): string {
  return textGeometry(3, widths).linePercents.join(" / ")
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
 * How long the one auto-dismissing toast on this card lives, in milliseconds.
 *
 * Short and written down once, because the browser check drives this button: `pages/checks/ui.ts`
 * reads the number back off the button's `data-duration` instead of carrying a copy of it, so the
 * check waits multiples of whatever this card actually pushes and the two cannot drift apart. The
 * shipped default is 5000, which is too long to wait for five times in a verification run.
 */
const autoDismissMs = 1200

/** Body of that toast, and the string the browser check watches for. */
const autoDismissBody = "auto — dismissed by its own timer"

/**
 * What the extend control raises every toast on screen to, in milliseconds.
 *
 * Longer than {@link autoDismissMs} by enough that the two possible outcomes cannot be confused: a
 * toast given the new budget in full outlives one that carried on with whatever the old budget had
 * left by about two seconds, and that gap is what the browser check measures.
 */
const extendMs = 2500

/**
 * `Toastr` is also positioned for the page corner. The stack is owned here, not by the component:
 * `onDismiss` is the port, `duration: 0` keeps a toast until the demo dismisses it, one button
 * pushes a toast that dismisses itself, and one raises the duration of everything on screen.
 *
 * The dashed box is what shows the new empty-stack contract: the live area is inside it before
 * anything is pushed, and it is zero pixels tall, so the box looks exactly as it did when the
 * component rendered `null` for an empty stack.
 */
function ToastrDemo() {
  const stack = useSignal<ToastItem[]>([])
  const nextId = useSignal(0)

  const push = (type: ToastVariant, duration: number, body: string) => {
    nextId.value += 1
    stack.value = [{ id: nextId.value, type, duration, body }, ...stack.value]
  }

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        {entries(toastVariants).map(([variant, label]) => (
          <button
            key={variant}
            type="button"
            class={toastButton}
            data-e2e={`toast-${variant}`}
            onClick={() => push(variant, 0, `${variant} — pushed by the demo stack`)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          class={toastButton}
          data-e2e="toast-auto"
          data-duration={autoDismissMs}
          onClick={() => push("info", autoDismissMs, autoDismissBody)}
        >
          auto-dismiss ({autoDismissMs}ms)
        </button>
        <button
          type="button"
          class={toastButton}
          data-e2e="toast-extend"
          data-duration={extendMs}
          onClick={() =>
            stack.value = stack.value.map((toast) => ({ ...toast, duration: extendMs }))}
        >
          extend to {extendMs}ms
        </button>
        <button
          type="button"
          class={toastButton}
          data-e2e="toast-clear"
          onClick={() => stack.value = []}
        >
          clear {stack.value.length ? `(${stack.value.length})` : ""}
        </button>
      </div>
      <div class="min-h-24 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
        {stack.value.length === 0
          ? (
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Nothing pushed yet. The live area is already in the box below, empty and zero pixels
              tall — that is what lets a screen reader announce a toast that arrives later.
            </p>
          )
          : null}
        <Toastr
          toasts={stack.value}
          onDismiss={(id) => stack.value = stack.value.filter((toast) => toast.id !== id)}
          dataE2E="guide-toastr"
          class="static max-w-sm"
        />
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Put the pointer over the stack, or tab into it, and every timer stops; each one picks up the
        time it had left when you leave, rather than starting over. Raising a toast's `duration` is
        the one thing that refills its budget, which is what the extend control does. The error
        toast is a `role="alert"`, so it interrupts a screen reader; the rest are `role="status"`
        inside a polite region.
      </p>
    </div>
  )
}

/** Absent slots render nothing, and an instance with no slot at all renders `null`. */
function EmptyStateDemo() {
  return (
    <div class="space-y-2">
      <div class="max-w-[650px]">
        <EmptyState
          icon={<IconFolder class="size-5" />}
          title="No invoices yet"
          description="Invoices appear here once a customer is billed."
          action={
            <Button size="sm">
              <IconPlus class="size-4" />New invoice
            </Button>
          }
        />
      </div>
      <div class="max-w-[650px]">
        <EmptyState title="No filters applied" />
      </div>
      <div class="max-w-[650px]">
        <EmptyState />
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The third instance passes no slot at all and renders nothing — an empty state cannot invent
        copy, and the guide ships no product sentence to fall back on.
      </p>
    </div>
  )
}

/** The four width vocabularies, one paragraph each, with the resolved percentages printed. */
function SkeletonTextDemo() {
  return (
    <div class="space-y-5">
      {lineWidthSets.map(({ label, widths }) => (
        <div key={label} class="space-y-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <SkeletonText lines={3} widths={widths} />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            widths={widths === undefined ? "undefined" : JSON.stringify(widths)}{" "}
            — a shorter list cycles, so three lines read {skeletonWidthReport(widths)}
          </p>
        </div>
      ))}
    </div>
  )
}

/**
 * Card grids at both default and explicit counts.
 *
 * The grid is `sm:grid-cols-2 lg:grid-cols-3` as shipped, so the two-column call below passes the
 * utilities that override it — the component takes a `class` for exactly that.
 */
function SkeletonCardsDemo() {
  return (
    <div class="space-y-5">
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `columns={2} rows={1} lines={2}` — a two-up grid of one row
        </p>
        <div class="lg:grid-cols-2">
          <SkeletonCards columns={2} lines={2} class="lg:grid-cols-2" />
        </div>
      </div>
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `columns={3} rows={2} lines={3}` — the 3 × 2 grid, three bars per card
        </p>
        <SkeletonCards columns={3} rows={2} lines={3} />
      </div>
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `lines={0}` — the card boxes with no copy reserved inside them
        </p>
        <SkeletonCards columns={3} rows={1} lines={0} />
      </div>
    </div>
  )
}

/**
 * The cells and the row height one `SkeletonTable` reserves, as a sentence.
 *
 * The count is the claim worth making — `rows × columns` placeholder cells is what makes two layouts
 * line up — and it comes from the same `tableGeometry` the component renders from, so the card
 * cannot state a number the markup contradicts. The row height is printed in `px` because that is
 * the unit it was measured in.
 *
 * @param rows Placeholder body rows.
 * @param columns Column count.
 * @returns e.g. `4 × 3 = 12 placeholder cells, each row 53px tall`.
 */
export function skeletonTableNote(rows: number, columns: number): string {
  const geometry = tableGeometry({ rows, columns })

  return `${geometry.rows} × ${geometry.columns} = ${geometry.cells} placeholder cells, each row ` +
    `${Math.round(geometry.rowHeightRem * 16)}px tall`
}

/**
 * Table placeholders: even columns, weighted columns, and the same table without the height
 * reservation it ships with.
 *
 * `reserveHeight` is the one prop that is about the page rather than the shape: the real `Table`
 * reserves `min-h-[300px]`, so the skeleton does too unless the caller says otherwise.
 */
function SkeletonTableDemo() {
  const weights = [3, 1, 2]

  return (
    <div class="space-y-5">
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `rows={4} columns={3}` — {skeletonTableNote(4, 3)}
        </p>
        <SkeletonTable rows={4} columns={3} />
      </div>
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `widths={JSON.stringify(weights)}` —{" "}
          {skeletonTableNote(2, 3)}: the weights are the caller's description of the split, not a
          mirror of it, because the real `Table` is `table-auto` and sizes from content
        </p>
        <SkeletonTable widths={weights} rows={2} />
      </div>
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `reserveHeight={false}` — for a real table that has dropped `min-h-[300px]`, which is what
          an empty result set renders
        </p>
        <SkeletonTable rows={2} columns={4} reserveHeight={false} />
      </div>
      <div class="space-y-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          `rows={1} columns={0}` — nothing to render, so no header and no cells
        </p>
        <SkeletonTable rows={1} columns={0} reserveHeight={false} />
      </div>
    </div>
  )
}

/**
 * The announcement that goes with the placeholders, and the placeholder it is silent about.
 *
 * `SkeletonStatus` renders its text `sr-only`, so the visible card is nearly empty on purpose: the
 * two instances are the labelled and the blank case, and the difference between them is the whole
 * contract — a blank label renders `null` rather than an empty region.
 */
function SkeletonStatusDemo() {
  return (
    <div class="space-y-3">
      <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <SkeletonStatus label="Loading the invoice list…" />
        <SkeletonText lines={2} />
      </div>
      <SkeletonStatus label="   " />
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Only the first instance is in the DOM: `role="status"`, `aria-live="polite"` and `sr-only`,
        which is why a sighted reader sees the placeholder and nothing else. The second passes
        whitespace and renders nothing.
      </p>
    </div>
  )
}

/**
 * The two dialog tones, each behind its own trigger, plus the step a close port closes over.
 *
 * Mounting is opening: the component renders `null` while closed, and the press mounts it, which is
 * what makes the effect call `showModal()`. The dialog's actual behaviour is the browser's, and this
 * repository has no DOM harness, so the unit suite covers what the component renders and the pure
 * decisions it makes (`isBackdropClick`, `escapeCloseStrategy`, `shouldRetargetFocus`).
 *
 * **This card is what the browser checks drive.** `deno task --cwd pages verify` presses the first
 * trigger below, asserts the dialog is `:modal` with focus inside it, presses the step control
 * inside the dialog, sends a real Escape key press, and asserts the dialog closed, that the close
 * port saw the step the parent has *now*, and that focus returned to that trigger. That `:modal`
 * reading is what says the dialog reached the top layer at all. Still covered by no committed test:
 * what two dialogs open at once do to each other's stacking order, focus containment, the backdrop
 * hit-test, scroll-lock compensation and the refused-Escape path.
 *
 * **Why the step is `useState` and not a signal.** A signal read from any render's closure returns
 * the current value, which is exactly what hides a handler that captured an old one. The step is
 * plain state and `onClose` closes over it by value, so "which render's port ran" becomes a number
 * on screen — the difference between a dialog that acts on the step the user is on and one that
 * acts on the step they opened it from.
 */
function ModalDemo() {
  const open = useSignal<DialogTone | null>(null)
  const [step, setStep] = useState(1)
  const [closedAtStep, setClosedAtStep] = useState<number | null>(null)

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        {entries(dialogTones).map(([tone, label]) => (
          <Button
            key={tone}
            variant="outline"
            size="sm"
            onClick={() => open.value = tone}
          >
            {label}
          </Button>
        ))}
        <span class="text-xs text-gray-500 dark:text-gray-400">
          nothing is mounted until a trigger is pressed: {open.value === null ? "closed" : "open"}
        </span>
      </div>

      <p
        class="text-xs text-gray-500 dark:text-gray-400"
        data-e2e="modal-close-step"
        data-step={step}
        data-closed-at={closedAtStep ?? ""}
      >
        step {step}; the close port last read{" "}
        {closedAtStep === null ? "nothing yet" : `step ${closedAtStep}`}
      </p>

      {open.value !== null && (
        <Modal
          open
          onClose={() => {
            setClosedAtStep(step)
            open.value = null
          }}
          title={`Modal — ${open.value}`}
          tone={open.value}
          cancelLabel="Close"
          dataE2E="guide-modal"
          footer={
            <>
              <Button variant="outline" onClick={() => open.value = null}>Cancel</Button>
              <Button onClick={() => open.value = null}>Save</Button>
            </>
          }
        >
          <p class="text-sm text-gray-600 dark:text-gray-300">
            Opened through `showModal()`, in the browser's top layer. Escape, the header control and
            a backdrop click all route through `onClose`; returning `false` from that port refuses
            the close and keeps the dialog open.
          </p>
          <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
            This dialog's `onClose` closes over the step below. Advance it, then press Escape: the
            line above the dialog has to report the step you advanced to, not the one this dialog
            opened on.
          </p>
          <Button
            variant="outline"
            size="sm"
            class="mt-3"
            data-e2e="modal-next-step"
            onClick={() => setStep(step + 1)}
          >
            advance to step {step + 1}
          </Button>
        </Modal>
      )}
    </div>
  )
}

/**
 * Confirmation panels for both tones, with the ports wired to visible state.
 *
 * `onConfirm` writes the sentence a real handler would produce, and the panel does **not** close
 * itself — the port clears `open`, which is exactly the shape that keeps a failed request from
 * discarding the panel. A refusing `onCancel` is demonstrated by the second trigger: it returns
 * `false`, so the dialog stays open. As with `Modal`, everything after the press is browser-only.
 */
function ConfirmDialogDemo() {
  const target = useSignal<string | null>(null)
  const outcome = useSignal("nothing confirmed yet")

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => target.value = "danger"}
        >
          <IconTrashBin class="size-4" />Delete invoice
        </Button>
        <Button size="sm" onClick={() => target.value = "default"}>Archive invoice</Button>
        <Button variant="outline" size="sm" onClick={() => target.value = "refusing-cancel"}>
          Refusing cancel
        </Button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e="controlled-value">
        outcome: {outcome.value}
      </p>

      {target.value === "danger" && (
        <ConfirmDialog
          title="Delete invoice INV-0007?"
          message="This cannot be undone: the row and its lines are removed for good."
          confirmLabel="Delete"
          cancelLabel="Keep it"
          tone="danger"
          dataE2E="guide-confirm"
          onConfirm={() => {
            outcome.value = "confirmed: delete INV-0007"
            target.value = null
          }}
          onCancel={() => {
            target.value = null
          }}
        />
      )}

      {target.value === "default" && (
        <ConfirmDialog
          title="Archive invoice INV-0007?"
          confirmLabel="Archive"
          cancelLabel="Cancel"
          onConfirm={() => {
            outcome.value = "confirmed: archive INV-0007"
            target.value = null
          }}
          onCancel={() => {
            target.value = null
          }}
        >
          <p class="text-sm text-gray-600 dark:text-gray-300">
            A panel richer than one sentence goes in as `children` instead of `message`.
          </p>
        </ConfirmDialog>
      )}

      {target.value === "refusing-cancel" && (
        <ConfirmDialog
          title="Unsaved changes"
          message="The cancel port below returns false, so the dialog stays open: that is how a caller guards unsaved work."
          confirmLabel="Discard"
          cancelLabel="Stay"
          onConfirm={() => {
            target.value = null
          }}
          onCancel={() => {
            outcome.value = "cancel refused — the panel stays open"
            return false
          }}
        />
      )}
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
  EmptyState: {
    summary:
      'Placeholder for a list, table or search that produced no rows. Every string is a prop, and the component owns layout and nothing else; an instance with no slot at all renders `null`. It is `role="status"`, so an empty collection is announced politely rather than raising an alert.',
    snippet: `<EmptyState
  icon={<IconFolder class="size-5" />}
  title="No invoices yet"
  description="Invoices appear here once a customer is billed."
  action={<Button size="sm">New invoice</Button>}
/>`,
    render: () => <EmptyStateDemo />,
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
  SkeletonText: {
    summary:
      "Paragraph-shaped placeholder: `lines` bars, each at its own width from `widths`, which cycles when it is shorter than `lines`. With no `widths` every line is full width, and the bars carry the same `text-sm` line box the real paragraph does.",
    snippet: `<SkeletonText lines={3} widths={[100, 85, 60]} />

// The ragged right edge belongs to the copy, so a paragraph with no width list is all-full:
<SkeletonText lines={2} />`,
    render: () => <SkeletonTextDemo />,
  },
  SkeletonTable: {
    summary:
      "Table-shaped placeholder mirroring a real `Table`'s boxes: the same wrapper, the same row heights, one `grid-template-columns` on the header and every row. `widths` are relative weights, a description of the shape rather than a mirror of `table-auto`'s content sizing, and `reserveHeight` follows the real table's `min-h-[300px]`.",
    snippet: `<SkeletonTable rows={4} columns={3} />

<SkeletonTable widths={[3, 1, 2]} rows={2} />

// An empty result set: the real table dropped its height reservation too.
<SkeletonTable rows={0} columns={0} reserveHeight={false} />`,
    render: () => <SkeletonTableDemo />,
  },
  SkeletonCards: {
    summary:
      "Card-grid placeholder: `columns × rows` boxes on the grid a card grid is written with, each carrying the real `Card`'s surface utilities and `lines` text bars inside it. The column count stays a prop because the shipped utilities only express two and three columns.",
    snippet: `<SkeletonCards columns={3} rows={2} lines={2} />

// A two-up grid overrides the shipped three-column default through class:
<SkeletonCards columns={2} lines={3} class="lg:grid-cols-2" />`,
    render: () => <SkeletonCardsDemo />,
  },
  SkeletonStatus: {
    summary:
      'The live region that announces a load the skeletons are silent about: `role="status"`, polite, `sr-only`, so one instance can cover a table, a grid and a paragraph. A blank or absent label renders `null` rather than an empty region.',
    snippet: `<SkeletonStatus label="Loading the invoice list…" />
<SkeletonTable rows={4} columns={3} />`,
    render: () => <SkeletonStatusDemo />,
  },
  LoadingScreen: {
    summary: "Full-viewport loading overlay: `message` plus an optional second line.",
    snippet: `<LoadingScreen message="Syncing" description="This can take a minute." />`,
    render: () => <LoadingScreenDemo />,
  },
  Modal: {
    summary:
      "Dialog on the platform's `<dialog>`, opened by mounting it through `showModal()` — the `open` attribute is deliberately never rendered, because `<dialog open>` is the non-modal state and `showModal()` throws on it. `open` is either caller-owned or seeded by `defaultOpen`, every close leaves through `onClose` (return `false` to refuse), and `title` supplies the accessible name unless `ariaLabel` does.",
    snippet: `<Modal
  open={open.value}
  onClose={() => open.value = false}
  title="Rename the list"
  cancelLabel="Close"
  tone="danger"
  footer={<Button onClick={save}>Save</Button>}
>
  <p>Modal body.</p>
</Modal>`,
    render: () => <ModalDemo />,
  },
  ConfirmDialog: {
    summary:
      "Confirmation panel: a title, one question as `message` or richer `children`, and two labelled actions. `title`, `confirmLabel` and `cancelLabel` are required — the library ships no product copy, and a blank label throws rather than rendering an unlabelled action. Nothing closes itself: `onConfirm` and `onCancel` are ports, and only the caller moves its own flag.",
    snippet: `<ConfirmDialog
  title="Delete invoice INV-0007?"
  message="This cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Keep it"
  tone="danger"
  onConfirm={() => deleteInvoice()}
  onCancel={() => confirming.value = false}
/>`,
    render: () => <ConfirmDialogDemo />,
  },
  Toastr: {
    summary:
      'Stack of transient notifications. The caller owns the stack: it arrives as `toasts` and removal is the `onDismiss` port, which the per-toast auto-dismiss timer also calls. The stack is in the document at all times, empty included — a named region marked `aria-live="polite"`, because an area created together with its first message is commonly not announced at all; empty it has no children and no height, so it costs a landmark rather than layout. An error toast carries `role="alert"` and interrupts, every other variant `role="status"`. The timer pauses while the pointer is over the stack or focus is inside it and resumes with the time it had left, so the dismiss control is reachable rather than a race; raising a toast\'s `duration` while it is on screen refills the budget instead, which is how a caller extends one. Every string is a prop with an English default — `label`, `dismissLabel`, and `ToastItem.dismissLabel` for one toast — and `data-e2e` is rendered only when `dataE2E` is passed.',
    snippet: `<Toastr
  toasts={app.toast.list.value}
  onDismiss={(id) => app.toast.remove(id)}
  label="Benachrichtigungen"
  dismissLabel="Ausblenden"
/>

// One toast naming its own control, which is worth doing when several are on screen at once:
{ id: "upload", type: "error", body: "Upload failed", dismissLabel: "Dismiss the upload error" }`,
    render: () => <ToastrDemo />,
  },
} satisfies DemoFragment
