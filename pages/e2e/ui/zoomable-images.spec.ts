import type { Spec } from "../runner.ts"

/**
 * `ZoomableImages` opens the file an image names in `data-lightbox-src`, and an image without the
 * attribute still opens its own `src`: both pressed with a real click on the guide's card.
 */
const zoomableCropSpec: Spec = {
  name: "ZoomableImages: a crop with data-lightbox-src is named after its full file, and " +
    "pressing it opens that file and its alt, while a plain image still opens itself",
  pageId: "ui",
  run: async (page) => {
    const card = page.locator("#demo-ZoomableImages")
    const dialog = card.locator("dialog").and(page.locator(":modal"))
    const shown = dialog.locator("img")
    const crop = card.locator(`[data-e2e="lightbox-crop"]`)
    const plain = card.locator(`[data-e2e="lightbox-image"]`)
    const full = await crop.getAttribute("data-lightbox-src")
    const own = await plain.getAttribute("src")
    if (!full || !own) throw new Error("the card has no crop with a full file, or no plain image")

    await crop.and(page.getByRole("button", { name: "Zoom: A placeholder screen, in full" }))
      .waitFor()
    await crop.click()
    await shown.and(page.locator(`[alt="A placeholder screen, in full"]`)).waitFor()
    const opened = await shown.getAttribute("src")
    if (opened !== full) {
      throw new Error(`the crop opened ${opened?.slice(0, 60)}, not its full file`)
    }

    await page.keyboard.press("Escape")
    await dialog.waitFor({ state: "detached" })
    await plain.click()
    await shown.and(page.locator(`[alt="A placeholder image"]`)).waitFor()
    const plainOpened = await shown.getAttribute("src")
    if (plainOpened !== own) throw new Error("the plain image did not open its own src")
  },
}

/**
 * An image `ZoomableImages` turns into a Tab stop shows the components' focus ring, not only the
 * browser's thin outline on its edge.
 */
const zoomableFocusSpec: Spec = {
  name:
    "ZoomableImages: an image reached with the keyboard shows the components' focus ring inside its edge",
  pageId: "ui",
  run: async (page) => {
    const card = page.locator("#demo-ZoomableImages")
    const crop = card.locator(`[data-e2e="lightbox-crop"]`)
    await crop.focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Shift+Tab")
    await crop.and(page.locator(":focus-visible")).waitFor()
    const ring = await crop.evaluate((element) => {
      const style = getComputedStyle(element)
      // The ring colour resolved the way the browser resolves the outline's, for comparison.
      const probe = document.createElement("span")
      probe.style.color = "var(--color-ring)"
      element.parentElement!.append(probe)
      const ringColour = getComputedStyle(probe).color
      probe.remove()
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        offset: style.outlineOffset,
        colour: style.outlineColor,
        ringColour,
      }
    })
    if (ring.style === "none" || ring.width !== "2px") {
      throw new Error(`the focused image shows no focus ring: ${JSON.stringify(ring)}`)
    }
    if (ring.colour !== ring.ringColour) {
      throw new Error(`the focus ring is not the components' colour: ${JSON.stringify(ring)}`)
    }
    // Inside the edge, so a frame that clips the image (WindowFrame) still shows all four sides.
    if (parseFloat(ring.offset) >= 0) {
      throw new Error(
        `the focus ring sits outside the image, where a frame clips it: ${ring.offset}`,
      )
    }
  },
}

export const specs: readonly Spec[] = [
  zoomableCropSpec,
  zoomableFocusSpec,
]
