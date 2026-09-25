import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { editableText, MoneyInput, resolveMoneyInputEdit } from "./money-input.tsx"

const INVALID = "Enter a valid amount"

/** Locales exercised by the round-trip test below — matches `ui/money.test.ts`'s own list. */
const ROUND_TRIP_LOCALES = [
  "sv",
  "fi",
  "nb",
  "lt",
  "sl",
  "he",
  "ur",
  "ar-EG",
  "fa",
  "bn",
  "mr",
  "de",
  "fr",
  "de-CH",
  "en-IN",
  "en",
  "ja",
]

describe("resolveMoneyInputEdit", () => {
  it("resolves empty text to a null value and no message", () => {
    expect(resolveMoneyInputEdit("", "EUR", "en", {}, INVALID)).toEqual({
      value: null,
      message: undefined,
    })
    expect(resolveMoneyInputEdit("   ", "EUR", "en", {}, INVALID)).toEqual({
      value: null,
      message: undefined,
    })
  })

  it("resolves a plain amount and clears the message", () => {
    expect(resolveMoneyInputEdit("12.50", "USD", "en", {}, INVALID)).toEqual({
      value: 1250,
      message: undefined,
    })
  })

  it("understands the German group and decimal marks", () => {
    expect(resolveMoneyInputEdit("1.234,56", "EUR", "de", {}, INVALID)).toEqual({
      value: 123456,
      message: undefined,
    })
  })

  it("understands JPY's zero decimals and KWD's three", () => {
    expect(resolveMoneyInputEdit("12345", "JPY", "en", {}, INVALID)).toEqual({
      value: 12345,
      message: undefined,
    })
    expect(resolveMoneyInputEdit("1.234", "KWD", "en", {}, INVALID)).toEqual({
      value: 1234,
      message: undefined,
    })
  })

  it("has no 0.1 + 0.2 style rounding error", () => {
    expect(resolveMoneyInputEdit("0.30", "USD", "en", {}, INVALID)).toEqual({
      value: 30,
      message: undefined,
    })
    // The naive `parseFloat("0.1") * 100 + parseFloat("0.2") * 100` drifts to 30.000000000000004;
    // this goes through the same digit-based `parseMoney` `money.test.ts` already proves against
    // that drift, wired here to confirm `resolveMoneyInputEdit` does not reintroduce it.
    expect(resolveMoneyInputEdit(String(0.1 + 0.2), "USD", "en", {}, INVALID)).toEqual({
      message: INVALID,
    })
  })

  it("parses a negative amount", () => {
    expect(resolveMoneyInputEdit("-12.50", "USD", "en", {}, INVALID)).toEqual({
      value: -1250,
      message: undefined,
    })
  })

  it("refuses text that cannot be parsed, using invalidMessage, and leaves value unset", () => {
    const edit = resolveMoneyInputEdit("abc", "USD", "en", {}, INVALID)
    expect(edit).toEqual({ message: INVALID })
    expect("value" in edit).toBe(false)
  })

  it("refuses an amount beyond Number.MAX_SAFE_INTEGER the same way", () => {
    expect(resolveMoneyInputEdit("99999999999999999", "USD", "en", {}, INVALID)).toEqual({
      message: INVALID,
    })
  })

  it("refuses an amount below min, through rangeMessage", () => {
    const edit = resolveMoneyInputEdit("4.00", "USD", "en", { min: 500 }, INVALID)
    expect(edit.value).toBeUndefined()
    expect(edit.message).toBe("Enter an amount of at least $5.00")
  })

  it("refuses an amount above max, through rangeMessage", () => {
    const edit = resolveMoneyInputEdit("6.00", "USD", "en", { max: 500 }, INVALID)
    expect(edit.value).toBeUndefined()
    expect(edit.message).toBe("Enter an amount of at most $5.00")
  })

  it("names both bounds when both are set", () => {
    const edit = resolveMoneyInputEdit("6.00", "USD", "en", { min: 100, max: 500 }, INVALID)
    expect(edit.message).toBe("Enter an amount between $1.00 and $5.00")
  })

  it("accepts an amount exactly at min and exactly at max", () => {
    expect(resolveMoneyInputEdit("5.00", "USD", "en", { min: 500, max: 500 }, INVALID)).toEqual({
      value: 500,
      message: undefined,
    })
  })

  it("uses the caller's own invalidMessage and rangeMessage instead of the defaults", () => {
    const customInvalid = resolveMoneyInputEdit("abc", "USD", "en", {}, "Not a valid price")
    expect(customInvalid).toEqual({ message: "Not a valid price" })

    const customRange = resolveMoneyInputEdit(
      "6.00",
      "USD",
      "en",
      { max: 500 },
      INVALID,
      () => "Too expensive",
    )
    expect(customRange.message).toBe("Too expensive")
  })

  it("round-trips value, editableText's own shown text, and the parsed-back edit for every listed locale", () => {
    // What `MoneyInput` itself does on every keystroke: format the committed value the way the
    // field would show it, then feed that text straight back through the same resolution a real
    // edit goes through. sv/fi/nb/lt/sl print U+2212 MINUS SIGN for a negative amount; ar-EG/fa/bn/
    // mr print their own digit glyphs; de/fr/de-CH/en-IN exercise the module's own marks.
    for (const locale of ROUND_TRIP_LOCALES) {
      for (const value of [12345, -12345, 0, 1, 9007199254740991]) {
        const text = editableText(value, "USD", locale)
        const edit = resolveMoneyInputEdit(text, "USD", locale, {}, INVALID)
        expect({ locale, value, text, edit }).toEqual({
          locale,
          value,
          text,
          edit: { value, message: undefined },
        })
      }
    }
  })
})

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

  it("carries the smallest-unit integer in a hidden field named `name`, disabled before it mounts", () => {
    const html = render(
      <MoneyInput value={1250} currency="USD" name="amount" onChange={() => {}} />,
    )
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="amount"')
    expect(html).toContain('value="1250"')
    // `preact-render-to-string` never runs effects, so this is the server-rendered, pre-hydration
    // markup — the same markup a fresh page's HTML carries. `disabled` here is what keeps that
    // markup out of `FormData` until the mount effect has reconciled whatever the visible field
    // actually shows; see `resolveMoneyInputEdit`'s round-trip test and `ui/README.md`.
    expect(html).toContain("disabled")
  })

  it("posts an empty hidden value for a null amount", () => {
    const html = render(
      <MoneyInput value={null} currency="USD" name="amount" onChange={() => {}} />,
    )
    const hiddenInput = html.match(/<input[^>]*type="hidden"[^>]*>/)?.[0] ?? ""
    expect(hiddenInput).not.toMatch(/value="[^"]/)
    expect(hiddenInput).toMatch(/disabled/)
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
