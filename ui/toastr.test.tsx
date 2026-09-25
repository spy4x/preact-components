import { createToastStore, type ToastEntry } from "@spy4x/preact-signals/toast"
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { FakeTime } from "@std/testing/time"
import { render } from "preact-render-to-string"
import { defaultToastDuration, resolveDuration, type ToastItem, Toastr } from "./toastr.tsx"

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

/**
 * The compile-time guard on the field both packages share.
 *
 * Both packages have to keep spelling the dismiss delay `duration`. Renaming either side turns
 * this line into a type error, and so does retyping one side to something disjoint from `number`
 * (a `string`), so `deno task ts:check` says so before anybody has to notice a toast leaving early.
 *
 * It does not catch a widening. `duration?: number | string` on one side still intersects with
 * `number` on the other, so the line compiles; a review would have to catch that one.
 */
type SharedDurationField = NonNullable<ToastEntry["duration"] & ToastItem["duration"]>
const _durationIsTheSharedName: SharedDurationField = 1

/**
 * What these tests prove, and what they cannot.
 *
 * They build toasts through a real `createToastStore` and ask the component's own
 * `resolveDuration` what delay each entry resolves to — so a store that writes the delay under
 * another name, or a resolver that reads another name or turns `0` into the default, goes red here.
 *
 * They do **not** prove that `Toastr` uses what `resolveDuration` returns. The string renderer
 * runs no effects, so no timer is ever started in this file, and a component that ignored the
 * delay entirely would pass every test below. That half is proven in a real browser, by the check
 * "a toast pushed through the store runs the delay the store was asked for, and duration: 0 keeps
 * it until somebody dismisses it" in `pages/checks/ui.ts`: it is the one that goes red when the
 * component stops reading the delay. Deleting it because these look like they cover the same
 * ground would leave that half unguarded.
 */
describe("Toastr wired to createToastStore", () => {
  it("resolves a store entry to the delay the store was asked for", () => {
    // Each package's own suite passed throughout both #174 and #175, because neither ever put the
    // two together: the store wrote its delay under one name and the component read another, so a
    // toast asked to stay for twenty seconds left after five.
    const store = createToastStore({ nextId: () => "wired" })
    store.add({ body: "read me", duration: 20_000 })

    const [entry] = store.list.value
    expect(resolveDuration(entry)).toBe(20_000)
    expect(resolveDuration(entry)).not.toBe(defaultToastDuration)
  })

  it("resolves a store entry asked to stay until it is dismissed to zero", () => {
    const store = createToastStore({ nextId: () => "sticky" })
    store.add({ body: "keep me", duration: 0 })

    // `0` has to survive the crossing as `0`. A `||` anywhere on either side turns it into the
    // five-second default, which is the case #175 broke worst.
    expect(store.list.value[0].duration).toBe(0)
    expect(resolveDuration(store.list.value[0])).toBe(0)
  })

  it("leaves a store toast on the list for as long as nothing dismisses it", () => {
    // The store's half of the same sentence, against a clock that has really moved: half a minute
    // passes, six times the component's default, and the toast is still there to be rendered.
    const clock = new FakeTime()
    try {
      const store = createToastStore({ nextId: () => "sticky" })
      store.add({ body: "keep me", duration: 0 })
      clock.tick(30_000)

      const html = render(
        <Toastr toasts={store.list.value} onDismiss={(id) => store.remove(String(id))} />,
      )
      expect(html).toContain("keep me")
    } finally {
      clock.restore()
    }
  })

  it("resolves a store entry that named no delay to the component's default", () => {
    // The other side of "one default, in one place": the store deliberately puts no number here,
    // so the fallback is the component's and there is nothing for the two to disagree about.
    const store = createToastStore({ nextId: () => "plain" })
    store.add({ body: "saved" })

    expect(store.list.value[0].duration).toBeUndefined()
    expect(resolveDuration(store.list.value[0])).toBe(defaultToastDuration)
  })

  it("renders a store's list without an adapter between them", () => {
    const store = createToastStore({ nextId: () => "rendered" })
    store.error({ body: "could not save", duration: 0 })

    const html = render(
      <Toastr toasts={store.list.value} onDismiss={(id) => store.remove(String(id))} />,
    )

    expect(html).toContain("could not save")
    expect(html).toContain('role="alert"')
  })
})

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
