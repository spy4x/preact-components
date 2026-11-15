import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ChangeList, type ChangeMonth } from "./change-list.tsx"

const MONTHS: ChangeMonth[] = [
  {
    id: "2026-10",
    title: "October 2026",
    added: [{
      text: "People can sign in with a passkey.",
      number: 612,
      href: "https://x.test/612",
    }],
    fixed: [
      { text: "The menu closes on Escape.", number: 609, href: "https://x.test/609" },
      { text: "A long name wraps." },
    ],
    note: <a href="/blog/october">Read the post</a>,
  },
  { id: "2026-09", title: "September 2026", added: [], fixed: [{ text: "One fix." }] },
]

describe("ChangeList", () => {
  it("renders nothing for no months, so the caller draws its empty state", () => {
    expect(render(<ChangeList months={[]} />)).toBe("")
  })

  it("heads each month with its id, newest first, and counts its changes with the note after", () => {
    const html = render(<ChangeList months={MONTHS} />)
    expect(html.indexOf("October 2026")).toBeLessThan(html.indexOf("September 2026"))
    expect(html).toMatch(/<h2 id="2026-10"[^>]*>October 2026<\/h2>/)
    expect(html).toContain('<p class="text-sm text-muted">3 changes · <a href="/blog/october">')
    expect(html).toContain(">1 change</p>")
  })

  it("lists new things open and folds the fixes in a details that counts them", () => {
    const html = render(<ChangeList months={MONTHS} />)
    const october = html.slice(0, html.indexOf("September 2026"))
    expect(october).toMatch(/<h3 id="2026-10-new"[^>]*>New<\/h3>/)
    expect(october.indexOf("passkey")).toBeLessThan(october.indexOf("<details"))
    expect(october).toMatch(/<h3 id="2026-10-fixed"[^>]*>Fixed<\/h3>/)
    expect(october).toMatch(/<details[^>]*><summary[^>]*><svg[^>]*>.*<\/svg>2 fixes<\/summary>/)
    expect(october.indexOf("<details")).toBeLessThan(october.indexOf("Escape"))
  })

  it("does not draw a group with no changes", () => {
    const html = render(<ChangeList months={[MONTHS[1]]} />)
    expect(html).not.toContain(">New</h3>")
    expect(html).toContain("1 fix</summary>")
  })

  it("links each change's number, named as its pull request, in bdi, after the sentence", () => {
    const html = render(<ChangeList months={MONTHS} />)
    expect(html).toMatch(
      /People can sign in with a passkey\. <a href="https:\/\/x\.test\/612" aria-label="Pull request 612"[^>]*><bdi>#612<\/bdi><\/a>/,
    )
    expect(html).toContain('<li class="text-pretty">A long name wraps.</li>')
  })

  it("gives every heading a link to itself beside it, outside the heading", () => {
    const html = render(<ChangeList months={MONTHS} />)
    expect(html).toContain(
      '</h2><a href="#2026-10" aria-label="Link to this section"',
    )
    expect(html).toContain('</h3><a href="#2026-10-new" aria-label="Link to this section"')
    expect(html).toContain('</h3><a href="#2026-10-fixed" aria-label="Link to this section"')
  })

  it("names every heading's anchor with the caller's anchor label", () => {
    const html = render(<ChangeList months={MONTHS} labels={{ anchor: "Copy the link" }} />)
    const headings = html.match(/class="group\/heading /g)?.length ?? 0
    expect(headings).toBeGreaterThan(2)
    expect(html.match(/<a href="#[^"]*" aria-label="Copy the link"/g)?.length).toBe(headings)
    expect(html).not.toContain("Link to this section")
  })

  it("takes the caller's words and heading level", () => {
    const html = render(
      <ChangeList
        months={MONTHS}
        headingLevel={3}
        labels={{
          added: "Added",
          fixes: (count) => `${count} bugs`,
          pullRequest: (number) => `Pull request ${number} on GitHub`,
        }}
      />,
    )
    expect(html).toMatch(/<h3 id="2026-10"/)
    expect(html).toMatch(/<h4 id="2026-10-new"[^>]*>Added<\/h4>/)
    expect(html).toContain("2 bugs</summary>")
    expect(html).toContain('aria-label="Pull request 612 on GitHub"')
  })
})
