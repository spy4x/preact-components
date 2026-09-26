/**
 * The `ui/` feedback surfaces: empty and error states, the loading placeholders, the transient
 * notification stack, and the two dialogs.
 *
 * `Toastr` is positioned for the whole window, so its card pins it into the demo with a `class`
 * override. `Modal` and `ConfirmDialog` need no pinning: they are native
 * `<dialog>` elements in the browser's top layer and render nothing until a trigger opens them.
 */

import {
  Button,
  Cluster,
  ConfirmDialog,
  defaultToastDuration,
  type DialogTone,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  LoadingSpinner,
  Modal,
  type SpinnerSize,
  Stack,
  Toastr,
  type ToastVariant,
} from "@spy4x/preact-ui"
import { createToastStore } from "@spy4x/preact-signals/toast"
import { useSignal } from "@preact/signals"
import { useMemo, useState } from "preact/hooks"
import { IconFolder, IconPlus, IconTrashBin } from "@spy4x/preact-icons"
import { entries } from "../record.ts"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
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
  default: "default dialog",
  danger: "danger dialog",
}

function SpinnerDemo() {
  return (
    <Cluster align="end" gap="xl">
      {entries(spinnerSizes).map(([size, label]) => (
        <LoadingSpinner key={size} size={size} label={label} class="py-0" />
      ))}
    </Cluster>
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

/** Body of the long-lived toast, so a failure message can name which one outstayed its welcome. */
const longBody = "long — outlives the component's own default"

/**
 * What the extend control raises every toast on screen to, in milliseconds.
 *
 * Longer than {@link autoDismissMs} by enough that the two possible outcomes cannot be confused: a
 * toast given the new budget in full outlives one that carried on with whatever the old budget had
 * left by about two seconds, and that gap is what the browser check measures.
 */
const extendMs = 2500

/**
 * A delay far longer than the component's own five-second default, in milliseconds.
 *
 * The card pushes one of these so the browser check can watch a toast live past the moment the
 * default would have taken it. Twenty seconds is the number #174 was written about, and the check
 * waits six of them rather than all twenty — five is the number that has to be beaten.
 */
const longDurationMs = 20_000

/**
 * `Toastr` is positioned for the page corner, so the demo pins it into the card with `static`, and
 * the stack comes out of a real `createToastStore` — the wiring both READMEs show, so the browser
 * checks drive the documented path. `onDismiss` is `store.remove`, `duration: 0` keeps a toast until
 * somebody dismisses it, one button pushes a toast that dismisses itself, one pushes a toast with a
 * delay far past the component's default, and one raises the duration of everything on screen by
 * pushing each entry back under its own id.
 *
 * `pages/checks/ui.ts` finds every control here by its `data-e2e`, and reads the store's count and
 * the default duration from the two readouts under the buttons.
 */
function ToastrDemo() {
  // One store for the life of the card. It owns no timers and no effects, so there is nothing to
  // tear down and nothing a re-render could restart.
  const store = useMemo(() => createToastStore(), [])
  const toasts = store.list.value

  const push = (type: ToastVariant, duration: number, body: string) =>
    store.add({ type, duration, body })

  return (
    <Stack>
      <Cluster>
        {entries(toastVariants).map(([variant, label]) => (
          <Button
            key={variant}
            variant="outline"
            size="sm"
            data-e2e={`toast-${variant}`}
            onClick={() => push(variant, 0, `${variant} — pushed by the demo stack`)}
          >
            {label}
          </Button>
        ))}
      </Cluster>
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-auto"
          data-duration={autoDismissMs}
          onClick={() => push("info", autoDismissMs, autoDismissBody)}
        >
          auto-dismiss ({autoDismissMs}ms)
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-long"
          data-duration={longDurationMs}
          onClick={() => push("info", longDurationMs, longBody)}
        >
          long ({longDurationMs}ms)
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-extend"
          data-duration={extendMs}
          onClick={() => {
            // Re-adding under the same id replaces that entry in place, which is the store's own
            // rule; the component sees the duration change and refills that toast's budget.
            for (const toast of store.list.value) {
              store.add({ ...toast, duration: extendMs })
            }
          }}
        >
          extend to {extendMs}ms
        </Button>
        <Button variant="ghost" size="sm" data-e2e="toast-clear" onClick={() => store.clear()}>
          clear {toasts.length ? `(${toasts.length})` : ""}
        </Button>
      </Cluster>
      <DemoNote>
        In the store:{" "}
        <span data-e2e="toast-store-count">{toasts.length}</span>. A toast with no duration of its
        own stays <span data-e2e="toast-default-duration">{defaultToastDuration}</span>{" "}
        ms. Hover the stack to pause every timer.
      </DemoNote>
      {toasts.length === 0 ? <DemoNote>Nothing pushed yet.</DemoNote> : null}
      <Toastr
        toasts={toasts}
        onDismiss={(id) => store.remove(String(id))}
        dataE2E="guide-toastr"
        class="static max-w-sm"
      />
    </Stack>
  )
}

/** A full empty state, one with a title alone, and one with nothing, which renders nothing. */
function EmptyStateDemo() {
  return (
    <Stack>
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
      <EmptyState title="No filters applied" />
      <EmptyState />
    </Stack>
  )
}

/**
 * The two dialog tones, each behind its own trigger, plus the step a close port closes over.
 *
 * Mounting is opening: the component renders `null` while closed, and the press mounts it, which is
 * what makes the effect call `showModal()`.
 *
 * `pages/checks/ui.ts` and `pages/checks/system.ts` drive this card: they find the first trigger by
 * its text starting with "default", press the step control inside the dialog, press Escape, and
 * read `data-closed-at` to see that the close port saw the step the parent has now. The last
 * trigger is the uncontrolled dialog, found by `data-e2e="modal-uncontrolled-open"`.
 *
 * **Why the step is `useState` and not a signal.** A signal read from any render's closure returns
 * the current value, which is exactly what hides a handler that captured an old one. The step is
 * plain state and `onClose` closes over it by value, so "which render's port ran" becomes a number
 * on screen.
 */
function ModalDemo() {
  const open = useSignal<DialogTone | null>(null)
  const [step, setStep] = useState(1)
  const [closedAtStep, setClosedAtStep] = useState<number | null>(null)
  // How many times the uncontrolled dialog has been asked for, used as its key. An uncontrolled
  // dialog cannot be re-opened from outside — it seeds its flag from `defaultOpen` and settles that
  // flag itself — so asking for another one means mounting another one.
  const [uncontrolled, setUncontrolled] = useState(0)

  return (
    <Stack gap="sm">
      <Cluster>
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
        <Button
          variant="outline"
          size="sm"
          data-e2e="modal-uncontrolled-open"
          onClick={() => setUncontrolled(uncontrolled + 1)}
        >
          uncontrolled dialog
        </Button>
      </Cluster>

      <p
        class="text-xs text-gray-500 dark:text-gray-400"
        data-e2e="modal-close-step"
        data-step={step}
        data-closed-at={closedAtStep ?? ""}
      >
        Step {step}; onClose last read{" "}
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
          <Stack gap="sm">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              Escape, the close button and a click outside all close this dialog through its
              `onClose`. Advance the step, then press Escape: the line under the triggers reports
              the step you reached.
            </p>
            <Cluster>
              <Button
                variant="outline"
                size="sm"
                data-e2e="modal-next-step"
                onClick={() => setStep(step + 1)}
              >
                advance to step {step + 1}
              </Button>
            </Cluster>
          </Stack>
        </Modal>
      )}

      {uncontrolled > 0 && (
        <Modal
          key={uncontrolled}
          defaultOpen
          title="Uncontrolled dialog"
          cancelLabel="Close"
          dataE2E="guide-modal-uncontrolled"
        >
          <p class="text-sm text-gray-600 dark:text-gray-300">
            No `open` prop and no `onClose`: this dialog opens itself from `defaultOpen` and closes
            itself. Press the trigger again for a fresh one.
          </p>
        </Modal>
      )}
    </Stack>
  )
}

