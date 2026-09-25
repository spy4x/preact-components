import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { InstallBox } from "./install-box.tsx"

describe("InstallBox", () => {
  it("renders the command as real, selectable text inside a code element", () => {
    const html = render(<InstallBox command="deno add jsr:@spy4x/preact-ui" />)
    expect(html).toContain("<code")
    expect(html).toContain("deno add jsr:@spy4x/preact-ui")
  })

  it("renders a copy control labelled for the command", () => {
    const html = render(
      <InstallBox command="npm install cool-thing" copyLabel="Copy install command" />,
    )
    expect(html).toContain("Copy install command")
  })

  it("defaults the copy label to Copy command", () => {
    expect(render(<InstallBox command="pnpm add cool-thing" />)).toContain("Copy command")
  })

  it("passes the caller's class through", () => {
    expect(render(<InstallBox command="echo hi" class="max-w-sm" />)).toContain("max-w-sm")
  })
})
