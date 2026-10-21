import { cn } from "@spy4x/preact-cn"
import { IconXMark } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import { Button } from "./button.tsx"
import { useBackdropPress } from "./backdrop-press.ts"
import { acquireScrollLock } from "./scroll-lock.ts"
import {
  backdropClickDismisses,
  backdropDismissesByDefault,
  bindEscapeClose,
  dialogTitleId,
  escapeCloseStrategy,
  type FocusableElement,
  isDismissKey,
  platformCloseHandler,
  restoreFocus,
  shouldRetargetFocus,
  supportsClosedBy,
} from "./modal-internals.ts"

export { backdropDismissesByDefault }

/** Visual register of a {@link Modal}: a plain surface or a destructive one. */
export type DialogTone = "default" | "danger"

/**
 * How a {@link Modal} announces itself to assistive technology.
 *
 * `"dialog"` is the ordinary panel. `"alertdialog"` is the one that stops everything until it is
 * answered — a destructive confirmation is the case the role exists for — and a screen reader
 * treats it the way it treats an alert: it interrupts, and it reads the dialog's description out
 * with its name rather than waiting to be asked for the body. The role does not supply that
 * description; the dialog still has to point at the element holding the question through
 * {@link ModalProps.ariaDescribedBy}.
 */
export type DialogRole = "dialog" | "alertdialog"

export interface ModalProps {
  /**
   * Whether the dialog is on screen.
   *
   * Left out, the dialog is uncontrolled: {@link ModalProps.defaultOpen} seeds internal state and
   * the caller drives every later change through {@link ModalProps.onClose}. Given, the prop is the
   * single source of truth — the parent owns the flag, which is the usual shape when a button on a
   * page owns the dialog.
   */
  open?: boolean
  /** Initial open state when the dialog is uncontrolled. Defaults to `false`. */
  defaultOpen?: boolean
  /**
   * Close-request port, called on Escape, a backdrop click, the header control and (from
   * `ConfirmDialog`) the cancel action. Return `false` to refuse: the dialog stays open. Refusal is
   * what makes the close cancellable; every other return value, `undefined` included, accepts it.
   *
   * Whichever path a close arrives down, the port called is the one from the **most recent** render,
   * not the one this dialog opened with. That is what makes an inline `onClose={() => setStep(step -
   * 1)}` safe: it reads the step the parent has now.
   *
   * Escape is the one path with an exception, and only on a platform that ignores `closedby` (no
   * shipping WebKit): there the platform closes the dialog itself before the port can answer, and a
   * refusal is honoured by showing the dialog again, with a brief flash — see the support contract
   * on {@link Modal}.
   */
  onClose?: () => boolean | void
  /**
   * Title, and by default the dialog's accessible name.
   *
   * With a title, this component owns both halves of the `aria-labelledby` ↔ `id` correspondence:
   * the id it writes on the title element is the id it references, and it is generated per dialog so
   * two dialogs on one page never share it. Without a title, `aria-label` from
   * {@link ModalProps.ariaLabel} is used instead — never both, because an accessible name has one
   * source.
   */
  title?: ComponentChildren
  /** Accessible name used when there is no title. Ignored when a title is given; the title wins. */
  ariaLabel?: string
  /**
   * Id of the element that describes the dialog — the question it asks, the sentence it opens with.
   *
   * Written as `aria-describedby`, which is what makes a screen reader read the body out after the
   * name instead of announcing a title and two buttons. This component does not generate it: the
   * description lives in the caller's own children, so only the caller can say which element it is.
   * `ConfirmDialog` is the worked example.
   *
   * Left out, nothing is referenced. A description pointing at a missing or empty element is worse
   * than none, because a screen reader then reads a name and silence where the caller believes it
   * reads the question.
   */
  ariaDescribedBy?: string
  /** Id for the title element. Generated when absent. */
  titleId?: string
  /**
   * How the dialog announces itself. Defaults to `"dialog"`; see {@link DialogRole}.
   *
   * This is about the announcement, not the tone: {@link ModalProps.tone} paints a destructive panel
   * red, and a red panel that a screen reader reads as an ordinary dialog is exactly the mismatch
   * this prop exists to close.
   */
  role?: DialogRole
  /** Body content. */
  children?: ComponentChildren
  /** Footer content, right-aligned below the body. */
  footer?: ComponentChildren
  /**
   * Accessible name of the header dismiss control, and the control's own switch.
   *
   * No default, and deliberately not one: this label decides whether the header carries a dismiss
   * control at all, so defaulting it would put a close button on every dialog that never asked for
   * one. `ConfirmDialog` passes its own cancel label down, which is where the English default lives.
   */
  cancelLabel?: string
  /** Colour register of the dialog. Defaults to `"default"`. */
  tone?: DialogTone
  /**
   * Whether a click on the backdrop closes the dialog. Defaults to `true`.
   *
   * Native `<dialog>` does not dismiss on a backdrop click; see {@link isBackdropClick}. Both the
   * press and the release must land on the backdrop, so a text selection dragged out of the panel
   * leaves it open.
   */
  closeOnBackdrop?: boolean
  /** Stamps `data-e2e` on the dialog element. */
  dataE2E?: string
  /** Extra utilities for the dialog element. */
  class?: string
}

