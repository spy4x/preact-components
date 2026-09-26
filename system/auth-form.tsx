/**
 * `AuthForm` — the sign-in, sign-up and one-time-code screens, driven entirely by props.
 *
 * The component draws the screens and nothing else: it makes no network call, and it stores no
 * credential anywhere the caller did not hand it a place to put one. `mode`, `step`, `busy` and
 * `error` are all read from props, and every outcome — a credentials submit, a code submit, a mode
 * switch — leaves through a callback rather than through state this component keeps. See
 * `system/README.md` for the import graph and the evidence that nothing here reaches the network.
 *
 * **Reading the submitted values from `FormData`, not from controlled state, is the load-bearing
 * decision.** A controlled `Input` needs a signal or a `useState` holding the password on every
 * keystroke, which is one more place the value sits in memory than the native input already gives
 * it for free. Reading `new FormData(form)` inside the submit handler takes the value from the
 * input's own `value` at the one moment it is needed and puts it nowhere else — never a URL, never
 * a log line, never an attribute, never `localStorage`. It is also what makes the no-JavaScript
 * path and the hydrated path the same code path: a browser building its own `FormData` for a real
 * POST reads the same fields this handler reads.
 *
 * **`action` is how the form still posts when the bundle has not loaded.** Before hydration
 * nothing here has run, so a visitor's Enter or a tap on Submit is a native form submission to
 * `action` — this is the progressive-enhancement contract `system/README.md` documents for
 * `ImageLightbox` and `Calendar`'s link mode, applied to a form. Once hydrated, the submit handler
 * calls `event.preventDefault()` and the matching callback instead, *provided the caller supplied
 * one* — a caller that only wants the native post even after hydration can leave the callback out
 * and the browser submits for it. **`method` is always `"post"`, unconditionally, and there is no
 * `method` prop to override it.** A GET submission puts every field's value — the password
 * included — in the address bar, browser history and every access log the request passes through,
 * and that risk is not confined to a caller who typed `method="get"` on purpose: a card with
 * callbacks and no `action`, the ordinary shape of a hydrated app, has no `method` attribute at all
 * without an unconditional default, and a browser reads a form with no `method` as GET. A visitor
 * who submits before the bundle has run — the gap between the page painting and hydration finishing,
 * or JavaScript off entirely — sends the password into the URL. There is no spelling of `method`
 * left to reject, because there is nothing left for a caller to spell.
 *
 * **The one-time-code step moves the focus to its field**, and nowhere else does this component
 * take focus on its own initiative — the same rule `Calendar` follows for the one focus move it
 * makes without a key press behind it (`system/README.md`, "It never takes the focus from
 * somewhere the reader chose"). Whether a reader reaches the code step by a real round trip through
 * an app's server or by a caller flipping `step` in a demo, the effect fires on the same
 * transition, `step` becoming `"one-time-code"`, and on no other render.
 *
 * **The error live region is in the page before there is anything to announce**, the same pattern
 * `SWUpdater` and `Combobox` use and `system/README.md`'s "A live region is always present and
 * empty" section states as a library-wide rule: an element that arrives already carrying its first
 * message is commonly not announced at all, because assistive technology announces a *change* to a
 * region it is already watching. `error` normalises to a message and an optional field name
 * ({@link AuthFormError}); the message always reaches the always-present region, and when it names
 * a field, that field's own `Field` also receives it, which is what links the message to the
 * control with `aria-describedby` and marks it `aria-invalid` — two different jobs, so both
 * happen. A plain string is accepted too, for the ordinary case of an error that is not about one
 * field more than another.
 *
 * **A field-named error is therefore read out twice by some assistive technology**: once from the
 * assertive `role="alert"` region, and again from `Field`'s own `aria-live="polite"` paragraph
 * under the control. This is accepted rather than avoided. The two regions do different jobs — the
 * always-present one is what makes the error announced promptly no matter where focus is, and
 * `Field`'s own paragraph is what a sighted reader sees printed next to the control and what
 * `aria-describedby` points a screen reader at when it later visits the field — and `Field` offers
 * no way to keep the second without its own live paragraph. A message heard twice is a milder cost
 * than a message a reader who tabs to the field later never hears at all, which is what dropping
 * either region would risk.
 *
 * **`login` and `password` reach the callback exactly as typed.** Neither is trimmed, cased or
 * otherwise normalised — `new FormData(form)` hands back the input's raw string, unchanged, and
 * this component passes it straight through. A login with leading whitespace or a password that is
 * meaningfully whitespace-sensitive both survive; normalising either is a decision an app's own
 * auth code is better placed to make, with the rules of the account store behind it, than a
 * component that has never seen that store.
 *
 * **`Field`'s `required` does not yet put `required` on the control it wraps** (#116), so every
 * field here passes `required` to both: to `Field`, for the visible `*`, and to the `Input`
 * directly, for the native constraint validation a password manager and a browser's own "please
 * fill this in" both rely on.
 *
 * **The show/hide control is a real, named button, not a click zone on an icon.** It never submits
 * — `type="button"` — and it reports whether the password is showing through `aria-pressed` rather
 * than through its own changing label alone, and it moves the focus to itself on activation so a
 * keyboard user does not have to find it again after the toggle re-renders.
 *
 * **`mode` and `step` are string unions, matching every other prop union in this library**
 * (`ButtonVariant`, `CalendarDayReason`) rather than a TypeScript `enum`. An `enum` earns its place
 * in this codebase for a value that is internal bookkeeping and never crosses a serialisation
 * boundary — `BlockOutcome` in the browser-check harness, `ValidationType` in `crud/`. `mode` and
 * `step` are the opposite: a caller's server hands one back after a real round trip, so the value
 * has to survive JSON without a second lookup table translating an integer back into a string, the
 * way a caller of `ButtonVariant` or `CalendarDayReason` already expects.
 */

