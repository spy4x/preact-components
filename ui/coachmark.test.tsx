import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Coachmark } from "./coachmark.tsx"

const noop = () => {}

describe("Coachmark", () => {
  it("renders a non-modal dialog in a manual popover, named by its heading", () => {
    const html = render(
      <Coachmark open target="#a" title="Search here" onClose={noop}>Find anything.</Coachmark>,
    )
    expect(html).toContain(`popover="manual"`)
    expect(html).toContain(`role="dialog"`)
    expect(html).toContain(`aria-modal="false"`)
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1]
    expect(labelledBy).toBeDefined()
    expect(html).toContain(`<h2 id="${labelledBy}" tabindex="-1"`)
    expect(html).toContain(">Search here</h2>")
  })

  it("names its close button Close by default, and takes another name", () => {
    expect(render(<Coachmark open target="#a" title="T" onClose={noop} />)).toContain(
      `aria-label="Close"`,
    )
    const html = render(
      <Coachmark open target="#a" title="T" closeLabel="Schließen" onClose={noop} />,
    )
    expect(html).toContain(`aria-label="Schließen"`)
    expect(html).not.toContain(`aria-label="Close"`)
  })

  it("gives the body an id for the target to point at, and leaves it out with no body", () => {
    const html = render(<Coachmark open target="#a" title="T" onClose={noop}>Body text</Coachmark>)
    expect(html).toMatch(/<div id="[^"]+-body" class="text-sm text-muted">Body text<\/div>/)
    expect(render(<Coachmark open target="#a" title="T" onClose={noop} />)).not.toContain("-body")
  })

  it("renders the app's footer controls", () => {
    const html = render(
      <Coachmark
        open
        target="#a"
        title="T"
        onClose={noop}
        footer={<button type="button">Next</button>}
      />,
    )
    expect(html).toContain(`<button type="button">Next</button>`)
  })

  it("renders no Go to button on the server, where there is no target to measure", () => {
    expect(render(<Coachmark open target="#a" title="T" onClose={noop} />)).not.toContain("Go to")
  })
})
