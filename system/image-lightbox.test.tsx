import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { type ImageElementLike, ImageLightbox, resolveImage } from "./image-lightbox.tsx"

/** An element stub with the three properties `resolveImage` reads. */
function element(overrides: Partial<ImageElementLike> = {}): ImageElementLike {
  return {
    matches: (selector) => selector === "img",
    src: "https://acme.example/img/hero.png",
    alt: "A hero",
    ...overrides,
  }
}

describe("resolveImage", () => {
  it("resolves a clicked image", () => {
    expect(resolveImage(element())).toEqual({
      src: "https://acme.example/img/hero.png",
      alt: "A hero",
    })
  })

  it("ignores a click that did not land on an image", () => {
    expect(resolveImage(element({ matches: () => false }))).toBeNull()
  })

  it("ignores a null target", () => {
    expect(resolveImage(null)).toBeNull()
  })

  it("falls back to the placeholder alt when the image has none", () => {
    expect(resolveImage(element({ alt: "" }))?.alt).toBe("Blog image")
  })

  it("takes a custom placeholder alt", () => {
    expect(resolveImage(element({ alt: "  " }), "img", "Illustration")?.alt).toBe("Illustration")
  })

  it("trims alt text", () => {
    expect(resolveImage(element({ alt: "  A hero  " }))?.alt).toBe("A hero")
  })

  it("honours a custom image selector", () => {
    const target = element({ matches: (selector) => selector === ".zoomable" })

    expect(resolveImage(target, ".zoomable")).not.toBeNull()
    expect(resolveImage(target)).toBeNull()
  })

  it("reads the src attribute when the element has no src property", () => {
    const target = element({
      src: undefined,
      getAttribute: (name) => (name === "src" ? "/img/hero.png" : null),
    })

    expect(resolveImage(target)?.src).toBe("/img/hero.png")
  })

  it("ignores an image with no src at all", () => {
    expect(resolveImage(element({ src: "", getAttribute: () => null }))).toBeNull()
  })

  it("keeps a wrapping link click from opening the lightbox", () => {
    // The click lands on the anchor, which is not an image: navigation must win.
    expect(resolveImage(element({ matches: (selector) => selector === "a" }))).toBeNull()
  })
})

describe("ImageLightbox", () => {
  it("renders an empty dialog, before anything is opened", () => {
    const html = render(<ImageLightbox />)

    expect(html).toContain("<dialog")
    expect(html).toContain('aria-label="Image viewer"')
    expect(html).not.toContain("<img")
  })

  it("adds nothing to the page's markup that needs JavaScript", () => {
    const html = render(<ImageLightbox />)

    expect(html.startsWith("<dialog")).toBe(true)
    expect(html).not.toContain("<script")
  })

  it("takes a custom dialog label", () => {
    const html = render(<ImageLightbox label="Photo" />)

    expect(html).toContain('aria-label="Photo"')
  })

  it("keeps the caller's utilities alongside the dialog defaults", () => {
    const html = render(<ImageLightbox class="bg-white" />)

    expect(html).toContain("bg-white")
    expect(html).not.toContain("bg-black/95")
  })

  it("mounts no listeners during server rendering", () => {
    // Nothing to assert beyond surviving a render with no `document`: a throw here is the failure.
    expect(render(<ImageLightbox containerSelector="#missing" />)).toContain("<dialog")
  })
})
