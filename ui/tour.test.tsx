import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Tour, type TourStep } from "./tour.tsx"

const noop = () => {}

const steps: TourStep[] = [
  { id: "search", target: "#search", title: "Search", body: "Find anything." },
  { id: "new", target: "#new", title: "Create" },
  { id: "help", target: "#help", title: "Help" },
]

/** The text of every button, in order. */
function buttons(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((match) => match[1])
}

describe("Tour", () => {
  it("shows the step at index, with the step count, Skip and Next but no Back on the first", () => {
    const html = render(
      <Tour steps={steps} open index={0} onIndexChange={noop} onClose={noop} />,
    )
    expect(html).toContain(">Search</h2>")
    expect(html).toContain("Find anything.")
    expect(html).toContain("Step 1 of 3")
    expect(buttons(html)).toEqual(["Skip tour", "Next"])
  })

  it("offers Back after the first step and Done instead of Next on the last", () => {
    expect(
      buttons(render(<Tour steps={steps} open index={1} onIndexChange={noop} onClose={noop} />)),
    )
      .toEqual(["Skip tour", "Back", "Next"])
    const last = render(<Tour steps={steps} open index={2} onIndexChange={noop} onClose={noop} />)
    expect(last).toContain("Step 3 of 3")
    expect(buttons(last)).toEqual(["Skip tour", "Back", "Done"])
  })

  it("takes every visible label from a prop", () => {
    const html = render(
      <Tour
        steps={steps}
        open
        index={2}
        onIndexChange={noop}
        onClose={noop}
        backLabel="Zurück"
        skipLabel="Überspringen"
        doneLabel="Fertig"
        closeLabel="Schließen"
        stepLabel={(step, total) => `Schritt ${step} von ${total}`}
      />,
    )
    expect(buttons(html)).toEqual(["Überspringen", "Zurück", "Fertig"])
    expect(html).toContain("Schritt 3 von 3")
    expect(html).toContain(`aria-label="Schließen"`)
    const next = render(
      <Tour steps={steps} open index={0} onIndexChange={noop} onClose={noop} nextLabel="Weiter" />,
    )
    expect(buttons(next)).toEqual(["Skip tour", "Weiter"])
  })
})
