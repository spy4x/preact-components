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
})
