import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { MoneyInput } from "./money-input.tsx"

describe("MoneyInput", () => {
  it("shows the amount as editable decimal text, without a currency symbol or grouping", () => {
    const html = render(<MoneyInput value={12345} currency="EUR" onChange={() => {}} />)
    expect(html).toContain('value="123.45"')
    expect(html).not.toContain("€")
  })

  it("shows an empty field for a null value", () => {
    const html = render(<MoneyInput value={null} currency="EUR" onChange={() => {}} />)
    const visibleInput = html.match(/<input[^>]*>/)?.[0] ?? ""
    expect(visibleInput).not.toMatch(/value="[^"]/)
  })

  it("renders with no decimal places for a zero-decimal currency, three for a three-decimal one", () => {
    expect(render(<MoneyInput value={12345} currency="JPY" onChange={() => {}} />)).toContain(
      'value="12345"',
    )
    expect(render(<MoneyInput value={12345} currency="KWD" onChange={() => {}} />)).toContain(
      'value="12.345"',
    )
  })

  it("formats the edited text through the given locale's own decimal mark", () => {
    const html = render(<MoneyInput value={1250} currency="EUR" locale="de" onChange={() => {}} />)
    expect(html).toContain('value="12,50"')
  })

  it("brings up the numeric keyboard on a phone", () => {
    const html = render(<MoneyInput value={0} currency="USD" onChange={() => {}} />)
    expect(html).toContain('inputmode="decimal"')
  })

  it("renders no name on the visible field, so a plain form post never carries the typed text", () => {
    const html = render(
      <MoneyInput value={1250} currency="USD" name="amount" onChange={() => {}} />,
    )
    const visibleInput = html.match(/<input[^>]*>/)?.[0] ?? ""
    expect(visibleInput).not.toContain("hidden")
    expect(visibleInput).not.toMatch(/name="amount"/)
  })

  it("posts the smallest-unit integer through a hidden field named `name`", () => {
    const html = render(
      <MoneyInput value={1250} currency="USD" name="amount" onChange={() => {}} />,
    )
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="amount"')
    expect(html).toContain('value="1250"')
  })

  it("posts an empty hidden value for a null amount", () => {
    const html = render(
      <MoneyInput value={null} currency="USD" name="amount" onChange={() => {}} />,
    )
    const hiddenInput = html.match(/<input[^>]*type="hidden"[^>]*>/)?.[0] ?? ""
    expect(hiddenInput).not.toMatch(/value="[^"]/)
  })

  it("renders no hidden field at all when name is left out", () => {
    const html = render(<MoneyInput value={1250} currency="USD" onChange={() => {}} />)
    expect(html).not.toContain('type="hidden"')
  })

  it("carries an id, and uses it for the visible control and the status region", () => {
    const html = render(
      <MoneyInput value={1250} currency="USD" id="checkout-amount" onChange={() => {}} />,
    )
    expect(html).toContain('id="checkout-amount"')
    expect(html).toContain('id="checkout-amount-status"')
  })

  it("renders an empty, polite status region before anything has been typed", () => {
    const html = render(<MoneyInput value={1250} currency="USD" onChange={() => {}} />)
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"[^>]*>\s*<\/span>/)
  })

  it("passes the caller's class through to the visible input, alongside the theme class", () => {
    const html = render(
      <MoneyInput value={1250} currency="USD" class="max-w-xs" onChange={() => {}} />,
    )
    expect(html).toContain("input max-w-xs")
  })

  it("disables the visible control when disabled is set", () => {
    const html = render(<MoneyInput value={1250} currency="USD" disabled onChange={() => {}} />)
    expect(html).toContain("disabled")
  })
})
