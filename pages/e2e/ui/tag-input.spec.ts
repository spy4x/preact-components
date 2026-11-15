import type { Spec } from "../runner.ts"

export const specs: readonly Spec[] = [
  {
    name:
      "TagInput: a held Backspace clears the typed text and removes no tag, and the next fresh press removes the last tag",
    pageId: "ui",
    run: async (page) => {
      const card = page.locator("#demo-TagInput")
      const input = card.locator("#guide-tag-input")
      const tags = card.locator(`[data-e2e="controlled-value"]`)
      await tags.getByText("tags: work", { exact: true }).waitFor()
      await input.pressSequentially("ab")

      // A second `down` of a key that is already down is the keyboard's repeat: two of the six
      // clear the text, and the other four arrive in the empty field.
      for (let press = 0; press < 6; press++) await page.keyboard.down("Backspace")
      await page.keyboard.up("Backspace")
      const text = await input.inputValue()
      if (text !== "") throw new Error(`the field holds "${text}" after a held Backspace`)
      const kept = await tags.innerText()
      if (kept !== "tags: work") throw new Error(`a held Backspace left "${kept}"`)

      await page.keyboard.press("Backspace")
      await tags.getByText("tags: (none)", { exact: true }).waitFor()
    },
  },
]
