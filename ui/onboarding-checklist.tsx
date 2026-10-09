import { cn } from "@spy4x/preact-cn"
import { IconCheckCircle } from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useId, useLayoutEffect, useRef } from "preact/hooks"
import { Button } from "./button.tsx"
import { Card, CardBody, CardFooter, CardHeader } from "./card.tsx"
import { Progress } from "./progress.tsx"

/** A step's action that runs in place, such as opening a dialog. */
export interface OnboardingStepButton {
  /** The button's text, such as "Invite a teammate". */
  label: string
  /** Called on a press. The app marks the step done itself, through {@link OnboardingStep.done}. */
  onClick: () => void
  href?: never
  navigate?: never
}

/** A step's action that goes to another page, such as the form that creates a first project. */
export interface OnboardingStepLink {
  /** The link's text, such as "Create a project". */
  label: string
  /** Where the link goes. A real `href`, so it works before any script runs. */
  href: string
  /** The app's router, given a plain left click on the link. Left out, the browser navigates. */
  navigate?: (href: string) => void
  onClick?: never
}

/** What a step offers to get it done: a button, or a link. */
export type OnboardingStepAction = OnboardingStepButton | OnboardingStepLink

/** One step of an {@link OnboardingChecklist}. */
export interface OnboardingStep {
  /** Stable id, unique within the list. */
  id: string
  /** What to do, as a short imperative: "Connect your bank". */
  title: string
  /** One line on why or how, shown while the step is open. */
  description?: ComponentChildren
  /** Whether the step is done. The app decides this; the checklist only shows it. */
  done: boolean
  /** The step's action, offered as the card's primary action while this is the next open step. */
  action?: OnboardingStepAction
}

/** What {@link OnboardingChecklist} takes. */
export interface OnboardingChecklistProps {
  /** The steps, in the order a new user should take them. */
  steps: readonly OnboardingStep[]
  /** The card's heading. Defaults to `"Get started"`. */
  title?: string
  /** Level of the heading. Defaults to `2`. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** One line under the heading. */
  description?: ComponentChildren
  /**
   * Hides the checklist for good. Left out, the card offers no way to close it. The app stores the
   * choice wherever it likes, stops rendering the card, and moves focus somewhere sensible, since
   * the control that had it is gone.
   */
  onDismiss?: () => void
  /** The Dismiss button's text. Defaults to `"Dismiss"`. */
  dismissLabel?: string
  /** The primary button once every step is done; it calls `onDismiss`. Defaults to `"Finish"`. */
  finishLabel?: string
  /** The progress caption. Defaults to `"2 of 4 done"`. */
  progressLabel?: (done: number, total: number) => string
  /** Read before a done step's title by a screen reader. Defaults to `"Done"`. */
  doneLabel?: string
  /** Read before an open step's title by a screen reader. Defaults to `"To do"`. */
  todoLabel?: string
  /** Shown and announced once every step is done. Defaults to `"All done. You're set up."` */
  completeMessage?: ComponentChildren
  /** Extra utilities for the card. */
  class?: string
}

/** The default progress caption: `"2 of 4 done"`. */
function defaultProgressLabel(done: number, total: number): string {
  return `${done} of ${total} done`
}

/**
 * A card of first steps for a new user: each step with its state, a progress bar, the next open
 * step's action as the card's one primary button, and Dismiss.
 *
 * Completion comes from the app. The checklist stores nothing: it reads `done` off each step, so a
 * step ticks itself off when the app's own data says it happened, and Dismiss is a port the app
 * persists. The next open step is the first one, in order, that is not done; it carries
 * `aria-current="step"`.
 *
 * Focus survives progress. The primary action is one control in the footer that changes its text
 * and its target from step to step, rather than a button inside each step's row. While consecutive
 * actions are buttons it is the same element, so focus simply stays on it. When the control has to
 * change element — a button followed by a link — an effect moves focus to the new control, and
 * when the footer goes away — the next step has no action, or every step is done and there is no
 * `onDismiss` — it moves focus to the card's heading. Either move happens only when the footer's
 * focused control was itself removed; once the user has moved focus elsewhere, or clicked empty
 * space, a later step change leaves focus alone. Once every step is done the control becomes
 * Finish, which calls `onDismiss`, and a status region announces `completeMessage`.
 *
 * @param props See {@link OnboardingChecklistProps}.
 */
