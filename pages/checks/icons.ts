import { check, type Devtools } from "./harness.ts"

/**
 * `icons/`'s browser checks: the live filter over the glyph gallery, and click-to-copy on a glyph.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function iconsChecks(devtools: Devtools): Promise<void> {
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
