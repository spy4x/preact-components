import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  applyScrollLock,
  backdropClickDismisses,
  backdropDismissesByDefault,
  type BackdropHitTarget,
  bindEscapeClose,
  clientWidthWithoutScrollbar,
  dialogHeldFocus,
  type DialogRect,
  dialogTitleId,
  DISMISS_KEY,
  type EscapeCloseHandlers,
  escapeCloseStrategy,
  isBackdropClick,
  isDismissKey,
  Modal,
  platformCloseHandler,
  restoreFocus,
  scrollLockPadding,
  shouldRetargetFocus,
  supportsClosedBy,
} from "./modal.tsx"
/**
 * The modal's source, for assertions about a parameter default.
 *
 * A function component's resolved props are not reachable from `preact-render-to-string` — refs and
 * effects never run — so a default expressed as `closeOnBackdrop = <constant>` has no rendered
 * symptom to assert on. Reading the declaration is the honest way to pin it: the test fails if the
 * default stops being the shared constant, which is the drift that matters.
 */
function modalDialogSource(): string {
  return Deno.readTextFileSync(new URL("./modal.tsx", import.meta.url))
}

/** The dialog's own box, as `getBoundingClientRect()` would report it in a 1000×800 viewport. */
const rect: DialogRect = { left: 300, top: 200, right: 700, bottom: 600 }

/** A click event; `backdropClickDismisses` reads only its target and coordinates. */
function clickAt(target: unknown, x: number, y: number): MouseEvent {
  return { target, clientX: x, clientY: y } as unknown as MouseEvent
}

