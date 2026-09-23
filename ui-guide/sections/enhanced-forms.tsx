/**
 * `EnhancedForm` and the two forms built on it: progressive enhancement, demonstrated with cards a
 * visitor can actually break — a checkbox to simulate a failure, another to simulate a submit that
 * never resolves.
 *
 * Every card posts to `form-demo/`, the static page `pages/build.ts` copies into the artefact
 * verbatim: with scripts on, `onSubmit` intercepts the post and none of the three cards ever
 * navigates there, but with scripts off — `pages/checks/ui.ts`'s no-JavaScript check — that is
 * exactly where the native submit lands, and the page it lands on is real enough to read.
 */

import {
  Button,
  ContactForm,
  EnhancedForm,
  Field,
  Input,
  NewsletterForm,
} from "@preact-components/ui"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"

/** Every card's `action`: the static page that stands in for "a server answered". */
const FORM_DEMO_ACTION = "form-demo/"

/** A submit that takes a moment, so a fast second click still lands inside the sending window. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The raw building block: one field, a failure toggle, and an explicit `done` slot so the result
 * visibly replaces the field instead of leaving it on screen re-enabled.
 */
function EnhancedFormDemo() {
  const submits = useSignal(0)
  const shouldFail = useSignal(false)

  return (
    <div class="max-w-sm space-y-3">
      <label class="label flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox"
          checked={shouldFail.value}
          onChange={(event) => shouldFail.value = event.currentTarget.checked}
          data-e2e="enhanced-form-fail-toggle"
        />
        Simulate a failure
      </label>
      <EnhancedForm
        action={FORM_DEMO_ACTION}
        onSubmit={async () => {
          submits.value++
          await delay(200)
          if (shouldFail.value) throw new Error("simulated failure")
        }}
        done={<p class="text-sm text-gray-700 dark:text-gray-300">Done.</p>}
      >
        <Field id="guide-enhanced-form-note" label="A note, any note">
          <Input name="note" placeholder="Anything" />
        </Field>
        <Button type="submit">Submit</Button>
      </EnhancedForm>
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="enhanced-form-submits">
        submits: {submits.value}
      </p>
    </div>
  )
}

/** One email field. The submit takes 300ms, long enough for a fast double click to land twice. */
function NewsletterFormDemo() {
  const subscribes = useSignal(0)

  return (
    <div class="max-w-sm space-y-3">
      <NewsletterForm
        action={FORM_DEMO_ACTION}
        onSubmit={async () => {
          subscribes.value++
          await delay(300)
        }}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="newsletter-form-subscribes">
        subscribes: {subscribes.value}
      </p>
    </div>
  )
}

/**
 * Name, email and message, plus two toggles: one simulates a rejected submit, the other a submit
 * that never resolves at all — the shape a promise takes when the visitor's tab is frozen in the
 * back/forward cache before it ever settles.
 */
function ContactFormDemo() {
  const leads = useSignal(0)
  const shouldFail = useSignal(false)
  const hang = useSignal(false)

  return (
    <div class="max-w-md space-y-3">
      <div class="flex flex-wrap gap-4">
        <label class="label flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox"
            checked={shouldFail.value}
            onChange={(event) => shouldFail.value = event.currentTarget.checked}
            data-e2e="contact-form-fail-toggle"
          />
          Simulate a failure
        </label>
        <label class="label flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox"
            checked={hang.value}
            onChange={(event) => hang.value = event.currentTarget.checked}
            data-e2e="contact-form-hang-toggle"
          />
          Simulate a submit that never resolves
        </label>
      </div>
      <ContactForm
        action={FORM_DEMO_ACTION}
        onSubmit={async () => {
          leads.value++
          if (hang.value) {
            await new Promise<void>(() => {}) // Never settles — see the toggle's own label.
            return
          }
          await delay(200)
          if (shouldFail.value) throw new Error("simulated failure")
        }}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="contact-form-leads">
        leads: {leads.value}
      </p>
    </div>
  )
}

export const enhancedFormDemos = {
  EnhancedForm: {
    summary:
      'A real `<form action method>` that posts on its own before hydration, or whenever `onSubmit` is left out — `method` defaults to `"post"` unconditionally, so a pre-hydration submit never puts a field\'s value in the address bar. Once hydrated, a submit calls `onSubmit(formData)` instead and the page stays: `children` sits inside a disabled `<fieldset>` while the promise is outstanding (or the `sending` slot replaces it, when given), `done`/`failed` replace it on settlement, and the always-present `role="status"` region announces the same three states. A second click, or a `form.requestSubmit()`, while a submit is outstanding does nothing — a ref checked synchronously catches what the disabled fieldset has not repainted yet. The sending state always ends: on success, on a rejection or a synchronous throw, and on a `pageshow` with `persisted: true`, which is what a promise abandoned in the back/forward cache would otherwise leave stuck forever.',
    snippet: `<EnhancedForm
  action="/api/subscribe"
  onSubmit={async (data) => api.subscribe(data.get("email"))}
  done={<p>Thanks.</p>}
>
  <Field id="email" label="Email">
    <Input type="email" name="email" required />
  </Field>
  <Button type="submit">Subscribe</Button>
</EnhancedForm>`,
    render: () => <EnhancedFormDemo />,
  },
  NewsletterForm: {
    summary:
      "One email field on `EnhancedForm`: `onSubmit={(email) => …}` reads the one field for you, `done` replaces the field with a thank-you message, and a rejected submit — no `failed` slot of its own — leaves the field and button re-enabled so the visitor can just try again without retyping their address. `honeypot` adds an off-screen field simple bots fill in; a submit that carries a value there resolves as if it had succeeded and never reaches `onSubmit`.",
    snippet: `<NewsletterForm
  action="/api/subscribe"
  onSubmit={(email) => api.subscribe(email)}
  honeypot
/>`,
    render: () => <NewsletterFormDemo />,
  },
  ContactForm: {
    summary:
      "Name, email and message on `EnhancedForm`, with the same retry-on-failure default `NewsletterForm` has. `onSubmit={({ name, email, message }) => …}` reads all three fields for you. The same `honeypot` prop as `NewsletterForm`.",
    snippet: `<ContactForm
  action="/api/lead"
  onSubmit={({ name, email, message }) => api.sendLead({ name, email, message })}
  honeypot
/>`,
    render: () => <ContactFormDemo />,
  },
} satisfies DemoFragment
