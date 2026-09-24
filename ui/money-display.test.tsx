import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { MoneyDisplay } from "./money-display.tsx"

describe("MoneyDisplay", () => {
  it("shows 12345 as €123.45 in euros, ¥12,345 in yen, three decimals in Kuwaiti dinar", () => {
    expect(render(<MoneyDisplay amount={12345} currency="EUR" />)).toContain("€123.45")
    expect(render(<MoneyDisplay amount={12345} currency="JPY" />)).toContain("¥12,345")
    expect(render(<MoneyDisplay amount={12345} currency="KWD" />)).toContain("12.345")
  })

  it("formats through the given locale", () => {
    expect(render(<MoneyDisplay amount={1250} currency="EUR" locale="de" />)).toContain("12,50")
  })

  it("colours a negative amount only when colorNegative is set", () => {
    const plain = render(<MoneyDisplay amount={-500} currency="USD" />)
    expect(plain).not.toContain("text-red-600")

    const colored = render(<MoneyDisplay amount={-500} currency="USD" colorNegative />)
    expect(colored).toContain("text-red-600")
    expect(colored).toContain("-$5.00")
  })

  it("never colours a positive amount even when colorNegative is set", () => {
    const html = render(<MoneyDisplay amount={500} currency="USD" colorNegative />)
    expect(html).not.toContain("text-red-600")
  })

  it("passes the caller's class through alongside the negative colour", () => {
    const html = render(
      <MoneyDisplay amount={-500} currency="USD" colorNegative class="font-bold" />,
    )
    expect(html).toContain("font-bold")
    expect(html).toContain("text-red-600")
  })
})
