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
 * from its back/forward cache, where the promise that was supposed to settle it never will. That
 * reset also retires the outstanding submit's own id, so if its promise settles later anyway — a
 * network response arriving after the visitor has already navigated back and possibly submitted
 * again — the stale `.then`/`.catch` below finds its id no longer current and does nothing, rather
 * than overwriting whatever the *next* submit is in the middle of doing.
 *
 * **The result is announced through one region, present and empty from the first render.** The same
 * rule `Toastr` and `AuthForm` follow: assistive technology announces a *change* to a region it is
 * already watching, and commonly says nothing about one that arrives already carrying its message.
 * One `role="status"` region rather than `AuthForm`'s assertive/polite pair — a marketing form's
 * failure does not need to interrupt the way a rejected sign-in does, so a single polite region
 * carries all three states here.
 *
 * **The slot sits inside its own wrapper, so it can never be the region.** Preact's unkeyed child
 * diffing does not match old and new children position-by-position when a type changes at that
 * position — it searches the whole sibling list for the first *old* node of the *new* node's type.
 * Both the region and a text-carrying `done`/`failed` slot render a `<p>`, so with the slot's `<p>`
 * a direct sibling of the region's, Preact found the region's own `<p>` as the closest match for
 * the slot's incoming one on success, patched the region's *existing, already-being-watched*
 * element into the slot's content, and created a *new* `<p role="status">` for the region at the
 * position the slot vacated — a node that reaches the document already holding its message, which
 * is exactly what an always-present region exists to avoid: a live region created together with
 * its first message is commonly never announced, because assistive technology announces a change
 * to a region it is already watching, not a new subtree. The wrapper's own type never turns over —
 * it is always a `<div>`, whatever the slot renders inside it — so it is never a candidate match
 * for the region's `<p>` at all; giving the region a `key` of its own was tried too and made no
 * difference once the wrapper was in place, so it was not kept as a second mechanism doing nothing.
 *
 * **The region hides itself from sighted users whenever the current status has a slot of its own on
 * screen at all — not only when that slot's own copy happens to match the region's.** Repeating
 * "Sent." once as the visible replacement for the fields and a second time immediately under it
 * reads as a mistake, not a confirmation, and `NewsletterForm` and `ContactForm` both hand
 * `EnhancedForm` a `done` slot whose copy is the region's own default; a caller whose slot says
 * something entirely different still gets the plainer, cheaper rule, rather than this component
 * comparing rendered text to decide. The always-present element is what makes the announcement
 * reliable, so it never stops rendering — only `sr-only` while a slot is on screen for the same
 * status, which keeps the announcement and removes the duplicate line where one would otherwise
 * appear. A status with no slot of its own (the default disabled-`<fieldset>` behaviour, or
 * `ContactForm`'s un-slotted `"failed"`) still needs the region to carry the message visibly, since
 * nothing else on screen does.
 *
 * **Focus moves to the region only when it was inside this form the moment the visitor submitted,
 * and the control they used is gone — and only the first time that happens for a given submit.**
 * The first condition is read off `event.currentTarget.contains(document.activeElement)` inside the
 * submit handler, before anything async happens: a real click or keypress on the submit button
 * leaves focus there, but `form.requestSubmit()` called from outside the form — or a submit that
 * started while focus was already elsewhere — does not, and there is no visitor to give focus back
 * to in either case. A submit nobody focused, or one whose visitor was already reading elsewhere, or
 * already working in the browser's own UI, where `document.activeElement` also reads as `<body>`,
 * never has this component reach for its focus at all.
 *
 * Once that first condition holds, disabling the `<fieldset>` — which happens as soon as the status
 * reaches `"sending"`, well before `done` or `failed` — takes the focused submit button out of the
 * page's focus order entirely, which a browser resolves by dropping focus to `<body>`; that is the
 * one situation this component recovers from, moving focus to the region (`tabIndex={-1}`, so it can
 * hold focus without joining the tab order) and, in the same breath, clearing the flag that let it
 * happen. Clearing it is what keeps a visitor who has since clicked on plain text — which also lands
 * focus on `<body>` — and moved on to reading something else from being pulled back to this form
 * a second time, once the same submit later reaches `done` or `failed`: without that, the effect
 * would see the flag still set on that later run too, "recovering" focus a visitor had already,
 * deliberately, put somewhere else.
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
  const regionRef = useRef<HTMLParagraphElement>(null)
  // Identifies one submit's own promise chain, so a settlement that arrives after a newer submit
  // started — or after a `pageshow` reset gave up on it — can tell it is stale and do nothing. See
  // this component's own doc for why a `.then`/`.catch` needs this at all.
  const submitIdRef = useRef(0)
  // Whether focus was inside *this* form the moment the current submit started — a real click or
  // keypress on the submit button leaves focus there, but `form.requestSubmit()` called from
  // outside it, or a submit that started while the visitor's focus was already elsewhere, does not.
  // Read by the focus-restoring effect below, which must never move focus for a visitor who was
  // never engaging with this form's own controls in the first place.
  const focusInFormAtSubmitRef = useRef(false)

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
    // it belonged to the page that was frozen, and it is never coming back — and bumping the id here
    // is what keeps it from being mistaken for a still-current one if it settles anyway.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      submitIdRef.current++
      busyRef.current = false
      setStatus("idle")
    }
    globalThis.addEventListener("pageshow", onPageShow)
    return () => globalThis.removeEventListener("pageshow", onPageShow)
  }, [])

  useEffect(() => {
    if (status === "idle") return
    // Two conditions, both required. Focus must have been inside this form when the visitor
    // submitted — otherwise there is no visitor here to give focus back to, and moving it anyway is
    // theft from whatever they were actually doing (reading another part of the page, working in
    // the browser's own UI) when this unrelated submit happened to settle. And focus must still be
    // on <body> right now — a visitor who tabbed to a specific control on purpose, inside or outside
    // this form, is left exactly there.
    if (!focusInFormAtSubmitRef.current) return
    if (globalThis.document?.activeElement === globalThis.document?.body) {
      regionRef.current?.focus()
      // A one-time recovery, not a standing claim on the visitor's focus for the rest of this
      // submit's lifecycle. This effect re-runs on the *next* status change too — disabling the
      // fieldset for "sending" already drops focus to <body> in this browser, so the region is
      // recovered there, before the same submit ever reaches "done" or "failed" — and without
      // clearing the flag here, that second run would see it still set and pull focus back again
      // for a visitor who has, in between, deliberately clicked on plain text (landing on <body>
      // exactly the way disabling a control does) and scrolled away to read something else.
      focusInFormAtSubmitRef.current = false
    }
  }, [status])

  const handleSubmit = (event: JSX.TargetedEvent<HTMLFormElement, SubmitEvent>) => {
    if (busyRef.current) {
      event.preventDefault()
      return
    }
    if (!onSubmit) return // No callback: let the native post to `action` proceed.
    event.preventDefault()

    focusInFormAtSubmitRef.current = event.currentTarget.contains(
      globalThis.document?.activeElement ?? null,
    )

    const data = new FormData(event.currentTarget)
    busyRef.current = true
    setStatus("sending")
    const id = ++submitIdRef.current

    // `Promise.resolve().then(...)` folds a synchronous throw from `onSubmit` into the same
    // `"failed"` path a rejected promise takes, rather than letting it escape this handler.
    Promise.resolve()
      .then(() => onSubmit(data))
      .then(() => {
        if (submitIdRef.current !== id) return // Superseded by a newer submit or a pageshow reset.
        busyRef.current = false
        if (mountedRef.current) setStatus("done")
      })
      .catch(() => {
        if (submitIdRef.current !== id) return
        busyRef.current = false
        if (mountedRef.current) setStatus("failed")
      })
  }

  const message = enhancedFormMessage(status, copy)

  const activeSlot = status === "sending" && sending !== undefined
    ? sending
    : status === "done" && done !== undefined
    ? done
    : status === "failed" && failed !== undefined
    ? failed
    : undefined

  const slot = activeSlot !== undefined ? activeSlot : (
    <fieldset disabled={status === "sending"} class="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  )

  // The region stops repeating a result a visible slot already shows in view — see this
  // component's own doc — but only while that slot is actually the one on screen.
  const regionHidden = activeSlot !== undefined

  return (
    <form
      action={action}
      method={method}
      onSubmit={handleSubmit}
      class={cn("space-y-4", className)}
    >
      <div>{slot}</div>
      {
        /* Always in the page, empty until there is something to say — see this component's own
           doc, and `system/README.md`'s "A live region is always present and empty". The slot's
           own wrapper above is load-bearing: see this component's own doc for why an unwrapped
           slot can end up reusing this exact node for its own content instead. */
      }
      <p
        ref={regionRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        tabIndex={-1}
        class={cn(
          "text-sm text-gray-600 outline-none dark:text-gray-400",
          regionHidden && "sr-only",
        )}
      >
        {message}
      </p>
    </form>
  )
}
