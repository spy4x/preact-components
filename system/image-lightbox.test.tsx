import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  collectSequence,
  type ImageElementLike,
  ImageLightbox,
  resolveImage,
  zoomableAlt,
} from "./image-lightbox.tsx"

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
    expect(resolveImage(element({ alt: "" }))?.alt).toBe("Image")
  })

  it("takes a custom placeholder alt", () => {
    expect(resolveImage(element({ alt: "  " }), "img", "Illustration")?.alt).toBe("Illustration")
  })

  it("resolves to an empty alt when both the image's own and the placeholder are empty", () => {
    // The one way an image reaches this component with a genuinely empty description: a caller who
    // turned the substitution off with `fallbackAlt=""`. `openAt` and `markZoomable` both refuse an
    // image whose resolved `alt` is empty — see `zoomableAlt`, the same decision restated so it can
    // be made before any attribute is written, not only once a click has already landed.
    expect(resolveImage(element({ alt: "" }), "img", "")?.alt).toBe("")
    expect(resolveImage(element({ alt: "  " }), "img", "")?.alt).toBe("")
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

  it("ignores an event whose target is the link around an image", () => {
    // Only the image answers. What keeps such a link from being followed is the component
    // cancelling the event it opens on, which is a browser's business and `pages/checks/system.ts`'s
    // to prove — this function never sees it.
    expect(resolveImage(element({ matches: (selector) => selector === "a" }))).toBeNull()
  })
})

describe("zoomableAlt", () => {
  it("substitutes fallbackAlt for a missing or blank alt", () => {
    expect(zoomableAlt(null, "Image")).toBe("Image")
    expect(zoomableAlt(undefined, "Image")).toBe("Image")
    expect(zoomableAlt("   ", "Image")).toBe("Image")
  })

  it("keeps a real alt, trimmed", () => {
    expect(zoomableAlt("  A hero  ", "Image")).toBe("A hero")
  })

  it("is empty only when both the image's own alt and fallbackAlt are", () => {
    // The one case markZoomable and openAt both refuse: fallbackAlt turned off with "" and the
    // image itself carrying no real description.
    expect(zoomableAlt(null, "")).toBe("")
    expect(zoomableAlt("   ", "")).toBe("")
  })
})

describe("collectSequence", () => {
  const hero = element({ src: "https://acme.example/img/hero.png", alt: "A hero" })
  const team = element({ src: "https://acme.example/img/team.png", alt: "The team" })
  const product = element({ src: "https://acme.example/img/product.png", alt: "A product" })

  it("resolves every matched element into the sequence, in order", () => {
    const result = collectSequence([hero, team, product], team)

    expect(result.images).toEqual([
      { src: "https://acme.example/img/hero.png", alt: "A hero" },
      { src: "https://acme.example/img/team.png", alt: "The team" },
      { src: "https://acme.example/img/product.png", alt: "A product" },
    ])
  })

  it("finds the activated element's position in the sequence", () => {
    expect(collectSequence([hero, team, product], product).index).toBe(2)
    expect(collectSequence([hero, team, product], hero).index).toBe(0)
  })

  it("skips an element with no usable src, without miscounting the activated one after it", () => {
    const broken = element({ src: "", getAttribute: () => null })
    const result = collectSequence([hero, broken, product], product)

    expect(result.images.map((image) => image.src)).toEqual([
      "https://acme.example/img/hero.png",
      "https://acme.example/img/product.png",
    ])
    // product is second in the resolved sequence, even though it is third among the elements.
    expect(result.index).toBe(1)
  })

  it("reports -1 when the activated element itself did not resolve", () => {
    const broken = element({ src: "", getAttribute: () => null })
    expect(collectSequence([hero, broken], broken).index).toBe(-1)
  })

  it("returns an empty sequence for an empty container", () => {
    expect(collectSequence([], null)).toEqual({ images: [], index: -1 })
  })

  describe('with fallbackAlt disabled ("")', () => {
    // The default `fallbackAlt` ("Image") means `resolveImage` never produces an empty `alt`, so
    // these are the one way `describedImages` ever has something to drop here — the exact
    // regression review found: an earlier version computed the activated position against the
    // *unfiltered* list, so a described image that came after an undescribed one opened the wrong
    // picture (or, if the undescribed one was the only image, opened an empty dialog).
    const bare = element({ src: "https://acme.example/img/bare.png", alt: "" })
    const alpha = element({ src: "https://acme.example/img/alpha.png", alt: "Alpha" })
    const gamma = element({ src: "https://acme.example/img/gamma.png", alt: "Gamma" })

    it("opens the clicked, described image at its position after filtering, not before", () => {
      const result = collectSequence([bare, alpha, gamma], alpha, "img", "")

      expect(result.images).toEqual([
        { src: "https://acme.example/img/alpha.png", alt: "Alpha" },
        { src: "https://acme.example/img/gamma.png", alt: "Gamma" },
      ])
      // alpha is first in the filtered sequence, not second as it would be counted against the
      // three raw elements — the miscount the review found.
      expect(result.index).toBe(0)
    })

    it("refuses to open an undescribed image clicked on its own", () => {
      const result = collectSequence([bare, alpha, gamma], bare, "img", "")

      expect(result.index).toBe(-1)
      expect(result.images).toEqual([
        { src: "https://acme.example/img/alpha.png", alt: "Alpha" },
        { src: "https://acme.example/img/gamma.png", alt: "Gamma" },
      ])
    })
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
