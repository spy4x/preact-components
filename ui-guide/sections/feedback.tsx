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
  Checkbox,
  Cluster,
  ConfirmDialog,
  createLeaveGuard,
  defaultToastActionDuration,
  defaultToastDuration,
  type DialogTone,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  Input,
  LoadingSkeleton,
  LoadingSpinner,
  Modal,
  Notice,
  type NoticeTone,
  RadioGroup,
  type SpinnerSize,
  Stack,
  type ToastCorner,
  Toastr,
  type ToastVariant,
  UnsavedGuard,
  useFocusAfterRemoval,
  useFreshError,
} from "@spy4x/preact-ui"
import { createToastStore } from "@spy4x/preact-signals/toast"
import { useSignal } from "@preact/signals"
import { render } from "preact"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { IconFolder, IconPlus, IconTrashBin } from "@spy4x/preact-icons"
import { entries } from "../record.ts"
import { DemoNote } from "./demo-note.tsx"
import { onboardingDemos } from "./onboarding.tsx"
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

/** One notice per tone — a tone with no entry does not compile. */
const noticeTones: Record<NoticeTone, {
  title: string
  body: string
  /** The action's label, and its `href` when the action is a link rather than a button. */
  action?: string
  href?: string
}> = {
  info: { title: "Scheduled maintenance", body: "Sync pauses for ten minutes on Sunday at 02:00." },
  warning: {
    title: "Your trial ends in 3 days",
    body: "Add a payment method to keep your data.",
    action: "Add a payment method",
  },
  success: { title: "Export ready", body: "The file is in your downloads." },
  danger: {
    title: "Payment failed",
    body: "Your card was declined, so the plan renews on the free tier.",
    action: "Update card",
    href: "#demo-Notice",
  },
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
 * The title the card's titled toast is pushed with, and its body. The variant buttons push no title,
 * so their toasts carry the store's default for their kind; this one carries a caller's own, and
 * `pages/checks/ui.ts` reads it back off the button's `data-title` to find it on screen.
 */
const titledTitle = "Could not save the draft"
const titledBody = "titled — the connection dropped; your text is kept"

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
 * How long the card's Undo toast stays, in milliseconds, unless the pointer or focus is on it.
 *
 * A toast with an action and no duration stays {@link defaultToastActionDuration}, ten seconds, and
 * the card says so; it pushes a shorter one so the browser check, which reads this number off the
 * button's `data-duration`, can watch the timer hold and resume without waiting ten seconds twice.
 */
const undoMs = 3000

/** Body of the card's Undo toast, and the label of its action. */
const undoBody = "Draft deleted"
const undoLabel = "Undo"

/**
 * The `data-e2e` the card's Undo toast gives its action button through `action.dataE2E`. The other
 * two toasts with an action name none, so their buttons carry no hook.
 */
const undoActionHook = "guide-toast-undo-action"

/**
 * A long action label, so the card shows how a label too long for one line wraps instead of
 * pushing the dismiss control out of a narrow window. The toast stays until it is dismissed, so it
 * can be looked at on a phone.
 */
const undoLongLabel = "Restore the twelve deleted tasks"

/**
 * The label of the card's action that moves focus on purpose, to the name field beside the
 * buttons. The toast closes after its action, and focus stays where the action put it.
 */
const renameLabel = "Rename"

/**
 * Where the card puts its stack: inside the card, or in one of the window's corners. The record is
 * the coverage guard for `ToastCorner` — a corner with no entry does not compile.
 */
const toastPlacements: Record<ToastCorner | "card", string> = {
  card: "In this card",
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
}

/**
 * `Toastr` is positioned for the page corner, so the demo pins it into the card with `static` until
 * a reader picks a corner, which then shows the stack in that corner of the window. And
 * the stack comes out of a real `createToastStore` — the wiring both READMEs show, so the browser
 * checks drive the documented path. `onDismiss` is `store.remove`, `duration: 0` keeps a toast until
 * somebody dismisses it, one button pushes a toast that dismisses itself, one pushes a toast with a
 * delay far past the component's default, and one raises the duration of everything on screen by
 * pushing each entry back under its own id.
 *
 * `pages/checks/ui.ts` finds every control here by its `data-e2e`, and reads the store's count and
 * the default duration from the two readouts under the buttons. A toast pushed by a kind's button
 * carries its own hook, `guide-toast-<kind>`, which that file finds on the toast itself.
 */
function ToastrDemo() {
  // One store for the life of the card. It owns no timers and no effects, so there is nothing to
  // tear down and nothing a re-render could restart.
  const store = useMemo(() => createToastStore(), [])
  const toasts = store.list.value
  const placement = useSignal<ToastCorner | "card">("card")
  const undone = useSignal(0)
  const renameField = useRef<HTMLInputElement>(null)

  const push = (type: ToastVariant, duration: number, body: string, dataE2E?: string) =>
    store.add({ type, duration, body, dataE2E })

  return (
    <Stack>
      <RadioGroup
        legend="Where the stack sits"
        name="guide-toastr-corner"
        options={entries(toastPlacements).map(([value, label]) => ({ value, label }))}
        value={placement.value}
        onChange={(value) => placement.value = value as ToastCorner | "card"}
        data-e2e="toast-corner"
      />
      <Cluster>
        {entries(toastVariants).map(([variant, label]) => (
          <Button
            key={variant}
            variant="outline"
            size="sm"
            data-e2e={`toast-${variant}`}
            onClick={() =>
              push(variant, 0, `${variant} — pushed by the demo stack`, `guide-toast-${variant}`)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-titled"
          data-title={titledTitle}
          onClick={() =>
            store.add({ type: "error", title: titledTitle, body: titledBody, duration: 0 })}
        >
          with its own title
        </Button>
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
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-undo"
          data-duration={undoMs}
          data-label={undoLabel}
          data-action-hook={undoActionHook}
          onClick={() =>
            store.info({
              body: undoBody,
              duration: undoMs,
              dataE2E: "guide-toast-undo",
              action: {
                label: undoLabel,
                onAction: () => undone.value++,
                dataE2E: undoActionHook,
              },
            })}
        >
          with an Undo action
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-undo-long"
          data-label={undoLongLabel}
          onClick={() =>
            store.info({
              body: "Twelve tasks deleted",
              duration: 0,
              dataE2E: "guide-toast-undo-long",
              action: { label: undoLongLabel, onAction: () => undone.value++ },
            })}
        >
          with a long action
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-e2e="toast-rename"
          data-label={renameLabel}
          onClick={() =>
            store.info({
              body: "Draft saved as Untitled",
              duration: 0,
              dataE2E: "guide-toast-rename",
              action: { label: renameLabel, onAction: () => renameField.current?.focus() },
            })}
        >
          with an action that moves focus
        </Button>
        <Input
          ref={renameField}
          aria-label="Draft name"
          placeholder="Draft name"
          data-e2e="toast-rename-field"
        />
        <Button variant="ghost" size="sm" data-e2e="toast-clear" onClick={() => store.clear()}>
          clear {toasts.length ? `(${toasts.length})` : ""}
        </Button>
      </Cluster>
      <DemoNote>
        In the store:{" "}
        <span data-e2e="toast-store-count">{toasts.length}</span>. A toast with no duration of its
        own stays <span data-e2e="toast-default-duration">{defaultToastDuration}</span> ms, or{" "}
        <span data-e2e="toast-action-duration">{defaultToastActionDuration}</span>{" "}
        ms with an action; the Undo toast here asks for {undoMs} ms. Undone:{" "}
        <span data-e2e="toast-undo-count">{undone.value}</span>. The Undo button carries{" "}
        <code>data-e2e="{undoActionHook}"</code>, from its action's{" "}
        <code>dataE2E</code>. Each toast shows the title it was pushed with, or its kind's default.
        Rename puts focus in the name field, and it stays there once the toast closes. Hover the
        stack to pause every timer.
      </DemoNote>
      {toasts.length === 0 ? <DemoNote>Nothing pushed yet.</DemoNote> : null}
      <Toastr
        toasts={toasts}
        onDismiss={store.remove}
        dataE2E="guide-toastr"
        {...(placement.value === "card"
          ? { class: "static max-w-sm" }
          : { corner: placement.value })}
      />
    </Stack>
  )
}

/**
 * A full empty state, one with a title alone, one whose title is an `<h4>` under the card's own
 * `<h3>` (an `<h1>` here would give the catalogue page a second one), and one with nothing, which
 * renders nothing.
 */
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
      <EmptyState
        headingLevel={4}
        title="No matches"
        description="This title is an h4, under the card's h3; a whole-page empty state passes 1."
      />
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
        class="text-xs text-muted"
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
            <p class="text-sm text-muted">
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
          <p class="text-sm text-muted">
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
  // The delete "request" takes two seconds, so the busy state stays on screen long enough to see.
  const deleting = useSignal(false)

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
          busy={deleting.value}
          busyLabel="Deleting…"
          onConfirm={() => {
            deleting.value = true
            setTimeout(() => {
              deleting.value = false
              outcome.value = "confirmed: delete INV-0007"
              target.value = null
            }, 2000)
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
          <p class="text-sm text-muted">
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

/**
 * The demo's router owns the addresses under `unsaved-demo/` and this catalogue page itself, so the
 * fragment links below are left alone for being fragments, not for being someone else's page.
 */
const ownsUnsavedDemo = (url: URL) =>
  url.pathname.includes("/unsaved-demo/") || url.pathname === globalThis.location?.pathname

/** Where the demo's buttons and key presses go, by the letter pressed with Alt. */
const unsavedDemoPlaces: Record<string, string> = { KeyL: "lists", KeyU: "upcoming" }

/**
 * Links of every kind the guard looks at, and navigation started from code: two buttons and two key
 * presses that go through a `LeaveGuard`. A click the guard leaves alone reaches the wrapper, which
 * cancels it and says where the browser would have gone, so trying a link never leaves the guide.
 */
function UnsavedGuardDemo() {
  const dirty = useSignal(false)
  const outcome = useSignal("nothing yet")
  const calls = useSignal(0)
  const leaveGuard = useMemo(createLeaveGuard, [])
  const link = "pc-link text-sm"
  /** What an app's sidebar button or shortcut does: its own navigation, sent through the guard. */
  const go = (place: string) => {
    calls.value += 1
    leaveGuard.navigate(() => outcome.value = `navigate("unsaved-demo/${place}") from code`)
  }

  return (
    <Stack
      gap="sm"
      onKeyDown={(event: KeyboardEvent) => {
        const place = event.altKey ? unsavedDemoPlaces[event.code] : undefined
        if (!place) return
        event.preventDefault()
        go(place)
      }}
    >
      <Input
        aria-label="Draft"
        placeholder="Type to make a change"
        onInput={() => dirty.value = true}
        data-e2e="unsaved-draft"
      />
      <Checkbox
        checked={dirty.value}
        onChange={(event) => dirty.value = event.currentTarget.checked}
        data-e2e="unsaved-dirty"
      >
        Unsaved changes
      </Checkbox>
      <div
        data-e2e="unsaved-links"
        onClick={(event) => {
          const anchor = (event.target as Element).closest("a")
          if (!anchor || event.defaultPrevented) return
          event.preventDefault()
          outcome.value = `the browser follows ${anchor.getAttribute("href")}`
        }}
      >
        <Cluster>
          <a class={link} href="unsaved-demo/notes/2" data-unsaved="owned">In-app page</a>
          <a class={link} href="unsaved-demo/notes/1" data-unsaved-ok data-unsaved="allowed">
            Load the latest version
          </a>
          <a class={link} href="unsaved-demo/notes/3" target="_blank" data-unsaved="target">
            New tab
          </a>
          <a class={link} href="unsaved-demo/export.csv" download data-unsaved="download">
            Download
          </a>
          <a class={link} href="server-page/" data-unsaved="not-owned">Server page</a>
          <a class={link} href="https://example.com/" data-unsaved="other-origin">
            Another site
          </a>
          <a class={link} href="#demo-UnsavedGuard" data-unsaved="hash">This card</a>
          <a class={link} href="#" data-unsaved="empty-hash">An action link (#)</a>
        </Cluster>
      </div>
      <Cluster>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go("lists")}
          data-e2e="unsaved-go-lists"
        >
          Go to Lists
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go("upcoming")}
          data-e2e="unsaved-go-upcoming"
        >
          Go to Upcoming
        </Button>
      </Cluster>
      <DemoNote>
        The buttons navigate from code, as a sidebar does. With the focus in this card, Alt+L and
        Alt+U do the same, as a keyboard shortcut does.
      </DemoNote>
      <DemoNote e2e="unsaved-calls">Navigations from code: {calls.value}</DemoNote>
      <DemoNote e2e="unsaved-outcome">Outcome: {outcome.value}</DemoNote>
      <UnsavedGuard
        when={dirty.value}
        leaveGuard={leaveGuard}
        owns={ownsUnsavedDemo}
        navigate={(href) => outcome.value = `navigate("${href}")`}
        onDiscard={() => dirty.value = false}
      />
    </Stack>
  )
}

/**
 * An `UnsavedGuard` with no `leaveGuard`, as an app that guards only its links uses it. The guard
 * lives in a Preact root of its own so that `onDiscard` can remove it from the page at once, the
 * way an app does when dropping the changes closes the form: "Leave" must still navigate.
 */
function UnsavedGuardAloneDemo() {
  const dirty = useSignal(false)
  const outcome = useSignal("nothing yet")
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = host.current
    if (!root || !dirty.value) return
    render(
      <UnsavedGuard
        when
        owns={ownsUnsavedDemo}
        navigate={(href) => outcome.value = `navigate("${href}")`}
        onDiscard={() => {
          render(null, root)
          dirty.value = false
        }}
      />,
      root,
    )
    return () => render(null, root)
  }, [dirty.value])

  return (
    <Stack gap="sm">
      <DemoNote>
        A form of its own, with no leave guard. Leaving drops the change and removes the guard from
        the page in the same step.
      </DemoNote>
      <Input
        aria-label="Second draft"
        placeholder="Type to make a change"
        onInput={() => dirty.value = true}
        data-e2e="unsaved-alone-draft"
      />
      <div
        onClick={(event) => {
          if (event.defaultPrevented) return
          event.preventDefault()
          outcome.value = "the browser follows the link"
        }}
      >
        <a class="pc-link text-sm" href="unsaved-demo/notes/4" data-e2e="unsaved-alone-link">
          In-app page
        </a>
      </div>
      <DemoNote e2e="unsaved-alone-state">
        Unsaved: {dirty.value ? "yes" : "no"}. Outcome: {outcome.value}
      </DemoNote>
      <div ref={host} />
    </Stack>
  )
}

/** Props of {@link FragileView}. */
interface FragileViewProps {
  broken: boolean
  onBreak: () => void
}

/** A view that throws while it renders once its button has been pressed. */
function FragileView({ broken, onBreak }: FragileViewProps) {
  if (broken) throw new Error("The ErrorBoundary demo view broke on purpose.")
  return (
    <Button onClick={onBreak} data-e2e="error-boundary-break">
      Break this view
    </Button>
  )
}

/**
 * A view that breaks on a click, inside an `ErrorBoundary`.
 *
 * The reload port is the demo's own: it counts the press, then changes the boundary's `key`, which
 * mounts a fresh boundary over a mended view, so the card works again and the catalogue is never
 * really reloaded. `pages/checks/ui.ts` drives this card and reads the readouts below.
 */
function ErrorBoundaryDemo() {
  const broken = useSignal(false)
  const mount = useSignal(0)
  const caught = useSignal(0)
  const last = useSignal("nothing yet")
  const reloads = useSignal(0)

  return (
    <Stack gap="sm">
      <ErrorBoundary
        key={mount.value}
        headingLevel={4}
        dataE2E="error-boundary-screen"
        onError={(error, errorInfo) => {
          caught.value++
          last.value = `${String(error)}, with ${typeof errorInfo} errorInfo`
        }}
        onReload={() => {
          reloads.value++
          broken.value = false
          mount.value++
        }}
      >
        <FragileView broken={broken.value} onBreak={() => broken.value = true} />
      </ErrorBoundary>
      <DemoNote>
        Errors reported: <span data-e2e="error-boundary-caught">{caught.value}</span>, the last{" "}
        <span data-e2e="error-boundary-last">{last.value}</span>. Reloads asked for:{" "}
        <span data-e2e="error-boundary-reloads">{reloads.value}</span>. This demo's reload changes
        the boundary's key instead of reloading the page.
      </DemoNote>
    </Stack>
  )
}

/** The people the {@link RemovalDemo} list starts with, and comes back to. */
const REMOVAL_PEOPLE: readonly string[] = ["Ada", "Grace", "Linus"]

/** How long the {@link RemovalDemo}'s pretend request takes, in milliseconds. */
const REMOVAL_REQUEST_MS = 200

/** What a {@link RemovalDemo} row can start with, in front of its "Remove" button. */
const removalLeads = {
  none: "Nothing",
  link: "A link, and the hook is told to focus the button",
  field: "A hidden field",
  unseen: "A button that is not shown, in the last row only",
} as const

/** One key of {@link removalLeads}. */
type RemovalLead = keyof typeof removalLeads

/**
 * A list whose rows are removed behind a confirmation, with a pretend request that the first
 * checkbox makes fail. It shows `ErrorState` with `focusOnAppear` (the refusal in the dialog takes
 * focus), `useFreshError` (the dialog opens again without it) and `useFocusAfterRemoval` (a removed
 * row hands focus to its neighbour, or to "Bring everyone back").
 *
 * The other controls are there for `pages/e2e/ui.spec.ts`, which drives every one: a removal that
 * takes the row at once and ends by hand, a person who leaves with no removal running, and rows
 * that start with something other than their button. The last line is written from an effect that
 * runs after the hook's, so a check that reads it knows the hook has finished with that state.
 */
function RemovalDemo() {
  const [people, setPeople] = useState(REMOVAL_PEOPLE)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<{ id: string; message: string } | null>(null)
  const [refuse, setRefuse] = useState(false)
  const [skipEarlier, setSkipEarlier] = useState(false)
  const [atOnce, setAtOnce] = useState(false)
  const [lead, setLead] = useState<RemovalLead>("none")
  const list = useRef<HTMLUListElement>(null)
  const reset = useRef<HTMLButtonElement>(null)
  useFocusAfterRemoval(list, people, removingId, {
    fallback: () => reset.current,
    earlier: !skipEarlier,
    target: lead === "link" ? (row) => row.querySelector("button") : undefined,
  })
  const state = `on the list: ${people.join(", ") || "nobody"} · removing ${removingId ?? "nobody"}`
  const [settled, setSettled] = useState(state)
  useEffect(() => setSettled(state), [state])
  const leave = (id: string) => setPeople((current) => current.filter((name) => name !== id))
  const remove = (id: string, attempt: number) => {
    setRemovingId(id)
    if (atOnce) return leave(id)
    setTimeout(() => {
      if (refuse) {
        const message = attempt === 1
          ? `${id} could not be removed.`
          : `${id} still could not be removed.`
        setRefusal({ id, message })
      } else {
        setRefusal(null)
        leave(id)
      }
      setRemovingId(null)
    }, REMOVAL_REQUEST_MS)
  }
  return (
    <Stack data-e2e="removal-demo">
      <Cluster>
        <Checkbox
          checked={refuse}
          onChange={(event) => setRefuse(event.currentTarget.checked)}
        >
          Refuse the next removal
        </Checkbox>
        <Checkbox
          checked={skipEarlier}
          onChange={(event) => setSkipEarlier(event.currentTarget.checked)}
        >
          Skip earlier rows
        </Checkbox>
        <Checkbox
          checked={atOnce}
          onChange={(event) => setAtOnce(event.currentTarget.checked)}
        >
          Take the row at once, and end the request by hand
        </Checkbox>
      </Cluster>
      <RadioGroup
        legend="Each row starts with"
        name="guide-removal-lead"
        options={entries(removalLeads).map(([value, label]) => ({ value, label }))}
        value={lead}
        onChange={(value) => setLead(value as RemovalLead)}
      />
      <ul ref={list} class="flex flex-col gap-2">
        {people.map((name) => (
          <RemovalRow
            key={name}
            name={name}
            lead={lead === "unseen" && name !== people.at(-1) ? "none" : lead}
            pending={removingId === name && !atOnce}
            error={refusal?.id === name ? refusal.message : null}
            onRemove={remove}
          />
        ))}
      </ul>
      <Cluster>
        <Button
          ref={reset}
          variant="outline"
          data-e2e="removal-reset"
          onClick={() => setPeople(REMOVAL_PEOPLE)}
        >
          Bring everyone back
        </Button>
        <Button variant="outline" data-e2e="removal-leave" onClick={() => leave("Grace")}>
          Grace leaves by herself
        </Button>
        <Button variant="outline" data-e2e="removal-end" onClick={() => setRemovingId(null)}>
          End the request
        </Button>
      </Cluster>
      <DemoNote e2e="removal-settled">{settled}</DemoNote>
    </Stack>
  )
}

/**
 * One row of {@link RemovalDemo}: a name, what the row starts with, its "Remove" button and the
 * dialog that confirms it. It counts the attempts since its dialog opened, so the demo can word a
 * second refusal differently.
 */
function RemovalRow(
  { name, lead, pending, error, onRemove }: {
    name: string
    lead: RemovalLead
    pending: boolean
    error: string | null
    onRemove: (id: string, attempt: number) => void
  },
) {
  const [asking, setAsking] = useState(false)
  const attempts = useRef(0)
  const [shown, opened] = useFreshError(error, pending)
  return (
    <li class="flex items-center justify-between gap-3" data-e2e="removal-row">
      <span class="text-sm">{name}</span>
      {lead === "link" && <a href="#demo-ErrorState" class="text-sm underline">About {name}</a>}
      {lead === "field" && <input type="hidden" name="person" value={name} />}
      {lead === "unseen" && <button type="button" hidden>Not shown</button>}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          opened()
          attempts.current = 0
          setAsking(true)
        }}
      >
        Remove {name}
      </Button>
      {asking && (
        <ConfirmDialog
          title={`Remove ${name}?`}
          confirmLabel="Remove"
          cancelLabel="Keep"
          tone="danger"
          busy={pending}
          busyLabel="Removing…"
          dataE2E="removal-dialog"
          onConfirm={() => onRemove(name, ++attempts.current)}
          onCancel={() => setAsking(false)}
        >
          <Stack>
            <p class="text-sm text-muted">{name} loses access right away.</p>
            <ErrorState focusOnAppear message={shown} dataE2E="removal-error" />
          </Stack>
        </ConfirmDialog>
      )}
    </li>
  )
}

export const feedbackDemos = {
  EmptyState: {
    summary: "What a list, a table or a search shows when it has no rows yet.",
    wide: true,
    props: [
      { name: "title", type: "string", description: "What is missing." },
      {
        name: "headingLevel",
        type: "1 | 2 | 3 | 4",
        default: `3`,
        description:
          "The title's heading tag; 1 when the empty state is the whole page. Same size.",
      },
      { name: "description", type: "string", description: "Why, or what to do next." },
      { name: "icon", type: "ComponentChildren", description: "A glyph above the title." },
      { name: "action", type: "ComponentChildren", description: "A button that fills the list." },
    ],
    snippet: `<EmptyState
  icon={<IconFolder class="size-5" />}
  title="No invoices yet"
  description="Invoices appear here once a customer is billed."
  action={<Button size="sm">New invoice</Button>}
/>

// A 404 page whose whole content is the empty state:
<EmptyState headingLevel={1} title="Page not found" />`,
    render: () => <EmptyStateDemo />,
  },
  ErrorBoundary: {
    summary:
      "Catches a view that throws while it renders and shows a reload screen instead of a blank page.",
    wide: false,
    props: [
      {
        name: "onError",
        type: "(error: unknown, errorInfo: ErrorInfo) => void",
        description:
          "Called once with each caught error and, when Preact has one, its component stack, for your reporter.",
      },
      {
        name: "onReload",
        type: "() => void",
        default: "location.reload()",
        description:
          "What the button does. The screen stays until the boundary remounts: change its `key` to recover.",
      },
      {
        name: "title",
        type: "string",
        default: `"Something went wrong."`,
        description: "The headline.",
      },
      {
        name: "description",
        type: "string",
        default: `"Reloading the page usually fixes it."`,
        description: "The line under it.",
      },
      {
        name: "reloadLabel",
        type: "string",
        default: `"Reload the page"`,
        description: "The button's text.",
      },
      {
        name: "headingLevel",
        type: "1 | 2 | 3 | 4",
        default: `3`,
        description: "The title's heading tag; 1 when the boundary guards the whole page.",
      },
    ],
    snippet: `<ErrorBoundary onError={reportError} headingLevel={1}>
  <App />
</ErrorBoundary>`,
    render: () => <ErrorBoundaryDemo />,
  },
  ErrorState: {
    summary:
      "The message for an expected failure, where its result would have been; nothing when there is none.",
    wide: false,
    snippet: `<ErrorState message={error.value} />

// A refusal inside the dialog that asked: it takes focus, and is gone when the dialog opens again.
const [shown, opened] = useFreshError(error, pending)
<ErrorState focusOnAppear message={shown} />

// A removed row hands focus to the row that took its place.
useFocusAfterRemoval(list, ids, removingId, { fallback: () => addButton.current })`,
    render: () => (
      <Stack gap="lg">
        <Stack>
          <ErrorState message="The report could not be generated: no accounts are connected." />
          <ErrorState message="" />
          <DemoNote>The second one has an empty message, so nothing shows.</DemoNote>
        </Stack>
        <RemovalDemo />
      </Stack>
    ),
  },
  Notice: {
    summary: "A page-wide banner: a trial that ends soon, a change that saved, a failed payment.",
    wide: true,
    props: [
      {
        name: "tone",
        type: `"info" | "warning" | "success" | "danger"`,
        default: `"info"`,
        description: "The border, the tint and the glyph.",
      },
      { name: "title", type: "string", description: "The first line, in a heavier weight." },
      { name: "children", type: "ComponentChildren", description: "The body under the title." },
      { name: "action", type: "ComponentChildren", description: "A button or link beside it." },
      {
        name: "urgent",
        type: "boolean",
        default: `false`,
        description:
          'Interrupts the screen reader (`role="alert"`). Without it the notice is a polite status.',
      },
    ],
    snippet: `<Notice
  tone="warning"
  title="Your trial ends in 3 days"
  action={<Button size="sm">Add a payment method</Button>}
>
  Add a payment method to keep your data.
</Notice>

// A failure the reader must act on, heard now:
<Notice
  tone="danger"
  urgent
  title="Payment failed"
  action={<Button size="sm" href="/billing">Update card</Button>}
>
  Your card was declined, so the plan renews on the free tier.
</Notice>`,
    render: () => (
      <Stack>
        {entries(noticeTones).map(([tone, { title, body, action, href }]) => (
          <Notice
            key={tone}
            tone={tone}
            title={title}
            data-tone={tone}
            action={action &&
              (href
                ? <Button size="sm" href={href}>{action}</Button>
                : <Button size="sm">{action}</Button>)}
          >
            {body}
          </Notice>
        ))}
      </Stack>
    ),
  },
  LoadingSpinner: {
    summary:
      "A spinning circle for something that is loading, with an optional caption, which stands still when the system asks for reduced motion.",
    wide: true,
    props: [
      {
        name: "label",
        type: "string",
        description: "A caption under the spinner, which a screen reader also hears.",
      },
      {
        name: "loadingLabel",
        type: "string",
        default: `"Loading"`,
        description: "The hidden word a screen reader hears when there is no `label`.",
      },
      {
        name: "size",
        type: `"sm" | "md" | "lg"`,
        default: `"md"`,
        description: "The spinner's size.",
      },
    ],
    snippet: `<LoadingSpinner size="lg" label="Loading transactions…" />

// An app's first load: the whole screen
<LoadingSpinner size="lg" label="Loading your workspace…" class="min-h-dvh bg-canvas" />`,
    render: () => (
      <Stack>
        <SpinnerDemo />
        <LoadingSpinner
          size="lg"
          label="Loading your workspace…"
          class="h-64 rounded-lg border border-subtle bg-canvas"
        />
        <DemoNote>
          The full-page recipe, held to a fixed height here; in an app, min-h-dvh makes it the whole
          window.
        </DemoNote>
      </Stack>
    ),
  },
  LoadingSkeleton: {
    summary:
      "Grey placeholder cards that hold a page's shape while its content loads, and stop pulsing when the system asks for reduced motion.",
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
      {
        name: "busy / busyLabel",
        type: "boolean / string",
        default: "false",
        description:
          "While the confirmed work runs: a spinner and the busy label on confirm, presses ignored, and no way to cancel.",
      },
      {
        name: "confirmDataE2E / cancelDataE2E",
        type: "string",
        default: `"confirm-dialog-confirm" / "confirm-dialog-cancel"`,
        description: "The buttons' `data-e2e` hooks.",
      },
    ],
    snippet: `<ConfirmDialog
  title="Delete invoice INV-0007?"
  message="This cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Keep it"
  tone="danger"
  busy={deleting.value}
  busyLabel="Deleting…"
  onConfirm={() => deleteInvoice()}
  onCancel={() => confirming.value = false}
/>`,
    render: () => <ConfirmDialogDemo />,
  },
  UnsavedGuard: {
    summary:
      "Asks before leaving a page with unsaved changes: the browser's question on close or reload, and a dialog on an in-app link or on a navigation the app starts from code.",
    wide: true,
    props: [
      { name: "when", type: "boolean", description: "Whether there are unsaved changes." },
      {
        name: "navigate",
        type: "(href: string) => void",
        description: "The router port, called with the link's path, query and hash on Leave.",
      },
      {
        name: "owns",
        type: "(url: URL) => boolean",
        description: "Which addresses the router handles; any other link is the browser's.",
      },
      {
        name: "onDiscard",
        type: "() => void",
        description: "Called on Leave, before the navigation, to drop the changes.",
      },
      {
        name: "leaveGuard",
        type: "LeaveGuard",
        description:
          "The app's `createLeaveGuard()`. A button or shortcut that calls `leaveGuard.navigate(go)` gets the same dialog: Leave runs `go`, Stay drops it. With nothing unsaved, `go` runs at once.",
      },
      {
        name: "labels",
        type: "Partial<UnsavedGuardLabels>",
        description: "Replaces the dialog's English words: `title`, `message`, `leave`, `stay`.",
      },
    ],
    snippet: `// Once for the app, outside any component.
export const leaveGuard = createLeaveGuard()

<UnsavedGuard
  when={draft.value !== saved.value}
  navigate={(href) => setLocation(href)}
  owns={(url) => url.pathname.startsWith("/notes/")}
  onDiscard={() => draft.value = saved.value}
  leaveGuard={leaveGuard}
/>
<a href="/notes/7?latest" data-unsaved-ok>Load the latest version</a>
<Button onClick={() => leaveGuard.navigate(() => setLocation("/lists"))}>Lists</Button>`,
    render: () => (
      <Stack gap="lg">
        <UnsavedGuardDemo />
        <UnsavedGuardAloneDemo />
      </Stack>
    ),
  },
  Toastr: {
    summary: "Short notifications stacked in a corner that go away on their own or when dismissed.",
    wide: true,
    props: [
      {
        name: "toasts",
        type: "ToastItem[]",
        description:
          "The stack: each toast's id, type, title (shown above the body), body, duration, an optional `action` button ({ label, onAction }, run once, then the toast is dismissed), and a `dataE2E` test hook on that toast.",
      },
      {
        name: "onDismiss",
        type: "(id: ToastId) => void",
        description:
          "Removes a toast, when its timer ends or it is dismissed; a store's `remove` fits as it is.",
      },
      {
        name: "corner",
        type: `"top-left" | "top-right" | "bottom-left" | "bottom-right"`,
        default: `"top-right"`,
        description: "The window corner the stack sits in; toasts slide in from that side.",
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
    snippet: `app.toast.info({
  body: "Draft deleted",
  action: { label: "Undo", onAction: () => restore(draft) },
}) // no duration: stays 10 s, paused while hovered or focused

<Toastr
  toasts={app.toast.list.value}
  onDismiss={app.toast.remove}
  corner="bottom-right"
/>`,
    render: () => <ToastrDemo />,
  },
  ...onboardingDemos,
} satisfies DemoFragment
