/**
 * `MailedCodeStep` — "Check your inbox, type the code": the step after an app e-mailed a person a
 * code, for sign-up, sign-in or a password reset alike. A code works in whichever browser or
 * device the person types it into, where a mailed link opens wherever the mail app decides.
 *
 * It draws the step and nothing else: the code leaves through `onSubmit`, a new mail through
 * `onResend`, the way back through `onChangeEmail`. Busy, error and cooldown state come in as props.
 *
 * **The code is cleaned of whitespace only.** A code copied from a mail often carries spaces or a
 * line break, and some apps print it in groups ("ABC 123"). A `-` or `_` can be part of a code, so
 * it is kept: the app's own check decides what a code may hold.
 *
 * **A paste or an autofill submits by itself** when `pattern` says the result is a whole code. The
 * input event's `inputType` tells them apart from typing: `insertFromPaste`, `insertReplacementText`
 * (a suggestion picked, such as the code the keyboard offers) or none at all (an autofill). A key
 * press never submits, so a person typing is never cut off mid-code, and a paste over a refused
 * code's selected text submits even though the value did not grow.
 *
 * **Focus.** The field takes focus when the step opens, and again, with its text selected, after a
 * refused code, so the next try replaces it. After a new code went out, `ResendButton` moves focus
 * to its "on its way" line; this step hands it on to the field, since typing the new code is what
 * comes next, and the line, a `role="status"` region, is still announced.
 *
 * **It draws its own card**, with "Wrong email? Use a different one" centred under it, as the
 * design language's "Waiting on an e-mail" row places it, so an app puts the whole step on the page
 * as it is. `class` sizes the outer column.
 *
 * **Tests find a part by its fixed `data-e2e`**, as with `AuthForm`: `mailed-code-step` on the
 * root, `mailed-code-step-code`, `mailed-code-step-submit` and `mailed-code-step-change-email`, and
 * `ResendButton`'s own `resend-button-*` hooks.
 */

import { cn } from "@spy4x/preact-cn"
import { TOUCH_TARGET } from "@spy4x/preact-ui"
import { Button } from "@spy4x/preact-ui/button"
import { Card } from "@spy4x/preact-ui/card"
import { Field } from "@spy4x/preact-ui/field"
import { useLabels } from "@spy4x/preact-ui/i18n"
import { Input } from "@spy4x/preact-ui/input"
import { ResendButton } from "@spy4x/preact-ui/resend-button"
import { useSignal } from "@preact/signals"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useId, useRef } from "preact/hooks"

/** Every word {@link MailedCodeStep} shows, each with an English default. */
export interface MailedCodeStepLabels {
  /** The heading. Defaults to `"Check your inbox"`. */
  title: string
  /** How long the code works, given `minutes`. Defaults to `"The code works for 15 minutes."`. */
  expires: (minutes: number) => string
  /** The field's label. Defaults to `"Code"`. */
  code: string
  /** The submit button. Defaults to `"Continue"`. */
  submit: string
  /** The submit button while `busy`. Defaults to `"Checking…"`. */
  checking: string
  /** The field's error when `pattern` refuses what was typed. */
  invalid: string
  /** The resend button. Defaults to `"Send a new code"`. */
  resend: string
  /** The line announced once a new code went out. Defaults to `"A new code is on its way."`. */
  resent: string
  /** The words before the way back. Defaults to `"Wrong email?"`. */
  wrongEmail: string
  /** The way back to another address. Defaults to `"Use a different one"`. */
  changeEmail: string
}

