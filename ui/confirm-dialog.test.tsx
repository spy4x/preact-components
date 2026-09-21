import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  ConfirmDialog,
  confirmVariant,
  hasQuestion,
  labelOr,
} from "./confirm-dialog.tsx"

/** A panel with both ports wired and both verbs named, which is how a caller should write one. */
function dialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return (
    <ConfirmDialog
      title="Delete invoice?"
      confirmLabel="Delete"
      cancelLabel="Keep it"
      onConfirm={() => {}}
      onCancel={() => {}}
      {...overrides}
    />
  )
}

/**
 * The panel's source, for the one assertion with no rendered symptom.
 *
 * `ConfirmDialog`'s `closeOnBackdrop` default is a parameter default, and a function component's
 * resolved props are not reachable through `preact-render-to-string` — refs and effects never run, so
 * nothing on the rendered element carries the value. Reading the declaration is the honest way to pin
 * it: flipping the default to `true` silently makes a destructive panel dismissable on a stray click,
 * and this is what fails when that happens.
 */
function panelSource(): string {
  return Deno.readTextFileSync(new URL("./confirm-dialog.tsx", import.meta.url))
}

describe("ConfirmDialog", () => {
  it("renders a modal dialog", () => {
    const html = render(dialog())

    expect(html).toContain("<dialog")
    expect(html).toContain('aria-modal="true"')
  })

  it("announces itself as a dialog demanding an answer", () => {
    // `alertdialog`, not `dialog`: a confirmation interrupts, and the role is what tells a screen
    // reader to read the question out with the name instead of waiting to be asked for the body.
    const html = render(dialog())

    expect(html).toContain('role="alertdialog"')
    expect(html).not.toContain('role="dialog"')
  })

  it("reads out the question it is asking", () => {
    // The whole announcement, followed end to end: the dialog names an element, that element
    // exists exactly once, and the sentence the caller passed is inside it. Asserting the
    // attribute alone would pass for a dialog describing itself by nothing.
    const html = render(dialog({ message: "Delete invoice INV-0007? This cannot be undone." }))
    const described = html.match(/aria-describedby="([^"]+)"/)?.[1] as string
    const carriesId = html.match(new RegExp(`id="${described}"`, "g")) ?? []
    const body = html.split(`id="${described}"`)[1] ?? ""

    expect(described).toBeTruthy()
    expect(carriesId.length).toBe(1)
    expect(body).toContain("Delete invoice INV-0007? This cannot be undone.")
  })

  it("describes itself by the children when they replace the message", () => {
    const html = render(dialog({ children: <strong>Three rows go for good.</strong> }))
    const described = html.match(/aria-describedby="([^"]+)"/)?.[1] as string
    const body = html.split(`id="${described}"`)[1] ?? ""

    expect(described).toBeTruthy()
    expect(body).toContain("<strong>Three rows go for good.</strong>")
  })

  it("describes itself by nothing when there is no question to read", () => {
    // A reference to an empty element is worse than none: the caller believes the dialog reads its
    // question and the screen reader reads the name and then silence.
    expect(render(dialog())).not.toContain("aria-describedby")
  })

  it("gives two panels on one page different question ids", () => {
    const html = render(
      <div>
        {dialog({ message: "Delete this one?" })}
        {dialog({ message: "Delete that one?" })}
      </div>,
    )
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1])

    expect(ids.length).toBe(2)
    expect(ids[1]).not.toBe(ids[0])
  })

  it("takes its accessible name from the title", () => {
    const html = render(dialog())
    const referenced = html.match(/aria-labelledby="([^"]+)"/)?.[1] as string
    const carriesId = html.match(new RegExp(`id="${referenced}"`, "g")) ?? []

    expect(referenced).toBeTruthy()
    expect(carriesId.length).toBe(1)
    expect(html).toContain(`<h2 id="${referenced}"`)
  })

  it("uses the caller's title id when one is given", () => {
    const html = render(dialog({ titleId: "archive-heading" }))

    expect(html).toContain('aria-labelledby="archive-heading"')
    expect(html).toContain('<h2 id="archive-heading"')
  })

  it("shows the message as the question", () => {
    expect(render(dialog({ message: "This cannot be undone." })))
      .toContain("This cannot be undone.")
  })

  it("prefers children over the message when both are given", () => {
    const html = render(dialog({ message: "ignored", children: <strong>typed</strong> }))

    expect(html).toContain("<strong>typed</strong>")
    expect(html).not.toContain("ignored")
  })

  it("renders exactly the confirm and cancel controls the caller named", () => {
    const html = render(dialog())

    expect(html).toContain("Delete")
    expect(html).toContain("Keep it")
    expect(html.match(/<button/g)?.length).toBe(3)
  })

  it("makes the cancel label the header dismiss control's accessible name", () => {
    expect(render(dialog())).toContain('aria-label="Keep it"')
  })

  it("names the verb on the confirming button rather than an OK default", () => {
    const html = render(dialog({ confirmLabel: "Archive invoice" }))

    expect(html).toContain("Archive invoice")
    expect(html).not.toContain(">OK<")
  })

  it("labels both actions with an English default when the caller names neither", () => {
    const html = render(
      <ConfirmDialog title="Delete invoice?" onConfirm={() => {}} onCancel={() => {}} />,
    )

    expect(html).toContain(`>${CONFIRM_LABEL}</button>`)
    expect(html).toContain(`>${CANCEL_LABEL}</button>`)
    expect(html).toContain(`aria-label="${CANCEL_LABEL}"`)
  })

  it("renders the panel rather than raising when a label arrives blank", () => {
    // A blank label reaches this prop through a variable — an unfilled translation, a key that
    // resolved to `""`. Raising during a render took the page down over one button; the default
    // takes the button.
    const html = render(dialog({ cancelLabel: "   " }))

    expect(html).toContain(`>${CANCEL_LABEL}</button>`)
    expect(html).toContain(">Delete</button>")
  })

  it("confirms with the primary button by default", () => {
    const html = render(dialog())
    const primary = html.split("<button").find((part) => part.includes(">Delete</button>"))

    expect(primary).toContain("bg-purple-900")
  })

  it("confirms with the danger button in the danger register", () => {
    const html = render(dialog({ tone: "danger" }))
    const dangerous = html.split("<button").find((part) => part.includes(">Delete</button>"))

    expect(dangerous).toContain("bg-red-600")
    expect(html).toContain("border-red-300")
  })

  it("leaves the cancel button out of the destructive path", () => {
    const html = render(dialog({ tone: "danger" }))
    const cancel = html.split("<button").find((part) => part.includes(">Keep it</button>"))

    expect(cancel).toContain("border-gray-300")
  })

  it("refuses a backdrop dismissal unless the caller opts in", () => {
    // The panel's own default. `Modal` defaults this to true; a confirmation panel must not, because
    // it is routinely placed over the thing it is about to act on.
    expect(panelSource()).toContain("closeOnBackdrop = false")
    expect(panelSource()).not.toContain("closeOnBackdrop = true")
  })

  it("routes a refusal through a port the caller owns", () => {
    // The panel passes its `onCancel` straight to Modals `onClose`, which is the port `requestClose`
    // consults before closing anything.
    expect(panelSource()).toContain("onClose={onCancel}")
  })

  it("mounts a dialog the client can make modal", () => {
    // The panel renders the element closed — `<dialog open>` is non-modal and `showModal()` refuses
    // such an element — so `Modal` is what opens it, on mount. Both actions render with their ports
    // wired, and the panel never closes itself: that is the caller's flag, or `onCancel` refusing.
    const html = render(dialog())

    expect(html).toContain("<dialog")
    expect(html).not.toMatch(/<dialog[^>]*\sopen(?:\s|>)/)
    expect(html).toContain(">Delete</button>")
    expect(html).toContain(">Keep it</button>")
  })

  it("carries the caller's labels into the accessible names", () => {
    const html = render(dialog({ titleId: "archive-heading" }))

    expect(html).toContain('aria-labelledby="archive-heading"')
    expect(html).toContain(">Keep it</button>")
  })

  it("explains itself through a caller class", () => {
    expect(render(dialog({ class: "max-w-lg" }))).toContain("max-w-lg")
  })

  it("stamps the e2e attribute when asked", () => {
    expect(render(dialog({ dataE2E: "delete-invoice" })))
      .toContain('data-e2e="delete-invoice"')
  })

  it("keeps the danger tone off the default surface", () => {
    expect(render(dialog())).not.toContain("border-red-300")
  })
})

