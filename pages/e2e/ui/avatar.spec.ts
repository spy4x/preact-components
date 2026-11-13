import type { Spec } from "../runner.ts"

/**
 * An `Avatar` in a `Table` row keeps its circle while the pointer is on the row: the row's hover
 * fill and the avatar's own fill must differ, or the initials float on nothing.
 */
function avatarOnHoveredRowSpec(colorScheme: "light" | "dark"): Spec {
  return {
    name: `Avatar: on a hovered Table row the circle keeps a fill of its own (${colorScheme})`,
    pageId: "ui",
    colorScheme,
    run: async (page) => {
      const row = page.locator(`#demo-Table [data-e2e="ui-guide-row"]`).first()
      const avatar = row.locator(`span.rounded-full[aria-hidden="true"]`)
      await row.scrollIntoViewIfNeeded()
      await row.hover()
      await row.and(page.locator(":hover")).waitFor()
      const fills = await row.evaluate((element) => {
        const circle = element.querySelector(`span.rounded-full[aria-hidden="true"]`)
        if (!circle) throw new Error("the row holds no avatar")
        return {
          row: getComputedStyle(element).backgroundColor,
          avatar: getComputedStyle(circle).backgroundColor,
        }
      })
      await avatar.waitFor()
      if (fills.row === fills.avatar) {
        throw new Error(`the hovered row and the avatar are both ${fills.row}`)
      }
      return `row ${fills.row}, avatar ${fills.avatar}`
    },
  }
}

export const specs: readonly Spec[] = [
  avatarOnHoveredRowSpec("light"),
  avatarOnHoveredRowSpec("dark"),
]
