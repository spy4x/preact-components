import { cn } from "@preact-components/cn"
import type { ComponentChildren, JSX } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"

/**
 * Where one {@link EnhancedForm} is in its submit cycle.
 *
 * `"idle"` covers both "never submitted" and "submitted natively", since a native submit navigates
 * the page away and takes this state with it — there is nothing left here to be in any other status
 * about. The other three only exist once `onSubmit` has taken over the submit.
 */
export type EnhancedFormStatus = "idle" | "sending" | "done" | "failed"

/** Copy {@link EnhancedForm} announces. Override per key through the `labels` prop. */
export interface EnhancedFormLabels {
  /** Announced while a background submit is in flight. */
  sending: string
  /** Announced once a background submit resolves. */
  done: string
  /** Announced once a background submit rejects, or its promise throws. */
  failed: string
}

const defaultLabels: EnhancedFormLabels = {
  sending: "Sending…",
  done: "Sent.",
  failed: "Something went wrong. Please try again.",
}

/**
 * The live region's text for one status — the one piece of {@link EnhancedForm}'s behaviour a
 * render-to-string test can assert directly, since the status it runs against never leaves
 * `"idle"` without an effect or an event `preact-render-to-string` does not run.
 *
 * @param status Current {@link EnhancedFormStatus}.
 * @param labels Resolved copy — defaults already merged with any override.
 * @returns The message, or `""` for `"idle"`, which is what keeps the region empty until there is
 * something to say.
 */
export function enhancedFormMessage(
  status: EnhancedFormStatus,
  labels: EnhancedFormLabels,
): string {
  switch (status) {
    case "sending":
      return labels.sending
    case "done":
      return labels.done
    case "failed":
      return labels.failed
    default:
      return ""
  }
}

export interface EnhancedFormProps {
  /**
   * Where the plain `<form>` posts. Optional the same way {@link EnhancedFormProps.onSubmit} is:
   * a caller that only wants the background path can leave it out, and a caller that only wants
   * the native one supplies it and no `onSubmit`. Never defaulted by this component — an endpoint
   * is always the caller's to name.
   */
  action?: string
  /**
   * Defaults to `"post"`. A caller with nothing but a search box to submit may still ask for
   * `"get"`; nothing here defaults to it, because a GET puts every field's value in the address bar,
   * browser history and every access log the request passes through, and that is the wrong default
   * for a form whose fields are not yet known to this component.
   */
  method?: "get" | "post"
  /**
   * Submits the form's data in the background once hydrated, instead of letting the browser post
   * natively. Omit it to always let the native post to `action` proceed, hydrated or not — the same
   * fallback {@link https://github.com/spy4x/preact-components/blob/main/system/auth-form.tsx AuthForm}
   * uses for a callback-less step.
   *
   * A rejected promise, and a synchronous throw, both resolve to `"failed"` — the sending state
   * always ends, whichever way this callback fails.
   */
  onSubmit?: (data: FormData) => Promise<void> | void
  /** The form's fields. Rendered inside a `<fieldset>` this component disables while sending. */
  children: ComponentChildren
  /** Replaces `children` while a background submit is in flight. Omit it to keep `children` on
   * screen, disabled, so the visitor still sees what they typed. */
  sending?: ComponentChildren
  /** Replaces `children` once a background submit resolves. */
  done?: ComponentChildren
  /** Replaces `children` once a background submit rejects. Omit it to keep `children` on screen,
   * re-enabled, so the visitor can retry without losing what they typed. */
  failed?: ComponentChildren
  /** Copy overrides. */
  labels?: Partial<EnhancedFormLabels>
  /** Utilities for the `<form>` itself. */
  class?: string
}

