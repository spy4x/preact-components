import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { ComponentChild } from "preact"
import { render } from "preact-render-to-string"
import { createFormatters, type Formatters } from "@spy4x/time/format"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { FormatContext, OnDay, useFormat, When } from "./format.tsx"
import { I18nContext } from "./i18n.tsx"

const NOW = Date.parse("2026-10-17T12:00:00.000Z")
const THREE_DAYS_AGO = "2026-10-14T12:00:00.000Z"
/** 23:30 in UTC is already the next day in Tokyo. */
const LATE_EVENING_UTC = "2026-10-17T23:30:00.000Z"

const utc = createFormatters({ locale: "en-GB", timeZone: "UTC" })
const tokyo = createFormatters({ locale: "en-GB", timeZone: "Asia/Tokyo" })

function inZone(format: Formatters, node: ComponentChild): string {
  return render(<FormatContext.Provider value={format}>{node}</FormatContext.Provider>)
}

describe("When", () => {
  it("shows the distance from now in English inside a time element with the instant", () => {
    const html = inZone(utc, <When at={THREE_DAYS_AGO} now={NOW} />)
    expect(html).toContain(`<time datetime="${THREE_DAYS_AGO}"`)
    expect(html).toContain(">3 days ago</time>")
  })

  it("keeps its English words without a provider, whatever the region format", () => {
    const german = createFormatters({ locale: "de-DE", timeZone: "UTC" })
    const at = (ms: number) => new Date(NOW - ms).toISOString()
    const text = (ms: number) => inZone(german, <When at={at(ms)} now={NOW} />)
    expect(text(5_000)).toContain(">a moment ago</time>")
    expect(text((2 * 60 + 55) * 60_000)).toContain(">2 hours ago</time>")
    expect(text(3 * 86_400_000)).toContain(">3 days ago</time>")
  })

  it("keeps its English words under an English translator", () => {
    const english = createTranslator({ language: "en-GB", catalogs: [] })
    const html = render(
      <I18nContext.Provider value={english}>
        <When at="2026-10-17T11:59:55.000Z" now={NOW} />
      </I18nContext.Provider>,
    )
    expect(html).toContain(">a moment ago</time>")
  })

  it("says the distance in the translator's language", () => {
    const german = createTranslator({ language: "de", catalogs: [] })
    const inGerman = (format: Formatters, node: ComponentChild) =>
      render(
        <I18nContext.Provider value={german}>
          <FormatContext.Provider value={format}>{node}</FormatContext.Provider>
        </I18nContext.Provider>,
      )
    expect(inGerman(utc, <When at={THREE_DAYS_AGO} now={NOW} />)).toContain(">vor 3 Tagen</time>")
    const clocked = createFormatters({ locale: "de-DE", timeZone: "UTC" }, { now: () => NOW })
    expect(inGerman(clocked, <When at={THREE_DAYS_AGO} />)).toContain(">vor 3 Tagen</time>")
  })

  it("says the distance in the translator's language under an English region format, without now", () => {
    const german = createTranslator({ language: "de", catalogs: [] })
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
    const html = render(
      <I18nContext.Provider value={german}>
        <FormatContext.Provider value={utc}>
          <When at={threeDaysAgo} />
        </FormatContext.Provider>
      </I18nContext.Provider>,
    )
    expect(html).toContain(">vor 3 Tagen</time>")
  })

  it("writes epoch milliseconds or a Date as an ISO datetime", () => {
    const epoch = Date.parse(THREE_DAYS_AGO)
    expect(inZone(utc, <When at={epoch} now={NOW} />)).toContain(`datetime="${THREE_DAYS_AGO}"`)
    expect(inZone(utc, <When at={new Date(epoch)} now={NOW} />)).toContain(
      `datetime="${THREE_DAYS_AGO}"`,
    )
  })

  it("puts the exact instant in the provided zone in its title", () => {
    const html = inZone(tokyo, <When at={THREE_DAYS_AGO} now={NOW} />)
    expect(html).toContain(`title="${tokyo.exact(THREE_DAYS_AGO)}"`)
    expect(tokyo.exact(THREE_DAYS_AGO)).not.toBe(utc.exact(THREE_DAYS_AGO))
  })

  it("reads the device's own format when no provider is around it", () => {
    const html = render(<When at={THREE_DAYS_AGO} now={NOW} />)
    expect(html).toContain(`title="${createFormatters().exact(THREE_DAYS_AGO)}"`)
  })

  it("shows the missing label, and no time element, for a missing or unreadable date", () => {
    expect(inZone(utc, <When at={null} now={NOW} />)).toBe("<span>-</span>")
    expect(inZone(utc, <When at="not a date" now={NOW} />)).toBe("<span>-</span>")
  })

  it("takes the caller's words for the distance, the missing date and the title", () => {
    const labels = {
      relative: (at: Date, now: number) => `${(now - at.getTime()) / 86_400_000} Tage`,
      missing: "unbekannt",
      title: (exact: string) => `Genau: ${exact}`,
    }
    const html = inZone(utc, <When at={THREE_DAYS_AGO} now={NOW} labels={labels} />)
    expect(html).toContain(">3 Tage</time>")
    expect(html).toContain(`title="Genau: ${utc.exact(THREE_DAYS_AGO)}"`)
    expect(inZone(utc, <When at={undefined} labels={labels} />)).toBe("<span>unbekannt</span>")
  })
})

describe("OnDay", () => {
  it("shows the calendar day in the provided zone", () => {
    expect(inZone(utc, <OnDay at={LATE_EVENING_UTC} />)).toContain(">17 Oct 2026</time>")
    expect(inZone(tokyo, <OnDay at={LATE_EVENING_UTC} />)).toContain(">18 Oct 2026</time>")
  })

  it("carries the instant and the exact time as its title", () => {
    const html = inZone(tokyo, <OnDay at={LATE_EVENING_UTC} class="text-muted" />)
    expect(html).toContain(`datetime="${LATE_EVENING_UTC}"`)
    expect(html).toContain(`title="${tokyo.exact(LATE_EVENING_UTC)}"`)
    expect(html).toContain(`class="text-muted"`)
  })

  it("shows the caller's missing label for a missing date", () => {
    expect(inZone(utc, <OnDay at="" labels={{ missing: "never" }} />)).toBe("<span>never</span>")
  })
})

describe("useFormat", () => {
  it("returns the nearest provided formatter", () => {
    let seen: Formatters | undefined
    function Probe() {
      seen = useFormat()
      return null
    }
    inZone(tokyo, <Probe />)
    expect(seen).toBe(tokyo)
  })
})