export function OnboardingChecklist(
  {
    steps,
    title = "Get started",
    headingLevel = 2,
    description,
    onDismiss,
    dismissLabel = "Dismiss",
    finishLabel = "Finish",
    progressLabel = defaultProgressLabel,
    doneLabel = "Done",
    todoLabel = "To do",
    completeMessage = "All done. You're set up.",
    class: className,
  }: OnboardingChecklistProps,
): JSX.Element {
  const headingId = useId()
  const progressId = useId()
  const doneCount = steps.filter((step) => step.done).length
  const next = steps.find((step) => !step.done)
  const allDone = next === undefined
  const Heading = `h${headingLevel}` as "h2"
  const action = next?.action
  const headingRef = useRef<HTMLHeadingElement>(null)
  /** The footer's control as of the last render, or `null` when there was no footer. */
  const lastControl = useRef<Element | null>(null)
  /** Whether focus was last inside the footer. */
  const footerHadFocus = useRef(false)

  // No dependency array: the footer's control can change on any render. A focused element that
  // leaves the DOM drops focus on the page body, so when that happened to the footer's control,
  // hand focus to its replacement, or to the heading when the footer is gone.
  useLayoutEffect(() => {
    const card = headingRef.current?.closest('[role="region"]')
    const control = card?.querySelector("[data-onboarding-footer] > *") ?? null
    const previous = lastControl.current
    lastControl.current = control
    if (previous === null || previous === control || !footerHadFocus.current) return
    const active = document.activeElement
    if (active !== null && active !== document.body && active.isConnected) return
    if (control instanceof HTMLElement) {
      control.focus()
    } else {
      footerHadFocus.current = false
      headingRef.current?.focus()
    }
  })

  return (
    <Card class={className} role="region" aria-labelledby={headingId}>
      <CardHeader>
        <Heading id={headingId} ref={headingRef} tabIndex={-1} class="text-lg font-semibold">
          {title}
        </Heading>
        {onDismiss && <Button variant="ghost" size="sm" onClick={onDismiss}>{dismissLabel}</Button>}
      </CardHeader>
      <CardBody class="flex flex-col gap-4">
        {description && <p class="text-sm text-muted">{description}</p>}
        <Progress
          id={progressId}
          label={progressLabel(doneCount, steps.length)}
          value={doneCount}
          max={steps.length}
          showValue={false}
          tone={allDone ? "success" : "primary"}
        />
        {/* The status region is always in the page, so the message is announced when it arrives. */}
        <div>
          <ol class="flex flex-col gap-3">
            {steps.map((step) => (
              <li
                key={step.id}
                class="flex items-start gap-3"
                aria-current={step === next ? "step" : undefined}
              >
                {step.done
                  ? <IconCheckCircle class="size-5 text-success" aria-hidden="true" />
                  : step === next
                  ? (
                    // A dot inside the ring, so the next step stands out by shape, not colour alone.
                    <span
                      class="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
                      aria-hidden="true"
                    >
                      <span class="size-2 rounded-full bg-primary" />
                    </span>
                  )
                  : (
                    <span
                      class="size-5 shrink-0 rounded-full border-2 border-control"
                      aria-hidden="true"
                    />
                  )}
                <div class="flex min-w-0 flex-col gap-1">
                  <span
                    class={cn(
                      "text-sm",
                      step.done ? "text-muted line-through" : "font-medium text-foreground",
                    )}
                  >
                    <span class="sr-only">{`${step.done ? doneLabel : todoLabel}: `}</span>
                    {step.title}
                  </span>
                  {!step.done && step.description && (
                    <p class="text-sm text-muted">{step.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p role="status" class={cn("text-sm font-medium text-foreground", allDone && "pt-3")}>
            {allDone ? completeMessage : null}
          </p>
        </div>
      </CardBody>
      {(action || (allDone && onDismiss)) && (
        <CardFooter
          class="justify-end"
          data-onboarding-footer=""
          onFocusIn={() => footerHadFocus.current = true}
          onFocusOut={(event) => {
            if (event.relatedTarget !== null) {
              footerHadFocus.current = false
              return
            }
            // No new target: either the control was removed while focused, or the user clicked
            // empty space. Only a removed control has left the page, so a microtask later the
            // flag is kept for removal alone, and the effect above hands focus on only then.
            const left = event.target as Element
            queueMicrotask(() => {
              if (left.isConnected) footerHadFocus.current = false
            })
          }}
        >
          {action?.href !== undefined
            ? <Button href={action.href} navigate={action.navigate}>{action.label}</Button>
            : action
            ? <Button onClick={action.onClick}>{action.label}</Button>
            : <Button onClick={onDismiss}>{finishLabel}</Button>}
        </CardFooter>
      )}
    </Card>
  )
}