/**
 * A real `<form>` that posts on its own, and gets nicer once JavaScript has run.
 *
 * **Before hydration, or whenever `onSubmit` is left out, this is an ordinary form.** Nothing in
 * this component prevents the browser's own submission, so a visitor without the bundle — the gap
 * between the page painting and hydration finishing, or JavaScript off entirely — gets the same
 * request a server-rendered `<form action method>` always sent. `method` defaults to `"post"`
 * unconditionally, the same decision {@link https://github.com/spy4x/preact-components/blob/main/system/auth-form.tsx AuthForm}
 * makes for the same reason: a form with callbacks and no method prop has no `method` attribute at
 * all without a default, and a browser reads that as GET — putting every field's value in the
 * address bar, browser history and every access log the request passes through, for a visitor who
 * submitted before the bundle ran.
 *
 * **Once hydrated, a submit calls `onSubmit` instead, and the page stays.** `event.preventDefault()`
 * only fires when `onSubmit` is given — the same "no callback, let the native post proceed" rule
 * every other progressively-enhanced form in this library follows. While the returned promise is
 * outstanding, `children` sits inside a disabled `<fieldset>` (or `sending` replaces it, when given),
 * so a second click on the submit button does nothing to the browser's own controls; a
 * `form.requestSubmit()` called from outside the disabled button is still blocked, by a ref this
 * component checks before either branch below runs. **The sending state always ends**: a resolved
 * promise moves to `"done"`, a rejected one — or a synchronous throw — to `"failed"`, and the
 * `pageshow` listener resets a stale `"sending"` to `"idle"` when the browser restores this page
 * from its back/forward cache, where the promise that was supposed to settle it never will.
 *
 * **The result is announced through one region, present and empty from the first render.** The same
 * rule `Toastr` and `AuthForm` follow: assistive technology announces a *change* to a region it is
 * already watching, and commonly says nothing about one that arrives already carrying its message.
 * One `role="status"` region rather than `AuthForm`'s assertive/polite pair — a marketing form's
 * failure does not need to interrupt the way a rejected sign-in does, so a single polite region
 * carries all three states here.
 */
export function EnhancedForm(
  {
    action,
    method = "post",
    onSubmit,
    children,
    sending,
    done,
    failed,
    labels,
    class: className,
  }: EnhancedFormProps,
): JSX.Element {
  const copy = { ...defaultLabels, ...labels }
  const [status, setStatus] = useState<EnhancedFormStatus>("idle")
  // Checked synchronously, before either branch of `handleSubmit` runs, so two submits that arrive
  // in the same tick — a fast double click, or a `requestSubmit()` racing the disabled button — both
  // see the flag the first one set, however far the `useState` update above has (or has not) been
  // applied yet.
  const busyRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // A page restored from the back/forward cache is the same JS heap this component was already
    // running in — nothing remounts, so a `"sending"` left over from before the visitor navigated
    // away stays `"sending"` forever unless something resets it. The promise that would have settled
    // it belonged to the page that was frozen, and it is never coming back.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      busyRef.current = false
      setStatus("idle")
    }
    globalThis.addEventListener("pageshow", onPageShow)
    return () => globalThis.removeEventListener("pageshow", onPageShow)
  }, [])

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    if (busyRef.current) {
      event.preventDefault()
      return
    }
    if (!onSubmit) return // No callback: let the native post to `action` proceed.
    event.preventDefault()

    const data = new FormData(event.currentTarget)
    busyRef.current = true
    setStatus("sending")

    // `Promise.resolve().then(...)` folds a synchronous throw from `onSubmit` into the same
    // `"failed"` path a rejected promise takes, rather than letting it escape this handler.
    Promise.resolve()
      .then(() => onSubmit(data))
      .then(() => {
        busyRef.current = false
        if (mountedRef.current) setStatus("done")
      })
      .catch(() => {
        busyRef.current = false
        if (mountedRef.current) setStatus("failed")
      })
  }

  const message = enhancedFormMessage(status, copy)

  const slot = status === "sending" && sending !== undefined
    ? sending
    : status === "done" && done !== undefined
    ? done
    : status === "failed" && failed !== undefined
    ? failed
    : (
      <fieldset disabled={status === "sending"} class="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
    )

  return (
    <form
      action={action}
      method={method}
      onSubmit={handleSubmit}
      class={cn("space-y-4", className)}
    >
      {slot}
      {
        /* Always in the page, empty until there is something to say — see this component's own
           doc, and `system/README.md`'s "A live region is always present and empty". */
      }
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="text-sm text-gray-600 dark:text-gray-400"
      >
        {message}
      </p>
    </form>
  )
}