import { cn } from "@spy4x/preact-cn"
import { IconEye, IconEyeOff } from "@spy4x/preact-icons"
import { Button } from "@spy4x/preact-ui/button"
import { Field } from "@spy4x/preact-ui/field"
import { Input } from "@spy4x/preact-ui/input"
import type { JSX } from "preact"
import { useEffect, useId, useRef, useState } from "preact/hooks"

/** Which screen {@link AuthForm} draws. */
export type AuthMode = "sign-in" | "sign-up"

/** Which step of a mode {@link AuthForm} draws. */
export type AuthStep = "credentials" | "one-time-code"

/** What a credentials submit hands back. */
export interface AuthCredentials {
  login: string
  password: string
}

/** Which field one {@link AuthFormError} names, when it names one. */
export type AuthFormErrorField = "login" | "password" | "code"

/**
 * One error {@link AuthForm} shows.
 *
 * `field` is optional on purpose: most auth errors — a wrong password, a network the app could not
 * reach, a locked account — are not more about one field than the other, so `AuthForm` also accepts
 * a plain `string` for that ordinary case. Name a field only for an error that really is about one,
 * an unregistered login say, where linking the message to that one control is worth the extra
 * `aria-describedby`/`aria-invalid` wiring.
 */
export interface AuthFormError {
  /** Announced in the always-present live region. */
  message: string
  /** The one control this message is about, if any. */
  field?: AuthFormErrorField
}

/** Copy {@link AuthForm} renders. Override per key through the `labels` prop. */
export interface AuthFormLabels {
  /** Label of the login/username field. */
  login: string
  /** Label of the password field. */
  password: string
  /** Label of the one-time-code field. */
  code: string
  /** Hint shown under the one-time-code field. */
  codeHint: string
  /** Accessible name of the eye-icon toggle while the password is hidden. */
  showPassword: string
  /** Accessible name of the same toggle while the password is showing. */
  hidePassword: string
  /** Submit button in sign-in mode. */
  signIn: string
  /** Submit button in sign-up mode. */
  signUp: string
  /** Submit button on the one-time-code step. */
  submitCode: string
  /** Mode-switch control, shown in sign-in mode. */
  switchToSignUp: string
  /** Mode-switch control, shown in sign-up mode. */
  switchToSignIn: string
  /** Announced, off-screen, while `busy` is true. */
  busy: string
}