describe("Modal", () => {
  it("renders nothing while closed", () => {
    expect(render(<Modal open={false} title="Delete">body</Modal>)).toBe("")
  })

  it("renders nothing by default, so an unopened modal cannot leak markup", () => {
    expect(render(<Modal title="Delete">body</Modal>)).toBe("")
  })

  it("renders a dialog whose open state is left to showModal()", () => {
    const html = render(<Modal open title="Delete">body</Modal>)

    expect(html).toContain("<dialog")
    expect(html).toContain("body")
    // Regression guard with a browser-measured reason: `<dialog open>` is the *non-modal* state, and
    // `showModal()` on such an element throws `InvalidStateError`, so rendering the attribute here
    // makes a modal impossible. This assertion is the only thing in a DOM-free suite that can hold
    // that line — no shim would have caught the original bug; headless Chromium did.
    expect(html).not.toMatch(/<dialog[^>]*\sopen(?:\s|>)/)
  })

  it("honours defaultOpen when uncontrolled", () => {
    const html = render(<Modal defaultOpen title="Delete">body</Modal>)

    expect(html).toContain("<dialog")
    expect(html).not.toMatch(/<dialog[^>]*\sopen(?:\s|>)/)
  })

  it("marks itself as a modal dialog for assistive tech", () => {
    const html = render(<Modal open title="Delete">body</Modal>)

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
  })

  it("takes its accessible name from the title element", () => {
    const html = render(<Modal open title="Delete invoice?">body</Modal>)
    const referenced = html.match(/aria-labelledby="([^"]+)"/)?.[1] as string

    expect(referenced).toBeTruthy()
    expect(html).toContain(`<h2 id="${referenced}"`)
  })

  it("leaves exactly one element carrying the referenced id", () => {
    const html = render(<Modal open title="Delete invoice?">body</Modal>)
    const referenced = html.match(/aria-labelledby="([^"]+)"/)?.[1] as string
    const carriesId = html.match(new RegExp(`id="${referenced}"`, "g")) ?? []

    expect(carriesId.length).toBe(1)
    expect(html.match(/<h2/g)?.length).toBe(1)
  })

  it("numbers generated title ids apart", () => {
    // Compared against each other, not against the counter's absolute value: the sequence is
    // module-level, so a sibling test rendering a dialog first must not renumber this one.
    const first = render(<Modal open title="First">a</Modal>)
    const second = render(<Modal open title="Second">b</Modal>)
    const firstId = first.match(/aria-labelledby="([^"]+)"/)?.[1]
    const secondId = second.match(/aria-labelledby="([^"]+)"/)?.[1]

    expect(firstId).toBeTruthy()
    expect(secondId).not.toBe(firstId)
  })

  it("uses a caller-supplied title id instead of a generated one", () => {
    const html = render(<Modal open title="Delete invoice?" titleId="confirm-heading">body</Modal>)

    expect(html).toContain('aria-labelledby="confirm-heading"')
    expect(html).toContain('<h2 id="confirm-heading"')
    expect(html.match(/id="modal-title-\d+"/g)).toBe(null)
  })

  it("falls back to aria-label when there is no title element to reference", () => {
    const html = render(<Modal open ariaLabel="Draft settings">body</Modal>)

    expect(html).toContain('aria-label="Draft settings"')
    expect(html).not.toContain("aria-labelledby")
    expect(html).not.toContain("<h2")
  })

  it("carries no name attribute at all when the caller gives neither title nor label", () => {
    const html = render(<Modal open>body</Modal>)

    expect(html).not.toContain("aria-labelledby")
    expect(html).not.toContain("aria-label")
  })

  it("renders a header dismiss control only when labelled", () => {
    const labelled = render(<Modal open title="Delete" cancelLabel="Cancel" />)

    expect(labelled).toContain('aria-label="Cancel"')
    expect(labelled).toContain('title="Cancel"')
    expect(render(<Modal open title="Delete" />)).not.toContain("<svg")
  })

  it("renders footer content only when given", () => {
    const html = render(<Modal open title="Delete" footer={<span>actions</span>} />)

    expect(html).toContain("<footer")
    expect(html).toContain("actions")
    expect(render(<Modal open title="Delete" />)).not.toContain("<footer")
  })

  it("keeps the headless body padding off the dialog element itself", () => {
    // The dialog paints its own padded children; a `p-*` on the element would fight `max-w-md`.
    const html = render(<Modal open title="Delete">body</Modal>)

    expect(html).toContain("p-0")
    expect(html).toContain("max-w-md")
  })

  it("centres itself and names the backdrop colour", () => {
    const html = render(<Modal open title="Delete" />)

    expect(html).toContain("m-auto")
    expect(html).toContain("backdrop:bg-black/50")
  })

  it("wires the Escape handler that makes a refusal possible", () => {
    // `closedby="none"` and the keydown listener are two halves of one mechanism: the attribute stops
    // the uncancellable platform close and the listener is what routes Escape through the port. Either
    // one alone leaves Escape ungovernable — dropping the listener used to stay green, which is the
    // same shape of gap as the bug this path was written to fix.
    expect(modalDialogSource()).toContain('addEventListener("keydown"')
    expect(modalDialogSource()).toContain("isDismissKey(")
    expect(modalDialogSource()).toContain('removeEventListener("keydown"')
  })

  it("takes the uncancellable platform close out of the picture", () => {
    // `closedby="none"` is the whole reason a refused Escape can keep the dialog open: the `cancel`
    // event is not cancelable, so the platform's own Escape close cannot be prevented, and the
    // component handles the key instead. Without this attribute the refusal path is unreachable.
    expect(render(<Modal open title="Delete">body</Modal>)).toContain('closedby="none"')
  })

  it("renders closedby=none whichever platform will read it", () => {
    // Regression guard for the fix's shape. The attribute is static markup while the platform branch
    // lives in the effect — this suite renders on the server, where there is no `HTMLDialogElement`
    // to detect with, so the two platforms cannot produce different markup here. Where the attribute
    // is honoured it is the mechanism a refusal leans on; where it is ignored it is inert and the
    // `cancel` fallback takes over. Dropping it from either world would break the supported one.
    const html = render(<Modal open title="Delete">body</Modal>)

    expect(html).toContain('closedby="none"')
    expect(html.match(/closedby=/g)?.length).toBe(1)
  })

  it("gates its Escape branch on the platform, not on the attribute alone", () => {
    // The load-bearing line of the fix, pinned at the source. `supportsClosedBy`, `escapeCloseStrategy`
    // and `bindEscapeClose` are all covered directly below, but nothing in a DOM-free suite observes
    // *which* of them the effect consults: a refactor that passed `true` unconditionally would leave
    // the fallback dead code with every other test in this file still green.
    const source = modalDialogSource()

    expect(source).toContain("supportsClosedBy(globalThis.HTMLDialogElement?.prototype)")
    expect(source).toContain('addEventListener("cancel"')
    expect(source).toContain('removeEventListener("cancel"')
    // The fallback's wiring, as text. Passing the state setter through is not behaviour a DOM-free
    // suite can observe, but unhooking it — handing `platformCloseHandler` a no-op `settleOpen` — is
    // the one mutation of this fix that would otherwise go unnoticed, and it is exactly the mutation
    // that puts the state desync back. Stated for what it is: a presence check, not a behavioural one.
    expect(source).toContain("platformCloseHandler({")
    expect(source).toContain("settleOpen,")
  })

  it("tints the surface in the danger register", () => {
    expect(render(<Modal open title="Delete" tone="danger" />)).toContain("border-red-300")
  })

  it("appends caller utilities to the dialog", () => {
    const html = render(<Modal open title="Delete" class="max-w-2xl" />)

    expect(html).toContain("max-w-2xl")
    expect(html).toContain("m-auto")
  })

  it("stamps the e2e attribute when asked", () => {
    expect(render(<Modal open title="Delete" dataE2E="confirm-modal" />))
      .toContain('data-e2e="confirm-modal"')
  })

  it("starts closed when only a default is given, so a closed modal renders no dialog", () => {
    expect(render(<Modal defaultOpen={false} title="Delete">body</Modal>)).toBe("")
  })
})

