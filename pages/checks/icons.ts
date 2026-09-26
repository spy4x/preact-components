import { check, type Devtools } from "./harness.ts"

/**
 * Every glyph's caption fits its cell on a phone: a long name wraps between its words rather than
 * running past the cell or ending in an ellipsis. Measured at 375 px, the narrowest width the guide
 * designs for, where the gallery puts three glyphs in a row; with every glyph shown.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function captionFitCheck(devtools: Devtools): Promise<void> {
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: false,
  })
  try {
    const fit = await devtools.evaluate<{ total: number; cut: string[]; perRow: number }>(
      `(async () => {
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
        const cells = [...document.querySelectorAll("#icons [data-icon]")]
        const cut = cells
          .map((cell) => cell.querySelector("span"))
          .filter((caption) => caption.scrollWidth > caption.clientWidth)
          .map((caption) => caption.closest("[data-icon]").getAttribute("data-icon"))
        const top = cells[0]?.getBoundingClientRect().top
        const perRow = cells.filter((cell) => cell.getBoundingClientRect().top === top).length
        return { total: cells.length, cut, perRow }
      })()`,
    )
    check(
      "every glyph's name fits its cell on a phone, three glyphs to a row",
      fit.total > 90 && fit.cut.length === 0 && fit.perRow === 3,
      `${fit.cut.length} of ${fit.total} names cut off${
        fit.cut.length ? ` (${fit.cut.slice(0, 5).join(", ")})` : ""
      }, ${fit.perRow} per row at 375 px`,
    )
  } finally {
    await devtools.send("Emulation.clearDeviceMetricsOverride")
  }
}

/**
 * `icons/`'s browser checks: every caption fits on a phone, the live filter over the glyph
 * gallery, and click-to-copy on a glyph.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function iconsChecks(devtools: Devtools): Promise<void> {
  await captionFitCheck(devtools)

  const filter = await devtools.evaluate<{
    total: number
    filtered: number
    allMatch: boolean
    status: string
  }>(
    `(async () => {
      const input = document.querySelector('#icons input[name="icon-search"]')
      const total = document.querySelectorAll("#icons [data-icon]").length
      input.focus()
      input.value = "arrow"
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await new Promise((done) => setTimeout(done, 50))
      const shown = [...document.querySelectorAll("#icons [data-icon]")]
        .map((cell) => cell.getAttribute("data-icon"))
      return {
        total,
        filtered: shown.length,
        allMatch: shown.every((name) => name.toLowerCase().includes("arrow")),
        status: document.querySelector("#icons p[aria-live]").textContent.trim(),
      }
    })()`,
  )
  check(
    "the icon filter filters 119 glyphs live",
    filter.total > 90 && filter.filtered > 0 && filter.filtered < filter.total && filter.allMatch,
    `${filter.filtered}/${filter.total} — ${filter.status}`,
  )

  const copy = await devtools.evaluate<{ name: string; status: string }>(
    `(async () => {
      const cell = document.querySelector("#icons [data-icon]")
      const name = cell.getAttribute("data-icon")
      cell.click()
      await new Promise((done) => setTimeout(done, 50))
      return { name, status: document.querySelector("#icons p[aria-live]").textContent }
    })()`,
  )
  check(
    "clicking an icon copies its JSX",
    copy.status.includes("copied") && copy.status.includes(`<${copy.name} />`),
    copy.status.trim(),
  )
}
