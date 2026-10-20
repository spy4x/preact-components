import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import type { JSX } from "preact"
import { render } from "preact-render-to-string"
import { lazyModule } from "./lazy.ts"

describe("lazyModule", () => {
  it("renders the loading state on the server and never starts the load during a render", () => {
    let loads = 0
    const lazy = lazyModule(() => {
      loads++
      return Promise.resolve({ answer: 42 })
    })
    function Card(): JSX.Element {
      const state = lazy.use()
      return <p>{state.status === "loaded" ? state.module.answer : state.status}</p>
    }

    expect(render(<Card />)).toBe("<p>loading</p>")
    expect(render(<Card />)).toBe("<p>loading</p>")
    expect(loads).toBe(0)
  })

  it("shares one load between callers and keeps the module once loaded", async () => {
    let loads = 0
    const lazy = lazyModule(() => {
      loads++
      return Promise.resolve({ answer: 42 })
    })
    const [first, second] = await Promise.all([lazy.load(), lazy.load()])
    expect(first).toEqual({ status: "loaded", module: { answer: 42 } })
    expect(second).toBe(first)
    await lazy.load()
    expect(loads).toBe(1)
  })

  it("loads again after a failed load, and renders the module once that one succeeds", async () => {
    let loads = 0
    const lazy = lazyModule(() =>
      ++loads === 1 ? Promise.reject(new Error("chunk missing")) : Promise.resolve({ answer: 42 })
    )
    function Card(): JSX.Element {
      const state = lazy.use()
      return <p>{state.status === "loaded" ? state.module.answer : state.status}</p>
    }

    expect(await lazy.load()).toEqual({ status: "failed", message: "chunk missing" })
    expect(render(<Card />)).toBe("<p>loading</p>")
    expect(await lazy.load()).toEqual({ status: "loaded", module: { answer: 42 } })
    expect(loads).toBe(2)
    expect(render(<Card />)).toBe("<p>42</p>")
  })
})
