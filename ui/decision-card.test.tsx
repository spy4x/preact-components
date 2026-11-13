import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { DecisionCard, type DecisionCardOption, type DecisionCardProps } from "./decision-card.tsx"

const OPTIONS: DecisionCardOption[] = [
  { id: "wait", label: "Wait a week" },
  { id: "ship", label: "Ship it now", description: "The fix goes out today.", recommended: true },
  { id: "drop", label: "Drop it" },
]

/** Renders a decision with the three options above, plus whatever `props` add or replace. */
function decision(props: Partial<DecisionCardProps> = {}): string {
  return render(
    <DecisionCard title="Ship the fix?" options={OPTIONS} onChoose={() => {}} {...props} />,
  )
}

/** Every `<button …>` opening tag, in document order. */
function buttonTags(html: string): string[] {
  return html.match(/<button[^>]*>/g) ?? []
}

/** The option buttons: the ones inside the options group, which holds no `<div>` of its own. */
function optionTags(html: string): string[] {
  const start = html.indexOf(`role="group"`)
  return buttonTags(html.slice(start, html.indexOf("</div>", start)))
}

/** The `class` attribute of an opening tag. */
function classOf(tag: string): string {
  return tag.match(/class="([^"]*)"/)?.[1] ?? ""
}

describe("DecisionCard", () => {
  it("draws the recommended option first, with the word Recommended in its text", () => {
    const html = decision()
    const ship = html.indexOf("Ship it now")
    expect(ship).toBeGreaterThan(-1)
    expect(ship).toBeLessThan(html.indexOf("Wait a week"))
    expect(html.indexOf("Wait a week")).toBeLessThan(html.indexOf("Drop it"))
    const recommended = html.indexOf(">Recommended<")
    expect(recommended).toBeGreaterThan(ship)
    expect(recommended).toBeLessThan(html.indexOf("Wait a week"))
  })

  it("gives every option the same classes and preselects none", () => {
    const tags = optionTags(decision())
    expect(tags.length).toBe(3)
    for (const tag of tags) {
      expect(classOf(tag)).toBe(classOf(tags[0]))
      expect(tag).not.toMatch(/aria-pressed|aria-checked|aria-current|autofocus/)
    }
  })

  it("numbers the first nine options 1 to 9 and gives a tenth no key", () => {
    const ten = Array.from({ length: 10 }, (_, index) => ({
      id: `o${index}`,
      label: `Option ${index}`,
    }))
    const tags = optionTags(decision({ options: ten }))
    expect(tags.length).toBe(10)
    tags.slice(0, 9).forEach((tag, index) => {
      expect(tag).toContain(`aria-keyshortcuts="${index + 1}"`)
    })
    expect(tags[9]).not.toContain("aria-keyshortcuts")
  })

  it("binds no key with hotkeys off", () => {
    const html = decision({ hotkeys: false, onDone: () => {} })
    expect(html).not.toContain("aria-keyshortcuts")
    expect(html).not.toContain("data-hotkey-hint")
  })

  it("renders the context as text, never as HTML", () => {
    const html = decision({ context: `<b>bold</b> & <script>alert(1)</script>` })
    expect(html).not.toContain("<b>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;b>bold&lt;/b> &amp; &lt;script>")
  })

  it("folds a context past 6 lines behind More", () => {
    const html = decision({ context: "1\n2\n3\n4\n5\n6\n7" })
    expect(html).toMatch(/<p[^>]*data-folded[^>]*class="[^"]*line-clamp-6/)
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+-context"/)
    expect(html).toContain(">More</button>")
  })

  it("shows no More toggle for a context of 6 lines", () => {
    const html = decision({ context: "1\n2\n3\n4\n5\n6" })
    expect(html).not.toContain(">More</button>")
    expect(html).not.toContain("aria-controls")
  })

  it("keeps the note behind a closed disclosure on a decision", () => {
    const html = decision({ onSend: () => {} })
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Add a note or your own answer/)
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain("Send own answer")
  })

  it("calls the disclosure Add a note on a decision without onSend", () => {
    expect(decision()).toMatch(/aria-expanded="false"[^>]*>Add a note<span/)
  })

  it("shows the answer field open on a question without options", () => {
    const html = render(<DecisionCard title="Which region?" onSend={() => {}} />)
    expect(html).toMatch(/<label[^>]*for="([^"]+)-note"[^>]*>Your answer<\/label>/)
    expect(html).toMatch(/<textarea[^>]*id="[^"]+-note"/)
    expect(html).not.toContain("Add a note")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Send answer/)
    expect(html).not.toContain(`role="group"`)
  })

  it("offers Mark done pressed with e, as the main action of a to-do", () => {
    const html = render(<DecisionCard title="Renew the domain" onDone={() => {}} />)
    const done = buttonTags(html).find((tag) => tag.includes(`aria-keyshortcuts="E"`))
    expect(done).toBeDefined()
    expect(classOf(done!)).toContain("bg-accent-900")
    expect(html).toContain("Mark done")
    expect(html).toMatch(/aria-expanded="false"[^>]*>Add a note/)
  })

  it("disables every action while pending", () => {
    const html = decision({ pending: true, onDone: () => {} })
    const actions = buttonTags(html).filter((tag) => !tag.includes("aria-expanded"))
    expect(actions.length).toBe(4)
    for (const tag of actions) expect(tag).toMatch(/\sdisabled(=""|\s|>)/)
  })

  it("draws the question as a focusable h2 by default, and at the level asked", () => {
    expect(decision()).toMatch(
      /<h2[^>]*id="[^"]+-title"[^>]*tabindex="-1"[^>]*>Ship the fix\?<\/h2>/,
    )
    expect(decision({ headingLevel: 1 })).toMatch(/<h1[^>]*>Ship the fix\?<\/h1>/)
    expect(decision()).toMatch(/<section aria-labelledby="([^"]+)-title"/)
  })

  it("shows the kind, the position, the meta line and the notice it is given", () => {
    const html = decision({
      kind: "Decision",
      position: "Decision 1 of 36",
      meta: "Asked by the release agent",
      notice: "Kept here only.",
    })
    for (const text of ["Decision 1 of 36", "Asked by the release agent", "Kept here only."]) {
      expect(html).toContain(text)
    }
    expect(html).toMatch(/<span[^>]*>Decision<\/span>/)
  })

  it("lets labels replace the English words", () => {
    const html = decision({
      context: "1\n2\n3\n4\n5\n6\n7",
      labels: { recommended: "Suggested", more: "Show all", addNote: "Note it" },
    })
    expect(html).toContain(">Suggested<")
    expect(html).toContain(">Show all</button>")
    expect(html).toContain(">Note it<")
  })

  it("throws for options without onChoose, and for a card with no action", () => {
    expect(() => render(<DecisionCard title="Ship?" options={OPTIONS} />)).toThrow("onChoose")
    expect(() => render(<DecisionCard title="Ship?" />)).toThrow("onSend")
  })
})
