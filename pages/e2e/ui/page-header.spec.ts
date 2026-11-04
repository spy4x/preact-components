import type { Spec } from "../runner.ts"

export const specs: readonly Spec[] = [
  {
    name: "PageHeader's heading leaves room for the whole focus ring of a button in its heading " +
      "slot",
    pageId: "ui",
    run: async (page) => {
      const button = page.locator(`#demo-PageHeader [data-card-part="demo"]`)
        .getByRole("heading").getByRole("button", { name: "Packing list" })
      await button.focus()
      await button.and(page.locator(":focus")).waitFor()
      // The ring is measured as geometry, so this holds whether or not the browser draws
      // `:focus-visible` for a scripted focus: no box between the button and its header may hide
      // overflow while cutting into the button's box grown by the 4 px ring (#579).
      const clippers = await button.evaluate((control) => {
        const ring = 4
        const box = control.getBoundingClientRect()
        const header = control.closest("header")
        const found: string[] = []
        for (let at = control.parentElement; at && header?.contains(at); at = at.parentElement) {
          const style = getComputedStyle(at)
          if (style.overflowX === "visible" && style.overflowY === "visible") continue
          const edge = at.getBoundingClientRect()
          if (
            edge.left > box.left - ring || edge.top > box.top - ring ||
            edge.right < box.right + ring || edge.bottom < box.bottom + ring
          ) {
            found.push(`${at.tagName.toLowerCase()} overflow ${style.overflowX}/${style.overflowY}`)
          }
        }
        return header ? found : ["no header around the button"]
      })
      if (clippers.length > 0) throw new Error(`boxes that clip the ring: ${clippers.join(", ")}`)
      return "boxes that clip the ring: none"
    },
  },
]
