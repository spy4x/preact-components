import type { Spec } from "../runner.ts"
import { axeCleanIn } from "../axe-clean.ts"

export const specs: readonly Spec[] = [
  ...(["light", "dark"] as const).map((palette): Spec => ({
    name: `Prose with copyCode, ${palette}: Tab goes from a code block to its named copy button, ` +
      "which shows a focus ring, copies the block's text without its final newline and " +
      "announces it, and a long line scrolls inside the block",
    pageId: "ui",
    colorScheme: palette,
    run: async (page) => {
      const card = page.locator(`[data-e2e="prose-code-copy"]`)
      const block = card.locator("pre")
      const button = card.getByRole("button", { name: "Copy", exact: true })
      const status = card.locator("[data-prose-copy-status]")
      // The guide's two commands, without the newline the Markdown renderer ends a block with,
      // so a pasted command waits for Enter.
      const text = "deno add jsr:@spy4x/preact-ui\n" +
        "deno task dev --port=8000 --watch=static/,routes/ --env-file=.env.local"
      // The clipboard is replaced, so the spec reads what reached it and decides whether it works.
      await page.evaluate(() => {
        const state = globalThis as { __copyWorks?: boolean; __copied?: string[] }
        state.__copyWorks = true
        state.__copied = []
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: (copied: string) => {
              state.__copied?.push(copied)
              return state.__copyWorks ? Promise.resolve() : Promise.reject(new Error("denied"))
            },
          },
        })
        document.execCommand = () => false
      })
      await button.waitFor()

      const wide = await block.evaluate((pre) => {
        const style = getComputedStyle(pre)
        const content = pre.clientHeight - parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom)
        return {
          scrolls: pre.scrollWidth > pre.clientWidth,
          lines: Math.round(content / parseFloat(style.lineHeight)),
        }
      })
      if (!wide.scrolls) throw new Error("the long line does not scroll inside its block")
      if (wide.lines !== 2) throw new Error(`two commands take ${wide.lines} lines: one wrapped`)
      // The first line starts below the button, so the text that scrolls under its corner is
      // never covered.
      const gap = await card.evaluate((node) => {
        const pre = node.querySelector("pre")
        const control = node.querySelector("[data-prose-copy]")
        if (!pre || !control) return Number.NaN
        const line = document.createRange()
        line.selectNodeContents(pre)
        return line.getClientRects()[0].top - control.getBoundingClientRect().bottom
      })
      if (!(gap >= 0)) throw new Error(`the copy button covers the first line by ${-gap} px`)

      await block.focus()
      await page.keyboard.press("Tab")
      await button.and(page.locator(":focus")).waitFor()
      const ring = await button.evaluate((element) => getComputedStyle(element).boxShadow)
      if (ring === "none") throw new Error("the copy button shows no focus ring")

      await page.keyboard.press("Enter")
      await status.filter({ hasText: /^Copied$/ }).waitFor()
      const copied = await page.evaluate(() => (globalThis as { __copied?: string[] }).__copied)
      if (JSON.stringify(copied) !== JSON.stringify([text])) {
        throw new Error(`the clipboard got ${JSON.stringify(copied)}`)
      }

      await page.evaluate(() => (globalThis as { __copyWorks?: boolean }).__copyWorks = false)
      await page.keyboard.press("Enter")
      await status.filter({ hasText: /^Couldn't copy$/ }).waitFor()
      await axeCleanIn(page, `[data-e2e="prose-code-copy"]`)
      return `ring ${ring}, ${wide.lines} lines tall, first line ${gap} px below the button`
    },
  })),
]
