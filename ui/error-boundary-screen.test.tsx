import { expect } from "@std/expect"
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd"
import type { VNode } from "preact"
import { render } from "preact-render-to-string"
import { ErrorBoundaryScreen, type ErrorBoundaryScreenProps } from "./error-boundary-screen.tsx"

const defaults: ErrorBoundaryScreenProps = {
  title: "Something went wrong.",
  description: "Reloading the page usually fixes it.",
  reloadLabel: "Reload the page",
}

/** The reload button's click handler, taken from the element tree the screen returns. */
function reloadHandler(props: ErrorBoundaryScreenProps): () => void {
  const screen = ErrorBoundaryScreen(props) as VNode<{ children: VNode<{ action: VNode }> }>
  const button = screen.props.children.props.action as VNode<{ onClick: () => void }>
  return button.props.onClick
}

describe("ErrorBoundaryScreen", () => {
  const own = Object.getOwnPropertyDescriptor(globalThis, "location")
  let reloadedOn: unknown[] = []
  const fakeLocation = {
    reload(this: unknown) {
      reloadedOn.push(this)
    },
  }

  beforeEach(() => {
    reloadedOn = []
    Object.defineProperty(globalThis, "location", { value: fakeLocation, configurable: true })
  })

  afterEach(() => {
    if (own) Object.defineProperty(globalThis, "location", own)
    else delete (globalThis as { location?: unknown }).location
  })

  it("reloads the page through location.reload() when no onReload port is given", () => {
    reloadHandler(defaults)()

    expect(reloadedOn).toHaveLength(1)
    expect(reloadedOn[0]).toBe(fakeLocation)
  })

  it("calls the onReload port instead of reloading when one is given", () => {
    let calls = 0
    reloadHandler({ ...defaults, onReload: () => calls++ })()

    expect(calls).toBe(1)
    expect(reloadedOn).toHaveLength(0)
  })

  it("reads location only when the button is pressed", () => {
    delete (globalThis as { location?: unknown }).location

    expect(render(<ErrorBoundaryScreen {...defaults} />)).toContain("Reload the page")
  })

  it("shows the title at the given heading level, the description and the button text", () => {
    const html = render(
      <ErrorBoundaryScreen
        title="Oups."
        description="Rechargez la page."
        reloadLabel="Recharger"
        headingLevel={1}
        dataE2E="render-error"
      />,
    )

    expect(html).toMatch(/^<div role="alert" data-e2e="render-error">/)
    expect(html).toMatch(/<h1[^>]*>Oups\.<\/h1>/)
    expect(html).toContain("Rechargez la page.")
    expect(html).toMatch(/<button[^>]*data-e2e="render-error-reload"[^>]*>Recharger<\/button>/)
  })
})
