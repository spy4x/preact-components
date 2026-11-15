import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

/**
 * `CurrencyField` finds a currency by its name, its code or its symbol and Enter picks the
 * highlighted match (the unit tests prove the order); `MoneyInput` reads a coin's own decimals and
 * refuses one decimal too many; `MoneyDisplay`'s signed amounts pass axe's contrast check in both
 * palettes, on a phone and on a desktop.
 */
function currencySpecs(): Spec[] {
  const pick = (query: string): Spec => ({
    name: `CurrencyField: typing "${query}" finds the euro and Enter picks it`,
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-CurrencyField")
      const field = card.getByRole("combobox", { name: "Account currency" })
      await field.fill(query)
      await card.getByRole("option").first().filter({ hasText: "Euro" }).waitFor()
      await field.press("Enter")
      await card.getByText("code: EUR", { exact: true }).waitFor()
      const shown = await field.inputValue()
      if (shown !== "Euro (EUR)") throw new Error(`the field reads "${shown}", not "Euro (EUR)"`)
    },
  })
  const contrast = (colorScheme: "light" | "dark", width: number): Spec => ({
    name: `MoneyDisplay at ${width} px in the ${colorScheme} palette: axe finds no violation in ` +
      "the signed and negative amounts, text colour contrast included",
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      await page.setViewportSize({ width, height: 900 })
      const table = page.locator(`[data-e2e="money-display-table"]`)
      await table.scrollIntoViewIfNeeded()
      const signed = await table.locator(".text-success, .text-danger").count()
      if (signed !== 6) throw new Error(`${signed} toned amounts, not 6`)
      return await axeCleanIn(page, `[data-e2e="money-display-table"]`)
    },
  })
  return [
    pick("euro"),
    pick("eur"),
    pick("€"),
    {
      name: "CurrencyField: with nothing typed, the recent codes come first in their order",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-CurrencyField")
        const field = card.getByRole("combobox", { name: "Account currency" })
        await field.focus()
        await field.press("ArrowDown")
        const options = card.getByRole("option")
        await options.first().waitFor()
        const first = await options.evaluateAll((rows) =>
          rows.slice(0, 3).map((row) => row.textContent?.slice(0, 3))
        )
        if (first.join() !== "EUR,USD,THB") throw new Error(`the list starts ${first.join()}`)
      },
    },
    {
      name: "MoneyInput: BTC with 8 decimals shows one satoshi, names BTC in the field, and " +
        "refuses a ninth decimal with its own message",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-MoneyInput")
        const coin = card.locator("#guide-money-btc")
        const shown = await coin.inputValue()
        if (!/^0[.,]00000001$/.test(shown)) throw new Error(`the field reads "${shown}"`)
        await card.locator("#guide-money-btc-currency").getByText("BTC").waitFor()
        const decimal = shown[1]
        await coin.fill(`0${decimal}000000001`)
        await card.getByText("BTC takes up to 8 decimal places", { exact: true }).waitFor()
        if (await coin.getAttribute("aria-invalid") !== "true") {
          throw new Error(`the field is not marked invalid`)
        }
      },
    },
    {
      name: "MoneyInput: a yen amount with decimals says JPY takes whole amounts only",
      pageId: "ui",
      run: async (page) => {
        const card = page.locator("#demo-MoneyInput")
        await card.locator("#guide-money-jpy").fill("0.5")
        await card.getByText("JPY takes whole amounts only", { exact: true }).waitFor()
      },
    },
    contrast("light", 390),
    contrast("light", 1440),
    contrast("dark", 390),
    contrast("dark", 1440),
  ]
}

export const specs: readonly Spec[] = [
  ...currencySpecs(),
]
