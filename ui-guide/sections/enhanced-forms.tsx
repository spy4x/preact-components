/**
 * `EnhancedForm` and the two forms built on it, with checkboxes that make a submit fail, throw or
 * never finish, so a visitor can see every state.
 *
 * Every card posts to `form-demo/`, the static page `pages/build.ts` copies into the artefact
 * verbatim: with scripts on, `onSubmit` intercepts the post and no card ever navigates there, but
 * with scripts off — `pages/checks/ui.ts`'s no-JavaScript check — that is where the native submit
 * lands. Only `pages/serve.ts`, the local server `verify` drives, answers a POST there; the
 * published GitHub Pages site is a static host and answers a POST with `405 Method Not Allowed`.
 */

import {
  Button,
  Checkbox,
  Cluster,
  ContactForm,
  EnhancedForm,
  Field,
  Grid,
  Input,
  NewsletterForm,
  Stack,
} from "@spy4x/preact-ui"
import type { ComponentChildren } from "preact"
import { useSignal } from "@preact/signals"
import type { DemoFragment } from "../registry.ts"

/** Every card's `action`: the static page that stands in for "a server answered". */
const FORM_DEMO_ACTION = "form-demo/"

/** A submit that takes a moment, so a fast second click still lands inside the sending window. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A quiet counter under a form: how many submits reached its `onSubmit`. */
function Count({ e2e, children }: { e2e: string; children: ComponentChildren }) {
  return <p class="text-xs text-gray-500 dark:text-gray-400" data-e2e={e2e}>{children}</p>
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
    <Stack gap="md" class="max-w-md">
      <Cluster gap="lg">
        <Checkbox
          checked={shouldFail.value}
          onChange={(event) => shouldFail.value = event.currentTarget.checked}
          data-e2e="enhanced-form-fail-toggle"
        >
          Fail the submit
        </Checkbox>
        <Checkbox
          checked={throwSync.value}
          onChange={(event) => throwSync.value = event.currentTarget.checked}
          data-e2e="enhanced-form-throw-sync-toggle"
        >
          Throw before it starts
        </Checkbox>
      </Cluster>
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
        <Cluster>
          <Button type="submit">Submit</Button>
        </Cluster>
      </EnhancedForm>
      <Count e2e="enhanced-form-submits">submits: {submits.value}</Count>
    </Stack>
  )
}

/**
 * Five instances, because a successful submit replaces the field with a thank-you message, so each
 * copy can be sent once. The first is the one the card's snippet shows; each of the other four is
 * submitted by exactly one check in `pages/checks/ui.ts`, named by its `data-e2e`:
 *
 * - `newsletter-form-honeypot` — `enhancedFormsHoneypotChecks`: a filled honeypot resolves as a
 *   success without calling `onSubmit`.
 * - `newsletter-form-request-submit` — `newsletterFormRequestSubmitGuardCheck`: two
 *   `form.requestSubmit()` calls in one turn prove the synchronous busy guard, and that a submit
 *   nobody focused never steals focus once it resolves.
 * - `newsletter-form-focus-elsewhere` — `newsletterFormFocusElsewhereCheck`: a visitor who moved
 *   focus to another control while sending keeps it there.
 * - `newsletter-form-blur-while-sending` — `newsletterFormBlurWhileSendingCheck`: a visitor who
 *   blurred to the page while sending is not pulled back when the submit lands.
 */
function NewsletterFormDemo() {
  const subscribes = useSignal(0)
  const honeypotSubscribes = useSignal(0)
  const requestSubmitCalls = useSignal(0)
  const focusElsewhereCalls = useSignal(0)
  const blurWhileSendingCalls = useSignal(0)

  return (
    <Stack gap="lg">
      <Stack gap="sm" class="max-w-md">
        <NewsletterForm
          action={FORM_DEMO_ACTION}
          honeypot
          onSubmit={async () => {
            subscribes.value++
            await delay(300)
          }}
        />
        <Count e2e="newsletter-form-subscribes">subscribes: {subscribes.value}</Count>
      </Stack>
      <Stack gap="sm">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Four more copies: a sent form stays sent, so each of these can be tried once.
        </p>
        <Grid minColumnWidth="md" gap="lg">
          <Stack gap="sm" data-e2e="newsletter-form-honeypot">
            <NewsletterForm
              action={FORM_DEMO_ACTION}
              honeypot
              onSubmit={async () => {
                honeypotSubscribes.value++
                await delay(50)
              }}
            />
            <Count e2e="newsletter-form-honeypot-subscribes">
              subscribes: {honeypotSubscribes.value}
            </Count>
          </Stack>
          <Stack gap="sm" data-e2e="newsletter-form-request-submit">
            <NewsletterForm
              action={FORM_DEMO_ACTION}
              onSubmit={async () => {
                requestSubmitCalls.value++
                await delay(150)
              }}
            />
            <Count e2e="newsletter-form-request-submit-subscribes">
              subscribes: {requestSubmitCalls.value}
            </Count>
          </Stack>
          <Stack gap="sm" data-e2e="newsletter-form-focus-elsewhere">
            <NewsletterForm
              action={FORM_DEMO_ACTION}
              onSubmit={async () => {
                focusElsewhereCalls.value++
                await delay(150)
              }}
            />
            <Count e2e="newsletter-form-focus-elsewhere-subscribes">
              subscribes: {focusElsewhereCalls.value}
            </Count>
          </Stack>
          <Stack gap="sm" data-e2e="newsletter-form-blur-while-sending">
            <NewsletterForm
              action={FORM_DEMO_ACTION}
              onSubmit={async () => {
                blurWhileSendingCalls.value++
                await delay(150)
              }}
            />
            <Count e2e="newsletter-form-blur-while-sending-subscribes">
              subscribes: {blurWhileSendingCalls.value}
            </Count>
          </Stack>
        </Grid>
      </Stack>
    </Stack>
  )
}

