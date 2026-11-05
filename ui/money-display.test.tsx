import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { ComponentChildren } from "preact"
import { render } from "preact-render-to-string"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { createFormatters } from "@spy4x/time/format"
import en from "./i18n/en.ts"
import { FormatContext } from "./format.tsx"
import { I18nContext } from "./i18n.tsx"
import { MoneyDisplay } from "./money-display.tsx"

/** `node` under a `FormatContext` for `locale`, so no test reads this machine's own region. */
function inRegion(locale: string, node: ComponentChildren): string {
  return render(
    <FormatContext.Provider value={createFormatters({ locale, timeZone: "UTC" })}>
      {node}
    </FormatContext.Provider>,
  )
}

describe("MoneyDisplay", () => {
  it("shows 12345 as €123.45 in euros, ¥12,345 in yen, three decimals in Kuwaiti dinar", () => {
    expect(inRegion("en-US", <MoneyDisplay amount={12345} currency="EUR" />)).toContain("€123.45")
    expect(inRegion("en-US", <MoneyDisplay amount={12345} currency="JPY" />)).toContain("¥12,345")
    expect(inRegion("en-US", <MoneyDisplay amount={12345} currency="KWD" />)).toContain("12.345")
  })

  it("formats through the given locale over the region", () => {
    expect(inRegion("en-US", <MoneyDisplay amount={1250} currency="EUR" locale="de" />))
      .toContain("12,50")
  })

  it("formats in the region of FormatContext, not the language of the words", () => {
    const english = createTranslator({ language: "en", catalogs: [{ source: en }] })
    const html = inRegion(
      "de-DE",
      <I18nContext.Provider value={english}>
        <MoneyDisplay amount={123456} currency="EUR" />
      </I18nContext.Provider>,
    )
    expect(html).toContain("1.234,56 €")
  })

  it("shows a coin with the decimals the caller gives", () => {
    expect(inRegion("en-US", <MoneyDisplay amount={1} currency="BTC" decimals={8} />))
      .toContain("0.00000001")
  })

  it("marks income with a plus in the success colour and spending in the danger colour when signed", () => {
    const income = inRegion("en-US", <MoneyDisplay amount={500} currency="USD" tone="signed" />)
    expect(income).toContain("+$5.00")
    expect(income).toContain("text-success")

    const spending = inRegion("en-US", <MoneyDisplay amount={-500} currency="USD" tone="signed" />)
    expect(spending).toContain("-$5.00")
    expect(spending).toContain("text-danger")
  })

  it("gives zero no sign and no colour when signed", () => {
    const html = inRegion("en-US", <MoneyDisplay amount={0} currency="USD" tone="signed" />)
    expect(html).toContain(">$0.00<")
    expect(html).not.toContain("text-success")
    expect(html).not.toContain("text-danger")
  })

  it("colours only a negative amount, without a plus, when the tone is negative", () => {
    const negative = inRegion(
      "en-US",
      <MoneyDisplay amount={-500} currency="USD" tone="negative" />,
    )
    expect(negative).toContain("text-danger")
    const positive = inRegion("en-US", <MoneyDisplay amount={500} currency="USD" tone="negative" />)
    expect(positive).not.toContain("text-success")
    expect(positive).not.toContain("+")
  })

  it("adds no sign and no colour by default", () => {
    const html = inRegion("en-US", <MoneyDisplay amount={-500} currency="USD" />)
    expect(html).toContain("-$5.00")
    expect(html).not.toContain("text-danger")
  })

  it("keeps colorNegative working as the negative tone", () => {
    const html = inRegion("en-US", <MoneyDisplay amount={-500} currency="USD" colorNegative />)
    expect(html).toContain("text-danger")
  })

  it("draws tabular figures and passes the caller's class through beside the tone colour", () => {
    const html = inRegion(
      "en-US",
      <MoneyDisplay amount={-500} currency="USD" tone="negative" class="font-bold" />,
    )
    expect(html).toContain("tabular-nums")
    expect(html).toContain("font-bold")
    expect(html).toContain("text-danger")
  })
})
