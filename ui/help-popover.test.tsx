import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { HelpPopover } from "./help-popover.tsx"
import { I18nContext } from "./i18n.tsx"
import { createTranslator } from "@spy4x/platform/universal/i18n"
import uiEn from "./i18n/en.ts"
import uiDe from "./i18n/de.ts"

/**
 * The markup the browser acts on. Opening, Escape, the click outside and where focus goes are the
 * platform's, proven in `pages/e2e/ui/help-popover.spec.ts`.
 */

/** The opening tag of the first element whose attributes contain `needle`. */
function tagWith(html: string, needle: string): string {
  const at = html.indexOf(needle)
  if (at === -1) throw new Error(`no ${needle} in: ${html}`)
  return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1)
}

const help = (props: { id?: string; closeLabel?: string } = {}) => (
  <HelpPopover label="How sorting works" title="Sorting" {...props}>
    <p>Earliest first.</p>
  </HelpPopover>
)

describe("HelpPopover", () => {
  it("points the trigger at a native auto popover that it names as a dialog", () => {
    const html = render(help({ id: "sorting-help" }))
    const trigger = tagWith(html, `popovertarget="sorting-help"`)
    const panel = tagWith(html, `popover="auto"`)

    expect(trigger).toContain(`aria-haspopup="dialog"`)
    // `popovertarget` already ties the trigger to its panel; `aria-controls` beside
    // `aria-haspopup` leaves axe undecided (aria-valid-attr-value), as Dropdown avoids too.
    expect(trigger).not.toContain("aria-controls")
    expect(trigger).not.toContain("popovertargetaction")
    expect(panel).toContain(`id="sorting-help"`)
    expect(panel).toContain(`role="dialog"`)
    expect(panel).toContain(`aria-labelledby="sorting-help-title"`)
  })

  it("names the trigger by its visible text", () => {
    const html = render(help({ id: "h" }))
    const trigger = tagWith(html, `popovertarget="h"`)

    expect(trigger).not.toContain("aria-label")
    expect(html.slice(html.indexOf(trigger))).toMatch(
      /^<button[^]*?How sorting works[^]*?<\/button>/,
    )
  })

  it("labels the panel by its heading, which takes focus on open", () => {
    const html = render(help({ id: "h" }))
    const heading = tagWith(html, `id="h-title"`)

    expect(heading).toMatch(/^<h2/)
    expect(heading).toContain(`tabindex="-1"`)
    expect(heading).toContain("autofocus")
    expect(html).toContain(">Sorting</h2>")
  })

  it("closes from a named button that only hides the panel", () => {
    const html = render(help({ id: "h", closeLabel: "Done" }))
    const close = tagWith(html, `popovertargetaction="hide"`)

    expect(close).toContain(`popovertarget="h"`)
    expect(close).toContain(`aria-label="Done"`)
    expect(close).toContain(`type="button"`)
  })

  it("takes the close button's name from the catalog", () => {
    const de = createTranslator({ language: "de", catalogs: [{ source: uiEn, translation: uiDe }] })
    const html = render(<I18nContext.Provider value={de}>{help({ id: "h" })}</I18nContext.Provider>)

    expect(tagWith(html, `popovertargetaction="hide"`)).toContain(`aria-label="Schließen"`)
  })

  it("gives each panel its own id when none is passed", () => {
    const html = render(<div>{help()}{help()}</div>)
    const ids = [
      ...html.matchAll(/popover="auto"[^>]*?\bid="([^"]+)"|id="([^"]+)"[^>]*?popover="auto"/g),
    ]
      .map((match) => match[1] ?? match[2])

    expect(ids.length).toBe(2)
    expect(ids[0]).not.toBe(ids[1])
    for (const id of ids) {
      expect(html).toContain(`popovertarget="${id}"`)
      expect(html).toContain(`aria-labelledby="${id}-title"`)
    }
  })

  it("lets the keyboard reach and scroll a long body, named by the heading", () => {
    const body = tagWith(render(help({ id: "h" })), "overflow-y-auto")

    expect(body).toContain(`tabindex="0"`)
    expect(body).toContain(`role="region"`)
    expect(body).toContain(`aria-labelledby="h-title"`)
  })

  it("draws the closed panel only through the open state, so the platform can hide it", () => {
    const panel = tagWith(render(help({ id: "h" })), `popover="auto"`)
    const classes = panel.match(/class="([^"]*)"/)?.[1].split(" ") ?? []

    expect(classes).toContain("open:flex")
    expect(classes).not.toContain("flex")
    expect(classes).not.toContain("block")
  })
})
