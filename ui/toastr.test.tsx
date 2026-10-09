import { createToastStore, type ToastEntry } from "@spy4x/preact-signals/toast"
import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { FakeTime } from "@std/testing/time"
import { options } from "preact"
import { render } from "preact-render-to-string"
import {
  defaultToastActionDuration,
  defaultToastDuration,
  resolveDuration,
  type ToastCorner,
  type ToastId,
  type ToastItem,
  Toastr,
  type ToastrProps,
} from "./toastr.tsx"

/** The classes on the stack's own element, one per entry. */
function stackClasses(html: string): string[] {
  return html.match(/<div[^>]*role="region"[^>]*>/)?.[0].match(/class="([^"]*)"/)?.[1]
    .split(/\s+/) ?? []
}

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
      .toContain("bg-success text-(--color-success-foreground)")
    expect(render(<Toastr toasts={[{ id: 1, body: "no", type: "error" }]} onDismiss={() => {}} />))
      .toContain("bg-danger-fill text-danger-fill-foreground")
    expect(
      render(<Toastr toasts={[{ id: 1, body: "hmm", type: "warning" }]} onDismiss={() => {}} />),
    )
      .toContain("bg-warning text-(--color-warning-foreground)")
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

  it("pins the stack to the top-right corner by default", () => {
    const html = render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} />)

    expect(stackClasses(html)).toEqual(
      expect.arrayContaining(["fixed", "top-8", "right-8", "z-50"]),
    )
    expect(stackClasses(html)).not.toContain("left-8")
    expect(stackClasses(html)).not.toContain("bottom-8")
  })

  it("renders the same markup with no corner as with top-right", () => {
    const toasts = [{ id: 1, body: "note" }, { id: 2, body: "later", type: "error" as const }]

    expect(render(<Toastr toasts={toasts} onDismiss={() => {}} />)).toBe(
      render(<Toastr toasts={toasts} onDismiss={() => {}} corner="top-right" />),
    )
  })

  it("puts the stack in the corner it is asked for", () => {
    const expected: Record<ToastCorner, [string, string]> = {
      "top-left": ["top-8", "left-8"],
      "top-right": ["top-8", "right-8"],
      "bottom-left": ["bottom-8", "left-8"],
      "bottom-right": ["bottom-8", "right-8"],
    }
    for (const [corner, [vertical, horizontal]] of Object.entries(expected)) {
      const classes = stackClasses(
        render(<Toastr toasts={[]} onDismiss={() => {}} corner={corner as ToastCorner} />),
      )
      const others = ["top-8", "bottom-8", "left-8", "right-8"]
        .filter((edge) => edge !== vertical && edge !== horizontal)

      expect(classes, corner).toEqual(expect.arrayContaining(["fixed", vertical, horizontal]))
      for (const edge of others) expect(classes, `${corner} carries ${edge}`).not.toContain(edge)
    }
  })

  it("slides a toast in from the right in a right corner and from the left in a left one", () => {
    const toastClasses = (corner: ToastCorner) =>
      render(<Toastr toasts={[{ id: 1, body: "note" }]} onDismiss={() => {}} corner={corner} />)
        .match(/<div role="status" class="([^"]*)"/)?.[1].split(/\s+/) ?? []

    for (const corner of ["top-right", "bottom-right"] as const) {
      expect(toastClasses(corner), corner).toContain("motion-safe:starting:translate-x-8")
      expect(toastClasses(corner), corner).not.toContain("motion-safe:starting:-translate-x-8")
    }
    for (const corner of ["top-left", "bottom-left"] as const) {
      expect(toastClasses(corner), corner).toContain("motion-safe:starting:-translate-x-8")
      expect(toastClasses(corner), corner).not.toContain("motion-safe:starting:translate-x-8")
    }
  })

  it("keeps the caller's order in every corner", () => {
    const toasts = [{ id: 1, body: "first" }, { id: 2, body: "second" }]
    for (const corner of ["top-left", "bottom-right"] as const) {
      const html = render(<Toastr toasts={toasts} onDismiss={() => {}} corner={corner} />)

      expect(html.indexOf("first"), corner).toBeLessThan(html.indexOf("second"))
      expect(stackClasses(html), corner).not.toContain("flex-col-reverse")
    }
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

  it("renders a toast's action as a button named by its visible label alone", () => {
    const html = render(
      <Toastr
        toasts={[{ id: 1, body: "Note deleted", action: { label: "Undo", onAction: () => {} } }]}
        onDismiss={() => {}}
      />,
    )
    const button = html.match(/<button[^>]*>Undo<\/button>/)?.[0] ?? ""

    expect(button).toContain('type="button"')
    expect(button).not.toContain("aria-label")
    expect(button).not.toContain("title=")
    // The live area reads the toast's text, so the label has to be in it once and only once.
    expect(countOccurrences(html, "Undo")).toBe(1)
  })

  it("puts the action before the toast's dismiss control", () => {
    const html = render(
      <Toastr
        toasts={[{ id: 1, body: "Note deleted", action: { label: "Undo", onAction: () => {} } }]}
        onDismiss={() => {}}
      />,
    )
    const toast = html.slice(html.indexOf('role="status"'))

    expect(toast).toContain(">Undo</button>")
    expect(toast.indexOf(">Undo</button>")).toBeLessThan(toast.indexOf('aria-label="Dismiss"'))
  })

  it("still dismisses the toast when its action throws, and lets the error through", () => {
    // No DOM here: the action button's click handler is read off the element tree as it is made.
    let click: (() => void) | undefined
    const previous = options.vnode
    options.vnode = (vnode) => {
      const props = vnode.props as { onClick?: () => void; children?: unknown }
      if (vnode.type === "button" && props.children === "Undo") click = props.onClick
      previous?.(vnode)
    }
    const dismissed: ToastId[] = []
    try {
      render(
        <Toastr
          toasts={[{
            id: 7,
            body: "Note deleted",
            action: {
              label: "Undo",
              onAction: () => {
                throw new Error("restore failed")
              },
            },
          }]}
          onDismiss={(id) => void dismissed.push(id)}
        />,
      )
    } finally {
      options.vnode = previous
    }

    expect(click).toBeDefined()
    expect(() => click?.()).toThrow("restore failed")
    expect(dismissed).toEqual([7])
  })

  it("renders no action button for a toast without an action", () => {
    const html = render(<Toastr toasts={[{ id: 1, body: "Saved" }]} onDismiss={() => {}} />)

    expect(countOccurrences(html, "<button")).toBe(1)
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

  it("puts a toast's own data-e2e on that toast alone", () => {
    const html = render(
      <Toastr
        toasts={[
          { id: 1, body: "Saved", type: "success", dataE2E: "toast-saved" },
          { id: 2, body: "Queued" },
        ]}
        onDismiss={() => {}}
      />,
    )

    const toasts = html.match(/<div role="(?:status|alert)"[^>]*>/g) ?? []
    expect(toasts).toHaveLength(2)
    expect(toasts[0]).toContain('data-e2e="toast-saved"')
    expect(toasts[1]).not.toContain("data-e2e")
  })

  it("shows a toast's title above its body, inside the toast's live element", () => {
    const html = render(
      <Toastr
        toasts={[{ id: 1, type: "error", title: "Upload failed", body: "the file is too big" }]}
        onDismiss={() => {}}
      />,
    )

    const toast = html.match(/<div role="alert"[\s\S]*$/)?.[0] ?? ""
    expect(toast).toContain('<p class="font-semibold">Upload failed</p>')
    expect(toast.indexOf("Upload failed")).toBeLessThan(toast.indexOf("the file is too big"))
  })

  it("renders no heading for a toast without a title, or with an empty one", () => {
    const html = render(
      <Toastr
        toasts={[{ id: 1, body: "plain" }, { id: 2, title: "", body: "also plain" }]}
        onDismiss={() => {}}
      />,
    )

    expect(html).not.toContain("font-semibold")
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
 * The same guard for the title: renaming it on either side, or retyping one side to something
 * disjoint from `string`, makes this line a type error. That is the name #207 was about — the store
 * wrote it and the component never read it.
 */
type SharedTitleField = NonNullable<ToastEntry["title"] & ToastItem["title"]>
const _titleIsTheSharedName: SharedTitleField = "Saved"

/**
 * The same guard for the action: renaming it on either side, or retyping one side's shape so the
 * two no longer overlap, makes this line a type error.
 */
type SharedActionField = NonNullable<ToastEntry["action"] & ToastItem["action"]>
const _actionIsTheSharedName: SharedActionField = { label: "Undo", onAction: () => {} }

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
        <Toastr toasts={store.list.value} onDismiss={store.remove} />,
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

  it("gives a store toast with an action and no delay the longer action default", () => {
    const store = createToastStore({ nextId: () => "undo" })
    store.info({ body: "Note deleted", action: { label: "Undo", onAction: () => {} } })

    expect(defaultToastActionDuration).toBe(10_000)
    expect(resolveDuration(store.list.value[0])).toBe(defaultToastActionDuration)
  })

  it("keeps the delay a store toast with an action was asked for, zero included", () => {
    const action = { label: "Undo", onAction: () => {} }

    expect(resolveDuration({ duration: 3000, action })).toBe(3000)
    expect(resolveDuration({ duration: 0, action })).toBe(0)
  })

  it("renders the action a store entry carries", () => {
    const store = createToastStore({ nextId: () => "undo" })
    store.info({ body: "Note deleted", action: { label: "Undo", onAction: () => {} } })

    const html = render(<Toastr toasts={store.list.value} onDismiss={store.remove} />)

    expect(html).toMatch(/<button[^>]*>Undo<\/button>/)
  })

  it("shows the title the store filled in, and the one a caller gave it", () => {
    // #207: the store has always written a title and this component drew none, so a caller's
    // heading — the part that said what failed — vanished between the two.
    const store = createToastStore({ nextId: counterIds() })
    store.success({ body: "saved", duration: 0 })
    store.error({ title: "Could not save the draft", body: "offline", duration: 0 })

    const html = render(
      <Toastr toasts={store.list.value} onDismiss={store.remove} />,
    )

    expect(html).toContain('<p class="font-semibold">Success</p>')
    expect(html).toContain('<p class="font-semibold">Could not save the draft</p>')
  })

  it("takes the store's remove as its dismiss port, with no wrapper", () => {
    // A type test first: this assignment does not compile while `remove` takes a narrower id than
    // `onDismiss` is called with. The call then shows the id `Toastr` hands back reaches the store.
    const store = createToastStore({ nextId: () => "42" })
    store.add({ body: "gone", duration: 0 })
    const onDismiss: ToastrProps["onDismiss"] = store.remove

    onDismiss(42)

    expect(store.list.value).toEqual([])
  })

  it("renders a store toast's own data-e2e on that toast", () => {
    const store = createToastStore({ nextId: counterIds() })
    store.error({ body: "Upload failed", duration: 0, dataE2E: "toast-upload-failed" })

    const html = render(<Toastr toasts={store.list.value} onDismiss={store.remove} />)

    expect(html).toMatch(/<div role="alert" data-e2e="toast-upload-failed"[^>]*>/)
  })

  it("renders a store's list without an adapter between them", () => {
    const store = createToastStore({ nextId: () => "rendered" })
    store.error({ body: "could not save", duration: 0 })

    const html = render(
      <Toastr toasts={store.list.value} onDismiss={store.remove} />,
    )

    expect(html).toContain("could not save")
    expect(html).toContain('role="alert"')
  })
})

function counterIds(): () => string {
  let next = 0
  return () => `toast-${++next}`
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}
