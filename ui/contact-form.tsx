import { Button } from "./button.tsx"
import { EnhancedForm } from "./enhanced-form.tsx"
import { Field } from "./field.tsx"
import { HONEYPOT_FIELD_NAME, honeypotField, honeypotFilled } from "./honeypot.tsx"
import { Input, Textarea } from "./input.tsx"
import type { JSX } from "preact"
import { useId } from "preact/hooks"

/** What one {@link ContactForm} submit hands back. */
export interface ContactMessage {
  name: string
  email: string
  message: string
}

/** Copy {@link ContactForm} shows. Override per key through the `labels` prop. */
export interface ContactFormLabels {
  /** Label of the name field. */
  name: string
  /** Label of the email field. */
  email: string
  /** Label of the message field. */
  message: string
  /** Submit button text. */
  submit: string
  /** Announced while the background submit is in flight. */
  sending: string
  /** Shown, and announced, once the background submit resolves — replaces the fields and button. */
  done: string
  /** Announced once the background submit rejects; the fields and button stay for a retry. */
  failed: string
  /** Off-screen label of the honeypot field — see {@link NewsletterFormLabels.honeypot}. Only
   * rendered when `honeypot` is set. */
  honeypot: string
}

const defaultLabels: ContactFormLabels = {
  name: "Name",
  email: "Email",
  message: "Message",
  submit: "Send",
  sending: "Sending…",
  done: "Thanks — your message is on its way. We'll be in touch.",
  failed: "Something went wrong. Please try again.",
  honeypot: "Leave this field blank",
}

export interface ContactFormProps {
  /** Where the plain `<form>` posts, for a visitor without the bundle. Never defaulted — see
   * {@link EnhancedForm}'s own `action`. */
  action?: string
  /**
   * Submits the message once hydrated, instead of letting the browser post natively. Reads the
   * three fields out of the `FormData` `EnhancedForm` hands it down, so a caller writes
   * `onSubmit={({ name, email, message }) => api.sendLead({ name, email, message })}` rather than
   * reading a `FormData` itself.
   */
  onSubmit?: (message: ContactMessage) => Promise<void> | void
  /**
   * Adds an off-screen field simple bots fill in and people never see — see `honeypot.tsx`. A
   * submit whose honeypot carries a value never reaches `onSubmit`; it resolves as if it had
   * succeeded, because telling a bot it was caught only teaches it to try the next field name.
   */
  honeypot?: boolean
  /** Copy overrides. */
  labels?: Partial<ContactFormLabels>
  /** Utilities for the `<form>` itself. */
  class?: string
}

/**
 * Name, email and message, built on {@link EnhancedForm} — the "get in touch" form that works
 * before JavaScript has run and stays on the page once it has.
 *
 * See {@link EnhancedForm}'s own doc for the no-JavaScript path, the disabled-while-sending
 * `<fieldset>`, and the always-present live region this component's `sending`/`done`/`failed`
 * copy feeds. This component supplies no `failed` slot of its own, so a rejected submit leaves
 * every field and the button on screen, re-enabled and still carrying what the visitor typed —
 * `EnhancedForm` never clears them, so nothing here has to restore them either.
 */
export function ContactForm(
  { action, onSubmit, honeypot = false, labels, class: className }: ContactFormProps,
): JSX.Element {
  const copy = { ...defaultLabels, ...labels }
  const baseId = useId()
  const nameId = `${baseId}-name`
  const emailId = `${baseId}-email`
  const messageId = `${baseId}-message`

  const handleSubmit = onSubmit
    ? (data: FormData) => {
      // A bot filled the trap: resolve as if this had succeeded, and call `onSubmit` for nobody.
      // Telling it otherwise — an error, a different status — only teaches it which field to leave
      // alone next time.
      if (honeypot && honeypotFilled(data)) return
      return onSubmit({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        message: String(data.get("message") ?? ""),
      })
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
      <div class="grid gap-4 sm:grid-cols-2">
        <Field id={nameId} label={copy.name} required>
          <Input name="name" autocomplete="name" required />
        </Field>
        <Field id={emailId} label={copy.email} required>
          <Input type="email" name="email" autocomplete="email" required />
        </Field>
        <Field id={messageId} label={copy.message} required class="sm:col-span-2">
          <Textarea name="message" rows={4} required />
        </Field>
      </div>
      {honeypot && honeypotField(HONEYPOT_FIELD_NAME, copy.honeypot)}
      <Button type="submit">{copy.submit}</Button>
    </EnhancedForm>
  )
}
