/**
 * `EnhancedForm` and the two forms built on it: progressive enhancement, demonstrated with cards a
 * visitor can actually break — a checkbox to simulate a failure, another to simulate a submit that
 * never resolves, and (on `EnhancedForm`'s own card) one that throws before its first `await`.
 *
 * Every card posts to `form-demo/`, the static page `pages/build.ts` copies into the artefact
 * verbatim: with scripts on, `onSubmit` intercepts the post and none of the three cards ever
 * navigates there, but with scripts off — `pages/checks/ui.ts`'s no-JavaScript check — that is
 * exactly where the native submit lands. **Only `pages/serve.ts`, the local server `verify` drives,
 * answers a POST there** — `serve.ts` never reads `request.method` at all, so it hands back the
 * same file for either verb. The published GitHub Pages site is a static host and answers a POST
 * with `405 Method Not Allowed`; nothing here or in the no-JavaScript check claims otherwise, and
 * the check itself reads the method and the body off the recorded network request rather than
 * trusting the markup.
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
 * The raw building block: one field, two ways to fail — an asynchronous rejection and a
 * synchronous throw, which reach `EnhancedForm`'s submit handler differently and both have to end
 * in `"failed"` — and an explicit `done` slot so the result visibly replaces the field instead of
 * leaving it on screen re-enabled.
 */