/**
 * Built on the platform's dialog element, in the top layer.
 *
 * **The DOM-harness decision.** This repository has no DOM environment, and the behaviour a modal
 * is mostly made of — top-layer stacking, focus containment, Escape, `::backdrop` — is the
 * *browser's*, reached through `showModal()`. A partial DOM shim would test the shim instead of the
 * component, so the decisions this file makes are exported as pure functions
 * ({@link isBackdropClick}, {@link backdropClickDismisses}, {@link scrollLockPadding},
 * {@link shouldRetargetFocus}, {@link restoreFocus}, {@link dialogTitleId}) and the colocated suite
 * covers them exhaustively plus the rendered markup. **Browser-verified only, and therefore not
 * covered by that suite:** that `showModal()` really traps focus, that the `::backdrop` click reaches
 * the predicate, that `body { padding-right }` really removes the shift, that Escape closes the
 * dialog, that focus returns to the trigger, and that a refused Escape really keeps the dialog open
 * where the platform honours `closedby` (see the support contract below).
 *
 * Four of those are now committed checks, run in CI: `pages/checks/ui.ts`, run by
 * `deno task --cwd pages verify`, drives the guide's `Modal` demo in headless Chromium and asserts
 * that the trigger opens a `:modal` dialog, that focus moves into it, that a **real** Escape key
 * press (`Input.dispatchKeyEvent`, not a synthesised `KeyboardEvent`, which the browser treats as
 * untrusted) closes it, that the port that press runs is the one the parent passed most recently
 * rather than the one this dialog opened with, and that focus lands back on the same trigger
 * element.
 *
 * **The focus restore, and why it stays.** Decided 2026-09-21, in #148. The `target.focus()` in the
 * effect's cleanup is there for an engine that does not hand focus back when a dialog closes. The
 * browser these checks drive does hand it back, so **no check here covers the call**: deleting it
 * leaves the focus check green, because Chromium restores focus to the pre-`showModal()` element
 * itself. That check therefore asserts what a person experiences and cannot tell this component's
 * restore from the platform's. The call stays anyway — it costs a focus on an element that already
 * has it — and this is revisited when the browser checks can drive a second engine.
 *
 * **Still covered by no committed test:** focus trapping, the backdrop click, the scroll-lock
 * compensation, and the refused-Escape path. Those were verified with a throwaway CDP probe that was
 * deleted rather than committed, which means nothing in the tree reproduces those numbers — treat
 * them as reported, not as re-runnable. A consumer can check their own dialog the same way.
 *
 * **The `closedby` support contract, and what changes without it.** A refused Escape is honourable
 * only where the platform honours `closedby`: the attribute keeps the platform's uncancellable close
 * out of the picture, and the component's own `keydown` listener then routes Escape through
 * {@link ModalProps.onClose} before anything has closed. No shipping WebKit honours it — Chrome/Edge
 * 134+, Firefox 141+, Safari preview only — so the attribute alone is not a contract. Where
 * `HTMLDialogElement` has no `closedBy` the attribute is inert, Escape closes the dialog whatever the
 * port answers, and the component listens for the platform's `cancel` event instead: `cancel` is not
 * cancelable — `preventDefault()` inside it is a measured no-op — so the port is *told*, never asked,
 * and the component's own open state follows the dialog. That last part is the whole point of the
 * branch: believing a refusal there is what left the component reporting `"refused"` for a dialog
 * that had already closed. {@link supportsClosedBy} detects the capability,
 * {@link escapeCloseStrategy} turns it into a plan, {@link bindEscapeClose} registers it and
 * {@link platformCloseHandler} is the fallback's reaction.
 *
 * Component-initiated closes are unaffected and stay refusable everywhere: a refused header control
 * or backdrop click keeps the dialog open on every platform, because nothing has closed it yet. Two
 * consequences of the fallback, stated plainly. On a platform that ignores `closedby` the platform
 * closes the dialog before the port answers. A refusing port gets its dialog back, whoever owns
 * `open`: once the platform's `close` event fires, `showModal()` puts it in the top layer again, so
 * the refusal holds after a one-frame flash and focus moves into the dialog a second time; the open
 * state never changed, so the scroll lock is never released. A caller that owns `open` and accepts
 * must move that flag to `false`, or its own state will claim an open dialog the platform has
 * closed. Which of the two branches ran is decided at effect time from
 * `HTMLDialogElement.prototype`, so the rendered markup never varies — the attribute is always
 * there.
 *
 * The numbers behind this paragraph are reported, not reproducible from the tree, exactly as the
 * browser-only list above: measured in headless Chromium with `HTMLDialogElement.prototype.closedBy`
 * deleted *and* the `closedby` attribute stripped from the mounted element — a WebKit-like engine,
 * simulated the same throwaway way, not WebKit itself. With this branch an accepting port was told
 * once, the state settled, the element unmounted and the page's scroll lock released; before it, the
 * dialog closed while the element stayed rendered and both `body` and the document element stayed
 * `overflow: hidden`. No shipping WebKit exists on that machine, so what a real Safari does with the
 * `cancel` listener remains unverified.
 *
 * **The `open` attribute is deliberately not rendered.** A `<dialog open>` is a *non-modal* dialog:
 * it sits in the document flow with no top layer, no focus containment and no `cancel` event, and
 * `showModal()` on it throws `InvalidStateError` — measured in headless Chromium, and the reason the
 * first version of this component never actually became modal in a browser even though the markup
 * looked right. So the dialog element renders closed and every open goes through `showModal()` in an
 * effect. The consequence, stated plainly: an `open` modal server-renders as a closed element and
 * appears at hydration. Modals are opened by interaction in every consumer this package has, so the
 * alternative — rendering it open and being unable to make it modal at all — is not on the table.
 *
 * `document` is touched in effects and event handlers only, so the server render stays clean and
 * hydration has no mismatch to resolve.
 */
