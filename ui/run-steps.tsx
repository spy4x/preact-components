import { cn } from "@spy4x/preact-cn"
import {
  IconCheckCircle,
  IconExclamationCircle,
  IconMinus,
  IconSpinner,
  IconStopCircle,
} from "@spy4x/preact-icons"
import type { ComponentChildren, JSX } from "preact"
import { useId } from "preact/hooks"
import { Badge } from "./badge.tsx"
import { Progress } from "./progress.tsx"
import { useLabels } from "./i18n.tsx"

/** Where a step of a run stands. */
export type RunStepState = "pending" | "running" | "done" | "failed" | "unavailable" | "stopped"

/** One step of a {@link RunSteps} list. */
export interface RunStep {
  /** Stable id, unique within the list. */
  id: string
  /** What the step does or measures: "Download the group". */
  label: string
  /** Where the step stands. */
  state: RunStepState
  /** One muted line under the label, such as the budget the step is held to. */
  hint?: ComponentChildren
  /** The step's result, already formatted: "1.2 s". Shown once the step is done. */
  value?: string
  /** A verdict on the value, as a word in a badge beside it: "Within budget". */
  verdict?: { label: string; tone: "success" | "danger" }
  /** Progress inside a running step, as a bar under the label with its own caption. */
  progress?: { value: number; max: number; label: string }
  /** One more muted line under the label, such as why the step failed or was not available. */
  detail?: ComponentChildren
}

/** The word each state shows in the value's place, until a done step has its value. */
export type RunStepsLabels = Record<RunStepState, string>

/** What {@link RunSteps} takes. */
export interface RunStepsProps {
  /** The steps, in the order they run. The list keeps every row from start to end. */
  steps: readonly RunStep[]
  /** The state words. Defaults: Not started, Running, Done, Failed, Not available, Stopped. */
  labels?: Partial<RunStepsLabels>
  /** Names the list, such as the id of the heading above it. */
  "aria-labelledby"?: string
  /** Extra utilities for the list. */
  class?: string
}

const RUN_STEPS_LABELS: RunStepsLabels = {
  pending: "Not started",
  running: "Running",
  done: "Done",
  failed: "Failed",
  unavailable: "Not available",
  stopped: "Stopped",
}

/** The mark before each step: its state by shape, so colour never carries it alone. */
function StateMark({ state }: { state: RunStepState }): JSX.Element {
  switch (state) {
    case "done":
      return <IconCheckCircle class="size-5 shrink-0 text-success" />
    case "running":
      return <IconSpinner class="size-5 shrink-0 text-primary" />
    case "failed":
      return <IconExclamationCircle class="size-5 shrink-0 text-danger" />
    case "stopped":
      return <IconStopCircle class="size-5 shrink-0 text-muted" />
    case "unavailable":
      return <IconMinus class="size-5 shrink-0 text-muted" />
    default:
      return (
        <span class="size-5 shrink-0 rounded-full border-2 border-control" aria-hidden="true" />
      )
  }
}

/** One row: mark, label with its lines, then the value and the verdict. */
function RunStepRow({ step, labels }: { step: RunStep; labels: RunStepsLabels }): JSX.Element {
  const progressId = useId()
  const shown = step.state === "done" && step.value !== undefined ? step.value : labels[step.state]
  return (
    <li
      class="col-span-full grid grid-cols-subgrid items-start py-3"
      aria-current={step.state === "running" ? "step" : undefined}
      data-state={step.state}
    >
      <StateMark state={step.state} />
      <div class="flex min-w-0 flex-col gap-1">
        <span class="text-sm font-medium break-words text-foreground">{step.label}</span>
        {step.hint !== undefined && <span class="text-sm text-muted">{step.hint}</span>}
        {step.state === "running" && step.progress && (
          <Progress
            id={progressId}
            label={step.progress.label}
            value={step.progress.value}
            max={step.progress.max}
            showValue={false}
          />
        )}
        {step.detail !== undefined && <span class="text-sm text-muted">{step.detail}</span>}
      </div>
      {/* Stacked under each other on a phone; from `sm` the value and the badge are columns. */}
      <div class="flex flex-col items-end gap-1 sm:contents">
        <span
          class={cn(
            "pc-num text-end text-sm",
            step.state === "done"
              ? "font-medium text-foreground"
              : step.state === "failed"
              ? "font-medium text-danger"
              : "text-muted",
          )}
        >
          {shown}
        </span>
        {step.state === "done" && step.verdict && (
          <Badge
            text={step.verdict.label}
            color={step.verdict.tone === "success" ? "green" : "red"}
            type="outline"
          />
        )}
      </div>
    </li>
  )
}

/**
 * A fixed list of the steps of a run, such as a benchmark or an import, each with its state, a hint,
 * and once done its value and a verdict.
 *
 * The rows never change in number or order while the run goes on, so the layout does not shift:
 * a step only fills in. A running step carries `aria-current="step"` and may show a progress bar
 * under its label. On a phone the value sits on the label's line with its badge under it; from
 * `sm` the values form one right-aligned column of tabular figures and the badges another.
 *
 * The list announces nothing: a run's page owns one polite live region for its step changes.
 *
 * @param props See {@link RunStepsProps}.
 */
export function RunSteps(
  { steps, labels: labelsProp, "aria-labelledby": labelledBy, class: className }: RunStepsProps,
): JSX.Element {
  const labels = useLabels("RunSteps", RUN_STEPS_LABELS, labelsProp)
  return (
    <ol
      aria-labelledby={labelledBy}
      class={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 divide-y divide-subtle",
        "sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
        className,
      )}
    >
      {steps.map((step) => <RunStepRow key={step.id} step={step} labels={labels} />)}
    </ol>
  )
}
