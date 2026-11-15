import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { listenToKeydown } from "./keydown.ts"

describe("listenToKeydown", () => {
  it("listens until the returned cleanup runs, then hears nothing", () => {
    const listeners = new Set<(event: KeyboardEvent) => void>()
    const target = {
      addEventListener: (_: string, listener: (event: KeyboardEvent) => void) =>
        void listeners.add(listener),
      removeEventListener: (_: string, listener: (event: KeyboardEvent) => void) =>
        void listeners.delete(listener),
    }
    const heard: string[] = []
    const stop = listenToKeydown(target, (event) => void heard.push(event.key))
    for (const listener of listeners) listener({ key: "n" } as KeyboardEvent)
    stop()
    for (const listener of listeners) listener({ key: "g" } as KeyboardEvent)
    expect(heard).toEqual(["n"])
    expect(listeners.size).toBe(0)
  })
})
