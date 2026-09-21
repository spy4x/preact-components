import { type ComponentChildren, Fragment, isValidElement } from "preact"
import { useId } from "preact/hooks"
import { Button } from "./button.tsx"
import { type DialogTone, Modal } from "./modal.tsx"

export interface ConfirmDialogProps {
  /** Heading, and the dialog's accessible name. */
  title: ComponentChildren
  /** Body copy. Mutually exclusive with {@link ConfirmDialogProps.children}. */
  message?: ComponentChildren
  /** Body content, for richer panels than a sentence. Mutually exclusive with `message`. */
  children?: ComponentChildren
  /**
   * Label of the confirming action. Defaults to {@link CONFIRM_LABEL}.
   *
   * Name the verb whenever you can — `"Delete"`, `"Archive"`, `"Leave"` — because a button that
   * says what it does is the difference between a confirmation and a riddle. The default is there
   * so a blank string reaching this prop through a variable renders a usable button rather than
   * failing the page; see {@link labelOr}.
   */
  confirmLabel?: string
  /**
   * Label of the cancelling action, which is also the accessible name of the header dismiss
   * control. Defaults to {@link CANCEL_LABEL}, for the same reason as
   * {@link ConfirmDialogProps.confirmLabel}.
   */
  cancelLabel?: string
  /**
   * Injected confirm port. Called with the click event, so a caller can read a form field or a
   * checkbox out of the dialog. The dialog does **not** close itself — the caller closes it from the
   * port by clearing its own `open` flag, or by returning `false` to refuse. That keeps a failed
   * request from discarding the panel.
   */
  onConfirm: (event: MouseEvent) => boolean | void
  /**
   * Injected cancel port, called before the dialog closes. Return `false` to refuse the close, and
   * the dialog stays open — the hook for "you have unsaved changes" and for a second confirmation.
   */
  onCancel: () => boolean | void
  /**
   * Colour register. `"danger"` tints the surface and the confirm button. Defaults to `"default"`.
   */
  tone?: DialogTone
  /**
   * Whether a backdrop click cancels. Defaults to `false`: this component exists for decisions that
   * should take a deliberate action to leave — confirmation panels are routinely placed over the
   * trigger they are about to act on, where a stray click is an accident waiting to happen. Pass
   * `true` to opt into the cheaper dismissal, or use `Modal` directly for a panel with no stakes.
   */
  closeOnBackdrop?: boolean
  /** Id used to override the modal's generated title id. */
  titleId?: string
  /** Stamps `data-e2e` on the dialog element. */
  dataE2E?: string
  /** Extra utilities for the dialog element. */
  class?: string
}

/**
 * Confirmation panel: a title, one question, and two labelled actions.
 *
 * A thin composition of {@link Modal} — every behaviour (top layer, focus containment, Escape,
 * scroll lock, backdrop hit-test, focus restore) is the modal's, and the only thing added here is
 * the three-part anatomy, the refusal wiring and the announcement.
 *
 * **What a screen reader gets, and why it is two things.** The panel is an `alertdialog`, the role
 * for a dialog that stops everything until it is answered, and it points `aria-describedby` at the
 * element holding its question. Without the description the announcement is a title and two
 * buttons: the user is asked to choose "Delete" or "Keep it" and never told what is being deleted,
 * which is the one dialog where that matters most. Without the role the question is there to be
 * found but is not read out with the name.
 *
 * Escape, the header dismiss control and (when enabled) a backdrop click all route through
 * {@link ConfirmDialogProps.onCancel}, so one port can refuse every implicit close.
 *
 * **Mount it to open it.** The panel renders open unconditionally, so a caller that has no flag of
 * its own shows the panel with `{confirming && <ConfirmDialog … />}`. Mounting is what makes the
 * client call `showModal()`, and unmounting is what runs the scroll-lock and focus restoration.
 *
 * Nothing is pre-opened in the server render: the dialog element is emitted **without** an `open`
 * attribute, because `<dialog open>` is the non-modal state and `showModal()` throws
 * `InvalidStateError` on such an element. An open panel therefore appears at hydration, not in the
 * server string.
 *
 * The same DOM gap as `Modal` applies: what a modal does once it is open is the browser's, and the
 * checks that drive it live in `pages/checks/ui.ts`. They drive `Modal`'s own card; this panel's
 * markup — the role, the description and the two labels — is covered by the colocated suite, which
 * is where a rendered string can answer.
 */
