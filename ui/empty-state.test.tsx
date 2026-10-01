import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { EmptyState } from "./empty-state.tsx"

/**
 * Visible text of a server-rendered fragment: text nodes with tags stripped, entities restored.
 *
 * The `no hardcoded wording` suite compares this against the strings the caller passed, so it must
 * not return attribute values — an `aria-label` is not something a user reads on screen.
 *
 * @param html Markup from `preact-render-to-string`.
 * @returns The text nodes joined by a single space, trimmed.
 */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim()
}

describe("EmptyState", () => {
  it("renders nothing without any slot", () => {
    expect(render(<EmptyState />)).toBe("")
  })

  it("renders the minimal title-only markup", () => {
    expect(render(<EmptyState title="No invoices yet" />)).toBe(
      '<div role="status" class="mx-auto max-w-[650px] rounded-lg border border-dashed ' +
        'border-subtle bg-surface p-4 text-center">' +
        '<h3 class="text-base font-medium text-foreground">No invoices yet</h3>' +
        "</div>",
    )
  })

  it("renders the full markup with a description, an icon and an action", () => {
    expect(
      render(
        <EmptyState
          icon={<svg viewBox="0 0 24 24" />}
          title="No invoices yet"
          description="Invoices you send will appear here."
          action={<a href="/invoices/new">New invoice</a>}
        />,
      ),
    ).toBe(
      '<div role="status" class="mx-auto max-w-[650px] rounded-lg border border-dashed ' +
        'border-subtle bg-surface p-4 text-center">' +
        '<span aria-hidden="true" class="mx-auto mb-3 inline-flex size-10 items-center ' +
        'justify-center rounded-xl border border-subtle bg-selected-soft text-selected">' +
        '<svg viewBox="0 0 24 24"></svg></span>' +
        '<h3 class="text-base font-medium text-foreground">No invoices yet</h3>' +
        '<p class="mt-1 text-sm text-muted">' +
        "Invoices you send will appear here.</p>" +
        '<div class="mt-4"><a href="/invoices/new">New invoice</a></div>' +
        "</div>",
    )
  })

  it("draws the title as an h1 with the h3's look when headingLevel is 1", () => {
    const html = render(<EmptyState title="Page not found" headingLevel={1} />)

    expect(html).toContain('<h1 class="text-base font-medium text-foreground">Page not found</h1>')
    expect(html).not.toContain("<h3")
    expect(html.toLowerCase()).not.toContain("headinglevel")
  })

  it("keeps the title an h3 when headingLevel is not passed", () => {
    expect(render(<EmptyState title="No invoices yet" />)).toContain(
      '<h3 class="text-base font-medium text-foreground">No invoices yet</h3>',
    )
  })

  it("announces politely instead of impersonating an alert", () => {
    const html = render(<EmptyState title="No invoices yet" />)

    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('aria-live="assertive"')
  })
})

describe("EmptyState copy slots", () => {
  it("omits the icon and the description when they are absent", () => {
    const html = render(<EmptyState title="No invoices yet" />)

    expect(html).not.toContain("<p")
    expect(html).not.toContain("<span")
    expect(html).not.toContain("size-10")
  })

  it("renders nothing for an absent title rather than a default sentence", () => {
    const html = render(<EmptyState description="Something went missing." />)

    expect(html).not.toContain("<h3")
    expect(visibleText(html)).toBe("Something went missing.")
  })

  it("renders nothing for an absent description rather than a default sentence", () => {
    const html = render(<EmptyState title="No invoices yet" />)

    expect(html).not.toContain("<p")
    expect(visibleText(html)).toBe("No invoices yet")
  })

  it("renders nothing for an absent action rather than a default control", () => {
    const html = render(<EmptyState title="No invoices yet" />)

    expect(html).not.toContain("<button")
    expect(html).not.toContain("<a ")
    expect(html).not.toContain('<div class="mt-4"')
  })

  it("renders the caller's action control untouched", () => {
    const html = render(
      <EmptyState title="No invoices yet" action={<button type="button">Retry</button>} />,
    )

    expect(html).toContain('<div class="mt-4"><button type="button">Retry</button></div>')
  })

  it("appends a caller class", () => {
    expect(render(<EmptyState title="No invoices yet" class="max-w-full" />)).toContain(
      "max-w-full",
    )
  })

  it("keeps the ErrorState container geometry so the two can be swapped", () => {
    const html = render(<EmptyState title="No invoices yet" />)

    expect(html).toContain("mx-auto max-w-[650px] rounded-lg")
    expect(html).toContain("p-4 text-center")
  })
})

describe("EmptyState hardcoded wording", () => {
  it("renders no text the caller did not pass", () => {
    const html = render(
      <EmptyState title="No invoices yet" action={<button type="button">Retry</button>} />,
    )

    expect(visibleText(html)).toBe("No invoices yet Retry")
  })

  it("renders no text at all when only non-text slots are passed", () => {
    const html = render(<EmptyState icon={<svg viewBox="0 0 24 24" />} action={<span>+</span>} />)

    expect(visibleText(html)).toBe("+")
  })
})
