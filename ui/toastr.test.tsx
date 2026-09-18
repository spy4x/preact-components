import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Toastr } from "./toastr.tsx"

describe("Toastr", () => {
  it("renders nothing when the stack is empty", () => {
    expect(render(<Toastr toasts={[]} onDismiss={() => {}} />)).toBe("")
  })

  it("renders one entry per toast", () => {
    const html = render(
      <Toastr
        toasts={[
          { id: 1, body: "Saved" },
          { id: 2, body: "Queued" },
        ]}
        onDismiss={() => {}}
      />,
    )

    expect(html).toContain("Saved")
    expect(html).toContain("Queued")
    expect(countOccurrences(html, "rounded-lg px-6 py-4")).toBe(2)
  })

  it("colours each variant", () => {
    expect(
      render(<Toastr toasts={[{ id: 1, body: "ok", type: "success" }]} onDismiss={() => {}} />),
    )
      .toContain("bg-green-700")
    expect(render(<Toastr toasts={[{ id: 1, body: "no", type: "error" }]} onDismiss={() => {}} />))
      .toContain("bg-red-600")
    expect(
      render(<Toastr toasts={[{ id: 1, body: "hmm", type: "warning" }]} onDismiss={() => {}} />),
    )
      .toContain("bg-yellow-700")
  })

  it("falls back to the info variant", () => {
    const html = render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} />)

    expect(html).toContain("bg-blue-700")
  })

  it("pins the stack to the top-right corner", () => {
    const html = render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} />)

    expect(html).toContain("fixed top-8 right-8")
    expect(html).toContain("z-50")
  })

  it("gives every toast a dismiss control", () => {
    const html = render(
      <Toastr toasts={[{ id: 1, body: "a" }, { id: 2, body: "b" }]} onDismiss={() => {}} />,
    )

    expect(countOccurrences(html, 'aria-label="Dismiss"')).toBe(2)
  })

  it("exposes the stack as a labelled region for e2e and assistive tech", () => {
    const html = render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} />)

    expect(html).toContain('data-e2e="toastr"')
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Notifications"')
  })

  it("takes a custom region label", () => {
    const html = render(
      <Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} label="Alerts" />,
    )

    expect(html).toContain('aria-label="Alerts"')
  })

  it("renders element bodies, not just strings", () => {
    const html = render(
      <Toastr
        toasts={[{ id: 1, body: <a href="/invoices/1">Invoice 1</a> }]}
        onDismiss={() => {}}
      />,
    )

    expect(html).toContain('href="/invoices/1"')
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
