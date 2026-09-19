import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { InputButton } from "./input-button.tsx"

describe("InputButton", () => {
  it("renders an input with the shipped input class and a trailing button", () => {
    const html = render(<InputButton icon="🔍" iconLabel="Search" />)

    expect(html).toContain('class="input pr-11"')
    expect(html).toContain('class="btn-input-icon"')
    expect(html.indexOf("<input")).toBeLessThan(html.indexOf("<button"))
  })

  it("positions the button inside the input's box", () => {
    const html = render(<InputButton icon="🔍" iconLabel="Search" />)

    expect(html).toContain('class="relative"')
    expect(html).toContain('class="absolute top-1.5 right-1.5"')
  })

  it("names the icon button and gives it a tooltip", () => {
    const html = render(<InputButton icon="🔍" iconLabel="Search" />)

    expect(html).toContain('aria-label="Search"')
    expect(html).toContain('title="Search"')
  })

  it("lets the tooltip differ from the accessible name", () => {
    const html = render(<InputButton icon="👁" iconLabel="Show password" title="Reveal" />)

    expect(html).toContain('aria-label="Show password"')
    expect(html).toContain('title="Reveal"')
  })

  it("defaults the button to type button so it never submits the form", () => {
    expect(render(<InputButton icon="🔍" iconLabel="Search" />)).toContain('type="button"')
  })

  it("passes native input attributes straight through", () => {
    const html = render(
      <InputButton
        icon="🔍"
        iconLabel="Search"
        type="search"
        id="query"
        name="q"
        value="lamp"
        placeholder="Search"
        onInput={() => {}}
        data-e2e="query"
      />,
    )

    expect(html).toContain('type="search"')
    expect(html).toContain('id="query"')
    expect(html).toContain('name="q"')
    expect(html).toContain('value="lamp"')
    expect(html).toContain('placeholder="Search"')
    expect(html).toContain('data-e2e="query"')
  })

  it("disables the button and the input together when disabled", () => {
    const html = render(<InputButton icon="🔍" iconLabel="Search" disabled />)

    expect(html.match(/disabled/g)?.length).toBe(2)
  })

  it("takes a wider icon margin for a text button", () => {
    const html = render(
      <InputButton icon="Go" iconLabel="Run" iconMarginClass="pr-20" />,
    )

    expect(html).toContain('class="input pr-20"')
    expect(html).not.toContain("pr-11")
  })

  it("merges a caller class over the reserved right padding", () => {
    const html = render(
      <InputButton icon="🔍" iconLabel="Search" class="w-full" wrapperClass="max-w-xs" />,
    )

    expect(html).toContain("w-full")
    expect(html).toContain("pr-11")
    expect(html).toContain('class="relative max-w-xs"')
  })
})
