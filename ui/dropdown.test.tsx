import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Dropdown } from "./dropdown.tsx"

describe("Dropdown", () => {
  it("starts closed, hiding the panel", () => {
    const html = render(
      <Dropdown trigger="Menu">
        <a href="/a">First</a>
      </Dropdown>,
    )

    expect(html).toContain("hidden")
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain("First")
  })

  it("announces itself as a menu trigger", () => {
    const html = render(<Dropdown trigger="Menu">item</Dropdown>)

    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('role="menu"')
    expect(html).toContain('aria-orientation="vertical"')
  })

  it("renders the trigger content", () => {
    expect(render(<Dropdown trigger={<span data-e2e="icon">x</span>}>item</Dropdown>))
      .toContain('data-e2e="icon"')
  })

  it("opens the panel above the trigger when vertical is up", () => {
    const html = render(<Dropdown trigger="Menu" vertical="up">item</Dropdown>)

    expect(html).toContain("bottom-full")
    expect(html).toContain("origin-bottom-right")
  })

  it("anchors the panel to the left when asked", () => {
    const html = render(<Dropdown trigger="Menu" horizontal="left">item</Dropdown>)

    expect(html).toContain("left-0")
    expect(html).toContain("origin-top-left")
  })

  it("defaults the panel below and to the right of the trigger", () => {
    const html = render(<Dropdown trigger="Menu">item</Dropdown>)

    expect(html).toContain("top-full")
    expect(html).toContain("right-0")
  })

  it("uses the caller's trigger classes instead of the default button", () => {
    const html = render(<Dropdown trigger="Menu" triggerClasses="p-0">item</Dropdown>)

    expect(html).toContain("p-0")
    expect(html).not.toContain("rounded-md font-medium transition-colors")
  })

  it("names the menu for assistive tech", () => {
    expect(render(<Dropdown trigger="Menu" menuLabel="Actions">item</Dropdown>))
      .toContain('aria-label="Actions"')
  })

  it("appends caller classes to the panel", () => {
    const html = render(<Dropdown trigger="Menu" panelClasses="w-64">item</Dropdown>)

    expect(html).toContain("w-64")
    expect(html).toContain("whitespace-nowrap")
  })
})