const defaultLabels: AuthFormLabels = {
  login: "Email or username",
  password: "Password",
  code: "One-time code",
  codeHint: "Enter the code you were sent.",
  showPassword: "Show password",
  hidePassword: "Hide password",
  signIn: "Sign in",
  signUp: "Sign up",
  submitCode: "Verify code",
  switchToSignUp: "Need an account? Sign up",
  switchToSignIn: "Have an account? Sign in",
  busy: "Working…",
}

export interface AuthFormProps {
  /** Which screen to draw. */
  mode: AuthMode
  /** Called when the reader picks the mode-switch control. Omit it to hide that control. */
  onModeChange?: (mode: AuthMode) => void
  /** Which step of `mode` to draw. */
  step: AuthStep
  /**
   * Called on a credentials submit while `mode` is `"sign-in"`. Omitted, the credentials step
   * still renders and still posts natively to `action` when one is given.
   */
  onSignIn?: (credentials: AuthCredentials) => void
  /** Called on a credentials submit while `mode` is `"sign-up"`. Same fallback as `onSignIn`. */
  onSignUp?: (credentials: AuthCredentials) => void
  /** Called on a one-time-code submit. Same fallback as `onSignIn`. */
  onOneTimeCode?: (code: string) => void
  /**
   * Disables the submit button and announces `labels.busy`. A submit received while this is true —
   * including one started with `form.requestSubmit()` — calls no callback.
   */
  busy?: boolean
  /** The error to show, if any. A plain string is a form-level message; see {@link AuthFormError}. */
  error?: string | AuthFormError | null
  /** Copy overrides. */
  labels?: Partial<AuthFormLabels>
  /** Where the form posts natively before hydration, or when the matching callback is omitted. */
  action?: string
  /** Utilities for the `<form>` itself. */
  class?: string
}

/** Reduce the `error` prop to one shape, or `null` for nothing to show. */
function normalizeError(error: AuthFormProps["error"]): AuthFormError | null {
  if (error === undefined || error === null) return null
  if (typeof error === "string") return error.length > 0 ? { message: error } : null
  return error.message.length > 0 ? error : null
}

/**
 * Sign-in, sign-up and a one-time-code step, drawn from props and reported through callbacks.
 *
 * See this module's own doc comment for the decisions behind the `FormData` read, the live
 * region, the focus move and the unconditional `method="post"` — they are the whole of what makes
 * this component safe to hand a password to.
 */