/**
 * Confirmation panels for both tones, with the ports wired to visible state.
 *
 * `onConfirm` writes the sentence a real handler would produce, and the panel does **not** close
 * itself — the port clears `open`, which is the shape that keeps a failed request from discarding
 * the panel. The third trigger's `onCancel` returns `false`, so that dialog stays open.
 */
function ConfirmDialogDemo() {
  const target = useSignal<string | null>(null)
  const outcome = useSignal("nothing confirmed yet")

  return (
    <Stack gap="sm">
      <Cluster>
        <Button
          variant="danger"
          size="sm"
          onClick={() => target.value = "danger"}
        >
          <IconTrashBin class="size-4" />Delete invoice
        </Button>
        <Button size="sm" onClick={() => target.value = "default"}>Archive invoice</Button>
        <Button variant="outline" size="sm" onClick={() => target.value = "refusing-cancel"}>
          Leave page
        </Button>
      </Cluster>
      <DemoNote e2e="controlled-value">Outcome: {outcome.value}</DemoNote>

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
            You can find it again under the Archived filter.
          </p>
        </ConfirmDialog>
      )}

      {target.value === "refusing-cancel" && (
        <ConfirmDialog
          title="Unsaved changes"
          message="Stay keeps this dialog open, because its onCancel returns false."
          confirmLabel="Discard"
          cancelLabel="Stay"
          onConfirm={() => {
            target.value = null
          }}
          onCancel={() => {
            outcome.value = "cancel refused, the panel stays open"
            return false
          }}
        />
      )}
    </Stack>
  )
}