/**
 * Two instances, for the same reason `NewsletterFormDemo` has more than one: a successful submit
 * replaces the fields for good.
 *
 * The first carries the two checkboxes: one makes the submit reject, the other makes it never
 * resolve at all — the shape a promise takes when the visitor's tab is frozen in the back/forward
 * cache before it settles. The second, `data-e2e="contact-form-honeypot"`, exists only for
 * `contactFormHoneypotCheck` in `pages/checks/ui.ts`.
 */
function ContactFormDemo() {
  const leads = useSignal(0)
  const shouldFail = useSignal(false)
  const hang = useSignal(false)
  const honeypotLeads = useSignal(0)

  return (
    <Grid minColumnWidth="md" gap="xl">
      <Stack gap="md">
        <Cluster gap="lg">
          <Checkbox
            checked={shouldFail.value}
            onChange={(event) => shouldFail.value = event.currentTarget.checked}
            data-e2e="contact-form-fail-toggle"
          >
            Fail the submit
          </Checkbox>
          <Checkbox
            checked={hang.value}
            onChange={(event) => hang.value = event.currentTarget.checked}
            data-e2e="contact-form-hang-toggle"
          >
            Never finish
          </Checkbox>
        </Cluster>
        <ContactForm
          action={FORM_DEMO_ACTION}
          honeypot
          onSubmit={async () => {
            leads.value++
            if (hang.value) {
              await new Promise<void>(() => {}) // Never settles — see the checkbox's own label.
              return
            }
            await delay(200)
            if (shouldFail.value) throw new Error("simulated failure")
          }}
        />
        <Count e2e="contact-form-leads">leads: {leads.value}</Count>
      </Stack>
      <Stack gap="md" data-e2e="contact-form-honeypot">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          A second copy, so the form can be sent twice.
        </p>
        <ContactForm
          action={FORM_DEMO_ACTION}
          honeypot
          onSubmit={async () => {
            honeypotLeads.value++
            await delay(50)
          }}
        />
        <Count e2e="contact-form-honeypot-leads">leads: {honeypotLeads.value}</Count>
      </Stack>
    </Grid>
  )
}

export const enhancedFormDemos = {
  EnhancedForm: {
    summary:
      "A form that posts like a plain HTML form before its script loads, and afterwards sends through `onSubmit` and stays on the page.",
    wide: true,
    props: [
      {
        name: "action",
        type: "string",
        description: "Where the form posts while no script runs.",
      },
      {
        name: "onSubmit",
        type: "(data: FormData) => Promise<void> | void",
        description: "Sends the form once the script runs; a rejection shows `failed`.",
      },
      {
        name: "done / failed / sending",
        type: "ComponentChildren",
        description: "What replaces the fields in each state.",
      },
      {
        name: "method",
        type: `"get" | "post"`,
        default: `"post"`,
        description: "The plain form's method.",
      },
    ],
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
      "A ready-made one-field email sign-up, built on `EnhancedForm`, that thanks the visitor once it is sent.",
    wide: true,
    props: [
      { name: "action", type: "string", description: "Where the form posts while no script runs." },
      {
        name: "onSubmit",
        type: "(email: string) => Promise<void> | void",
        description: "Receives the address; a rejection lets the visitor retry without retyping.",
      },
      {
        name: "honeypot",
        type: "boolean",
        default: "false",
        description: "Adds a hidden field that quietly drops submits from simple bots.",
      },
    ],
    snippet: `<NewsletterForm
  action="/api/subscribe"
  onSubmit={(email) => api.subscribe(email)}
  honeypot
/>`,
    render: () => <NewsletterFormDemo />,
  },
  ContactForm: {
    summary: "A ready-made contact form, with name, email and message, built on `EnhancedForm`.",
    wide: true,
    props: [
      { name: "action", type: "string", description: "Where the form posts while no script runs." },
      {
        name: "onSubmit",
        type: "(message: ContactMessage) => Promise<void> | void",
        description: "Receives the name, email and message; a rejection lets the visitor retry.",
      },
      {
        name: "honeypot",
        type: "boolean",
        default: "false",
        description: "Adds a hidden field that quietly drops submits from simple bots.",
      },
    ],
    snippet: `<ContactForm
  action="/api/lead"
  onSubmit={({ name, email, message }) => api.sendLead({ name, email, message })}
  honeypot
/>`,
    render: () => <ContactFormDemo />,
  },
} satisfies DemoFragment
