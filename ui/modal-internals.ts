/**
 * The decisions behind `Modal` and `Lightbox`: backdrop hit-tests, which event carries Escape on a
 * platform, and where focus goes back to on close. Apart from the component so they can be tested
 * without a browser. Not an entry point of the package: an app imports `./modal.tsx` alone.
 *
 * @module
 */

/**
 * Whether a click on the backdrop dismisses a {@link Modal} that says nothing about the policy.
 *
 * Named so the component's default and the predicate's default are one value instead of two literals
 * that can drift: `Modal`'s own default is a documented part of its API, and a flip here is what
 * would switch the whole feature off. Lowercase deliberately — the guide's helper lists treat a
 * PascalCase value export as a component unless an exception is declared, and this is a value.
 */
export const backdropDismissesByDefault = true

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
  /** Undo the platform's close after the port refused it: show the dialog again once it closed. */
  reopen?: () => void
}

/**
 * Build the handler for a close the platform performs itself: Escape where `closedby` is ignored.
 *
 * This is the branch that removes the state desync the issue measured. The port cannot stop the
 * close: `cancel` is not cancelable — `preventDefault()` inside it is a no-op — and the dialog closes
 * whatever the port answers. So an accepted close settles the component's own open state, and a
 * refused one is undone through `reopen`: the open state, the caller's or the component's own, still
 * says open, so the dialog is shown again. Without `reopen` a refusal cannot be undone and the state
 * follows the dialog closed. Where the refusal could hold, the keydown path is in charge and this
 * handler is never registered.
 *
 * @param deps The strategy's verdict, the close port, the state setter and the re-show.
 * @returns The `cancel` listener.
 */
export function platformCloseHandler(deps: PlatformCloseDeps): () => void {
  return () => {
    const answer = deps.onClose?.()
    if (deps.refusalHolds) return
    if (answer === false && deps.reopen) return deps.reopen()
    deps.settleOpen(false)
  }
}

/**
 * Decide whether focus should go back to the element that opened the dialog.
 *
 * `true` exactly when a trigger was captured — that is the whole rule, and it carries no second
 * condition on purpose. The tempting one, "restore only if focus is still inside the dialog", was
 * written first and cannot decide anything: the restore runs while the dialog is closing and its
 * content is unmounting, so where focus sits at that moment is the platform's business, and the
 * reading cannot tell a caller who moved focus somewhere deliberate from a teardown that moved it
 * for them. With that guard in place the restore never ran in a real browser while every unit test
 * of the helper stayed green.
 *
 * The {@link dialogHeldFocus} reading is therefore something a caller can report, never a gate.
 *
 * What the restore exists for, and what covers it, is the `#148` paragraph on {@link Modal}: no
 * check in this repository proves this call does anything, because the browser they run in hands
 * focus back without it.
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