describe("Modal's backdrop policy", () => {
  /** One object standing in for the dialog element, so target identity holds. */
  const dialog = {}

  it("dismisses a backdrop click by default", () => {
    // The default the component documents, named so a flip in either the component or the predicate
    // fails here rather than silently switching the whole backdrop feature off.
    expect(backdropDismissesByDefault).toBe(true)
    // And the component's own parameter default, read from the rendered element rather than restated:
    // flipping `Modal`'s `closeOnBackdrop = backdropDismissesByDefault` to a literal `false` leaves
    // the constant's own value untouched and would slip past an assertion on the constant alone.
    expect(modalDialogSource()).toContain("closeOnBackdrop = backdropDismissesByDefault")
    expect(modalDialogSource()).not.toContain("closeOnBackdrop = false")
    expect(modalDialogSource()).not.toContain("closeOnBackdrop = true")
    expect(backdropClickDismisses(clickAt(dialog, 10, 10), rect, dialog, undefined)).toBe(
      backdropDismissesByDefault,
    )
  })

  it("keeps the component and the predicate on the same default", () => {
    // Both call sites use the constant, so this is the assertion that they still agree: a backdrop
    // click is dismissed under the default, and refused when the policy is the other way.
    expect(
      backdropClickDismisses(clickAt(dialog, 10, 10), rect, dialog, backdropDismissesByDefault),
    )
      .toBe(true)
    expect(
      backdropClickDismisses(clickAt(dialog, 10, 10), rect, dialog, !backdropDismissesByDefault),
    )
      .toBe(false)
  })
})

describe("isBackdropClick", () => {
  const dialog = {}

  it("accepts a click on the dialog element outside its box", () => {
    expect(isBackdropClick({ target: dialog, dialog }, rect, 10, 10)).toBe(true)
  })

  it("accepts a click on each edge of the backdrop", () => {
    const hit: BackdropHitTarget = { target: dialog, dialog }

    expect(isBackdropClick(hit, rect, rect.left - 1, 400)).toBe(true)
    expect(isBackdropClick(hit, rect, rect.right + 1, 400)).toBe(true)
    expect(isBackdropClick(hit, rect, 500, rect.top - 1)).toBe(true)
    expect(isBackdropClick(hit, rect, 500, rect.bottom + 1)).toBe(true)
  })

  it("refuses a click inside the dialog's box", () => {
    expect(isBackdropClick({ target: dialog, dialog }, rect, 500, 400)).toBe(false)
  })

  it("counts a click exactly on the box edge as inside", () => {
    const hit: BackdropHitTarget = { target: dialog, dialog }

    expect(isBackdropClick(hit, rect, rect.left, rect.top)).toBe(false)
    expect(isBackdropClick(hit, rect, rect.right, rect.bottom)).toBe(false)
  })

  it("refuses a click on any element inside the dialog", () => {
    expect(isBackdropClick({ target: {}, dialog }, rect, 10, 10)).toBe(false)
  })

  it("refuses a click that reached the dialog but not the backdrop", () => {
    expect(isBackdropClick({ target: dialog, dialog }, rect, 500, 400)).toBe(false)
  })

  it("refuses a click whose target is unknown", () => {
    expect(isBackdropClick({ target: null, dialog }, rect, 10, 10)).toBe(false)
  })
})