function EnhancedFormDemo() {
  const submits = useSignal(0)
  const shouldFail = useSignal(false)
  const throwSync = useSignal(false)

  return (
    <div class="max-w-sm space-y-3">
      <div class="flex flex-wrap gap-4">
        <label class="label flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox"
            checked={shouldFail.value}
            onChange={(event) => shouldFail.value = event.currentTarget.checked}
            data-e2e="enhanced-form-fail-toggle"
          />
          Simulate a failure (rejected promise)
        </label>
        <label class="label flex items-center gap-2">
          <input
            type="checkbox"
            class="checkbox"
            checked={throwSync.value}
            onChange={(event) => throwSync.value = event.currentTarget.checked}
            data-e2e="enhanced-form-throw-sync-toggle"
          />
          Simulate a failure (throws before any await)
        </label>
      </div>
      <EnhancedForm
        action={FORM_DEMO_ACTION}
        onSubmit={(_data) => {
          submits.value++
          // Thrown here, before any `await`, this reaches `onSubmit`'s caller synchronously —
          // `EnhancedForm`'s own `Promise.resolve().then(() => onSubmit(data))` is what folds it
          // into the same "failed" path a rejected promise takes, which is the one behaviour
          // `enhancedFormSynchronousThrowCheck` in `pages/checks/ui.ts` proves.
          if (throwSync.value) throw new Error("simulated synchronous failure")
          return (async () => {
            await delay(200)
            if (shouldFail.value) throw new Error("simulated failure")
          })()
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

/**
 * Five instances, because a successful submit replaces the field with a thank-you message and no
 * browser check that drives one to success can leave it resubmittable afterward for another.
 *
 * The first is the one this card's own snippet shows: one email field, `honeypot` on, a submit that
 * takes 300ms — long enough for a fast double click to land twice — and `subscribes`, which only
 * ever counts a call that actually reached `onSubmit`. `newsletterFormDoubleClickCheck` in
 * `pages/checks/ui.ts` drives this one.
 *
 * The second, marked `data-e2e="newsletter-form-honeypot"`, exists only for
 * `enhancedFormsHoneypotChecks` in that same file: proving that a filled honeypot resolves as a
 * success without ever calling `onSubmit` needs a submit of its own, one the double-click proof
 * above cannot spare once it has run.
 *
 * The third, marked `data-e2e="newsletter-form-request-submit"`, exists only for
 * `newsletterFormRequestSubmitGuardCheck`: two `form.requestSubmit()` calls made in the same script
 * turn, with no real click and so no focus ever placed on the form, are what that check uses to
 * prove `EnhancedForm`'s synchronous busy guard (a real double click, dispatched with the delay a
 * network round trip costs, cannot rule out the disabled `<fieldset>` alone already being enough)
 * and, in the same run, that a submit nobody focused never steals focus back once it resolves.
 *
 * The fourth, marked `data-e2e="newsletter-form-focus-elsewhere"`, exists only for
 * `newsletterFormFocusElsewhereCheck`: a real click on this instance's own submit button does put
 * focus inside the form, unlike the third instance's `requestSubmit()` calls, so it is the one card
 * that can prove the other half of the same fix — a visitor who submitted normally and then moved
 * focus to a specific other control, before the result lands, keeps it there too.
 *
 * The fifth, marked `data-e2e="newsletter-form-blur-while-sending"`, exists only for
 * `newsletterFormBlurWhileSendingCheck`: a real click, then a blur to `<body>` — not to a specific
 * other control, the fourth instance's own case — while the submit is still outstanding. This is
 * the case the focus-restoring effect recovers *into* on its own (disabling the fieldset for
 * `"sending"` already drops focus to `<body>`), so proving a visitor who blurred there themselves,
 * on purpose, is not pulled back once the same submit later reaches `"done"` needs a submit that
 * genuinely started with focus inside the form — the fourth instance's own point of difference from
 * the third.
 */
function NewsletterFormDemo() {
  const subscribes = useSignal(0)
  const honeypotSubscribes = useSignal(0)
  const requestSubmitCalls = useSignal(0)
  const focusElsewhereCalls = useSignal(0)
  const blurWhileSendingCalls = useSignal(0)

  return (
    <div class="max-w-sm space-y-3">
      <NewsletterForm
        action={FORM_DEMO_ACTION}
        honeypot
        onSubmit={async () => {
          subscribes.value++
          await delay(300)
        }}
      />
      <p class="text-sm text-gray-500 dark:text-gray-400" data-e2e="newsletter-form-subscribes">
        subscribes: {subscribes.value}
      </p>
      <div
        class="border-t border-gray-200 pt-3 dark:border-gray-700"
        data-e2e="newsletter-form-honeypot"
      >
        <NewsletterForm
          action={FORM_DEMO_ACTION}
          honeypot
          onSubmit={async () => {
            honeypotSubscribes.value++
            await delay(50)
          }}
        />
        <p
          class="text-sm text-gray-500 dark:text-gray-400"
          data-e2e="newsletter-form-honeypot-subscribes"
        >
          subscribes: {honeypotSubscribes.value}
        </p>
      </div>
      <div
        class="border-t border-gray-200 pt-3 dark:border-gray-700"
        data-e2e="newsletter-form-request-submit"
      >
        <NewsletterForm
          action={FORM_DEMO_ACTION}
          onSubmit={async () => {
            requestSubmitCalls.value++
            await delay(150)
          }}
        />
        <p
          class="text-sm text-gray-500 dark:text-gray-400"
          data-e2e="newsletter-form-request-submit-subscribes"
        >
          subscribes: {requestSubmitCalls.value}
        </p>
      </div>
      <div
        class="border-t border-gray-200 pt-3 dark:border-gray-700"
        data-e2e="newsletter-form-focus-elsewhere"
      >
        <NewsletterForm
          action={FORM_DEMO_ACTION}
          onSubmit={async () => {
            focusElsewhereCalls.value++
            await delay(150)
          }}
        />
        <p
          class="text-sm text-gray-500 dark:text-gray-400"
          data-e2e="newsletter-form-focus-elsewhere-subscribes"
        >
          subscribes: {focusElsewhereCalls.value}
        </p>
      </div>
      <div
        class="border-t border-gray-200 pt-3 dark:border-gray-700"
        data-e2e="newsletter-form-blur-while-sending"
      >
        <NewsletterForm
          action={FORM_DEMO_ACTION}
          onSubmit={async () => {
            blurWhileSendingCalls.value++
            await delay(150)
          }}
        />
        <p
          class="text-sm text-gray-500 dark:text-gray-400"
          data-e2e="newsletter-form-blur-while-sending-subscribes"
        >
          subscribes: {blurWhileSendingCalls.value}
        </p>
      </div>
    </div>
  )
}

/**
 * Two instances, for the same reason `NewsletterFormDemo` has more than one: a successful submit
 * replaces the fields for good.
 *
 * The first carries the two toggles this card's own snippet shows: one simulates a rejected submit,
 * the other a submit that never resolves at all — the shape a promise takes when the visitor's tab
 * is frozen in the back/forward cache before it ever settles.
 *
 * The second, marked `data-e2e="contact-form-honeypot"`, exists only for
 * `contactFormHoneypotCheck` in `pages/checks/ui.ts` — the same proof `enhancedFormsHoneypotChecks`
 * runs against `NewsletterForm`, on the three-field form instead.
 */
function ContactFormDemo() {
  const leads = useSignal(0)
  const shouldFail = useSignal(false)
  const hang = useSignal(false)
  const honeypotLeads = useSignal(0)

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
        honeypot
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
      <div
        class="border-t border-gray-200 pt-3 dark:border-gray-700"
        data-e2e="contact-form-honeypot"
      >
        <ContactForm
          action={FORM_DEMO_ACTION}
          honeypot
          onSubmit={async () => {
            honeypotLeads.value++
            await delay(50)
          }}
        />
        <p
          class="text-sm text-gray-500 dark:text-gray-400"
          data-e2e="contact-form-honeypot-leads"
        >
          leads: {honeypotLeads.value}
        </p>
      </div>
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
