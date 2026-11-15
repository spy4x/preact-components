import type { Locator } from "playwright-core"
import type { Spec } from "../runner.ts"

/**
 * Throws unless a dialog's two-button row is laid out for the viewport: at 390 px each button is
 * as wide as the row and the second sits under the first; at 1440 px both sit in one line at their
 * own width, the second to the right of the first and flush with the row's right edge.
 *
 * @param row The row: `DialogActions`, or a `Modal`'s footer.
 * @param width The viewport width the page is set to.
 * @returns What was measured, for the check's line.
 */
async function dialogRowFits(row: Locator, width: 390 | 1440): Promise<string> {
  const buttons = row.getByRole("button")
  await buttons.nth(1).waitFor()
  const [box, first, second] = await Promise.all(
    [row, buttons.nth(0), buttons.nth(1)].map((target) => target.boundingBox()),
  )
  if (box === null || first === null || second === null) throw new Error("the row is not drawn")
  // The row's content box: a footer has padding, `DialogActions` none.
  const inner = await row.evaluate((node) => {
    const style = getComputedStyle(node)
    return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) }
  })
  const contentLeft = box.x + inner.left
  const contentRight = box.x + box.width - inner.right
  const near = (a: number, b: number) => Math.abs(a - b) < 1
  if (width === 390) {
    for (const [name, button] of [["first", first], ["second", second]] as const) {
      if (!near(button.x, contentLeft) || !near(button.x + button.width, contentRight)) {
        throw new Error(
          `the ${name} button spans ${button.x}-${button.x + button.width}, ` +
            `not the row's ${contentLeft}-${contentRight}`,
        )
      }
    }
    if (second.y < first.y + first.height) {
      throw new Error("the second button is not below the first")
    }
    return `390 px: both ${first.width} px wide, stacked`
  }
  if (!near(first.y, second.y)) throw new Error(`the buttons sit at y ${first.y} and ${second.y}`)
  if (first.x + first.width > second.x) {
    throw new Error("the first button is not left of the second")
  }
  if (!near(second.x + second.width, contentRight)) {
    throw new Error(
      `the row ends at ${contentRight}, the second button at ${second.x + second.width}`,
    )
  }
  if (first.width >= (contentRight - contentLeft) / 2) throw new Error("the buttons are stretched")
  return `1440 px: one line, right-aligned`
}

/**
 * A dialog's button row (spy4x/seed#332): `DialogActions` and `Modal`'s footer stack Cancel over the
 * submit, full width, on a phone, and line them up right-aligned on a desktop.
 */
function dialogRowSpecs(): Spec[] {
  return [
    {
      name: "DialogActions: at 390 px Cancel and the submit are full width with the submit " +
        "below, and at 1440 px they sit in one line, right-aligned",
      pageId: "ui",
      run: async (page) => {
        const row = page.locator(`[data-e2e="dialog-actions-row"]`)
        const lines: string[] = []
        for (const width of [390, 1440] as const) {
          await page.setViewportSize({ width, height: 900 })
          await row.scrollIntoViewIfNeeded()
          lines.push(await dialogRowFits(row, width))
        }
        return lines.join("; ")
      },
    },
    {
      name: "Modal footer: at 390 px Cancel and Save are full width with Save below, and at " +
        "1440 px they sit in one line, right-aligned",
      pageId: "ui",
      run: async (page) => {
        const lines: string[] = []
        for (const width of [390, 1440] as const) {
          await page.setViewportSize({ width, height: 900 })
          await page.locator("#demo-Modal").getByRole("button", { name: "default dialog" }).click()
          const dialog = page.locator(`dialog[data-e2e="guide-modal"]`)
          lines.push(await dialogRowFits(dialog.locator("footer"), width))
          await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
          await dialog.waitFor({ state: "detached" })
        }
        return lines.join("; ")
      },
    },
    {
      name: "LayoutCustomiser footer at 1440 px: its own full-width wrapper keeps Reset at the " +
        "left edge and Done at the right",
      pageId: "ui",
      run: async (page) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.locator(`#demo-LayoutCustomiser [data-e2e="layout-open"]`).click()
        const dialog = page.locator(`dialog[data-e2e="layout-customiser"]`)
        const footer = dialog.locator("footer")
        const reset = footer.getByRole("button", { name: "Reset to default", exact: true })
        const done = footer.getByRole("button", { name: "Done", exact: true })
        await done.waitFor()
        const [box, resetBox, doneBox] = await Promise.all(
          [footer, reset, done].map((target) => target.boundingBox()),
        )
        if (box === null || resetBox === null || doneBox === null) {
          throw new Error("the footer or its buttons are not drawn")
        }
        const inner = await footer.evaluate((node) => {
          const style = getComputedStyle(node)
          return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) }
        })
        const left = box.x + inner.left
        const right = box.x + box.width - inner.right
        if (Math.abs(resetBox.x - left) >= 1) {
          throw new Error(`Reset starts at ${resetBox.x}, not the footer's left edge ${left}`)
        }
        if (Math.abs(doneBox.x + doneBox.width - right) >= 1) {
          throw new Error(
            `Done ends at ${doneBox.x + doneBox.width}, not the footer's edge ${right}`,
          )
        }
        return `Reset at ${resetBox.x}, Done ends at ${doneBox.x + doneBox.width}`
      },
    },
  ]
}

export const specs: readonly Spec[] = [
  ...dialogRowSpecs(),
]
