import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { ErrorBoundary } from "./error-boundary.tsx"

/*
 * A server render runs no error boundary, so the reload screen, `onError` and the reload port are
 * proven in a real browser instead: `pages/checks/ui.ts`, `errorBoundaryChecks`.
 */

function Broken(): never {
  throw new Error("view blew up")
}

describe("ErrorBoundary", () => {
  it("renders its children untouched while nothing throws", () => {
    expect(render(
      <ErrorBoundary title="Unused">
        <p>fine</p>
      </ErrorBoundary>,
    )).toBe("<p>fine</p>")
  })

  it("does not catch during a server render, where Preact runs no error boundary", () => {
    let reported = 0
    expect(() =>
      render(
        <ErrorBoundary onError={() => reported++}>
          <Broken />
        </ErrorBoundary>,
      )
    ).toThrow("view blew up")
    expect(reported).toBe(0)
  })
})
