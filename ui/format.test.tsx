import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { ComponentChild } from "preact"
import { render } from "preact-render-to-string"
import { createFormatters, type Formatters } from "@spy4x/time/format"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import { Elapsed, FormatContext, OnDay, useFormat, When } from "./format.tsx"
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

describe("Elapsed", () => {
  const START = NOW - (2 * 60 + 5) * 1000

  it("shows the time from start to now as a clock face in a time element with an ISO duration", () => {
    const html = render(<Elapsed start={START} now={NOW} />)
    expect(html).toBe(`<time class="tabular-nums" datetime="PT2M5S">02:05</time>`)
  })

  it("counts to the end when there is one, whatever now is", () => {
    const end = START + (3600 + 2 * 60 + 3) * 1000
    const html = render(<Elapsed start={new Date(START)} end={new Date(end).toISOString()} />)
    expect(html).toContain(`datetime="PT1H2M3S">1:02:03</time>`)
  })

  it("rounds down to whole seconds and writes PT0S for no time at all", () => {
    expect(render(<Elapsed start={NOW} end={NOW + 999} />)).toContain(`datetime="PT0S">00:00<`)
    expect(render(<Elapsed start={NOW} end={NOW + 3_600_000} />)).toContain(`datetime="PT1H">`)
  })

  it("counts a start after the end as no time, never a negative duration", () => {
    expect(render(<Elapsed start={NOW} end={NOW - 60_000} />)).toContain(`datetime="PT0S">00:00<`)
  })

  it("treats a null end as still running", () => {
    expect(render(<Elapsed start={START} end={null} now={NOW} />)).toContain(">02:05</time>")
  })

  it("shows the missing label for a start it cannot read", () => {
    expect(render(<Elapsed start="not a date" now={NOW} />)).toBe("<span>-</span>")
    expect(render(<Elapsed start={null} labels={{ missing: "Not started" }} />))
      .toBe("<span>Not started</span>")
  })

  it("takes the duration text from labels, given the milliseconds and the language", () => {
    const html = render(
      <Elapsed
        start={START}
        now={NOW}
        labels={{ duration: (ms, language) => `${ms} ${language}` }}
      />,
    )
    expect(html).toContain(">125000 en</time>")
  })

  it("writes the clock face in the reading language", () => {
    const arabic = createTranslator({ language: "ar", catalogs: [] })
    const html = render(
      <I18nContext.Provider value={arabic}>
        <Elapsed start={START} now={NOW} />
      </I18nContext.Provider>,
    )
    expect(html).toContain(
      `datetime="PT2M5S">${
        new Intl.DurationFormat("ar", { style: "digital", hoursDisplay: "auto" })
          .format({ minutes: 2, seconds: 5 })
      }</time>`,
    )
  })
})
