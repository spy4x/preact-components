import { cn } from "@preact-components/cn"
import type { ComponentChildren } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"
import { Button } from "./button.tsx"

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

/**
 * Whether a click on the backdrop dismisses a {@link Modal} that says nothing about the policy.
 *
 * Named so the component's default and the predicate's default are one value instead of two literals
 * that can drift: `Modal`'s own default is a documented part of its API, and a flip here is what
 * would switch the whole feature off. Lowercase deliberately — the guide's helper lists treat a
 * PascalCase value export as a component unless an exception is declared, and this is a value.
 */
export const backdropDismissesByDefault = true

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
   * shipping WebKit): there the platform closes the dialog itself, so the port is notified and its
   * refusal cannot be honoured — see the support contract on {@link Modal}.
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
  /** Dismiss control in the header. Rendered only when given — the library ships no copy. */
  cancelLabel?: string
  /** Colour register of the dialog. Defaults to `"default"`. */
  tone?: DialogTone
  /**
   * Whether a click on the backdrop closes the dialog. Defaults to `true`.
   *
   * Native `<dialog>` does not dismiss on a backdrop click; see {@link isBackdropClick}.
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
 * Three of those are now committed checks, run in CI: `deno task --cwd pages verify` drives the
 * guide's `Modal` demo in headless Chromium and asserts that the trigger opens a `:modal` dialog,
 * that focus moves into it, that a **real** Escape key press (`Input.dispatchKeyEvent`, not a
 * synthesised `KeyboardEvent`, which the browser treats as untrusted) closes it, and that focus
 * lands back on the same trigger element. The last of those asserts the behaviour rather than this
 * component's part in it: measured, deleting the `target.focus()` call below leaves the check green,
 * because Chromium restores focus to the pre-`showModal()` element by itself.
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
 * consequences of the fallback, stated plainly. On a platform that ignores `closedby` a refusing port
 * is still notified — it is how the caller learns the dialog went — but its refusal is not honoured,
 * because it cannot be. And a caller that owns `open` itself must move that flag to `false` when
 * told, or its own state will claim an open dialog the platform has closed; this component cannot
 * settle a flag it does not own. Which of the two branches ran is decided at effect time from
 * `HTMLDialogElement.prototype`, so the rendered markup never varies — the attribute is always there.
 *
 * The numbers behind this paragraph are reported, not reproducible from the tree, exactly as the
 * browser-only list above: measured in headless Chromium with `HTMLDialogElement.prototype.closedBy`
 * deleted *and* the `closedby` attribute stripped from the mounted element — a WebKit-like engine,
 * simulated the same throwaway way, not WebKit itself. With this branch a refusing port was told once,
 * the state settled, the element unmounted and the page's scroll lock released; before it, the dialog
 * closed while the element stayed rendered and both `body` and the document element stayed
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
) {
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
  // Written during render rather than from an effect, so a close that lands between a render and its
  // effects still routes through the port that render passed. Adding `onClose` to the effect's
  // dependency list is the obvious alternative and is wrong: an inline port has a new identity every
  // render, so the effect would tear the dialog down and re-open it under the user.
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
    // exactly that gain for as long as the lock lasts. Both widths are read here, one before the lock
    // and one with the scrollbar clamped away, because the gain is not derivable from a single
    // reading after the fact: post-lock there is no scrollbar left to measure.
    const widthBefore = document.documentElement.clientWidth
    const widthLocked = clientWidthWithoutScrollbar(document.documentElement)
    // The cast is the DOM's own gap, not this component's: `Document.scrollingElement` is typed
    // `Element | null` even though the spec makes it an element with inline styles.
    const lock = applyScrollLock(
      document as unknown as ScrollLockTarget,
      scrollLockPadding(widthBefore, widthLocked),
    )

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
    // and uncancellable, so the port is told rather than asked and the component's own state is
    // settled closed. That is what stops a refusing port from being left believing an open dialog
    // that the browser has already closed. The lifecycle cleanup then runs as for any other close:
    // scroll lock released, focus restored.
    const onCancel = platformCloseHandler({
      refusalHolds: escapeStrategy.refusalHolds,
      onClose: () => latest.current.onClose?.(),
      settleOpen,
    })

    const unbindEscape = bindEscapeClose(dialog, escapeStrategy, {
      keydown: onKeyDown,
      cancel: onCancel,
    })

    return () => {
      unbindEscape()
      lock.release()

      // Decide before closing, because `close()` moves focus itself: measured, `dialog.close()` leaves
      // `document.activeElement` as `body` and discards a focus restored a moment earlier.
      const target = restoresFocus.current

      if (dialog.open || dialog.matches(":modal")) dialog.close()
      // After `close()`, which moves focus itself and would discard a restore done before it. Nothing
      // here asks whether the dialog still held focus: measured, it never does by this point, and
      // gating on it is the bug documented on `shouldRetargetFocus`.
      if (shouldRetargetFocus(target)) restoreFocus(target)
    }
  }, [isOpen])

  const handleBackdropClick = (event: MouseEvent) => {
    const dialog = dialogRef.current
    if (!dialog) return

    const rect = dialog.getBoundingClientRect()
    if (backdropClickDismisses(event, rect, dialog, closeOnBackdrop)) requestClose(dialog)
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
        "m-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-xs open:flex open:flex-col dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
        tone === "danger" ? "border-red-300 dark:border-red-800" : "",
        className,
      )}
      onClick={handleBackdropClick}
    >
      {title
        ? (
          <header class="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
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
                  <CloseGlyph />
                </Button>
              )
              : null}
          </header>
        )
        : null}
      <div class="px-6 py-4">{children}</div>
      {footer
        ? (
          <footer class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            {footer}
          </footer>
        )
        : null}
    </dialog>
  )
}

/** The line-drawn cross used by the header dismiss control. */
function CloseGlyph() {
  return (
    <svg
      class="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** Anything the browser can move focus to. Narrower than `HTMLElement`, so a test can pass a stub. */
export interface FocusableElement {
  focus: () => void
}

/** Rectangle in viewport coordinates: a structural subset of `DOMRect`, so tests need no DOM. */
export interface DialogRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** The two identities a backdrop hit-test compares. */
export interface BackdropHitTarget {
  /** `event.target` for the click. */
  target: unknown
  /** The dialog element itself. */
  dialog: unknown
}

/**
 * Whether a click landed on the dialog's backdrop rather than on the dialog's content.
 *
 * This is what the platform does *not* give: a modal `<dialog>` fills the viewport and paints its
 * box in the middle, so a click on the dimmed area arrives with the *dialog* as `event.target` while
 * a click on the content arrives with a descendant. Target identity is the first half. Geometry is
 * the second, because a click on the dialog's own box outside its content — margin, border, padding
 * — also targets the dialog, and the box settled by `max-width` and `m-auto` is the only boundary
 * that matches what the user sees as the surface.
 *
 * Pure and exported precisely because the DOM harness this repository does not have could not cover
 * it: given a rect and two coordinates it is decidable with no browser and no rendering.
 *
 * @param hit `event.target` and the dialog element.
 * @param rect The dialog's client rect at click time.
 * @param x Click coordinate, viewport space.
 * @param y Click coordinate, viewport space.
 * @returns `true` when the click is outside the dialog's box and on the dialog element itself.
 */
export function isBackdropClick(
  hit: BackdropHitTarget,
  rect: DialogRect,
  x: number,
  y: number,
): boolean {
  if (hit.target !== hit.dialog) return false
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom
}

/**
 * Whether one click should dismiss the dialog.
 *
 * The decision layer over {@link isBackdropClick}: a disabled `closeOnBackdrop` refuses before the
 * hit-test is consulted at all, so a click on the dialog's own margin can never dismiss a panel the
 * caller marked as destructive.
 *
 * @param event The click event; only its target and coordinates are read.
 * @param rect The dialog's client rect at click time.
 * @param dialog The dialog element.
 * @param closeOnBackdrop Caller policy; defaults to `true`.
 * @returns `true` when the caller should route a close through its port.
 */
export function backdropClickDismisses(
  event: MouseEvent,
  rect: DialogRect,
  dialog: unknown,
  closeOnBackdrop = backdropDismissesByDefault,
): boolean {
  if (!closeOnBackdrop) return false
  return isBackdropClick({ target: event.target, dialog }, rect, event.clientX, event.clientY)
}

/**
 * Padding, in pixels, that keeps a scroll-locked page from shifting.
 *
 * Locking the page removes its scrollbar, which widens the layout by the scrollbar's width and slides
 * every centred element sideways — measured in headless Chromium at a 1000px viewport, the document's
 * `clientWidth` goes 985 → 1000. Padding the body by exactly that gain cancels it, so this is the
 * difference between the width inside the scrollbar container and the width with it removed:
 * `clientWidthLocked - clientWidthBefore`. Overlay scrollbars measure equal, give `0`, and write no
 * padding.
 *
 * The two widths come from {@link clientWidthWithoutScrollbar} and a plain read at the call site, so
 * the arithmetic itself is unit-testable and free of layout. Reading the *after* value once the lock
 * is in place instead would be a bug with a shape: the subtraction collapses to `0` and the page
 * still shifts, which is exactly what the first version of this component did until a browser said
 * otherwise.
 *
 * @param clientWidthBefore `document.documentElement.clientWidth` before the lock.
 * @param clientWidthLocked The same read with the scrollbar clamped away.
 * @returns A non-negative pixel count; `0` when the page reserves no width.
 */
export function scrollLockPadding(clientWidthBefore: number, clientWidthLocked: number): number {
  return Math.max(0, clientWidthLocked - clientWidthBefore)
}

/** The scrollable element whose scrollbar a lock removes. A structural subset of `HTMLElement`. */
export interface ScrollLockHost {
  /** Inline `overflow` — read in, saved, and written back. */
  style: { overflow: string }
  /** `Element.clientWidth`: the layout width inside the scrollbar. */
  readonly clientWidth: number
}

/**
 * Read the layout width once the scrollbar clamping is in place.
 *
 * The gain the lock causes is not a constant and not readable in advance: it is the scrollbar the
 * page currently shows, `0` when it shows none. The only honest way to get it is to clamp and read —
 * `overflow: hidden` is written, `clientWidth` is read back, the previous value is restored in
 * `finally`. The component then writes the lock itself, and
 * {@link scrollLockPadding} turns the before/after pair into padding.
 *
 * Structurally typed (see {@link ScrollLockHost}) so the write/read/restore sequence is drivable with
 * a stub, and a browser is needed only to prove the DOM's answer matches the arithmetic.
 *
 * @param host The scroll container, normally `document.documentElement`.
 * @returns `clientWidth` with the scrollbar removed.
 */
export function clientWidthWithoutScrollbar(host: ScrollLockHost): number {
  const previousOverflow = host.style.overflow
  try {
    host.style.overflow = "hidden"
    return host.clientWidth
  } finally {
    host.style.overflow = previousOverflow
  }
}

/** The two elements a page-level scroll lock has to touch, and the styles it replaces. */
export interface ScrollLockTarget {
  /** The scrolling element: `html` in standards mode, `body` in quirks mode. */
  scrollingElement: { style: { overflow: string } } | null
  /** The body, which carries the compensating padding. */
  body: { style: { overflow: string; paddingRight: string } }
}

/** A held lock, undone by {@link ScrollLock.release}. */
export interface ScrollLock {
  /** Restore both elements to what they had before the lock. */
  release: () => void
}

/**
 * Lock page scrolling without moving the page, and hand back how to undo it.
 *
 * Two things, and the second is the one that is easy to get wrong: `overflow: hidden` on `body` alone
 * does **not** stop the page scrolling — measured in headless Chromium, `window.scrollTo(0, 900)` with
 * `body { overflow: hidden }` set moved the page to 1623 — because the default scroll container is the
 * document element. So the lock is written on `document.scrollingElement` (the platform's own answer
 * to "which element scrolls this document"; quirks mode answers `body`), and the padding is written on
 * the body, which is where a page's content is.
 *
 * Both previous inline values are captured and restored, not blanked, so a host that had its own
 * `overflow` or `padding-right` keeps them. Structurally typed (see {@link ScrollLockTarget}) so which
 * element a document gets locked through is a decision a unit test can hold, with no DOM.
 *
 * @param document The document to lock; `globalThis.document` at the call site.
 * @param padding Pixels of right padding that cancel the width the scrollbar was taking.
 * @returns The held lock.
 */
export function applyScrollLock(document: ScrollLockTarget, padding: number): ScrollLock {
  const scroller = document.scrollingElement
  const previousScrollerOverflow = scroller?.style.overflow
  const previousBodyOverflow = document.body.style.overflow
  const previousPadding = document.body.style.paddingRight

  if (scroller) scroller.style.overflow = "hidden"
  document.body.style.overflow = "hidden"
  document.body.style.paddingRight = `${padding}px`

  return {
    release: () => {
      if (scroller) scroller.style.overflow = previousScrollerOverflow ?? ""
      document.body.style.overflow = previousBodyOverflow
      document.body.style.paddingRight = previousPadding
    },
  }
}

/**
 * Whether the dialog still holds the focused element.
 *
 * The close-time reading, exported so a caller can report or assert it rather than re-deriving it. It
 * is deliberately **not** part of {@link shouldRetargetFocus}'s decision — see there for the bug that
 * came from gating a restore on this value.
 *
 * @param dialog The dialog.
 * @param activeElement `document.activeElement` at close time.
 * @returns `true` when focus is inside the dialog, `false` when it is not, or `false` when the active
 * element arrived as `null`.
 */
export function dialogHeldFocus(
  dialog: { contains: (element: unknown) => boolean },
  activeElement: unknown,
): boolean {
  if (activeElement === null || activeElement === undefined) return false
  // One cast, at the one place the DOM's own types are narrower than the port: `Node.contains` takes
  // `Node | null` while this decision only asks "is focus inside the dialog".
  return dialog.contains(activeElement as Node | null)
}

/**
 * The key that asks a {@link Modal} to close.
 *
 * Named, and read by both the handler and its tests, so the string is one value instead of a literal
 * in a comparison that a test would have to restate.
 */
export const DISMISS_KEY = "Escape"

/**
 * Whether a keyboard event is a request to dismiss the dialog.
 *
 * Pure, and the whole rule the dialog's `keydown` handler applies: Escape only. Where the platform
 * honours `closedby`, its own Escape path is disabled by `closedby="none"` because the `cancel` event
 * is not cancelable — see the handler's comment — so this predicate plus `requestClose` *is* the
 * Escape behaviour there, not a decoration on top of the platform's. Where it does not, the platform
 * closes on Escape itself and `keydown` is not consulted at all; see {@link escapeCloseStrategy}.
 *
 * @param event The keyboard event.
 * @param open Whether the dialog is still open; a dismissed dialog is not asked to close twice.
 * @returns `true` when the event should be routed through the close port.
 */
export function isDismissKey(event: { key: string }, open: boolean): boolean {
  if (!open) return false
  return event.key === DISMISS_KEY
}

/**
 * Whether a dialog implementation knows the `closedby` attribute.
 *
 * The support floor this component is written against: `closedby` is honoured by Chrome/Edge 134+
 * and Firefox 141+, and by **no shipping WebKit** — Safari has it in preview only. Presence on the
 * prototype is the check, deliberately not the property's value: `closedBy` is a reflected IDL
 * accessor, so reading it on the prototype itself has no element to reflect and throws, while `"in"`
 * answers without invoking the getter.
 *
 * The prototype arrives as an argument rather than being read from a global here, because a global is
 * not a value a DOM-free suite can swap: {@link Modal} passes `globalThis.HTMLDialogElement?.prototype`
 * at effect time, and the tests pass plain objects.
 *
 * @param dialogPrototype `HTMLDialogElement.prototype`, or any object whose property chain should
 *   answer. Pass the prototype, not the constructor — a constructor carries no `closedBy` of its own.
 * @returns `true` when the implementation exposes `closedBy`, i.e. when the attribute is honoured.
 */
export function supportsClosedBy(dialogPrototype: unknown): boolean {
  if (dialogPrototype === null || dialogPrototype === undefined) return false
  // `in` throws on a primitive, and a capability check that throws inside an effect is worse than one
  // that reports no support.
  if (typeof dialogPrototype !== "object" && typeof dialogPrototype !== "function") return false
  return "closedBy" in dialogPrototype
}

/**
 * How Escape is handled on a platform, given whether it honours `closedby`.
 *
 * A decision table, and the only place this file encodes the support matrix. It is exported because
 * the two branches cannot both be observed from a DOM-free suite: which listener the effect registers
 * is a decision, so the decision is a value a test can hold.
 *
 * Where `closedby` is honoured, the attribute stops the platform's uncancellable close and the
 * component's own `keydown` listener is the whole Escape behaviour, so the port is *asked* before
 * anything closes and a refusal holds. Where it is not, the platform closes the dialog on Escape
 * itself; all that is left is to hear about it, so the `cancel` listener is registered and the port
 * is *told* with the close already under way. The two are mutually exclusive on purpose: registering
 * both would route one Escape through the port twice — a refused `keydown` would be followed by the
 * platform's `cancel` for the same keystroke.
 */
export interface EscapeCloseStrategy {
  /** Register a `keydown` listener: the port is consulted before anything has closed. */
  readonly listensForKeydown: boolean
  /** Register a `cancel` listener: the platform is closing already and the port is told after. */
  readonly listensForCancel: boolean
  /**
   * Whether the close port's `false` keeps the dialog open on this path.
   *
   * `false` wherever {@link EscapeCloseStrategy.listensForCancel} is, and that is the difference that
   * matters: a refusal that cannot hold must not be reported as holding.
   */
  readonly refusalHolds: boolean
}

/**
 * Choose the Escape plan for a platform.
 *
 * @param closedBySupported Whether the platform honours `closedby`; see {@link supportsClosedBy}.
 * @returns The listeners to register and whether a refusal can hold on this platform.
 */
export function escapeCloseStrategy(closedBySupported: boolean): EscapeCloseStrategy {
  if (closedBySupported) {
    return { listensForKeydown: true, listensForCancel: false, refusalHolds: true }
  }
  return { listensForKeydown: false, listensForCancel: true, refusalHolds: false }
}

/** The listener surface {@link bindEscapeClose} needs: a structural subset of `HTMLDialogElement`. */
export interface EscapeCloseTarget {
  /**
   * Register a listener; the platform passes the event. Declared with method syntax, as the DOM does,
   * so the narrower `keydown` handler is accepted without a cast.
   */
  addEventListener(type: string, listener: (event: Event) => void): void
  /** Remove the same listener reference. */
  removeEventListener(type: string, listener: (event: Event) => void): void
}

/** The two handlers an {@link EscapeCloseStrategy} can ask for, keyed by the event they belong to. */
export interface EscapeCloseHandlers {
  /** Used where the platform honours `closedby`. */
  keydown: (event: KeyboardEvent) => void
  /** Used where it does not. */
  cancel: () => void
}

/**
 * Register the one Escape listener a strategy asks for, and hand back how to undo it.
 *
 * Structurally typed so the decision "which event carries Escape here" is drivable and assertable
 * with a stub target — this repository has no DOM, and a listener left behind or registered twice is
 * exactly the kind of defect that would otherwise reach a browser unobserved.
 *
 * @param target The dialog element, or a stub that records what was registered.
 * @param strategy The plan; see {@link escapeCloseStrategy}.
 * @param handlers Both handlers, of which exactly one is registered.
 * @returns Removes the registered listener, and nothing else.
 */
export function bindEscapeClose(
  target: EscapeCloseTarget,
  strategy: EscapeCloseStrategy,
  handlers: EscapeCloseHandlers,
): () => void {
  if (strategy.listensForKeydown) {
    // The DOM types a listener's parameter as `Event`; this handler narrows to the event it is
    // registered for, which `keydown` always delivers. One cast, at the one place the DOM's typing is
    // wider than the port — same shape as the cast in `dialogHeldFocus`.
    const listener = handlers.keydown as (event: Event) => void
    target.addEventListener("keydown", listener)
    return () => target.removeEventListener("keydown", listener)
  }
  const listener = handlers.cancel
  target.addEventListener("cancel", listener)
  return () => target.removeEventListener("cancel", listener)
}

/** What {@link platformCloseHandler} needs: the strategy's verdict, the port and the state setter. */
export interface PlatformCloseDeps {
  /** Whether a refusal can hold on this path; see {@link EscapeCloseStrategy.refusalHolds}. */
  refusalHolds: boolean
  /** The caller's close port, notified and not consulted. */
  onClose?: () => boolean | void
  /** Settle the component's own open state. A no-op for a caller-owned (`open` prop) dialog. */
  settleOpen: (open: boolean) => void
}

/**
 * Build the handler for a close the platform performs itself: Escape where `closedby` is ignored.
 *
 * This is the branch that removes the state desync the issue measured. The port is **told, never
 * asked**, because there is nothing left to ask: `cancel` is not cancelable — `preventDefault()`
 * inside it is a no-op — and the dialog closes whatever the port answers. Discarding that answer is
 * the point: reporting a refusal here is what left a caller believing an open dialog that the
 * browser had already closed. So the component's own open state follows the dialog instead. Where the
 * refusal could hold, the keydown path is in charge and this handler is never registered.
 *
 * @param deps The strategy's verdict, the close port and the state setter.
 * @returns The `cancel` listener.
 */
export function platformCloseHandler(deps: PlatformCloseDeps): () => void {
  return () => {
    deps.onClose?.()
    if (!deps.refusalHolds) deps.settleOpen(false)
  }
}

/**
 * Decide whether focus should go back to the element that opened the dialog.
 *
 * `true` exactly when a trigger was captured — that is the whole rule, and the history behind it is
 * why it carries no second condition. This was first written as "restore only if focus is still
 * inside the dialog", which sounds like the same rule and is not: measured in headless Chromium, by
 * the time the component's cleanup runs the dialog's content has already unmounted and the platform
 * has moved focus to `body`, so focus is *never* still inside, the restore the guard was written to
 * permit never happened, and the trigger never got its focus back in a real browser while every unit
 * test of the helper stayed green.
 *
 * The caller-read `dialogHeldFocus` reading is therefore reported, not used as a gate. Refusing the
 * restore when focus is elsewhere would also be wrong on its own terms: a caller that moves focus
 * somewhere deliberate has to close the dialog first, and focus is at `body` by then either way, so
 * the condition cannot tell the two cases apart.
 *
 * @param target Element captured before `showModal()`, or `null` if there was none.
 * @returns `true` when focus should be moved back to `target`.
 */
export function shouldRetargetFocus(target: FocusableElement | null): boolean {
  return target !== null
}

/**
 * Move focus back to a captured element.
 *
 * @param target Element captured before `showModal()`, or `null`.
 * @returns Whether focus was moved.
 */
export function restoreFocus(target: FocusableElement | null): boolean {
  if (!target) return false
  target.focus()
  return true
}

/**
 * Build the id of a dialog's title element.
 *
 * Exported rather than inlined so the `aria-labelledby` ↔ `id` correspondence is assertable without
 * rendering, and so the id is a named unit rather than a template literal buried in JSX. The prefix
 * earns its place in a devtools inspector: `modal-title-P0-1` says what the element is, where the
 * bare framework id says only that something generated it.
 *
 * @param base A per-component id from `useId()`. It is derived from the component's place in the
 *   render tree, which is what makes it unique on a page and identical between the server's render
 *   and the browser's — the two properties a module-level counter cannot have at once.
 * @returns The title element's id.
 */
export function dialogTitleId(base: string): string {
  return `modal-title-${base}`
}
