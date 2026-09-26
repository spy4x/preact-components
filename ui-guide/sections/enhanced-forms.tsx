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

/**
 * A name, email and message form an app writes itself, with the same honeypot as
 * {@link SignUpForm}.
 */
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
 * A "Start over" button that remounts the form beside it, so a sent form can be tried again.
 *
 * The browser checks in `pages/checks/ui.ts` press it before every submit they make, which is why
 * one form of each shape is enough for all of them.
 */
function StartOver({ e2e, onPress }: { e2e: string; onPress: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" data-e2e={e2e} onClick={onPress}>
      Start over
    </Button>
  )
}

/**
 * One sign-up form, with the honeypot on. Every sign-up check in `pages/checks/ui.ts` starts by
 * pressing "Start over", which remounts the form through `key` and zeroes the counter: a real
 * double click, two `form.requestSubmit()` calls in one turn, focus moved elsewhere while sending,
 * a blur to the page while sending, and a filled honeypot.
 */
function SignUpDemo() {
  const subscribes = useSignal(0)
  const mount = useSignal(0)

  return (
    <Stack gap="sm" class="max-w-md" data-e2e="signup-form">
      <SignUpForm
        key={mount.value}
        id="guide-signup-email"
        honeypot
        onSubmit={async () => {
          subscribes.value++
          // Long enough that a double click's second press, a focus move or a blur lands mid-send.
          await delay(300)
        }}
      />
      <Cluster justify="between">
        <Count e2e="signup-form-subscribes">subscribes: {subscribes.value}</Count>
        <StartOver
          e2e="signup-form-start-over"
          onPress={() => {
            subscribes.value = 0
            mount.value++
          }}
        />
      </Cluster>
    </Stack>
  )
}

/**
 * One contact form, with two checkboxes: one makes the submit reject, the other makes it never
 * resolve at all — the shape a promise takes when the visitor's tab is frozen in the back/forward
 * cache before it settles. "Start over" remounts it, as on {@link SignUpDemo}.
 */
function ContactDemo() {
  const leads = useSignal(0)
  const mount = useSignal(0)
  const shouldFail = useSignal(false)
  const hang = useSignal(false)

  return (
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
        key={mount.value}
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
      <Cluster justify="between">
        <Count e2e="contact-form-leads">leads: {leads.value}</Count>
        <StartOver
          e2e="contact-form-start-over"
          onPress={() => {
            leads.value = 0
            mount.value++
          }}
        />
      </Cluster>
    </Stack>
  )
}

/**
 * The card: the raw building block first, then the two forms an app most often builds from it — a
 * sign-up and a contact form — written here from `Field`, `Input` and `Button` rather than shipped
 * as components.
 */
function EnhancedFormCard() {
  return (
    <Stack gap="xl">
      <EnhancedFormDemo />
      <Grid minColumnWidth="md" gap="xl">
        <Stack gap="md">
          <DemoNote>A sign-up form built from Field, Input and Button.</DemoNote>
          <SignUpDemo />
        </Stack>
        <Stack gap="md">
          <DemoNote>A contact form built the same way.</DemoNote>
          <ContactDemo />
        </Stack>
      </Grid>
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
