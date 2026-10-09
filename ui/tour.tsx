import type { ComponentChildren, JSX } from "preact"
import { Button } from "./button.tsx"
import { Coachmark, type CoachmarkPlacement, type CoachmarkTarget } from "./coachmark.tsx"

/** One stop of a {@link Tour}. */
export interface TourStep {
  /** The step's id, unique in the tour. */
  id: string
  /** The element the step points at: a CSS selector, or a ref the app holds. */
  target: CoachmarkTarget
  /** The step's heading. */
  title: string
  /** The step's text. */
  body?: ComponentChildren
  /** Side of the target to sit on. Defaults to `"bottom"`. */
  placement?: CoachmarkPlacement
}

/** Why a tour asked to close: Done on the last step, Skip or × on any step, or Escape. */
export type TourCloseReason = "done" | "skip" | "escape"

export interface TourProps {
  /** The steps in order. */
  steps: readonly TourStep[]
  /** Whether the tour is shown. The app owns it. */
  open: boolean
  /** The index of the step shown. The app owns it, so it can move the tour on by itself. */
  index: number
  /** Called by Next and Back with the index to show. */
  onIndexChange: (next: number) => void
  /** Called by Done, Skip, × and Escape. The app sets `open` to `false`. */
  onClose: (reason: TourCloseReason) => void
  /** Next's label. Defaults to `"Next"`. */
  nextLabel?: string
  /** Back's label. Defaults to `"Back"`. */
  backLabel?: string
  /** Skip's label. Defaults to `"Skip tour"`. */
  skipLabel?: string
  /** The last step's primary button. Defaults to `"Done"`. */
  doneLabel?: string
  /** The step count, given the 1-based step and the total. Defaults to `Step 2 of 5`. */
  stepLabel?: (step: number, total: number) => string
  /** The × button's accessible name. Defaults to `"Close"`. */
  closeLabel?: string
  /** The Go to button's label, given the target's name. See `Coachmark`. */
  goToLabel?: (targetName: string) => string
}

/**
 * A guided tour: one `Coachmark` for the step at `index`, with the step count, Skip, Back and Next
 * (Done on the last step). The app owns `open` and `index`, so it can also move the tour on when
 * the user does what a step asks. Each new step moves focus to its heading; closing hands focus
 * back to where it was when the tour opened. An `index` outside `steps` shows nothing.
 */
export function Tour(
  {
    steps,
    open,
    index,
    onIndexChange,
    onClose,
    nextLabel = "Next",
    backLabel = "Back",
    skipLabel = "Skip tour",
    doneLabel = "Done",
    stepLabel = (step, total) => `Step ${step} of ${total}`,
    closeLabel,
    goToLabel,
  }: TourProps,
): JSX.Element {
  const step = steps[index] as TourStep | undefined
  const last = index === steps.length - 1

  return (
    <Coachmark
      open={open && step !== undefined}
      target={step?.target ?? ""}
      title={step?.title ?? ""}
      placement={step?.placement}
      closeLabel={closeLabel}
      goToLabel={goToLabel}
      onClose={(reason) => onClose(reason === "escape" ? "escape" : "skip")}
      footer={
        <>
          <p class="mr-auto text-xs text-muted">{stepLabel(index + 1, steps.length)}</p>
          <Button variant="ghost" size="sm" onClick={() => onClose("skip")}>{skipLabel}</Button>
          {index > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onIndexChange(index - 1)}
            >
              {backLabel}
            </Button>
          )}
          {last
            ? <Button size="sm" onClick={() => onClose("done")}>{doneLabel}</Button>
            : <Button size="sm" onClick={() => onIndexChange(index + 1)}>{nextLabel}</Button>}
        </>
      }
    >
      {step?.body}
    </Coachmark>
  )
}
