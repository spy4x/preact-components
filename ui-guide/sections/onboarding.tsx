/**
 * The `ui/` onboarding pieces. Spread into the Feedback section, after `Toastr`.
 *
 * What only a browser shows — the next step's action and Dismiss reachable by Tab, focus staying in
 * the footer as steps complete (a button, then a link), focus moving to the heading when a step has
 * no action, and the Dismiss port firing — is driven by
 * `pages/checks/ui.ts`. The demo keeps its state in `createOnboardingState` from
 * `@spy4x/preact-signals`, so those checks also load a page that uses it.
 *
 * The `Tour` and `Coachmark` demos are driven there and by `pages/e2e/ui.spec.ts`: where each sits,
 * the bottom sheet, focus on open, on Next, on Go to and on close, the target's own
 * `aria-describedby` coming back, Escape inside the demo's `Modal` closing only the dialog, and the
 * last step pointing at whichever Help button is shown. The specs also cover the checklist's
 * `headingRef`: Show again puts focus on the heading.
 */

import {
  Button,
  Cluster,
  Coachmark,
  type CoachmarkPlacement,
  Input,
  Modal,
  OnboardingChecklist,
  type OnboardingStep,
  Select,
  Stack,
  Tour,
  type TourStep,
} from "@spy4x/preact-ui"
import { useComputed, useSignal } from "@preact/signals"
import { createOnboardingState } from "@spy4x/preact-signals/onboarding"
import { useEffect, useMemo, useRef } from "preact/hooks"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** How a demo step is done: by its own button, by its link, or by the app's data alone. */
type DemoActionKind = "button" | "link" | "none"

/** The demo's steps, which of them start done, and what kind of action each offers. */
const STEPS: readonly {
  id: string
  title: string
  description: string
  startsDone: boolean
  kind: DemoActionKind
}[] = [
  {
    id: "profile",
    title: "Fill in your profile",
    description: "Add your name and photo.",
    startsDone: true,
    kind: "button",
  },
  {
    id: "project",
    title: "Create a project",
    description: "Projects hold your tasks.",
    startsDone: true,
    kind: "button",
  },
  {
    id: "invite",
    title: "Invite a teammate",
    description: "Work is easier with two.",
    startsDone: false,
    kind: "button",
  },
  {
    id: "notify",
    title: "Turn on notifications",
    description: "A link to the settings page.",
    startsDone: false,
    kind: "link",
  },
  {
    id: "verify",
    title: "Confirm your e-mail",
    description: "Done when you open the link we sent; there is nothing to press here.",
    startsDone: false,
    kind: "none",
  },
  {
    id: "import",
    title: "Import your data",
    description: "Bring in what you already have.",
    startsDone: false,
    kind: "button",
  },
]

/** The ids of the steps the demo starts with done. */
function startingDone(): Set<string> {
  return new Set(STEPS.filter((step) => step.startsDone).map((step) => step.id))
}

function OnboardingChecklistDemo() {
  const done = useSignal(startingDone())
  const dismissed = useSignal(0)
  const showAgain = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  /** Whether Show again was pressed while it had focus, so focus is the demo's to move on. */
  const returning = useRef(false)
  const markDone = (id: string) => done.value = new Set([...done.value, id])

  const steps = useComputed<OnboardingStep[]>(() =>
    STEPS.map(({ id, title, description, kind }) => ({
      id,
      title,
      description,
      done: done.value.has(id),
      action: kind === "button"
        ? { label: title, onClick: () => markDone(id) }
        : kind === "link"
        ? { label: title, href: `#${id}`, navigate: () => markDone(id) }
        : undefined,
    }))
  )
  // The dismissed flag lives in memory here; an app keeps it in `localStorage` or a user setting.
  const onboarding = useMemo(
    () => createOnboardingState({ steps, dismissed: { read: () => false, write: () => {} } }),
    [],
  )
  const hidden = !onboarding.visible.value

  // The card is gone after Dismiss, so the app moves focus: here, to the button that brings it back.
  // Back again, the button that had focus is gone: the app moves focus to the card's heading,
  // through `headingRef`.
  useEffect(() => {
    if (hidden) showAgain.current?.focus()
    else if (returning.current) heading.current?.focus()
    returning.current = false
  }, [hidden])

  return (
    <Stack>
      {hidden
        ? (
          <Button
            ref={showAgain}
            variant="secondary"
            data-e2e="onboarding-show-again"
            onClick={() => {
              returning.current = document.activeElement === showAgain.current
              done.value = startingDone()
              onboarding.reset()
            }}
          >
            Show the checklist again
          </Button>
        )
        : (
          <OnboardingChecklist
            steps={steps.value}
            headingRef={heading}
            description="A few steps to a working team space."
            onDismiss={() => {
              dismissed.value++
              onboarding.dismiss()
            }}
          />
        )}
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="onboarding-confirm-email"
          disabled={hidden || done.value.has("verify")}
          onClick={() => markDone("verify")}
        >
          Pretend the e-mail link was opened
        </Button>
      </Cluster>
      <DemoNote e2e="onboarding-dismissed">onDismiss calls: {dismissed.value}.</DemoNote>
    </Stack>
  )
}

