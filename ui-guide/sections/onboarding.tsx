/**
 * The `ui/` onboarding pieces. Spread into the Feedback section, after `Toastr`.
 *
 * What only a browser shows — the next step's action and Dismiss reachable by Tab, focus staying in
 * the footer as steps complete (a button, then a link), focus moving to the heading when a step has
 * no action, and the Dismiss port firing — is driven by
 * `pages/checks/ui.ts`.
 */

import { Button, Cluster, OnboardingChecklist, type OnboardingStep, Stack } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { useEffect, useRef } from "preact/hooks"
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
  const hidden = useSignal(false)
  const showAgain = useRef<HTMLButtonElement>(null)
  const markDone = (id: string) => done.value = new Set([...done.value, id])

  // The card is gone after Dismiss, so the app moves focus: here, to the button that brings it back.
  useEffect(() => {
    if (hidden.value) showAgain.current?.focus()
  }, [hidden.value])

  const steps: OnboardingStep[] = STEPS.map(({ id, title, description, kind }) => ({
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

  return (
    <Stack>
      {hidden.value
        ? (
          <Button
            ref={showAgain}
            variant="secondary"
            data-e2e="onboarding-show-again"
            onClick={() => {
              done.value = startingDone()
              hidden.value = false
            }}
          >
            Show the checklist again
          </Button>
        )
        : (
          <OnboardingChecklist
            steps={steps}
            description="A few steps to a working team space."
            onDismiss={() => {
              dismissed.value++
              hidden.value = true
            }}
          />
        )}
      <Cluster>
        <Button
          variant="outline"
          size="sm"
          data-e2e="onboarding-confirm-email"
          disabled={hidden.value || done.value.has("verify")}
          onClick={() => markDone("verify")}
        >
          Pretend the e-mail link was opened
        </Button>
      </Cluster>
      <DemoNote e2e="onboarding-dismissed">onDismiss calls: {dismissed.value}.</DemoNote>
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
} satisfies DemoFragment
