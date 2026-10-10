/** A spec shared by every package whose guide page has an area that scrolls inside the page. */
import type { GuidePageId } from "@spy4x/preact-ui-guide/registry"
import type { Spec } from "./runner.ts"

/** One area that scrolls inside its own box, and how a keyboard is expected to reach it. */
export interface ScrollRegion {
  /** What the area is, for the spec's name. */
  what: string
  /** The guide page it is on. */
  pageId: GuidePageId
  /** Selects the scrolling element itself. */
  selector: string
  /** Its accessible name. */
  name: string
  /** The arrow key that scrolls it, which also picks the axis that is read. */
  key: "ArrowRight" | "ArrowDown"
}

/**
 * A spec proving a keyboard can scroll one area: it is a named group, the Tab key lands on it from
 * the stop before it, and an arrow key then moves its content.
 *
 * @param region The area and what is expected of it.
 * @returns The spec.
 */
export function scrollRegionSpec({ what, pageId, selector, name, key }: ScrollRegion): Spec {
  return {
    name: `${what}: Tab reaches the scrolling area, which is named, and an arrow key scrolls it`,
    pageId,
    run: async (page) => {
      const region = page.locator(selector).and(page.getByRole("group", { name, exact: true }))
      await region.waitFor()
      const horizontal = key === "ArrowRight"
      const room = await region.evaluate(
        (node, horizontal) =>
          horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight,
        horizontal,
      )
      if (room <= 0) throw new Error("the area has nothing to scroll, so the spec proves nothing")

      // From the stop before it, so the area is proven to be in the Tab order and not merely
      // focusable from a script.
      await region.focus()
      await page.keyboard.press("Shift+Tab")
      await page.locator(":focus").and(page.locator(`:not(${selector})`)).waitFor()
      await page.keyboard.press("Tab")
      await region.and(page.locator(":focus")).waitFor()

      await page.keyboard.press(key)
      const moved = await page.waitForFunction(
        ({ selector, horizontal }) => {
          const node = document.querySelector(selector)
          return node ? (horizontal ? node.scrollLeft : node.scrollTop) : 0
        },
        { selector, horizontal },
      )
      return `scrolled ${await moved.jsonValue()}px of ${room}px`
    },
  }
}