describe("confirmVariant", () => {
  it("uses the danger variant for a destructive decision", () => {
    expect(confirmVariant("danger")).toBe("danger")
  })

  it("uses the primary variant otherwise", () => {
    expect(confirmVariant("default")).toBe("primary")
  })
})

describe("labelOr", () => {
  it("passes a named action through", () => {
    expect(labelOr("Delete", CONFIRM_LABEL)).toBe("Delete")
  })

  it("trims the label it passes on", () => {
    expect(labelOr("  Archive  ", CONFIRM_LABEL)).toBe("Archive")
  })

  it("falls back to the English default when the caller names nothing", () => {
    expect(labelOr(undefined, CONFIRM_LABEL)).toBe("Confirm")
    expect(labelOr(undefined, CANCEL_LABEL)).toBe("Cancel")
  })

  it("falls back for a blank label a caller reached through a variable", () => {
    expect(labelOr("   ", CANCEL_LABEL)).toBe("Cancel")
  })
})

describe("hasQuestion", () => {
  it("counts a sentence", () => {
    expect(hasQuestion("This cannot be undone.")).toBe(true)
  })

  it("counts rendered content", () => {
    expect(hasQuestion(<strong>gone for good</strong>)).toBe(true)
  })

  it("counts an unfilled template as nothing", () => {
    expect(hasQuestion("   ")).toBe(false)
    expect(hasQuestion("")).toBe(false)
  })

  it("counts an absent body as nothing", () => {
    expect(hasQuestion(undefined)).toBe(false)
    expect(hasQuestion(null)).toBe(false)
    // What `{showDetail && <p>…</p>}` renders to when the flag is off.
    expect(hasQuestion(false)).toBe(false)
  })
})