describe("isDismissKey", () => {
  it("accepts Escape while the dialog is open", () => {
    expect(isDismissKey({ key: "Escape" }, true)).toBe(true)
  })

  it("accepts the key it names", () => {
    expect(DISMISS_KEY).toBe("Escape")
    expect(isDismissKey({ key: DISMISS_KEY }, true)).toBe(true)
  })

  it("refuses every other key", () => {
    for (const key of ["Esc", "Enter", "Tab", " ", "e", "Escape "]) {
      expect(isDismissKey({ key }, true), key).toBe(false)
    }
  })

  it("refuses Escape once the dialog is no longer open", () => {
    // The handler can fire for a dialog that is already closing down another path; a second request
    // would call the caller's close port twice for one dismissal.
    expect(isDismissKey({ key: "Escape" }, false)).toBe(false)
  })
})

describe("supportsClosedBy", () => {
  it("detects the attribute where the prototype exposes it", () => {
    // What Chrome/Edge 134+ and Firefox 141+ answer for `HTMLDialogElement.prototype`. Safari, whose
    // WebKit honours `closedby` in preview only, is the other branch.
    expect(supportsClosedBy({ closedBy: "auto" })).toBe(true)
  })

  it("answers from presence alone, never by reading the property", () => {
    // The reason this cannot be a value check: `closedBy` is a reflected IDL accessor, so reading it
    // on the prototype itself has no element to reflect and throws `Illegal invocation`. `in` asks
    // whether the property is there without invoking its getter, which is the whole question.
    const proto = Object.defineProperty({}, "closedBy", {
      get() {
        throw new Error("Illegal invocation")
      },
    })

    expect(supportsClosedBy(proto)).toBe(true)
  })

  it("reports no support on a prototype without it", () => {
    // A shipping WebKit prototype: no `closedBy`, escape closes the dialog regardless of the port.
    expect(supportsClosedBy({})).toBe(false)
  })

  it("reports no support when there is no prototype at all", () => {
    // `globalThis.HTMLDialogElement?.prototype` in an environment that has no dialog element.
    expect(supportsClosedBy(undefined)).toBe(false)
    expect(supportsClosedBy(null)).toBe(false)
  })

  it("reports no support for a value that is not a prototype", () => {
    // `in` throws a `TypeError` on a primitive, and a capability probe that throws inside the
    // lifecycle effect would take the dialog's whole mount down with it.
    expect(supportsClosedBy("closedBy")).toBe(false)
    expect(supportsClosedBy(0)).toBe(false)
  })
})

describe("escapeCloseStrategy", () => {
  it("asks the port first where the platform honours closedby", () => {
    expect(escapeCloseStrategy(true)).toEqual({
      listensForKeydown: true,
      listensForCancel: false,
      refusalHolds: true,
    })
  })

  it("listens for the platform's own close where it does not", () => {
    expect(escapeCloseStrategy(false)).toEqual({
      listensForKeydown: false,
      listensForCancel: true,
      refusalHolds: false,
    })
  })

  it("never asks for both listeners, which would report one Escape twice", () => {
    // Mutual exclusion is the point: a refused `keydown` request followed by the platform's `cancel`
    // for the same keystroke would call the caller's close port twice for one dismissal.
    for (const supported of [true, false]) {
      const strategy = escapeCloseStrategy(supported)

      expect(strategy.listensForKeydown, String(supported)).toBe(supported)
      expect(strategy.listensForCancel, String(supported)).toBe(!supported)
    }
  })

  it("lets a refusal hold exactly where the keydown path is in charge", () => {
    // The claim the fallback rests on. Where `cancel` is the event the dialog is already closing —
    // `preventDefault()` inside it is a no-op — so a port answering `false` must not be recorded as
    // having refused: that phantom is the state desync this fix removes.
    for (const supported of [true, false]) {
      const strategy = escapeCloseStrategy(supported)

      expect(strategy.refusalHolds, String(supported)).toBe(strategy.listensForKeydown)
      expect(strategy.refusalHolds, String(supported)).toBe(!strategy.listensForCancel)
    }
  })
})

