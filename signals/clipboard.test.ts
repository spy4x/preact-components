import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { CLIPBOARD_UNAVAILABLE, type ClipboardPort, createClipboard } from "./clipboard.ts"

function fakeClipboard(fail = false) {
  const written: string[] = []
  const port: ClipboardPort = {
    writeText(text: string) {
      if (fail) return Promise.reject(new Error("denied"))
      written.push(text)
      return Promise.resolve()
    },
  }
  return { port, written }
}

describe("createClipboard", () => {
  it("writes the text and reports success", async () => {
    const { port, written } = fakeClipboard()
    const clipboard = createClipboard({ clipboard: port })
    const successes: string[] = []

    const copied = await clipboard.copy("hello", { onSuccess: (text) => successes.push(text) })

    expect(copied).toBe(true)
    expect(written).toEqual(["hello"])
    expect(successes).toEqual(["hello"])
  })

  it("reports the failure when the write rejects", async () => {
    const { port } = fakeClipboard(true)
    const clipboard = createClipboard({ clipboard: port })
    const errors: unknown[] = []

    const copied = await clipboard.copy("hello", { onError: (error) => errors.push(error) })

    expect(copied).toBe(false)
    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe("denied")
  })

  it("reports a missing clipboard instead of throwing", async () => {
    const clipboard = createClipboard({ clipboard: null })
    const errors: unknown[] = []

    const copied = await clipboard.copy("hello", { onError: (error) => errors.push(error) })

    expect(copied).toBe(false)
    expect((errors[0] as Error).message).toBe(CLIPBOARD_UNAVAILABLE)
  })

  it("needs no feedback at all", async () => {
    const { port } = fakeClipboard()
    expect(await createClipboard({ clipboard: port }).copy("hello")).toBe(true)
    expect(await createClipboard({ clipboard: null }).copy("hello")).toBe(false)
  })

  it("calls neither callback of the pair it was not given", async () => {
    const { port } = fakeClipboard(true)
    const clipboard = createClipboard({ clipboard: port })
    let successes = 0
    await clipboard.copy("hello", { onSuccess: () => successes++ })
    expect(successes).toBe(0)
  })
})
