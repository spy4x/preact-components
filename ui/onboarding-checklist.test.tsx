import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { OnboardingChecklist, type OnboardingStep } from "./onboarding-checklist.tsx"

const noop = () => {}

const steps: OnboardingStep[] = [
  { id: "profile", title: "Fill in your profile", done: true },
  { id: "bank", title: "Connect your bank", done: true },
  {
    id: "budget",
    title: "Set a budget",
    description: "Pick a monthly limit.",
    done: false,
    action: { label: "Set a budget", onClick: noop },
  },
  {
    id: "invite",
    title: "Invite a teammate",
    done: false,
    action: { label: "Invite", onClick: noop },
  },
]

/** The footer's markup, after the card body. */
function footerOf(html: string): string {
  return html.split(`class="pc-card-footer`)[1] ?? ""
}

describe("OnboardingChecklist", () => {
  it("names its region by its heading, which defaults to Get started and can take focus", () => {
    const html = render(<OnboardingChecklist steps={steps} />)
    const labelledBy = html.match(/role="region" aria-labelledby="([^"]+)"/)?.[1]
    expect(labelledBy).toBeDefined()
    expect(html).toContain(
      `<h2 id="${labelledBy}" tabindex="-1" class="text-lg font-semibold">Get started</h2>`,
    )
  })

  it("counts done steps in the progress bar's caption and value", () => {
    const html = render(<OnboardingChecklist steps={steps} />)
    expect(html).toContain(">2 of 4 done</span>")
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="2"[^>]*aria-valuemax="4"/)
  })

  it("marks the first open step as current, not a later one", () => {
    const html = render(<OnboardingChecklist steps={steps} />)
    expect(html.match(/aria-current="step"/g)?.length).toBe(1)
    expect(html).toMatch(/<li [^>]*aria-current="step"[^>]*>(?:(?!<\/li>).)*Set a budget/)
  })

  it("sets the next step apart by a dot inside its ring, not by colour alone", () => {
    const html = render(<OnboardingChecklist steps={steps} />)
    expect(html.match(/<span class="size-2 rounded-full bg-primary"><\/span>/g)?.length).toBe(1)
    expect(html).toMatch(/aria-current="step"><span [^>]*><span class="size-2 rounded-full/)
  })

  it("offers only the next open step's action as the footer's one button", () => {
    const footer = footerOf(render(<OnboardingChecklist steps={steps} />))
    expect(footer.match(/<button /g)?.length).toBe(1)
    expect(footer).toContain(">Set a budget</button>")
    expect(footer).not.toContain("Invite")
  })

  it("renders a step's link action as a real link", () => {
    const linked = steps.map((step) =>
      step.id === "budget"
        ? { ...step, action: { label: "Set a budget", href: "/budgets/new" } }
        : step
    )
    const footer = footerOf(render(<OnboardingChecklist steps={linked} />))
    expect(footer).toMatch(/<a [^>]*href="\/budgets\/new"[^>]*>Set a budget<\/a>/)
  })

  it("tells a screen reader which steps are done and which are to do", () => {
    const html = render(<OnboardingChecklist steps={steps} />)
    expect(html).toContain(`<span class="sr-only">Done: </span>Connect your bank`)
    expect(html).toContain(`<span class="sr-only">To do: </span>Invite a teammate`)
  })

  it("shows a step's description only while it is open", () => {
    const done = steps.map((step) => ({ ...step, description: `Why ${step.id}` }))
    const html = render(<OnboardingChecklist steps={done} />)
    expect(html).not.toContain("Why bank")
    expect(html).toContain("Why budget")
  })

  it("draws Dismiss only when the app passes onDismiss", () => {
    expect(render(<OnboardingChecklist steps={steps} />)).not.toContain("Dismiss")
    expect(render(<OnboardingChecklist steps={steps} onDismiss={noop} />)).toMatch(
      /<button [^>]*>Dismiss<\/button>/,
    )
  })

  it("turns the primary action into Finish and announces the message once every step is done", () => {
    const allDone = steps.map((step) => ({ ...step, done: true }))
    const html = render(<OnboardingChecklist steps={allDone} onDismiss={noop} />)
    expect(footerOf(html)).toMatch(/<button [^>]*>Finish<\/button>/)
    expect(html).toMatch(/<p role="status"[^>]*>All done. You're set up.<\/p>/)
    expect(html).not.toContain(`aria-current="step"`)
  })

  it("keeps the status region empty while steps remain, so its message is announced on arrival", () => {
    expect(render(<OnboardingChecklist steps={steps} />)).toMatch(/<p role="status"[^>]*><\/p>/)
  })

  it("draws no footer when the next step has no action and nothing is left to finish", () => {
    const bare = steps.map((step) => ({ ...step, action: undefined }))
    expect(render(<OnboardingChecklist steps={bare} />)).not.toContain("pc-card-footer")
  })

  it("takes every visible string from its props", () => {
    const allDone = steps.map((step) => ({ ...step, done: true }))
    const open = render(
      <OnboardingChecklist steps={steps} todoLabel="À faire" doneLabel="Fait" />,
    )
    expect(open).toContain(`<span class="sr-only">À faire: </span>Invite a teammate`)
    expect(open).not.toContain("To do: ")
    const html = render(
      <OnboardingChecklist
        steps={allDone}
        title="Premiers pas"
        headingLevel={3}
        onDismiss={noop}
        dismissLabel="Masquer"
        finishLabel="Terminer"
        progressLabel={(done, total) => `${done} sur ${total}`}
        doneLabel="Fait"
        todoLabel="À faire"
        completeMessage="Tout est prêt."
      />,
    )
    for (const text of ["Premiers pas</h3>", "Masquer", "Terminer", "4 sur 4", "Fait: ", "Tout"]) {
      expect(html).toContain(text)
    }
    expect(html).not.toMatch(/Get started|Dismiss|Finish|of 4 done|Done: |set up/)
  })
})
