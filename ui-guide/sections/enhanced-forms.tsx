/**
 * `EnhancedForm`, and a sign-up and a contact form built from it, with checkboxes that make a
 * submit fail, throw or never finish, so a visitor can see every state.
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
  EnhancedForm,
  Field,
  Grid,
  HONEYPOT_FIELD_NAME,
  honeypotField,
  honeypotFilled,
  Input,
  Stack,
  Textarea,
} from "@spy4x/preact-ui"
import type { ComponentChildren } from "preact"
import { useSignal } from "@preact/signals"
import { entries } from "../record.ts"
import { DemoNote } from "./demo-note.tsx"
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
    <Stack gap="md" class="max-w-md" data-e2e="enhanced-form">
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

/** Every result a demo form below announces, the copy the browser checks wait for. */
const signUpLabels = {
  sending: "Sending…",
  done: "You're subscribed. Check your inbox to confirm.",
  failed: "Something went wrong. Please try again.",
}

const contactLabels = {
  sending: "Sending…",
  done: "Thanks — your message is on its way. We'll be in touch.",
  failed: "Something went wrong. Please try again.",
}

/**
 * A one-field sign-up form an app writes itself from `EnhancedForm`, `Field`, `Input` and
 * `Button`. With `honeypot`, a submit whose off-screen trap field carries a value resolves as if it
 * had succeeded and never reaches `onSubmit`: telling a bot it was caught only teaches it which
 * field to leave alone next time.
 */
function SignUpForm(
  { id, honeypot = false, onSubmit }: {
    id: string
    honeypot?: boolean
    onSubmit: (email: string) => Promise<void>
  },
) {
  return (
    <EnhancedForm
      action={FORM_DEMO_ACTION}
      onSubmit={(data) => {
        if (honeypot && honeypotFilled(data)) return
        return onSubmit(String(data.get("email") ?? ""))
      }}
      labels={signUpLabels}
      done={<p class="text-sm text-gray-700 dark:text-gray-300">{signUpLabels.done}</p>}
    >
      <Cluster align="end">
        <Field id={id} label="Email" required class="min-w-0 flex-1">
          <Input type="email" name="email" autocomplete="email" required />
        </Field>
        <Button type="submit">Subscribe</Button>
      </Cluster>
      {honeypot && honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank")}
    </EnhancedForm>
  )
}

/** A name, email and message form an app writes itself, with the same honeypot as {@link SignUpForm}. */
function ContactDemoForm(
  { id, onSubmit }: { id: string; onSubmit: () => Promise<void> },
) {
  return (
    <EnhancedForm
      action={FORM_DEMO_ACTION}
      onSubmit={(data) => honeypotFilled(data) ? undefined : onSubmit()}
      labels={contactLabels}
      done={<p class="text-sm text-gray-700 dark:text-gray-300">{contactLabels.done}</p>}
    >
      <Grid minColumnWidth="sm" gap="md">
        <Field id={`${id}-name`} label="Name" required>
          <Input name="name" autocomplete="name" required />
        </Field>
        <Field id={`${id}-email`} label="Email" required>
          <Input type="email" name="email" autocomplete="email" required />
        </Field>
      </Grid>
      <Field id={`${id}-message`} label="Message" required>
        <Textarea name="message" rows={4} required />
      </Field>
      {honeypotField(HONEYPOT_FIELD_NAME, "Leave this field blank")}
      <Cluster>
        <Button type="submit">Send</Button>
      </Cluster>
    </EnhancedForm>
  )
}

/**
 * Five sign-up forms, because a successful submit replaces the field with a thank-you message, so
 * each copy can be sent once. Each is submitted by exactly one check in `pages/checks/ui.ts`, named
 * by its `data-e2e`:
 *
 * - `signup-form` — `signUpFormDoubleClickCheck`: a real double click calls `onSubmit` once.
 * - `signup-form-honeypot` — `enhancedFormsHoneypotChecks`: a filled honeypot resolves as a
 *   success without calling `onSubmit`.
 * - `signup-form-request-submit` — `signUpFormRequestSubmitGuardCheck`: two
 *   `form.requestSubmit()` calls in one turn prove the synchronous busy guard, and that a submit
 *   nobody focused never steals focus once it resolves.
 * - `signup-form-focus-elsewhere` — `signUpFormFocusElsewhereCheck`: a visitor who moved focus to
 *   another control while sending keeps it there.
 * - `signup-form-blur-while-sending` — `signUpFormBlurWhileSendingCheck`: a visitor who blurred to
 *   the page while sending is not pulled back when the submit lands.
 */
function SignUpFormsDemo() {
  const counts = {
    "signup-form": useSignal(0),
    "signup-form-honeypot": useSignal(0),
    "signup-form-request-submit": useSignal(0),
    "signup-form-focus-elsewhere": useSignal(0),
    "signup-form-blur-while-sending": useSignal(0),
  }

  return (
    <Grid minColumnWidth="md" gap="lg">
      {entries(counts).map(([e2e, count]) => (
        <Stack key={e2e} gap="sm" data-e2e={e2e}>
          <SignUpForm
            id={`guide-${e2e}-email`}
            honeypot={e2e === "signup-form-honeypot"}
            onSubmit={async () => {
              count.value++
              // The first copy waits longest, so a double click's second press lands mid-send.
              await delay(e2e === "signup-form" ? 300 : e2e === "signup-form-honeypot" ? 50 : 150)
            }}
          />
          <Count e2e={`${e2e}-subscribes`}>subscribes: {count.value}</Count>
        </Stack>
      ))}
    </Grid>
  )
}

/**
 * Two contact forms, for the same reason there are several sign-up forms: a successful submit
 * replaces the fields for good.
 *
 * The first carries the two checkboxes: one makes the submit reject, the other makes it never
 * resolve at all — the shape a promise takes when the visitor's tab is frozen in the back/forward
 * cache before it settles. The second, `data-e2e="contact-form-honeypot"`, exists only for
 * `contactFormHoneypotCheck` in `pages/checks/ui.ts`.
 */
function ContactFormsDemo() {
  const leads = useSignal(0)
  const shouldFail = useSignal(false)
  const hang = useSignal(false)
  const honeypotLeads = useSignal(0)

  return (
    <Grid minColumnWidth="md" gap="xl">
      <Stack gap="md" data-e2e="contact-form">
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
        <ContactDemoForm
          id="guide-contact"
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
        <ContactDemoForm
          id="guide-contact-honeypot"
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

/**
 * The card: the raw building block first, then the two forms an app most often builds from it —
 * a sign-up and a contact form — written here from `Field`, `Input` and `Button` rather than
 * shipped as components. Their extra copies are for the browser checks.
 */
function EnhancedFormCard() {
  return (
    <Stack gap="xl">
      <EnhancedFormDemo />
      <Stack gap="md">
        <DemoNote>
          A sign-up form built from Field, Input and Button. A sent form stays sent, so each copy
          can be tried once.
        </DemoNote>
        <SignUpFormsDemo />
      </Stack>
      <Stack gap="md">
        <DemoNote>A contact form built the same way.</DemoNote>
        <ContactFormsDemo />
      </Stack>
    </Stack>
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
    render: () => <EnhancedFormCard />,
  },
} satisfies DemoFragment
