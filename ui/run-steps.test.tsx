import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import en from "./i18n/en.ts"
import ru from "./i18n/ru.ts"
import { I18nContext } from "./i18n.tsx"
import { type RunStep, RunSteps } from "./run-steps.tsx"

const steps: RunStep[] = [
  {
    id: "download",
    label: "Download the group",
    state: "done",
    hint: "Budget: under 10 s",
    value: "2.4 s",
    verdict: { label: "Within budget", tone: "success" },
  },
  {
    id: "scroll",
    label: "Scroll the list",
    state: "done",
    value: "12% of frames dropped",
    verdict: { label: "Over budget", tone: "danger" },
  },
  {
    id: "save",
    label: "Save to this device",
    state: "running",
    progress: { value: 300, max: 1000, label: "300 of 1,000 notes" },
  },
  { id: "memory", label: "Memory used", state: "unavailable", detail: "Not reported here." },
  { id: "search", label: "Search", state: "failed", value: "9 ms" },
  { id: "filter", label: "Filter", state: "stopped" },
  { id: "clear", label: "Clear the copy", state: "pending" },
]

/** The markup of the row whose label is `label`. */
function rowOf(html: string, label: string): string {
  const row = html.split("<li ").find((part) => part.includes(`>${label}</span>`))
  if (row === undefined) throw new Error(`no row labelled ${label}`)
  return row.split("</li>")[0]
}

describe("RunSteps", () => {
  it("keeps one row per step, in order, whatever each step's state", () => {
    const html = render(<RunSteps steps={steps} />)
    expect(html.match(/<li /g)?.length).toBe(steps.length)
    expect([...html.matchAll(/data-state="([a-z]+)"/g)].map((match) => match[1])).toEqual(
      steps.map((step) => step.state),
    )
  })

  it("shows a done step's value and its verdict as a word, coloured by tone", () => {
    const html = render(<RunSteps steps={steps} />)
    const within = rowOf(html, "Download the group")
    expect(within).toContain(">2.4 s</span>")
    expect(within).toMatch(/border-green-800[^"]*">Within budget<\/span>/)
    expect(within).toContain("Budget: under 10 s")
    expect(rowOf(html, "Scroll the list")).toMatch(/border-red-700[^"]*">Over budget<\/span>/)
  })

  it("shows the state word, not a value or verdict, until a step is done", () => {
    const html = render(<RunSteps steps={steps} />)
    expect(rowOf(html, "Save to this device")).toContain(">Running</span>")
    expect(rowOf(html, "Memory used")).toContain(">Not available</span>")
    expect(rowOf(html, "Memory used")).toContain("Not reported here.")
    const failed = rowOf(html, "Search")
    expect(failed).toContain(">Failed</span>")
    expect(failed).not.toContain("9 ms")
    expect(rowOf(html, "Filter")).toContain(">Stopped</span>")
    expect(rowOf(html, "Clear the copy")).toContain(">Not started</span>")
  })

  it("marks only the running step as current and draws its progress with a caption", () => {
    const html = render(<RunSteps steps={steps} />)
    expect(html.match(/aria-current="step"/g)?.length).toBe(1)
    const running = rowOf(html, "Save to this device")
    expect(running).toContain(`aria-current="step"`)
    expect(running).toContain(">300 of 1,000 notes</span>")
    expect(running).toMatch(/role="progressbar"[^>]*aria-valuenow="300"[^>]*aria-valuemax="1000"/)
    expect(html.match(/role="progressbar"/g)?.length).toBe(1)
  })

  it("draws each state with its own mark, so colour never carries the state alone", () => {
    const html = render(<RunSteps steps={steps} />)
    const marks = steps.map((step) =>
      rowOf(html, step.label).replace(/^[^>]*>/, "").split("<div")[0]
    )
    expect(new Set(marks.slice(1)).size).toBe(marks.length - 1)
    expect(marks[0]).toBe(marks[1])
  })

  it("takes the state words from labels, then the catalog, before English", () => {
    const pending: RunStep[] = [{ id: "a", label: "A", state: "pending" }]
    expect(render(<RunSteps steps={pending} labels={{ pending: "Not measured" }} />)).toContain(
      ">Not measured</span>",
    )
    const russian = createTranslator({
      language: "ru",
      catalogs: [{ source: en, translation: ru }],
    })
    expect(
      render(
        <I18nContext.Provider value={russian}>
          <RunSteps steps={pending} />
        </I18nContext.Provider>,
      ),
    ).toContain(">Не начато</span>")
  })

  it("is named by the heading the caller points it at", () => {
    expect(render(<RunSteps steps={steps} aria-labelledby="measures" />)).toMatch(
      /^<ol aria-labelledby="measures"/,
    )
  })
})