/** The English words {@link MailedCodeStep} shows when the caller passes none. */
export const DEFAULT_MAILED_CODE_STEP_LABELS: MailedCodeStepLabels = {
  title: "Check your inbox",
  expires: (minutes) => `The code works for ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
  code: "Code",
  submit: "Continue",
  checking: "Checking…",
  invalid: "That doesn't look like the code we sent. Check it and try again.",
  resend: "Send a new code",
  resent: "A new code is on its way.",
  wrongEmail: "Wrong email?",
  changeEmail: "Use a different one",
}

export interface MailedCodeStepProps {
  /**
   * The sentence under the heading, saying where the code went: a node, so the app can set the
   * address in bold, `<>We sent a code to <strong>{email}</strong>.</>`.
   */
  sentence: ComponentChildren
  /** How many minutes the code works. Left out, the step says nothing about it. */
  minutes?: number
  /** Called with the code, whitespace removed, on submit or on a paste that makes a whole code. */
  onSubmit: (code: string) => void
  /** Sends a new code. */
  onResend: () => void
  /** Goes back to the step that asks for the address. */
  onChangeEmail: () => void
  /** The code is being checked: the submit button is busy and a second submit is ignored. */
  busy?: boolean
  /** Why the last code was refused, shown under the field. `null` or left out shows nothing. */
  error?: string | null
  /**
   * What a whole code looks like, such as `/^[A-Z0-9]{6}$/`, tested after whitespace is removed.
   * A code it refuses shows `labels.invalid` and never reaches `onSubmit`; a paste or an autofill
   * it accepts submits at once. Left out, every code is submitted and nothing submits by itself.
   */
  pattern?: RegExp
  /** When a new code may be sent, for `ResendButton`: milliseconds since the epoch. */
  readyAt?: number
  /** A new code is being sent: `ResendButton`'s `busy`. */
  resending?: boolean
  /** The heading's level. Defaults to 2; a sign-in page whose main content is this step passes 1. */
  headingLevel?: 1 | 2 | 3
  /** Words to replace, each with an English default. */
  labels?: Partial<MailedCodeStepLabels>
  /** Utilities for the outer column that holds the card and the line under it. */
  class?: string
}

/** The code as typed, without any whitespace. */
function cleanCode(value: string): string {
  return value.replace(/\s+/g, "")
}

/**
 * True when an input event put text in at once rather than a key at a time: a paste, a picked
 * suggestion, or an autofill, which some browsers send as a plain `Event` with no `inputType`.
 */
function arrivedWhole(event: Event): boolean {
  const type = (event as InputEvent).inputType
  return !type || type === "insertFromPaste" || type === "insertReplacementText"
}

/** True when `pattern` accepts `code`; a `g` or `y` flag's position is reset first. */
function accepts(pattern: RegExp, code: string): boolean {
  pattern.lastIndex = 0
  return pattern.test(code)
}

/**
 * "Check your inbox", the address the code went to, a code field with Continue as the one primary
 * action, a `ResendButton`, and the way back to another address. See the module doc for the
 * cleaning, the automatic submit and where focus goes.
 */
export function MailedCodeStep(
  {
    sentence,
    minutes,
    onSubmit,
    onResend,
    onChangeEmail,
    busy = false,
    error,
    pattern,
    readyAt,
    resending = false,
    headingLevel = 2,
    labels,
    class: className,
  }: MailedCodeStepProps,
): JSX.Element {
  const words = useLabels("MailedCodeStep", DEFAULT_MAILED_CODE_STEP_LABELS, labels, {
    expires: ["count"],
  })
  const id = useId()
  const field = useRef<HTMLInputElement>(null)
  const invalid = useSignal(false)
  const shown = invalid.value ? words.invalid : error || null
  const Heading = `h${headingLevel}` as "h2"

  useEffect(() => {
    field.current?.focus()
  }, [])

  // After a refused code, once the answer is in: the field, its text selected to be replaced.
  // Keyed on `error` and `busy`, never on what is shown: typing clears `labels.invalid`, which
  // must not select the text being typed.
  useEffect(() => {
    if (busy || !error) return
    field.current?.focus()
    field.current?.select()
  }, [error, busy])

  /** Hands `code` on, or shows `labels.invalid` when `pattern` refuses it. */
  const submit = (code: string) => {
    if (busy) return
    if (pattern && !accepts(pattern, code)) {
      invalid.value = true
      field.current?.focus()
      field.current?.select()
      return
    }
    invalid.value = false
    onSubmit(code)
  }

  return (
    <div class={cn("flex w-full flex-col gap-6", className)} data-e2e="mailed-code-step">
      <Card class="flex w-full flex-col gap-6 p-6 sm:p-8">
        <header class="flex flex-col gap-1">
          <Heading class="text-xl font-semibold text-foreground">{words.title}</Heading>
          <p class="text-sm text-muted">
            {sentence}
            {minutes === undefined ? null : <>{" "}{words.expires(minutes)}</>}
          </p>
        </header>
        {
          /* `method="post"`: a submit before the script has loaded must not put the code in the
           address bar, as a form with no method does. */
        }
        <form
          method="post"
          class="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit(cleanCode(field.current?.value ?? ""))
          }}
        >
          <Field id={`${id}-code`} label={words.code} error={shown} required>
            {(wiring) => (
              <Input
                ref={field}
                id={wiring.id}
                aria-describedby={wiring["aria-describedby"]}
                aria-invalid={shown ? true : undefined}
                name="code"
                required
                autocomplete="one-time-code"
                autocapitalize="off"
                autocorrect="off"
                spellcheck={false}
                inputmode="text"
                class="font-mono text-lg"
                onInput={(event) => {
                  if (invalid.value) invalid.value = false
                  const code = cleanCode(event.currentTarget.value)
                  if (arrivedWhole(event) && pattern && accepts(pattern, code)) submit(code)
                }}
                data-e2e="mailed-code-step-code"
              />
            )}
          </Field>
          <Button
            type="submit"
            class="w-full"
            busy={busy}
            busyLabel={words.checking}
            data-e2e="mailed-code-step-submit"
          >
            {words.submit}
          </Button>
        </form>
        <div
          onFocusIn={(event) => {
            // ResendButton focuses its "on its way" line after a resend; typing comes next.
            if ((event.target as HTMLElement).getAttribute("role") === "status") {
              field.current?.focus()
            }
          }}
        >
          <ResendButton
            onResend={() => {
              // A new code is coming, so a complaint about the old one no longer applies.
              invalid.value = false
              onResend()
            }}
            busy={resending}
            readyAt={readyAt}
            label={words.resend}
            sentText={words.resent}
          />
        </div>
      </Card>
      <p class="text-center text-sm text-muted">
        {words.wrongEmail}{" "}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={TOUCH_TARGET}
          onClick={onChangeEmail}
          data-e2e="mailed-code-step-change-email"
        >
          {words.changeEmail}
        </Button>
      </p>
    </div>
  )
}