/**
 * The tour's steps. The third names an element the page does not have, so it shows as a sheet. The
 * last one's selector matches both Help buttons, and the step points at the one that is shown.
 */
const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "search",
    target: `[data-e2e="tour-search"]`,
    title: "Search everything",
    body: "Type a name to find a project, a person or a file.",
  },
  {
    id: "new",
    target: `[data-e2e="tour-new"]`,
    title: "Start a project",
    body: "This opens a dialog. Press Escape there: it closes the dialog, not the tour.",
    placement: "right",
  },
  {
    id: "missing",
    target: `[data-e2e="tour-missing"]`,
    title: "A step with no target",
    body: "Its target is not on the page, so the step is a sheet along the bottom edge.",
  },
  {
    id: "help",
    target: `[data-tour="help"]`,
    title: "Ask for help",
    body: "The last step: Done ends the tour.",
    placement: "top",
  },
]

function TourDemo() {
  const open = useSignal(false)
  const index = useSignal(0)
  const closed = useSignal("nothing yet")
  const dialog = useSignal(false)

  return (
    <Stack>
      <Cluster>
        <Button
          data-e2e="tour-start"
          onClick={() => {
            index.value = 0
            open.value = true
          }}
        >
          Start the tour
        </Button>
      </Cluster>
      <Cluster>
        <div class="w-56">
          {/* The app's own description, which the tour hands back, and anchor name, which it leaves. */}
          <Input
            data-e2e="tour-search"
            aria-label="Search"
            aria-describedby="tour-search-hint"
            placeholder="Search"
            style="anchor-name: --demo-search"
          />
        </div>
        <Button variant="secondary" data-e2e="tour-new" onClick={() => dialog.value = true}>
          New project
        </Button>
        {/* One control drawn twice, as an app draws its navigation for a wide and a narrow screen. */}
        <span class="hidden md:inline">
          <Button variant="ghost" data-e2e="tour-help" data-tour="help">Help</Button>
        </span>
        <span class="md:hidden">
          <Button variant="ghost" data-e2e="tour-help-compact" data-tour="help">Help</Button>
        </span>
      </Cluster>
      <DemoNote>
        <span id="tour-search-hint">Search looks through every project.</span>
      </DemoNote>
      <DemoNote e2e="tour-closed">onClose last said: {closed.value}.</DemoNote>
      <Tour
        steps={TOUR_STEPS}
        open={open.value}
        index={index.value}
        onIndexChange={(next) => index.value = next}
        onClose={(reason) => {
          closed.value = reason
          open.value = false
        }}
      />
      {dialog.value && (
        <Modal
          open
          title="New project"
          cancelLabel="Close"
          dataE2E="tour-modal"
          onClose={() => {
            dialog.value = false
          }}
        >
          <p class="text-sm text-muted">
            Escape closes this dialog and leaves the tour where it is.
          </p>
        </Modal>
      )}
    </Stack>
  )
}

/** The sides the `Coachmark` demo offers, in the order of its `Select`. */
const COACHMARK_SIDES: readonly CoachmarkPlacement[] = ["right", "bottom", "left", "top"]

function CoachmarkDemo() {
  const open = useSignal(false)
  const placement = useSignal<CoachmarkPlacement>("right")
  const target = useRef<HTMLDivElement>(null)

  return (
    <Stack>
      <Cluster>
        <Button variant="secondary" data-e2e="coachmark-toggle" onClick={() => open.value = true}>
          Show the hint
        </Button>
        {/* Not focusable, so Go to adds a tabindex and takes it away again on close. */}
        <div
          ref={target}
          class="rounded-md border border-subtle px-3 py-2 text-sm"
          data-e2e="coachmark-target"
        >
          Exports this month: 12
        </div>
        <Select
          class="w-auto"
          aria-label="Side of the target"
          data-e2e="coachmark-placement"
          value={placement.value}
          options={COACHMARK_SIDES.map((side) => ({ value: side, label: side }))}
          onChange={(event) => {
            placement.value = event.currentTarget.value as CoachmarkPlacement
          }}
        />
      </Cluster>
      <Coachmark
        open={open.value}
        target={target}
        title="New: export to CSV"
        placement={placement.value}
        onClose={() => {
          open.value = false
        }}
      >
        Download every row as a spreadsheet.
      </Coachmark>
    </Stack>
  )
}