describe("bindEscapeClose", () => {
  const handlers: EscapeCloseHandlers = { keydown: () => {}, cancel: () => {} }

  /** A target that records what a browser would have been asked to do. */
  function recordingTarget() {
    const calls: (string | ((event: Event) => void))[] = []
    return {
      calls,
      addEventListener(type: string, listener: (event: Event) => void) {
        calls.push(type, listener)
      },
      removeEventListener(type: string, listener: (event: Event) => void) {
        calls.push(`-${type}`, listener)
      },
    }
  }

  it("registers the keydown listener where the platform honours closedby", () => {
    const target = recordingTarget()

    bindEscapeClose(target, escapeCloseStrategy(true), handlers)

    expect(target.calls).toEqual(["keydown", handlers.keydown])
  })

  it("registers the cancel listener where it does not", () => {
    const target = recordingTarget()

    bindEscapeClose(target, escapeCloseStrategy(false), handlers)

    expect(target.calls).toEqual(["cancel", handlers.cancel])
  })

  it("registers exactly one listener, so one Escape is not routed twice", () => {
    for (const supported of [true, false]) {
      const target = recordingTarget()

      bindEscapeClose(target, escapeCloseStrategy(supported), handlers)

      expect(target.calls.length, String(supported)).toBe(2)
    }
  })

  it("unbinds the very listener it bound", () => {
    const target = recordingTarget()
    const unbind = bindEscapeClose(target, escapeCloseStrategy(false), handlers)

    unbind()

    // Same event and the same function reference. A mismatch leaks a live listener, and a listener
    // left on a dialog whose render is gone routes Escape into a port that no longer exists.
    expect(target.calls).toEqual(["cancel", handlers.cancel, "-cancel", handlers.cancel])
  })
})

describe("platformCloseHandler", () => {
  it("tells the port, discards a refusal, and settles the state instead", () => {
    // The exact desync the issue measured: `onClose` answering `false` while the platform closed the
    // dialog anyway, leaving the component believing it is open. The port hears about the close and
    // its answer is thrown away, because it cannot be honoured — and the state follows the dialog.
    const seen: unknown[] = []
    const handler = platformCloseHandler({
      refusalHolds: false,
      onClose: () => {
        seen.push("onClose")
        return false
      },
      settleOpen: (open) => seen.push(open),
    })

    handler()

    expect(seen).toEqual(["onClose", false])
  })

  it("settles the state even when the caller has no port to tell", () => {
    const settled: boolean[] = []
    platformCloseHandler({ refusalHolds: false, settleOpen: (open) => settled.push(open) })()

    expect(settled).toEqual([false])
  })

  it("does not double-count a close the port accepted", () => {
    // An accepting port returns `undefined`, the common case; the state still settles once, so the
    // component never needs a second close event to catch up with the browser.
    const settled: boolean[] = []
    platformCloseHandler({
      refusalHolds: false,
      onClose: () => {},
      settleOpen: (open) => settled.push(open),
    })()

    expect(settled).toEqual([false])
  })

  it("leaves the state alone where a refusal can hold", () => {
    // Unreachable with today's platforms — this handler is registered only on the branch where a
    // refusal cannot hold — but it is the other side of the decision table, and it is what a future
    // platform with a cancellable `cancel` would land on. Gating the settle on the strategy's verdict
    // is why the verdict is carried in here at all.
    const settled: boolean[] = []
    platformCloseHandler({
      refusalHolds: true,
      onClose: () => false,
      settleOpen: (open) => settled.push(open),
    })()

    expect(settled).toEqual([])
  })
})

