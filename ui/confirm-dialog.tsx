import type { ComponentChildren } from "preact"
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
   * Label of the confirming action. **Required**: the library ships no product copy, so the caller
   * writes the verb. `"Delete"`, `"Archive"`, `"Leave"` — whatever the action actually does.
   */
  confirmLabel: string
  /**
   * Label of the cancelling action, which is also the accessible name of the header dismiss control.
   * **Required**, for the same reason as {@link ConfirmDialogProps.confirmLabel}.
   */
  cancelLabel: string
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
 * the three-part anatomy and the refusal wiring. `title`, {@link ConfirmDialogProps.confirmLabel}
 * and {@link ConfirmDialogProps.cancelLabel} are required rather than defaulted, because a default
 * like `"OK"` would be the library inventing product copy for an action as irreversible as
 * deletion; the caller names the verb it is asking about.
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
 * The same DOM gap as `Modal` applies: modal interaction is browser-verified only, and by no
 * committed test — `pages/verify.ts` has no modal assertions.
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
  // `throw` rather than a silent default: an unlabelled action button is a product bug, and the
  // library has no copy of its own to fall back on. TypeScript already rejects a missing label; this
  // catches the `""` and `" "` a caller reaches through a variable.
  const confirmText = requireLabel(confirmLabel, "confirmLabel")
  const cancelText = requireLabel(cancelLabel, "cancelLabel")

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      titleId={titleId}
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
      {children ?? (
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {message}
        </p>
      )}
    </Modal>
  )
}

/**
 * Reject an action that has no label.
 *
 * Exported so the failure is testable without rendering a component, and so a host app can run the
 * same guard over its own translated strings.
 *
 * @param label The caller's label.
 * @param name Prop name, used in the message.
 * @returns The trimmed label, for the visible control and the accessible name.
 * @throws {Error} When the label is missing or blank.
 */
export function requireLabel(label: string | undefined, name: string): string {
  const text = typeof label === "string" ? label.trim() : ""
  if (!text) {
    throw new Error(`ConfirmDialog: \`${name}\` is required — the library ships no product copy.`)
  }
  return text
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
