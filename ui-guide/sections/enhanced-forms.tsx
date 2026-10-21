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
  type EnhancedFormStatus,
  Field,
  Grid,
  honeypotField,
  Input,
  Stack,
  Textarea,
  useFocusOnChange,
  useFocusOnError,
} from "@spy4x/preact-ui"
import { HONEYPOT_FIELD_NAME, honeypotFilled } from "@spy4x/platform/universal/honeypot"
import type { ComponentChildren } from "preact"
import { useSignal } from "@preact/signals"
import { useEffect, useState } from "preact/hooks"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** Every card's `action`: the static page that stands in for "a server answered". */
const FORM_DEMO_ACTION = "form-demo/"

/** A submit that takes a moment, so a fast second click still lands inside the sending window. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A failure a demo throws on purpose, when its "Fail the submit" box is ticked. */
class SimulatedFailure extends Error {}

/**
 * Keeps a demo's own {@link SimulatedFailure} out of the console.
 *
 * `EnhancedForm` hands a rejected submit to `reportError`, which reports it to the console unless
 * an `error` listener cancels it. An app does the same when it sends errors to its own telemetry;
 * here it keeps the failures a visitor asked for from reading as bugs, and lets every other error
 * through.
 */
function useQuietSimulatedFailures() {
  useEffect(() => {
    const quiet = (event: ErrorEvent) => {
      if (event.error instanceof SimulatedFailure) event.preventDefault()
    }
    globalThis.addEventListener("error", quiet)
    return () => globalThis.removeEventListener("error", quiet)
  }, [])
}

/** A quiet counter under a form: how many submits reached its `onSubmit`. */
function Count({ e2e, children }: { e2e: string; children: ComponentChildren }) {
  return <p class="text-xs text-muted" data-e2e={e2e}>{children}</p>
}

/**
 * The raw building block: one field, two ways to fail — an asynchronous rejection and a
 * synchronous throw, which reach `EnhancedForm`'s submit handler differently and both have to end
 * in `"failed"` — a `sending` slot shown while the note stays mounted behind it, so a failure brings
 * the typed note back, and an explicit `done` slot so the result visibly replaces the field instead
 * of leaving it on screen re-enabled.
 */
function EnhancedFormDemo() {
  const submits = useSignal(0)
  const shouldFail = useSignal(false)
  const throwSync = useSignal(false)
  useQuietSimulatedFailures()

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
          if (throwSync.value) throw new SimulatedFailure("simulated synchronous failure")
          return (async () => {
            await delay(200)
            if (shouldFail.value) throw new SimulatedFailure("simulated failure")
          })()
        }}
        sending={
          <p class="text-sm text-muted" data-e2e="enhanced-form-sending">Sending your note…</p>
        }
        done={<p class="text-sm text-muted">Done.</p>}
      >
        <Stack gap="md">
          <Field id="guide-enhanced-form-note" label="A note, any note">
            <Input name="note" placeholder="Anything" />
          </Field>
          <Cluster>
            <Button type="submit">Submit</Button>
          </Cluster>
        </Stack>
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
      done={<p class="text-sm text-muted">{signUpLabels.done}</p>}
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
      done={<p class="text-sm text-muted">{contactLabels.done}</p>}
    >
      <Stack gap="md">
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
      </Stack>
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
  useQuietSimulatedFailures()

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
          if (shouldFail.value) throw new SimulatedFailure("simulated failure")
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

/** Every label empty: the controlled demo below shows its own text, so the form says nothing. */
const silentLabels = { sending: "", done: "", failed: "" }

/**
 * A form whose caller holds the submit cycle: the status lives in the caller's own signal, and the
 * form announces nothing, so the caller's line under it is the only message. `onSubmit` returns at
 * once and the "request" finishes later on a timer, the shape of an app whose store tracks the
 * request — which is why a second submit is refused by the caller's `"sending"` alone.
 */
function ControlledDemo() {
  const status = useSignal<EnhancedFormStatus>("idle")
  const submits = useSignal(0)
  const shouldFail = useSignal(false)

  return (
    <Stack gap="md" class="max-w-md" data-e2e="controlled-form">
      <Checkbox
        checked={shouldFail.value}
        onChange={(event) => shouldFail.value = event.currentTarget.checked}
        data-e2e="controlled-form-fail-toggle"
      >
        Fail the submit
      </Checkbox>
      <EnhancedForm
        action={FORM_DEMO_ACTION}
        status={status.value}
        labels={silentLabels}
        onSubmit={() => {
          submits.value++
          status.value = "sending"
          setTimeout(() => status.value = shouldFail.value ? "failed" : "done", 600)
        }}
      >
        <Stack gap="md">
          <Field id="guide-controlled-form-note" label="A note, any note">
            <Input name="note" placeholder="Anything" />
          </Field>
          <Cluster>
            <Button type="submit">Submit</Button>
          </Cluster>
        </Stack>
      </EnhancedForm>
      <p
        class={status.value === "failed" ? "text-sm text-danger" : "text-sm text-muted"}
        role="status"
        data-e2e="controlled-form-message"
      >
        {status.value === "sending"
          ? "Saving your note…"
          : status.value === "done"
          ? "Your note is saved."
          : status.value === "failed"
          ? "The server said no. Try again."
          : ""}
      </p>
      <Cluster justify="between">
        <Count e2e="controlled-form-submits">submits: {submits.value}</Count>
        <StartOver
          e2e="controlled-form-start-over"
          onPress={() => {
            submits.value = 0
            status.value = "idle"
          }}
        />
      </Cluster>
    </Stack>
  )
}

