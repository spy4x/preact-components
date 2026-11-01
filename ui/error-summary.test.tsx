import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ErrorSummary, type ErrorSummaryItem } from "./error-summary.tsx"

const items: ErrorSummaryItem[] = [
  { key: "14", label: "Line 14", message: "There's no component called CostCalc." },
  { key: "32", label: "Line 32", message: "Chart is inside a list or a quote." },
]

const noop = () => {}

describe("ErrorSummary", () => {
  it("draws only an empty status line when there are no problems", () => {
    const html = render(<ErrorSummary title="No problems" items={[]} onSelect={noop} />)
    expect(html).toBe('<p role="status" class="sr-only" data-e2e="error-summary-status"></p>')
  })

  it("draws a region named by its title, with the line under it", () => {
    const html = render(
      <ErrorSummary title="2 problems in this post" items={items} onSelect={noop} id="problems">
        Readers won't see these lines.
      </ErrorSummary>,
    )
    const titleId = /<p id="([^"]+)" class="font-medium">2 problems in this post<\/p>/.exec(html)
    expect(titleId).not.toBeNull()
    expect(html).toContain(`<section id="problems" aria-labelledby="${titleId![1]}"`)
    expect(html).toContain("Readers won't see these lines.")
    expect(html).not.toMatch(/<h[1-6]/)
  })

  it("draws one button per problem, each described by its message, in order", () => {
    const html = render(<ErrorSummary title="T" items={items} onSelect={noop} />)
    const rows = [
      ...html.matchAll(/<button[^>]*aria-describedby="([^"]+)"[^>]*>(Line \d+)<\/button>/g),
    ]
    expect(rows.map((row) => row[2])).toEqual(["Line 14", "Line 32"])
    for (const [i, row] of rows.entries()) {
      expect(html).toContain(
        `<span id="${row[1]}" class="min-w-0 flex-1">${items[i].message}</span>`,
      )
    }
    expect(new Set(rows.map((row) => row[1])).size).toBe(2)
  })

  it("makes each row's button a 44 px touch target on a phone", () => {
    const html = render(<ErrorSummary title="T" items={items} onSelect={noop} />)
    const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)]
    expect(buttons).toHaveLength(2)
    for (const [, classes] of buttons) expect(classes.split(" ")).toContain("max-sm:min-h-11")
  })

  it("says the count in the status line, one and many", () => {
    expect(render(<ErrorSummary title="T" items={items} onSelect={noop} />)).toContain(
      'data-e2e="error-summary-status">2 problems</p>',
    )
    expect(render(<ErrorSummary title="T" items={items.slice(0, 1)} onSelect={noop} />)).toContain(
      'data-e2e="error-summary-status">1 problem</p>',
    )
    expect(
      render(
        <ErrorSummary
          title="T"
          items={items}
          onSelect={noop}
          countMessage={(n) => `${n} issues`}
        />,
      ),
    ).toContain(">2 issues</p>")
  })

  it("draws the panel in the warning tone's theme tokens", () => {
    const html = render(<ErrorSummary title="T" items={items} onSelect={noop} />)
    expect(html).toMatch(/<section[^>]*class="[^"]*\bborder-warning bg-warning-soft\b/)
    expect(html).toMatch(/<svg[^>]*class="[^"]*\btext-warning\b/)
  })
})