export function ConfirmDialog(
  {
    title,
    message,
    children,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    tone = "default",
    closeOnBackdrop = false,
    titleId,
    dataE2E,
    class: className,
  }: ConfirmDialogProps,
) {
  // An English default rather than a throw: every user-visible string in this package has one, and
  // a caller that reaches a blank label through a variable gets a usable button instead of a
  // rendered component that raises. The prop still overrides, and a product that wants its own verb
  // names it — see `labelOr`.
  const confirmText = labelOr(confirmLabel, CONFIRM_LABEL)
  const cancelText = labelOr(cancelLabel, CANCEL_LABEL)
  // The question's own id, from the framework's hook for the same reason `Modal`'s title id is:
  // unique on a page, and the same string in the server's render and the browser's.
  const questionId = `confirm-question-${useId()}`

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      titleId={titleId}
      role="alertdialog"
      ariaDescribedBy={hasQuestion(children ?? message) ? questionId : undefined}
      cancelLabel={cancelText}
      tone={tone}
      closeOnBackdrop={closeOnBackdrop}
      dataE2E={dataE2E}
      class={className}
      footer={
        <>
          <Button variant="outline" onClick={() => onCancel()}>{cancelText}</Button>
          <Button variant={confirmVariant(tone)} onClick={(event) => onConfirm(event)}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div id={questionId}>
        {children ?? (
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {message}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** English default for the confirming action, used when the caller names no verb. */
export const CONFIRM_LABEL = "Confirm"

/** English default for the cancelling action, which also names the header dismiss control. */
export const CANCEL_LABEL = "Cancel"

/**
 * The caller's label, or the library's English default.
 *
 * The package's rule for every user-visible string: an English default, and a prop that overrides
 * it. This used to throw instead, on the argument that a library inventing the verb for a delete is
 * worse than a loud failure. The argument does not survive contact with the failure mode: the throw
 * happened during a render, so a translation that came back blank took the whole page down rather
 * than the one button, and a caller has to guard every label it passes to avoid it. A button
 * reading "Confirm" is a smaller wrong than a page that does not render, and a product that wants
 * its own verb passes one.
 *
 * Exported so a host app can resolve its own translated strings the same way, and so the rule is
 * testable without rendering a component.
 *
 * @param label The caller's label; blank and whitespace-only count as absent.
 * @param fallback The default to fall back to — {@link CONFIRM_LABEL} or {@link CANCEL_LABEL}.
 * @returns The trimmed label, for the visible control and the accessible name.
 */
export function labelOr(label: string | undefined, fallback: string): string {
  const text = typeof label === "string" ? label.trim() : ""
  return text === "" ? fallback : text
}

/**
 * Whether the panel's body holds something worth being described by.
 *
 * `aria-describedby` is a promise that the referenced element says something. Pointing it at an
 * empty wrapper is worse than leaving it out: the caller believes the dialog reads its question,
 * and the screen reader reads the name and then silence. So the reference is written only when the
 * body has content that will actually render.
 *
 * "Content that will actually render" is the whole difficulty, because the ways of arriving with
 * none of it do not look alike. `undefined`, `null` and a boolean are what a skipped branch leaves
 * behind. A blank string is what an unfilled template renders to. And a **list** is the one that
 * reads as content while holding none: `{rows.map(…)}` over an empty collection arrives as `[]`,
 * and a fragment can wrap exactly the same nothing. Both are checked through, recursively, because
 * a list of blanks and a fragment around an empty list are the same nothing one layer down.
 *
 * @param body The panel's children, or its message when there are none.
 * @returns `true` when the body has content to announce.
 */
export function hasQuestion(body: ComponentChildren): boolean {
  if (body === undefined || body === null || typeof body === "boolean") return false
  if (typeof body === "string") return body.trim() !== ""
  if (Array.isArray(body)) return body.some(hasQuestion)
  if (isValidElement(body) && body.type === Fragment) {
    return hasQuestion((body.props as { children?: ComponentChildren }).children)
  }
  return true
}

/**
 * Button variant for the confirming action.
 *
 * Exported so a caller can render a matching trigger without restating the mapping.
 *
 * @param tone The dialog's register.
 * @returns `"danger"` for a destructive decision, `"primary"` otherwise.
 */
export function confirmVariant(tone: DialogTone): "danger" | "primary" {
  return tone === "danger" ? "danger" : "primary"
}