export function AuthForm(
  {
    mode,
    onModeChange,
    step,
    onSignIn,
    onSignUp,
    onOneTimeCode,
    busy = false,
    error,
    labels,
    action,
    class: className,
  }: AuthFormProps,
): JSX.Element {
  const copy = { ...defaultLabels, ...labels }
  const problem = normalizeError(error)
  const baseId = useId()
  const loginId = `${baseId}-login`
  const passwordId = `${baseId}-password`
  const codeId = `${baseId}-code`

  const [showPassword, setShowPassword] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  // The one focus move this component makes on its own initiative, and only on this one
  // transition — see the module doc for why that mirrors `Calendar`'s own rule.
  useEffect(() => {
    if (step === "one-time-code") codeRef.current?.focus()
  }, [step])

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    // Checked before anything else, and before either branch below picks a callback: a busy
    // submit — however it was started, including `form.requestSubmit()` — calls nothing.
    if (busy) {
      event.preventDefault()
      return
    }

    const form = event.currentTarget

    if (step === "one-time-code") {
      if (!onOneTimeCode) return // No callback: let the native post to `action` proceed.
      event.preventDefault()
      onOneTimeCode(String(new FormData(form).get("code") ?? ""))
      return
    }

    const submit = mode === "sign-in" ? onSignIn : onSignUp
    if (!submit) return // No callback: let the native post to `action` proceed.
    event.preventDefault()
    const data = new FormData(form)
    submit({
      login: String(data.get("login") ?? ""),
      password: String(data.get("password") ?? ""),
    })
  }

  const formLabel = step === "one-time-code"
    ? copy.submitCode
    : mode === "sign-in"
    ? copy.signIn
    : copy.signUp

  return (
    // `method` is a literal, not a variable: there is no prop feeding it, so a plain-JS caller who
    // passes one anyway has nowhere to put it — it is never destructured, so it is never spread
    // onto this element either.
    <form
      action={action}
      method="post"
      onSubmit={handleSubmit}
      aria-label={formLabel}
      class={cn("space-y-4", className)}
    >
      {
        /* Always in the page, empty until there is something to say — see this module's doc and
           system/README.md's "A live region is always present and empty". */
      }
      <div role="alert" aria-live="assertive" aria-atomic="true">
        {problem && <p class="text-sm text-red-700 dark:text-red-300">{problem.message}</p>}
      </div>

      {step === "credentials"
        ? (
          <>
            <Field
              id={loginId}
              label={copy.login}
              required
              error={problem?.field === "login" ? problem.message : undefined}
            >
              <Input name="login" autocomplete="username" required />
            </Field>
            <Field
              id={passwordId}
              label={copy.password}
              required
              error={problem?.field === "password" ? problem.message : undefined}
            >
              {(wiring) => (
                <div class="relative">
                  <Input
                    id={wiring.id}
                    aria-describedby={wiring["aria-describedby"]}
                    aria-invalid={problem?.field === "password" ? true : undefined}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autocomplete={mode === "sign-up" ? "new-password" : "current-password"}
                    required
                    class="pr-12"
                  />
                  {
                    /* An icon-only toggle, 32 px square at 4 px from the edge, so the field's
                      `pr-12` (48 px) keeps a shown password clear of it; a word-sized button
                      needed more room than any step on the spacing scale. */
                  }
                  <Button
                    type="button"
                    variant="icon"
                    size="sm"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                    class="absolute top-1/2 right-1 -translate-y-1/2"
                    onClick={(event) => {
                      // Keeps the toggle itself the Tab stop after the type swap re-renders it,
                      // rather than leaving the browser's own click-focus behaviour to decide —
                      // that behaviour is not the same in every engine.
                      event.currentTarget.focus()
                      setShowPassword((value) => !value)
                    }}
                  >
                    {showPassword ? <IconEyeOff class="size-5" /> : <IconEye class="size-5" />}
                  </Button>
                </div>
              )}
            </Field>
            <div class="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {mode === "sign-in" ? copy.signIn : copy.signUp}
              </Button>
              {onModeChange && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onModeChange(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {mode === "sign-in" ? copy.switchToSignUp : copy.switchToSignIn}
                </Button>
              )}
            </div>
          </>
        )
        : (
          <>
            <Field
              id={codeId}
              label={copy.code}
              hint={copy.codeHint}
              required
              error={problem?.field === "code" ? problem.message : undefined}
            >
              {(wiring) => (
                <Input
                  ref={codeRef}
                  id={wiring.id}
                  aria-describedby={wiring["aria-describedby"]}
                  aria-invalid={problem?.field === "code" ? true : undefined}
                  name="code"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                />
              )}
            </Field>
            <Button type="submit" disabled={busy}>{copy.submitCode}</Button>
          </>
        )}

      <p role="status" aria-live="polite" aria-atomic="true" class="sr-only">
        {busy ? copy.busy : ""}
      </p>
    </form>
  )
}