export const onboardingDemos = {
  OnboardingChecklist: {
    summary:
      "A card of first steps for a new user, with progress, the next step's action and Dismiss.",
    wide: false,
    props: [
      {
        name: "steps",
        type: "{ id, title, description?, done, action? }[]",
        description: "The steps in order; `done` comes from the app's own data.",
      },
      {
        name: "onDismiss",
        type: "() => void",
        description: "Hides the checklist; without it the card has no Dismiss.",
      },
      { name: "title", type: "string", default: `"Get started"`, description: "The heading." },
      {
        name: "headingRef",
        type: "RefObject<HTMLHeadingElement>",
        description: "Points at the heading, so the app can move focus to the card.",
      },
      {
        name: "progressLabel",
        type: "(done: number, total: number) => string",
        default: "`${done} of ${total} done`",
        description: "The progress caption.",
      },
      {
        name: "finishLabel",
        type: "string",
        default: `"Finish"`,
        description: "The primary button once every step is done; it calls `onDismiss`.",
      },
    ],
    snippet: `<OnboardingChecklist
  steps={[
    { id: "profile", title: "Fill in your profile", done: user.hasProfile },
    {
      id: "invite",
      title: "Invite a teammate",
      description: "Work is easier with two.",
      done: members.length > 1,
      action: { label: "Invite a teammate", onClick: openInvite },
    },
    {
      id: "project",
      title: "Create a project",
      done: projects.length > 0,
      action: { label: "Create a project", href: "/projects/new", navigate },
    },
  ]}
  onDismiss={() => settings.hideOnboarding()}
/>`,
    render: () => <OnboardingChecklistDemo />,
  },
  Tour: {
    summary:
      "A guided tour: one hint at a time beside the control it explains, with Back, Next and Skip.",
    wide: false,
    props: [
      {
        name: "steps",
        type: "{ id, target, title, body?, placement? }[]",
        description:
          "The stops in order; `target` is a ref, or a CSS selector, which names its first " +
          "visible match.",
      },
      { name: "open", type: "boolean", description: "Whether the tour is shown. The app owns it." },
      {
        name: "index",
        type: "number",
        description: "The step shown. The app owns it, so it can move the tour on by itself.",
      },
      {
        name: "onIndexChange",
        type: "(next: number) => void",
        description: "Called by Next and Back.",
      },
      {
        name: "onClose",
        type: `(reason: "done" | "skip" | "escape") => void`,
        description: "Called by Done, Skip, × and Escape; the app sets `open` to `false`.",
      },
      { name: "nextLabel", type: "string", default: `"Next"`, description: "Next's label." },
      { name: "backLabel", type: "string", default: `"Back"`, description: "Back's label." },
      { name: "skipLabel", type: "string", default: `"Skip tour"`, description: "Skip's label." },
      {
        name: "doneLabel",
        type: "string",
        default: `"Done"`,
        description: "The last step's primary button.",
      },
      {
        name: "stepLabel",
        type: "(step: number, total: number) => string",
        default: "`Step ${step} of ${total}`",
        description: "The step count.",
      },
      {
        name: "closeLabel",
        type: "string",
        default: `"Close"`,
        description: "The × button's accessible name.",
      },
      {
        name: "goToLabel",
        type: "(targetName: string) => string",
        default: "`Go to ${targetName}`",
        description: "The button that moves focus to the step's target.",
      },
    ],
    snippet: `const open = useSignal(false)
const index = useSignal(0)

<Tour
  steps={[
    { id: "search", target: "#search", title: "Search everything", body: "Find anything." },
    { id: "new", target: newButton, title: "Start a project", placement: "right" },
  ]}
  open={open.value}
  index={index.value}
  onIndexChange={(next) => index.value = next}
  onClose={() => open.value = false}
/>`,
    render: () => <TourDemo />,
  },
  Coachmark: {
    summary: "One hint anchored to one control, for a new feature; Tour is a list of them.",
    wide: false,
    props: [
      { name: "open", type: "boolean", description: "Whether it is shown. The app owns it." },
      {
        name: "target",
        type: "string | RefObject<HTMLElement>",
        description:
          "The control it points at: a ref, or a CSS selector, which names its first visible match.",
      },
      { name: "title", type: "string", description: "The heading, which also names it." },
      {
        name: "children",
        type: "ComponentChildren",
        description: "The text; it describes the target.",
      },
      {
        name: "placement",
        type: `"top" | "right" | "bottom" | "left"`,
        default: `"bottom"`,
        description:
          "The side of the target; it flips when there is no room and stays inside the window.",
      },
      {
        name: "onClose",
        type: `(reason: "escape" | "close") => void`,
        description: "Called on Escape and on ×.",
      },
      {
        name: "closeLabel",
        type: "string",
        default: `"Close"`,
        description: "The × button's accessible name.",
      },
      {
        name: "goToLabel",
        type: "(targetName: string) => string",
        default: "`Go to ${targetName}`",
        description: "The button that moves focus to the target.",
      },
      { name: "footer", type: "ComponentChildren", description: "Controls of the app's own." },
      {
        name: "describedBy",
        type: "string",
        description: "Ids of more elements that describe the dialog, after its text.",
      },
    ],
    snippet: `<Coachmark
  open={showHint.value}
  target={exportButton}
  title="New: export to CSV"
  placement="right"
  onClose={() => showHint.value = false}
>
  Download every row as a spreadsheet.
</Coachmark>`,
    render: () => <CoachmarkDemo />,
  },
} satisfies DemoFragment
