/**
 * `BookingSubmit` — a submit button that never shows a spinner over an invalid form, and that
 * tells the server which timezone the visitor is in.
 *
 * Two things happen before the native post runs:
 *
 * 1. **Pre-validation.** Posting an empty form and waiting for the server's redirect means the
 *    button sits in its "Confirming…" state for the whole round trip, which on a slow network
 *    looks broken. Validating locally first keeps the spinner for real in-flight requests only.
 *    The server stays the trust boundary; this is UX.
 * 2. **Timezone capture.** `Intl.DateTimeFormat().resolvedOptions().timeZone` on mount, into a
 *    hidden field, so the server can render confirmations in the visitor's zone.
 *
 * Nothing here is booking-specific: the field rules, the validator, the timezone field name and
 * the copy are all props. The validation gate is a pure function, so the branch that matters —
 * blocked vs let through — is tested without a DOM.
 */

import { type } from "arktype"
import { cn } from "@preact-components/cn"
import { IconSpinner } from "@preact-components/icons"
import { useEffect, useState } from "preact/hooks"

/** Reads a form field by name. `new FormData(form)` in a browser, a stub in a test. */
export type FieldReader = (name: string) => string

/** The first problem that blocks a submit, and the control to focus for it. */
export interface FieldProblem {
  message: string
  /** Selector of the control to focus. Defaults to `[name="<field>"]` for a rule's own field. */
  focus?: string
}

/** A single field's rules, walked in declaration order. */
export interface FieldRule {
  /** `name` attribute, as read by the reader. */
  name: string
  /** Message when the trimmed value is empty. Omit to accept an empty value. */
  required?: string
  /** Minimum trimmed length. */
  min?: number
  /** Message when the value is shorter than `min`. */
  tooShort?: string
  /** Maximum trimmed length. */
  max?: number
  /** Message when the value is longer than `max`. */
  tooLong?: string
  /** Shape check on the trimmed value, e.g. {@link emailProblem}. Returns a message or `null`. */
  check?: (value: string) => string | null
  /** Selector of the control to focus when this rule fails. */
  focus?: string
}

/** Validates a form and returns the first blocking problem, or `null` to let the submit run. */
export type FormValidator = (read: FieldReader) => FieldProblem | null

const emailType = type("string.email")

/**
 * arktype-backed email check.
 *
 * Shape only — whether the address exists is the server's call, and `string.email` is the same
 * rule the rest of the library validates with, rather than one more hand-rolled regex.
 */
export function emailProblem(value: string): string | null {
  return emailType.allows(value) ? null : "Please enter a valid email address."
}

/**
 * Run field rules against a reader and return the first failure.
 *
 * Rules are evaluated in order, and the first failure wins, so the message the visitor sees is
 * always about the earliest field on the form rather than an arbitrary one.
 */
export function fieldProblem(
  read: FieldReader,
  fields: readonly FieldRule[],
): FieldProblem | null {
  for (const field of fields) {
    const value = read(field.name).trim()
    const focus = field.focus ?? `[name="${field.name}"]`

    if (!value) {
      if (field.required) return { message: field.required, focus }
      continue
    }
    if (typeof field.min === "number" && value.length < field.min) {
      return {
        message: field.tooShort ?? `Please enter at least ${field.min} characters.`,
        focus,
      }
    }
    if (typeof field.max === "number" && value.length > field.max) {
      return {
        message: field.tooLong ?? `Please use at most ${field.max} characters.`,
        focus,
      }
    }
    const problem = field.check?.(value)
    if (problem) return { message: problem, focus }
  }

  return null
}

/** The browser side of a blocked submit: cancel it, and move focus to the offending control. */
export interface SubmitGate {
  read: FieldReader
  /** Cancels the native submit. In the component this is `event.preventDefault()`. */
  prevent: () => void
  focus: (selector: string) => void
}

/**
 * Validate, and block the submit only when something is wrong.
 *
 * Returning the problem instead of a boolean keeps the caller's state in one assignment, and
 * makes the "spin only for real requests" rule explicit: on success nothing is prevented, so the
 * native post proceeds and the button may legitimately go busy.
 */
export function gateSubmit(gate: SubmitGate, validate: FormValidator): FieldProblem | null {
  const problem = validate(gate.read)
  if (!problem) return null

  gate.prevent()
  if (problem.focus) gate.focus(problem.focus)
  return problem
}

/**
 * The visitor's IANA timezone, or `""` when the environment has no `Intl` data.
 *
 * Empty is a legitimate answer: the server falls back to its own zone rather than receiving a
 * guess.
 */
export function resolveTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
  } catch {
    return ""
  }
}

export interface BookingSubmitProps {
  /** Idle button label, e.g. `"Confirm — Fri, 28 Aug, 14:00"`. */
  label: string
  /** In-flight label. Defaults to `"Confirming…"`. */
  busyLabel?: string
  /** Field rules for the default validator; ignored when `validate` is given. */
  fields?: readonly FieldRule[]
  /** Replaces the default validator entirely. */
  validate?: FormValidator
  /** Name of the hidden timezone input, or `false` to render none. Defaults to `"guestTz"`. */
  timeZoneField?: string | false
  /** Timezone reader port; defaults to {@link resolveTimeZone}. */
  readTimeZone?: () => string
  /** Utilities for the button. */
  class?: string
}

const buttonClass =
  "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-purple-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-900 focus-visible:ring-offset-2 sm:w-auto dark:bg-purple-700 dark:hover:bg-purple-600 dark:focus-visible:ring-purple-400"

const errorClass = "mt-2.5 text-xs font-medium text-red-600 dark:text-red-400"

/**
 * Submit button for a native form.
 *
 * The button is `type="submit"` and does not disable itself while busy: a disabled submit control
 * can stay disabled for the life of the page if the browser cancels the navigation, which is the
 * stuck state this component exists to avoid.
 */
export function BookingSubmit(
  {
    label,
    busyLabel = "Confirming…",
    fields = [],
    validate,
    timeZoneField = "guestTz",
    readTimeZone = resolveTimeZone,
    class: className,
  }: BookingSubmitProps,
) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<FieldProblem | null>(null)
  const [timeZone, setTimeZone] = useState("")

  useEffect(() => {
    setTimeZone(readTimeZone())
  }, [])

  const validator: FormValidator = validate ?? ((read) => fieldProblem(read, fields))

  const onClick = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLButtonElement
    const form = button.form
    if (!form) return

    const data = new FormData(form)
    const blocked = gateSubmit({
      read: (name) => String(data.get(name) ?? ""),
      prevent: () => event.preventDefault(),
      focus: (selector) => form.querySelector<HTMLElement>(selector)?.focus(),
    }, validator)

    setProblem(blocked)
    setBusy(blocked === null)
  }

  return (
    <>
      {timeZoneField !== false && <input type="hidden" name={timeZoneField} value={timeZone} />}
      <button
        type="submit"
        onClick={onClick}
        aria-busy={busy ? "true" : undefined}
        class={cn(buttonClass, className)}
      >
        {busy
          ? (
            <>
              <IconSpinner class="size-4" />
              <span>{busyLabel}</span>
            </>
          )
          : <span>{label}</span>}
      </button>
      {problem && <p role="alert" class={errorClass}>{problem.message}</p>}
    </>
  )
}
