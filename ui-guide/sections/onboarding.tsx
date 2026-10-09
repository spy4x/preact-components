/**
 * The `ui/` onboarding pieces. Spread into the Feedback section, after `Toastr`.
 *
 * What only a browser shows — the next step's action and Dismiss reachable by Tab, focus staying on
 * the primary button as steps complete, and the Dismiss port firing — is driven by
 * `pages/checks/ui.ts`.
 */

import { Button, OnboardingChecklist, type OnboardingStep, Stack } from "@spy4x/preact-ui"
import { useSignal } from "@preact/signals"
import { DemoNote } from "./demo-note.tsx"
import type { DemoFragment } from "../registry.ts"

/** The demo's steps and which of them start done. */
const STEPS: readonly { id: string; title: string; description: string; startsDone: boolean }[] = [
  {
    id: "profile",
    title: "Fill in your profile",
    description: "Add your name and photo.",
    startsDone: true,
  },
  {
    id: "project",
    title: "Create a project",
    description: "Projects hold your tasks.",
    startsDone: true,
  },
  {
    id: "invite",
    title: "Invite a teammate",
    description: "Work is easier with two.",
    startsDone: false,
  },
  {
    id: "notify",
    title: "Turn on notifications",
    description: "Hear about changes as they happen.",
    startsDone: false,
  },
]

function OnboardingChecklistDemo() {
  const done = useSignal(new Set(STEPS.filter((step) => step.startsDone).map((step) => step.id)))
  const dismissed = useSignal(0)
  const hidden = useSignal(false)

  const steps: OnboardingStep[] = STEPS.map(({ id, title, description }) => ({
    id,
    title,
    description,
    done: done.value.has(id),
    action: { label: title, onClick: () => done.value = new Set([...done.value, id]) },
  }))

  return (
    <Stack>
      {hidden.value
        ? (
          <Button
            variant="secondary"
            data-e2e="onboarding-show-again"
            onClick={() => {
              done.value = new Set(STEPS.filter((step) => step.startsDone).map((step) => step.id))
              hidden.value = false
            }}
          >
            Show the checklist again
          </Button>
        )
        : (
          <OnboardingChecklist
            steps={steps}
            description="Four steps to a working team space."
            onDismiss={() => {
              dismissed.value++
              hidden.value = true
            }}
          />
        )}
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
