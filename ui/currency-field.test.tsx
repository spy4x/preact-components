import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { currencyOptions } from "@spy4x/platform/universal/money"
import { CurrencyField, filterCurrencies } from "./currency-field.tsx"

const OPTIONS = currencyOptions("en")
const codes = (query: string, recent?: string[]) =>
  filterCurrencies(OPTIONS, query, recent).map((option) => option.code)

describe("filterCurrencies", () => {
  it("finds the euro first by its name, its code in any case, and its symbol", () => {
    for (const query of ["euro", "eur", "EUR", "€"]) expect(codes(query)[0]).toBe("EUR")
  })

  it("puts the option whose code is the query first, before a better-scored name", () => {
    expect(codes("chf")[0]).toBe("CHF")
    expect(codes("usd")[0]).toBe("USD")
  })

  it("lists the recent codes first, in the order given, while nothing is typed", () => {
    const listed = codes("", ["THB", "EUR"])
    expect(listed.slice(0, 2)).toEqual(["THB", "EUR"])
    expect(listed.length).toBe(OPTIONS.length)
    expect(listed.filter((code) => code === "EUR").length).toBe(1)
  })

  it("lets recency play no part once something is typed", () => {
    expect(codes("eur", ["THB"])[0]).toBe("EUR")
    expect(codes("eur", ["THB"])).not.toContain("THB")
  })

  it("skips a recent code that is not among the options", () => {
    expect(codes("", ["XYZ", "EUR"])[0]).toBe("EUR")
  })

  it("matches a symbol-only query on symbols rather than listing everything", () => {
    const dollars = codes("$")
    expect(dollars[0]).toBe("USD")
    expect(dollars).toContain("CAD")
    expect(dollars).not.toContain("EUR")
    expect(codes("£")[0]).toBe("GBP")
  })

  it("lists nothing for a query no currency matches", () => {
    expect(codes("zzzz")).toEqual([])
  })

  it("finds a coin the app adds by its code", () => {
    const btc = { code: "BTC", name: "Bitcoin", symbol: "₿", decimals: 8, aliases: ["BTC", "₿"] }
    expect(filterCurrencies([...OPTIONS, btc], "btc")[0]).toBe(btc)
    expect(filterCurrencies([...OPTIONS, btc], "₿")).toEqual([btc])
  })
})

describe("CurrencyField", () => {
  it("shows the chosen currency as its name and code in the closed field", () => {
    const html = render(<CurrencyField value="EUR" onChange={() => {}} options={OPTIONS} />)
    expect(html).toContain('value="Euro (EUR)"')
  })

  it("is named Currency with the code, name or symbol placeholder when nothing names it", () => {
    const html = render(<CurrencyField value={null} onChange={() => {}} options={OPTIONS} />)
    expect(html).toContain('aria-label="Currency"')
    expect(html).toContain('placeholder="Code, name or symbol"')
  })

  it("leaves the name to a visible label that names it", () => {
    const html = render(
      <CurrencyField value={null} onChange={() => {}} options={OPTIONS} aria-labelledby="lbl" />,
    )
    expect(html).toContain('aria-labelledby="lbl"')
    expect(html).not.toContain('aria-label="Currency"')
  })

  it("shows an empty field for a code that is not among the options", () => {
    const html = render(<CurrencyField value="XYZ" onChange={() => {}} options={OPTIONS} />)
    const input = html.match(/<input[^>]*>/)?.[0] ?? ""
    expect(input).toMatch(/ value /)
    expect(input).not.toContain('value="')
  })
})
