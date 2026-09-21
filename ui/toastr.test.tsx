import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Toastr } from "./toastr.tsx"

describe("Toastr", () => {
  it("keeps the live area in the document when the stack is empty", () => {
    const html = render(<Toastr toasts={[]} onDismiss={() => {}} />)

    // The whole point of the change: an area that arrives together with its first message is
    // commonly not announced, so it has to be here, empty, before anything is pushed into it.
    expect(html).not.toBe("")
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-label="Notifications"')
    expect(html).not.toContain("rounded-lg px-6 py-4")
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

  it("interrupts for an error toast and stays polite for every other one", () => {
    const error = render(
      <Toastr toasts={[{ id: 1, body: "no", type: "error" }]} onDismiss={() => {}} />,
    )

    expect(error).toContain('role="alert"')
    expect(error).not.toContain('role="status"')

    // Asserted per variant rather than on the error alone, so a component that marked *everything*
    // as an alert would fail here instead of passing on half the contract.
    for (const type of ["success", "info", "warning"] as const) {
      const html = render(<Toastr toasts={[{ id: 1, body: "note", type }]} onDismiss={() => {}} />)

      expect(html).toContain('role="status"')
      expect(html).not.toContain('role="alert"')
    }
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

  it("names every dismiss control in the caller's own words", () => {
    const html = render(
      <Toastr
        toasts={[{ id: 1, body: "a" }, { id: 2, body: "b" }]}
        onDismiss={() => {}}
        dismissLabel="Ausblenden"
      />,
    )

    expect(countOccurrences(html, 'aria-label="Ausblenden"')).toBe(2)
    expect(html).not.toContain('aria-label="Dismiss"')
  })

  it("lets one toast name its own dismiss control", () => {
    const html = render(
      <Toastr
        toasts={[
          { id: 1, body: "upload failed", type: "error", dismissLabel: "Dismiss the upload error" },
          { id: 2, body: "saved" },
        ]}
        onDismiss={() => {}}
      />,
    )

    expect(html).toContain('aria-label="Dismiss the upload error"')
    expect(countOccurrences(html, 'aria-label="Dismiss"')).toBe(1)
  })

  it("exposes the stack as a labelled region for assistive tech", () => {
    const html = render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} />)

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Notifications"')
  })

  it("takes a custom region label", () => {
    const html = render(
      <Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} label="Alerts" />,
    )

    expect(html).toContain('aria-label="Alerts"')
  })

  it("ships no test hook unless the caller asks for one", () => {
    const withoutHook = render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} />)
    const withHook = render(
      <Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} dataE2E="guide-toastr" />,
    )

    expect(withoutHook).not.toContain("data-e2e")
    expect(withHook).toContain('data-e2e="guide-toastr"')
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
