import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  counterText,
  describedImages,
  Lightbox,
  type LightboxImage,
  wrapIndex,
} from "./lightbox.tsx"

const IMAGES: LightboxImage[] = [
  { src: "https://acme.example/img/a.png", alt: "A hero" },
  { src: "https://acme.example/img/b.png", alt: "A team" },
  { src: "https://acme.example/img/c.png", alt: "A product" },
]

describe("describedImages", () => {
  it("keeps every image with a non-empty description", () => {
    expect(describedImages(IMAGES)).toEqual(IMAGES)
  })

  it("drops an image whose alt is empty", () => {
    const images = [...IMAGES, { src: "https://acme.example/img/d.png", alt: "" }]
    expect(describedImages(images)).toEqual(IMAGES)
  })

  it("drops an image whose alt is only whitespace", () => {
    const images = [...IMAGES, { src: "https://acme.example/img/d.png", alt: "   " }]
    expect(describedImages(images)).toEqual(IMAGES)
  })

  it("keeps extra fields on the images that survive", () => {
    const withThumb = [{ ...IMAGES[0], thumbSrc: "https://acme.example/thumb/a.png" }]
    expect(describedImages(withThumb)).toEqual(withThumb)
  })
})

describe("wrapIndex", () => {
  it("moves forward one step", () => {
    expect(wrapIndex(0, 3, 1)).toBe(1)
  })

  it("wraps forward past the end", () => {
    expect(wrapIndex(2, 3, 1)).toBe(0)
  })

  it("wraps backward past the start", () => {
    expect(wrapIndex(0, 3, -1)).toBe(2)
  })

  it("stays at 0 for a sequence of one", () => {
    expect(wrapIndex(0, 1, 1)).toBe(0)
    expect(wrapIndex(0, 1, -1)).toBe(0)
  })

  it("stays at 0 for an empty sequence", () => {
    expect(wrapIndex(0, 0, 1)).toBe(0)
  })
})

describe("counterText", () => {
  it("renders the position and total the issue asks for", () => {
    expect(counterText(3, 8)).toBe("3 of 8")
  })
})

describe("Lightbox", () => {
  it("renders a closed dialog with an empty, always-present live region", () => {
    const html = render(
      <Lightbox
        images={IMAGES}
        index={0}
        open={false}
        onClose={() => {}}
        onIndexChange={() => {}}
      />,
    )

    expect(html).toContain("<dialog")
    expect(html).toContain('aria-label="Image viewer"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain("<img")
  })

  it("renders the current image, its caption and the counter when open", () => {
    const html = render(
      <Lightbox images={IMAGES} index={1} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    expect(html).toContain("https://acme.example/img/b.png")
    expect(html).toContain("A team")
    expect(html).toContain("2 of 3")
  })

  it("renders labelled previous and next controls when there is more than one image", () => {
    const html = render(
      <Lightbox images={IMAGES} index={0} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    expect(html).toContain('aria-label="Previous image"')
    expect(html).toContain('aria-label="Next image"')
  })

  it("renders no previous or next control for a single image", () => {
    const html = render(
      <Lightbox
        images={[IMAGES[0]]}
        index={0}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
      />,
    )

    expect(html).not.toContain('aria-label="Previous image"')
    expect(html).not.toContain('aria-label="Next image"')
  })

  it("takes custom labels for the close, previous and next controls", () => {
    const html = render(
      <Lightbox
        images={IMAGES}
        index={0}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
        closeLabel="Dismiss"
        previousLabel="Earlier"
        nextLabel="Later"
      />,
    )

    expect(html).toContain('aria-label="Dismiss"')
    expect(html).toContain('aria-label="Earlier"')
    expect(html).toContain('aria-label="Later"')
  })

  it("never renders an image with no description, not even as the current one", () => {
    const images = [{ src: "https://acme.example/img/x.png", alt: "" }, IMAGES[0]]
    const html = render(
      <Lightbox images={images} index={0} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    // index 0 over the unfiltered array is what the caller would compute wrong; this component
    // filters first, so index 0 lands on the one image that survives filtering.
    expect(html).toContain("https://acme.example/img/a.png")
    expect(html).not.toContain("https://acme.example/img/x.png")
  })

  it("clamps an out-of-range index instead of rendering nothing", () => {
    const html = render(
      <Lightbox images={IMAGES} index={99} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    expect(html).toContain("A product")
  })

  it("keeps the caller's utilities alongside the dialog defaults", () => {
    const html = render(
      <Lightbox
        images={IMAGES}
        index={0}
        open={false}
        onClose={() => {}}
        onIndexChange={() => {}}
        class="bg-white"
      />,
    )

    expect(html).toContain("bg-white")
    expect(html).not.toContain("bg-black/95")
  })

  it("mounts no listeners during server rendering", () => {
    expect(
      render(
        <Lightbox images={IMAGES} index={0} open onClose={() => {}} onIndexChange={() => {}} />,
      ),
    ).toContain("<dialog")
  })
})