describe("backdropClickDismisses", () => {
  const dialog = {}
  it("dismisses on a click outside the dialog when the caller says nothing", () => {
    // The default is `true`, and this is the only call that exercises it: with the parameter left
    // out, defaulting it to `false` would silently kill the whole backdrop feature. The `undefined`
    // is explicit because the fourth argument has to be passed to reach the default.
    expect(backdropClickDismisses(clickAt(dialog, 10, 10), rect, dialog, undefined)).toBe(true)
  })

  it("dismisses when the policy is explicitly enabled", () => {
    expect(backdropClickDismisses(clickAt(dialog, 10, 10), rect, dialog, true)).toBe(true)
  })

  it("refuses to dismiss when the caller disabled it, without consulting geometry", () => {
    // This is what makes the dismissal cancellable by policy: a disabled `closeOnBackdrop` answers
    // before the hit-test is consulted, so even a click that is plainly on the backdrop is ignored.
    expect(backdropClickDismisses(clickAt(dialog, 10, 10), rect, dialog, false)).toBe(false)
  })

  it("refuses a click inside the box when the policy allows dismissal", () => {
    // The geometry is still the geometry: enabling dismissal does not make every click a backdrop.
    expect(backdropClickDismisses(clickAt(dialog, 500, 400), rect, dialog, true)).toBe(false)
  })

  it("refuses a click on an element inside the dialog", () => {
    expect(backdropClickDismisses(clickAt({}, 10, 10), rect, dialog, true)).toBe(false)
  })

  it("reads the click coordinates, not the dialog's position", () => {
    const atEdge = clickAt(dialog, rect.right + 1, rect.bottom + 1)

    expect(backdropClickDismisses(atEdge, rect, dialog)).toBe(true)
    expect(backdropClickDismisses(clickAt(dialog, rect.right - 1, rect.bottom - 1), rect, dialog))
      .toBe(false)
  })
})

describe("scrollLockPadding", () => {
  it("returns the width the layout gains when the scrollbar goes", () => {
    // The shape a browser reports: a 1000px viewport whose document box is 985px becomes 1000px
    // once the scrollbar is clamped away, so the layout gained 15px and the body owes 15px of
    // padding. Measured in headless Chromium, not assumed.
    expect(scrollLockPadding(985, 1000)).toBe(15)
  })

  it("returns zero when the viewport and the clamped box agree", () => {
    expect(scrollLockPadding(1440, 1440)).toBe(0)
  })

  it("returns zero for overlay scrollbars that reserve no width", () => {
    expect(scrollLockPadding(390, 390)).toBe(0)
  })

  it("never returns a negative padding when the two disagree the other way", () => {
    expect(scrollLockPadding(1000, 985)).toBe(0)
  })

  it("reads as the exact width a centred element would shift by", () => {
    // Half the gain per side — the padding cancels the reflow that hiding the scrollbar causes.
    expect(scrollLockPadding(1000, 1017) / 2).toBe(8.5)
  })

  it("pads nothing when the before and after readings are the same object of measurement", () => {
    // The bug this signature exists to prevent: a single post-lock reading, plus one subtraction,
    // yields 0 and leaves the page shifting. Only a before/after pair can produce the gain.
    expect(scrollLockPadding(1000, 1000)).toBe(0)
  })
})

describe("clientWidthWithoutScrollbar", () => {
  it("clamps the host, reads it, and restores the previous overflow", () => {
    const seen: string[] = []
    const host = {
      style: {
        get overflow() {
          return seen.at(-1) ?? ""
        },
        set overflow(value: string) {
          seen.push(value)
        },
      },
      get clientWidth() {
        // The stub answers as a browser does: clamping the scrollbar widens the box...
        return this.style.overflow === "hidden" ? 1000 : 985
      },
    }

    expect(clientWidthWithoutScrollbar(host)).toBe(1000)
    // ...and the clamp is gone afterwards, which is what lets the component take the lock itself.
    expect(host.style.overflow).toBe("")
  })

  it("restores an overflow the page already had", () => {
    const host = { style: { overflow: "auto" }, clientWidth: 985 }

    clientWidthWithoutScrollbar(host)

    expect(host.style.overflow).toBe("auto")
  })

  it("pairs with scrollLockPadding to give the measured shift", () => {
    const host = {
      style: { overflow: "" },
      get clientWidth() {
        return this.style.overflow === "hidden" ? 1000 : 985
      },
    }

    expect(scrollLockPadding(host.clientWidth, clientWidthWithoutScrollbar(host))).toBe(15)
  })
})

