import { Button } from "./button.tsx"
import { EnhancedForm } from "./enhanced-form.tsx"
import { Field } from "./field.tsx"
import { HONEYPOT_FIELD_NAME, honeypotField, honeypotFilled } from "./honeypot.tsx"
import { Input } from "./input.tsx"
import type { JSX } from "preact"
import { useId } from "preact/hooks"

/** Copy {@link NewsletterForm} shows. Override per key through the `labels` prop. */
export interface NewsletterFormLabels {
  /** Label of the email field. */
  email: string
  /** Submit button text. */
  submit: string
  /** Announced while the background submit is in flight. */
  sending: string
  /** Shown, and announced, once the background submit resolves — replaces the field and button. */
  done: string
  /** Announced once the background submit rejects; the field and button stay for a retry. */
  failed: string
  /** Off-screen label of the honeypot field, read by the one assistive technology that autofills
   * a field `aria-hidden` does not stop it from finding. Only rendered when `honeypot` is set. */
  honeypot: string
}

const defaultLabels: NewsletterFormLabels = {
  email: "Email",
  submit: "Subscribe",
  sending: "Sending…",
  done: "You're subscribed. Check your inbox to confirm.",
  failed: "Something went wrong. Please try again.",
  honeypot: "Leave this field blank",
}

export interface NewsletterFormProps {
  /** Where the plain `<form>` posts, for a visitor without the bundle. Never defaulted — see
   * {@link EnhancedForm}'s own `action`. */
  action?: string
  /**
   * Submits the email once hydrated, instead of letting the browser post natively. Reads the raw
   * `FormData` `EnhancedForm` hands it down to the one field this form has, so a caller writes
   * `onSubmit={(email) => api.subscribe(email)}` rather than reading a `FormData` itself.
   */
  onSubmit?: (email: string) => Promise<void> | void
  /**
   * Adds an off-screen field simple bots fill in and people never see — see `honeypot.tsx`. A
   * submit whose honeypot carries a value never reaches `onSubmit`; it resolves as if it had
   * succeeded, because telling a bot it was caught only teaches it to try the next field name.
   */
  honeypot?: boolean
  /** Copy overrides. */
  labels?: Partial<NewsletterFormLabels>
  /** Utilities for the `<form>` itself. */
  class?: string
}

/**
 * One email field, built on {@link EnhancedForm} — the "subscribe" box that works before
 * JavaScript has run and stays on the page once it has.
 *
 * See {@link EnhancedForm}'s own doc for the no-JavaScript path, the disabled-while-sending
 * `<fieldset>`, and the always-present live region this component's `sending`/`done`/`failed`
 * copy feeds. This component supplies no `failed` slot of its own, so a rejected submit leaves the
 * field and the button on screen, re-enabled — the visitor can just try again without retyping
 * their address, which `EnhancedForm` never cleared in the first place.
 */
export function NewsletterForm(
  { action, onSubmit, honeypot = false, labels, class: className }: NewsletterFormProps,
): JSX.Element {
  const copy = { ...defaultLabels, ...labels }
  const emailId = useId()

  const handleSubmit = onSubmit
    ? (data: FormData) => {
      // A bot filled the trap: resolve as if this had succeeded, and call `onSubmit` for nobody.
      // Telling it otherwise — an error, a different status — only teaches it which field to leave
      // alone next time.
      if (honeypot && honeypotFilled(data)) return
      return onSubmit(String(data.get("email") ?? ""))
    }
    : undefined

  return (
    <EnhancedForm
      action={action}
      onSubmit={handleSubmit}
      labels={{ sending: copy.sending, done: copy.done, failed: copy.failed }}
      done={<p class="text-sm text-gray-700 dark:text-gray-300">{copy.done}</p>}
      class={className}
    >
      <div class="flex flex-wrap items-end gap-3">
        <Field id={emailId} label={copy.email} required class="min-w-0 flex-1">
          <Input type="email" name="email" autocomplete="email" required />
        </Field>
        <Button type="submit">{copy.submit}</Button>
      </div>
      {honeypot && honeypotField(HONEYPOT_FIELD_NAME, copy.honeypot)}
    </EnhancedForm>
  )
}