export const feedbackDemos = {
  EmptyState: {
    summary: "What a list, a table or a search shows when it has no rows yet.",
    wide: true,
    props: [
      { name: "title", type: "string", description: "What is missing." },
      { name: "description", type: "string", description: "Why, or what to do next." },
      { name: "icon", type: "ComponentChildren", description: "A glyph above the title." },
      { name: "action", type: "ComponentChildren", description: "A button that fills the list." },
    ],
    snippet: `<EmptyState
  icon={<IconFolder class="size-5" />}
  title="No invoices yet"
  description="Invoices appear here once a customer is billed."
  action={<Button size="sm">New invoice</Button>}
/>`,
    render: () => <EmptyStateDemo />,
  },
  ErrorState: {
    summary: "An inline error message, which renders nothing when there is no error to show.",
    wide: false,
    snippet: `<ErrorState message={error.value} />`,
    render: () => (
      <Stack>
        <ErrorState message="The report could not be generated: no accounts are connected." />
        <ErrorState message="" />
        <DemoNote>The second one has an empty message, so nothing shows.</DemoNote>
      </Stack>
    ),
  },
  LoadingSpinner: {
    summary: "A spinning circle for something that is loading, with an optional caption.",
    wide: true,
    snippet: `<LoadingSpinner size="lg" label="Loading transactions…" />`,
    render: () => <SpinnerDemo />,
  },
  LoadingSkeleton: {
    summary: "Grey placeholder cards that hold a page's shape while its content loads.",
    wide: false,
    snippet: `<LoadingSkeleton rows={1} />`,
    render: () => <LoadingSkeleton rows={1} />,
  },
  Modal: {
    summary: "A dialog that holds focus until it is closed, on the browser's own `<dialog>`.",
    wide: true,
    props: [
      {
        name: "open",
        type: "boolean",
        description:
          "Whether it is open; leave it out and use `defaultOpen` to let it keep its own.",
      },
      {
        name: "onClose",
        type: "() => boolean | void",
        description: "Called on every close; return `false` to keep it open.",
      },
      { name: "title", type: "ComponentChildren", description: "The heading, and its name." },
      {
        name: "cancelLabel",
        type: "string",
        description: "The close button's name; without it there is no close button.",
      },
      { name: "footer", type: "ComponentChildren", description: "The row of buttons at the end." },
      {
        name: "tone",
        type: `"default" | "danger"`,
        default: `"default"`,
        description: "`danger` tints the dialog red.",
      },
    ],
    snippet: `<Modal
  open={open.value}
  onClose={() => open.value = false}
  title="Rename the list"
  cancelLabel="Close"
  footer={<Button onClick={save}>Save</Button>}
>
  <p>Modal body.</p>
</Modal>`,
    render: () => <ModalDemo />,
  },
  ConfirmDialog: {
    summary: "Asks the user to confirm an action before it happens, with two labelled buttons.",
    wide: true,
    props: [
      { name: "title", type: "ComponentChildren", description: "The question." },
      { name: "message", type: "ComponentChildren", description: "What will happen." },
      {
        name: "onConfirm",
        type: "(event) => boolean | void",
        description: "Called on confirm; the dialog stays open until you close it.",
      },
      {
        name: "onCancel",
        type: "() => boolean | void",
        description: "Called on cancel; return `false` to keep it open.",
      },
      {
        name: "confirmLabel",
        type: "string",
        default: `"Confirm"`,
        description: "The confirming button's text.",
      },
      {
        name: "tone",
        type: `"default" | "danger"`,
        default: `"default"`,
        description: "`danger` confirms in red.",
      },
    ],
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
    summary: "Short notifications stacked in a corner that go away on their own or when dismissed.",
    wide: true,
    props: [
      {
        name: "toasts",
        type: "ToastItem[]",
        description: "The stack: each toast's id, type, body and duration.",
      },
      {
        name: "onDismiss",
        type: "(id: string | number) => void",
        description: "Removes a toast, when its timer ends or it is dismissed.",
      },
      {
        name: "label",
        type: "string",
        default: `"Notifications"`,
        description: "The stack's accessible name.",
      },
      {
        name: "dismissLabel",
        type: "string",
        default: `"Dismiss"`,
        description: "The dismiss button's name.",
      },
    ],
    snippet: `<Toastr
  toasts={app.toast.list.value}
  onDismiss={(id) => app.toast.remove(String(id))}
/>`,
    render: () => <ToastrDemo />,
  },
} satisfies DemoFragment
