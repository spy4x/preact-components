import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { enhanceCodeCopy } from "./prose-copy.tsx"

/** The text of a block, as the Markdown renderer left it: two lines and the closing newline. */
const BLOCK_TEXT = "deno add jsr:@spy4x/preact-ui\ndeno task dev\n"

/**
 * One code block as `Prose` renders it with `copyCode`, as the few DOM members the enhancer reads:
 * the wrapper, its `<pre>`, the hidden button with its words, and the live region.
 */
function codeBlock(text = BLOCK_TEXT) {
  const attributes = new Map([["data-copied", "Copied"], ["data-failed", "Couldn't copy"]])
  const listeners: (() => void)[] = []
  const status = {
    textContent: "",
    hasAttribute: (name: string) => name === "data-prose-copy-status",
  }
  const pre = { textContent: text }
  const button = {
    hidden: true,
    listeners,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    addEventListener: (_type: string, listener: () => void) => void listeners.push(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      void listeners.splice(listeners.indexOf(listener), 1),
    closest: (selector: string) =>
      selector === "[data-prose-code]"
        ? { querySelector: (tag: string) => tag === "pre" ? pre : null }
        : null,
    nextElementSibling: status,
  }
  const root = {
    querySelectorAll: (selector: string) => selector === "button[data-prose-copy]" ? [button] : [],
  } as unknown as ParentNode
  /** Presses the button and lets the copy settle. */
  const press = async () => {
    for (const listener of [...listeners]) listener()
    await new Promise((done) => setTimeout(done, 0))
  }
  return { root, button, status, attributes, press }
}

describe("enhanceCodeCopy", () => {
  it("copies the block's exact text, closing newline kept, and announces Copied", async () => {
    const block = codeBlock()
    const copied: string[] = []
    const undo = enhanceCodeCopy(block.root, (text) => void copied.push(text))
    expect(block.button.hidden).toBe(false)

    await block.press()

    expect(copied).toEqual([BLOCK_TEXT])
    expect(block.status.textContent).toBe("Copied")
    expect(block.attributes.get("data-status")).toBe("copied")
    undo()
  })

  it("announces the failure, and no Copied, when the clipboard refuses", async () => {
    const block = codeBlock()
    const undo = enhanceCodeCopy(block.root, () => false)

    await block.press()

    expect(block.status.textContent).toBe("Couldn't copy")
    expect(block.attributes.get("data-status")).toBe("failed")
    undo()
  })

  it("wires a button once when called twice, and hides it again on undo", async () => {
    const block = codeBlock()
    const copied: string[] = []
    const undo = enhanceCodeCopy(block.root, (text) => void copied.push(text))
    const second = enhanceCodeCopy(block.root, (text) => void copied.push(text))

    await block.press()
    expect(copied.length).toBe(1)

    second()
    expect(block.button.hidden).toBe(false)
    undo()
    expect(block.button.hidden).toBe(true)
    expect(block.button.listeners.length).toBe(0)
    expect(block.status.textContent).toBe("")
  })
})
