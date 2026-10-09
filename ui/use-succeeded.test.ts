import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { signal } from "@preact/signals"
import { useSucceeded } from "./use-succeeded.ts"

// A hook runs only inside a component, so these calls sit in functions that are never called: the
// proof is what `deno task ts:check` accepts. What the hook does is proven in the browser by
// `useSucceededChecks` in `pages/checks/ui.ts`.
describe("useSucceeded", () => {
  it("takes a boolean, a message, an error or nothing as its failure", () => {
    const calls = () => {
      useSucceeded(false, false, () => {})
      useSucceeded(false, "Save failed", () => {})
      useSucceeded(false, new Error("Save failed"), () => {})
      useSucceeded(false, null, () => {})
      useSucceeded(false, undefined, () => {})
    }

    expect(calls).toBeInstanceOf(Function)
  })

  it("rejects a signal as its failure at compile time", () => {
    const error = signal<string | null>(null)
    const call = () => {
      // @ts-expect-error A signal object is always truthy, so `onDone` would never run; pass its
      // `.value`. Widening `failed` back to `unknown` re-breaks this.
      useSucceeded(false, error, () => {})
    }

    expect(call).toBeInstanceOf(Function)
  })
})