describe("applyScrollLock", () => {
  /** A document whose scrolling element and body record what was written to them. */
  function stubDocument(scrollerOverflow = "", bodyOverflow = "", paddingRight = "") {
    return {
      scrollingElement: { style: { overflow: scrollerOverflow } },
      body: { style: { overflow: bodyOverflow, paddingRight } },
    }
  }

  it("locks the scrolling element, not just the body", () => {
    // `body { overflow: hidden }` alone does not stop a document scrolling — the built page kept
    // scrolling to 1623px under it in headless Chromium. The lock goes on the element the platform
    // says scrolls.
    const document = stubDocument()

    applyScrollLock(document, 15)

    expect(document.scrollingElement.style.overflow).toBe("hidden")
    expect(document.body.style.overflow).toBe("hidden")
  })

  it("clamps the scrolling element itself, which body-only does not achieve", () => {
    // Measured in headless Chromium: with `body { overflow: hidden }` alone the page still reported
    // scrollY 527 after a scroll to 900, because the document element is the scroll container.
    const document = stubDocument()

    applyScrollLock(document, 15)

    expect(document.scrollingElement.style.overflow).toBe("hidden")
  })

  it("pads the body by the measured gain", () => {
    const document = stubDocument()

    applyScrollLock(document, 15)

    expect(document.body.style.paddingRight).toBe("15px")
  })

  it("writes no padding when the page had no scrollbar", () => {
    const document = stubDocument()

    applyScrollLock(document, 0)

    expect(document.body.style.paddingRight).toBe("0px")
  })

  it("restores what the host had, rather than blanking it", () => {
    const document = stubDocument("auto", "scroll", "4px")

    applyScrollLock(document, 15).release()

    expect(document.scrollingElement.style.overflow).toBe("auto")
    expect(document.body.style.overflow).toBe("scroll")
    expect(document.body.style.paddingRight).toBe("4px")
  })

  it("releases to empty styles on a page that had none", () => {
    const document = stubDocument()

    applyScrollLock(document, 15).release()

    expect(document.scrollingElement.style.overflow).toBe("")
    expect(document.body.style.overflow).toBe("")
    expect(document.body.style.paddingRight).toBe("")
  })

  it("handles a document that reports no scrolling element", () => {
    const document = { scrollingElement: null, body: { style: { overflow: "", paddingRight: "" } } }

    const lock = applyScrollLock(document, 15)

    expect(document.body.style.overflow).toBe("hidden")
    lock.release()
    expect(document.body.style.overflow).toBe("")
  })

  it("is released exactly once by the carrying effect's cleanup", () => {
    const document = stubDocument()
    const lock = applyScrollLock(document, 15)

    lock.release()
    lock.release()

    expect(document.body.style.paddingRight).toBe("")
  })
})

describe("shouldRetargetFocus", () => {
  const trigger = { focus: () => {} }

  it("sends focus back to the captured trigger", () => {
    expect(shouldRetargetFocus(trigger)).toBe(true)
  })

  it("does nothing when no trigger was captured", () => {
    // The whole rule: there is no second condition to satisfy. A guard that also required focus to
    // still be inside the dialog never fired in a real browser, because by cleanup time Chromium has
    // already moved focus out of the unmounted content.
    expect(shouldRetargetFocus(null)).toBe(false)
  })
})

describe("dialogHeldFocus", () => {
  const inside = { contains: (element: unknown) => element === "in-dialog" }

  it("reports focus inside the dialog", () => {
    expect(dialogHeldFocus(inside, "in-dialog")).toBe(true)
  })

  it("reports focus outside the dialog", () => {
    expect(dialogHeldFocus(inside, "elsewhere")).toBe(false)
  })

  it("reports focus outside for an active element of null", () => {
    // The reading measured at cleanup time: a dialog whose content has unmounted sees `body`.
    expect(dialogHeldFocus(inside, null)).toBe(false)
  })

  it("asks the dialog rather than assuming", () => {
    const asked: unknown[] = []
    const dialog = {
      contains: (element: unknown) => {
        asked.push(element)
        return true
      },
    }

    dialogHeldFocus(dialog, "the active element")

    expect(asked).toEqual(["the active element"])
  })
})

describe("restoreFocus", () => {
  it("moves focus to the captured element", () => {
    let focused = 0
    const trigger = { focus: () => focused++ }

    expect(restoreFocus(trigger)).toBe(true)
    expect(focused).toBe(1)
  })

  it("reports nothing to restore when there is no target", () => {
    expect(restoreFocus(null)).toBe(false)
  })
})

describe("dialogTitleId", () => {
  it("is unique per sequence value", () => {
    expect(dialogTitleId(1)).not.toBe(dialogTitleId(2))
  })

  it("is a valid id, usable as the value of both attributes", () => {
    expect(dialogTitleId(7)).toBe("modal-title-7")
  })
})
