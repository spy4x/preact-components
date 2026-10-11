import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { SavedCopyNotice } from "./saved-copy-notice.tsx"

/** A copy saved at five past two in the afternoon, in whatever zone the test runs in. */
const SAVED_AT = new Date(2026, 9, 12, 14, 5)

/** The words of the notice, without its markup. */
function words(html: string): string {
  return html.replace(/<svg.*?<\/svg>/g, "").replace(/<\/p>/g, " ").replace(/<[^>]+>/g, "").trim()
}

describe("SavedCopyNotice", () => {
  it("says the list is a saved copy and gives the date and the clock time it was saved", () => {
    const html = render(<SavedCopyNotice savedAt={SAVED_AT} />)

    expect(words(html)).toBe(
      "Saved copy The server is out of reach. This copy was saved on this device: 12/10/2026 14:05.",
    )
  })

  it("gives the date for a copy saved today, since the words outlast the day", () => {
    const html = render(<SavedCopyNotice savedAt={Date.now()} />)

    expect(words(html)).toMatch(/saved on this device: \d\d\/\d\d\/\d{4} \d\d:\d\d\.$/)
  })

  it("takes the time as epoch milliseconds too", () => {
    const html = render(<SavedCopyNotice savedAt={SAVED_AT.getTime()} />)

    expect(words(html)).toContain("12/10/2026 14:05")
    expect(html).toContain(`data-saved-at="${SAVED_AT.toISOString()}"`)
  })

  it("puts the words in a polite live region that reads the whole sentence", () => {
    const html = render(<SavedCopyNotice savedAt={SAVED_AT} />)

    expect(html).toMatch(/^<div role="status" aria-live="polite" aria-atomic="true"[^>]*>/)
    expect(html).toMatch(/<\/p><\/div><\/div>$/)
  })

  it("keeps the live region in the page, empty and out of the layout, while the list is fresh", () => {
    for (const savedAt of [null, undefined, new Date("not a date"), Number.NaN]) {
      expect(render(<SavedCopyNotice savedAt={savedAt} class="mb-4" />)).toBe(
        '<div role="status" aria-live="polite" aria-atomic="true" class="sr-only"></div>',
      )
    }
  })

  it("takes the caller's words and the caller's wording of the time", () => {
    const html = render(
      <SavedCopyNotice
        savedAt={SAVED_AT}
        formatTime={(savedAt) => `${savedAt.getHours()} h ${savedAt.getMinutes()}`}
        labels={{ title: "Copie enregistrée", body: (time) => `Enregistrée à ${time}.` }}
      />,
    )

    expect(words(html)).toBe("Copie enregistrée Enregistrée à 14 h 5.")
  })

  it("drops the first line when the title is empty", () => {
    const html = render(<SavedCopyNotice savedAt={SAVED_AT} labels={{ title: "" }} />)

    expect(words(html)).toMatch(/^The server is out of reach\./)
    expect(html).not.toContain("font-medium")
  })

  it("adds the caller's utilities to the banner", () => {
    expect(render(<SavedCopyNotice savedAt={SAVED_AT} class="max-w-md" />)).toContain("max-w-md")
  })
})