export function Modal(
  {
    open,
    defaultOpen = false,
    onClose,
    title,
    ariaLabel,
    ariaDescribedBy,
    titleId,
    children,
    footer,
    cancelLabel,
    role = "dialog",
    tone = "default",
    closeOnBackdrop = backdropDismissesByDefault,
    dataE2E,
    class: className,
  }: ModalProps,
): JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoresFocus = useRef<FocusableElement | null>(null)
  // What the *latest* render passed, kept where the Escape listener can reach it.
  //
  // The lifecycle effect below runs once per open, so everything it closes over is frozen at the
  // moment the dialog opened — and the close port is the one thing in there a parent routinely
  // changes between renders. An inline `onClose={() => setStep(step - 1)}` is a new function reading
  // a new value on every render, and Escape used to call the one from the opening render: a wizard
  // closed to the step it was on when the dialog appeared, every time, and only when the user
  // pressed Escape rather than clicking.
  //
  // Adding `onClose` to the effect's dependency list is the obvious alternative and is wrong: an
  // inline port has a new identity every render, so the effect would tear the dialog down and
  // re-open it under the user.
  //
  // **What makes the write below safe, and what would stop it.** It happens during the render, not
  // from an effect, and that is a deliberate choice against this renderer's timing: Preact renders
  // synchronously and defers effects behind a frame, so between a commit and its effects there is a
  // real window in which a key press can land — and an effect-synced ref would still be holding the
  // previous render's port for the whole of it. The write is safe here because a render in this
  // renderer is never speculative: it is not started for a state the user may never see, never
  // abandoned, and never replayed, so the value written is always the one the user is looking at.
  // A renderer that rendered concurrently would break that and take this with it, because a
  // discarded render would have written its port into the ref on the way out. Nothing in this
  // repository can tell the two implementations apart — swap this for a `useEffect` that syncs the
  // same ref and the whole suite and every browser check stay green — so the reason is written here
  // rather than left to be rediscovered.
  const latest = useRef({ onClose, controlled: open !== undefined })
  latest.current = { onClose, controlled: open !== undefined }
  // The id comes from the framework's own hook, as everywhere else in this package. It is derived
  // from where this component sits in the tree, so it is stable across a dialog's re-renders, unique
  // among the dialogs of one page, and — the part a module counter got wrong — the same string in
  // the server's render and the browser's: a counter that lives for the life of the process numbers
  // the second request's dialog differently from the first's, and hydration then finds a title id
  // the server never wrote. A caller that needs to know the id (a dismiss button outside the dialog,
  // a `ConfirmDialog` heading) passes one instead.
  //
  // Called unconditionally, never inside the `??` below: a hook skipped on the renders where a
  // caller supplies an id would shift every later hook's slot the moment that prop changed.
  const generatedHeadingId = dialogTitleId(useId())
  const headingId = titleId ?? generatedHeadingId
  // Open flag and scroll-lock padding are local visual state; which dialog is open, and what
  // confirming it does, arrive as props and ports.
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen

  // Both of these are rebuilt every render and both read only the ref and a setter, so the copy the
  // effect captured at open time behaves exactly like the one this render made. That is the point:
  // stale *identity* is harmless once nothing stale is closed over.
  const settleOpen = (next: boolean) => {
    if (!latest.current.controlled) setInternalOpen(next)
  }

  /**
   * Route one close attempt through the port.
   *
   * @param dialog The dialog element to close.
   * @returns Whether the close was accepted.
   */
  const requestClose = (dialog: HTMLDialogElement): boolean => {
    if (latest.current.onClose?.() === false) return false
    dialog.close()
    settleOpen(false)
    return true
  }

  /**
   * One effect owns the dialog's whole lifecycle.
   *
   * Deliberately a single effect rather than an open/close one plus a lock one. With two, Preact runs
   * the *new* open/close effect before the previous lock effect's cleanup, so on close the dialog was
   * already `close()`d when the cleanup ran and every decision it made about focus was made too late —
   * measured in headless Chromium, where the trigger never got focus back. Sequence and teardown are
   * one concern here: open, lock, close, unlock, restore.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!isOpen) return

    // `showModal()`, never the `open` attribute — this element deliberately renders without it.
    // Measured: a dialog carrying `open` is *non-modal*, and `showModal()` then throws
    // `InvalidStateError: The dialog is already open as a non-modal dialog`. So the markup cannot
    // pre-open the dialog, and the top layer, focus containment, `::backdrop` and the `cancel` event
    // all follow from this call and nothing else. A dialog already in the modal state — a second
    // render while open — is left alone rather than re-entered.
    //
    // The trigger focus comes back to: captured before `showModal()` moves focus into the dialog.
    if (!dialog.matches(":modal")) {
      restoresFocus.current = document.activeElement as FocusableElement | null
      dialog.showModal()
    }

    // Scroll lock. Locking the page removes its scrollbar, which *widens* the layout — measured at a
    // 1000px viewport: `documentElement.clientWidth` goes 985 → 1000 — so the body is padded by
    // exactly that gain for as long as the lock lasts. The lock is the package's shared one, counted
    // across every open overlay: a Modal over another Modal or over a `CommandPalette` adds a holder
    // instead of measuring a page that has no scrollbar left, and the page unlocks only when the last
    // overlay closes (#649).
    const lock = acquireScrollLock()

    // Escape is handled here, not by the platform — but *how* depends on whether the platform honours
    // `closedby`. Two measured facts set the table:
    //
    // 1. The `cancel` event is **not cancelable** — `event.preventDefault()` inside it is a no-op and
    //    the dialog closes anyway (verified for a raw `<dialog>` in Chromium 151, with and without
    //    `closedby`). So a refusal routed through `cancel` never refused anything.
    // 2. With `closedby="none"` the platform does not close on Escape at all, and `cancel` does not
    //    even fire — but `keydown` still reaches the dialog, which is the event that can be routed
    //    through the port before anything has decided to close.
    //
    // `closedby="none"` is on the rendered element for exactly this reason: it takes the uncancellable
    // platform close out of the picture so the refusal is ours to honour. `close()` still works, which
    // is what `requestClose` calls once the port accepts. But the attribute is honoured by Chrome/Edge
    // 134+ and Firefox 141+ and by no shipping WebKit, so it cannot be the whole mechanism: on a
    // platform that ignores it, Escape closes the dialog regardless of the port. `escapeCloseStrategy`
    // picks the listener for each world, `bindEscapeClose` registers exactly one of them, and
    // `platformCloseHandler` is what the fallback does about a close it cannot stop.
    const escapeStrategy = escapeCloseStrategy(
      supportsClosedBy(globalThis.HTMLDialogElement?.prototype),
    )

    // Where `closedby` is honoured, this listener *is* the Escape behaviour. Nothing has closed the
    // dialog yet, so the port can refuse and the refusal holds: `requestClose` leaves the dialog open.
    const onKeyDown = (event: KeyboardEvent) => {
      // The dialog may already be closing down a path that did not refresh this render, which is what
      // the second argument rules out.
      if (!isDismissKey(event, dialog.open || dialog.matches(":modal"))) return
      requestClose(dialog)
    }

    // Where it is ignored, the platform owns Escape: `cancel` fires with the close already under way
    // and uncancellable, so the port is told rather than asked. An accepted close settles the
    // component's own state closed, and the lifecycle cleanup then runs as for any other close:
    // scroll lock released, focus restored.
    //
    // A refused close keeps the dialog, whoever owns `open`: the platform's close cannot be stopped,
    // but it can be undone. `close` fires as a task after `cancel`, and `showModal()` on the closed
    // element puts it back in the top layer. The scroll lock was never released, because `isOpen`
    // never changed. `disposed` stops a re-show on an element this effect no longer owns.
    let disposed = false
    const reshow = () => {
      if (disposed || !dialog.isConnected || dialog.open) return
      dialog.showModal()
    }
    const onCancel = platformCloseHandler({
      refusalHolds: escapeStrategy.refusalHolds,
      onClose: () => latest.current.onClose?.(),
      settleOpen,
      reopen: () => dialog.addEventListener("close", reshow, { once: true }),
    })

    const unbindEscape = bindEscapeClose(dialog, escapeStrategy, {
      keydown: onKeyDown,
      cancel: onCancel,
    })

    return () => {
      disposed = true
      dialog.removeEventListener("close", reshow)
      unbindEscape()
      lock.release()

      // Read the captured trigger before the close and restore after it: closing is what releases
      // the dialog's hold on focus, so a restore written before it has nothing to hold on to.
      // Nothing here asks whether the dialog still holds focus — see `shouldRetargetFocus` for why
      // that question cannot decide anything. What the restore is for, and what covers it (nothing
      // in this repository), is the `#148` paragraph on `Modal`.
      const target = restoresFocus.current

      if (dialog.open || dialog.matches(":modal")) dialog.close()
      if (shouldRetargetFocus(target)) restoreFocus(target)
    }
  }, [isOpen])

  const backdrop = useBackdropPress((event) => {
    const dialog = dialogRef.current
    if (!dialog) return false
    return backdropClickDismisses(event, dialog.getBoundingClientRect(), dialog, closeOnBackdrop)
  })

  const handleBackdropClick = (event: MouseEvent) => {
    const dialog = dialogRef.current
    if (dialog && backdrop.isBackdropClick(event)) requestClose(dialog)
  }

  const handleHeaderClose = () => {
    const dialog = dialogRef.current
    if (dialog) requestClose(dialog)
  }

  if (!isOpen) return null

  // A title element is the accessible name when there is one; otherwise the label attribute is the
  // name source. Both at once would leave the name ambiguous.
  const labelAttributes = title
    ? { "aria-labelledby": headingId }
    : ariaLabel
    ? { "aria-label": ariaLabel }
    : {}

  return (
    <dialog
      ref={dialogRef}
      closedby="none"
      data-e2e={dataE2E}
      role={role}
      aria-modal="true"
      aria-describedby={ariaDescribedBy}
      {...labelAttributes}
      class={cn(
        "m-auto w-full max-w-md rounded-lg border border-subtle bg-surface pc-focus-offset-surface p-0 text-foreground shadow-popover backdrop:bg-scrim backdrop:backdrop-blur-xs open:flex open:flex-col",
        tone === "danger" ? "border-red-300 dark:border-red-800" : "",
        className,
      )}
      onPointerDown={backdrop.onPointerDown}
      onClick={handleBackdropClick}
    >
      {title
        ? (
          <header class="flex items-start justify-between gap-4 border-b border-subtle px-6 py-4">
            <h2 id={headingId} class="text-lg font-semibold">{title}</h2>
            {cancelLabel
              ? (
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={cancelLabel}
                  title={cancelLabel}
                  onClick={handleHeaderClose}
                >
                  <IconXMark class="size-4" />
                </Button>
              )
              : null}
          </header>
        )
        : null}
      <div class="px-6 py-4">{children}</div>
      {footer
        ? (
          <footer class="flex justify-end gap-3 border-t border-subtle px-6 py-4">
            {footer}
          </footer>
        )
        : null}
    </dialog>
  )
}