/** What the focus demo's address field says is wrong, or `null` when it takes the address. */
function addressError(email: string): string | null {
  if (!email.trim()) return "Enter your address."
  if (!email.includes("@")) return "That address has no @ in it."
  return null
}

/**
 * `useFocusOnError` and `useFocusOnChange` on a two-step form. A refused address puts its error
 * under the field and focus on the field; an accepted one moves the flow to its second step, whose
 * line takes focus. "Start over" goes back to the first step, the value the demo mounted with, and
 * focus stays on the button. The last line's `data-settled` is written from an effect declared
 * after both hooks, so once it reads the state, the hooks have done all they do for that state. It
 * is an attribute, not text, so the served document and the hydrated card read the same.
 */
function FocusDemo() {
  const email = useSignal("")
  const error = useSignal<string | null>(null)
  const submits = useSignal(0)
  const step = useSignal<"ask" | "sent">("ask")
  const field = useFocusOnError(error.value)
  const line = useFocusOnChange<HTMLParagraphElement>(step.value)
  const state = `step ${step.value} · submits ${submits.value}`
  const [settled, setSettled] = useState("")
  useEffect(() => setSettled(state), [state])

  return (
    <Stack gap="md" class="max-w-md" data-e2e="focus-demo">
      <p ref={line} tabIndex={-1} class="text-sm" data-e2e="focus-demo-line">
        {step.value === "ask"
          ? "Step 1 of 2: where should the link go?"
          : `Step 2 of 2: a link is on its way to ${email.value}.`}
      </p>
      {step.value === "ask" && (
        <EnhancedForm
          action={FORM_DEMO_ACTION}
          status="idle"
          labels={silentLabels}
          onSubmit={() => {
            submits.value++
            error.value = addressError(email.value)
            if (!error.value) step.value = "sent"
          }}
        >
          <Stack gap="md">
            <Field id="guide-focus-demo-email" label="Email" error={error.value}>
              <Input
                ref={field}
                name="email"
                value={email.value}
                onInput={(event) => email.value = event.currentTarget.value}
                data-e2e="focus-demo-email"
              />
            </Field>
            <Cluster>
              <Button type="submit" data-e2e="focus-demo-submit">Send the link</Button>
            </Cluster>
          </Stack>
        </EnhancedForm>
      )}
      <Cluster justify="between">
        <p class="text-xs text-muted" data-e2e="focus-demo-settled" data-settled={settled}>
          {state}
        </p>
        <StartOver
          e2e="focus-demo-start-over"
          onPress={() => {
            email.value = ""
            error.value = null
            submits.value = 0
            step.value = "ask"
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
      <Stack gap="md">
        <DemoNote>
          With status passed in, the caller drives the form, and empty labels make it say nothing.
        </DemoNote>
        <ControlledDemo />
      </Stack>
      <Stack gap="md">
        <DemoNote>
          Focus on error and on a step change: a refused address puts focus on the field, an
          accepted one on the next step's line.
        </DemoNote>
        <FocusDemo />
      </Stack>
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
        description:
          "What shows in each state. `done` and `failed` replace the fields; `sending` hides them, so a failure brings back what was typed.",
      },
      {
        name: "status",
        type: `"idle" | "sending" | "done" | "failed"`,
        description:
          "Hands the submit cycle to the caller: the form renders from it, and refuses a submit while it reads `sending`.",
      },
      {
        name: "labels",
        type: "{ sending?, done?, failed? }",
        description: 'What the form announces; `""` for a key says nothing in that state.',
      },
      {
        name: "class",
        type: "string",
        description:
          "Extra classes for the form. The failure text carries `enhanced-form-error`, a hook " +
          "for styling it.",
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
  <Stack gap="md">
    <Field id="email" label="Email">
      <Input type="email" name="email" required />
    </Field>
    <Cluster>
      <Button type="submit">Subscribe</Button>
    </Cluster>
  </Stack>
</EnhancedForm>`,
    render: () => <EnhancedFormCard />,
  },
} satisfies DemoFragment
