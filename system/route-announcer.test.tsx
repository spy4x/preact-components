import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { useRouteAnnouncer } from "./route-announcer.ts"

/** A layout the way an app calls the hook: once, above the page, with the router's path. */
function Layout({ path }: { path: string }) {
  useRouteAnnouncer({ path, title: "Inbox — Acme" })
  return (
    <main>
      <h1>Inbox</h1>
    </main>
  )
}

describe("useRouteAnnouncer", () => {
  it("renders on a server, where there is no document", () => {
    expect("document" in globalThis).toBe(false)
    expect(render(<Layout path="/inbox?filter=open" />)).toBe("<main><h1>Inbox</h1></main>")
  })
})
