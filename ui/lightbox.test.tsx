import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  counterText,
  describedImages,
  Lightbox,
  type LightboxImage,
  swipeStep,
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

describe("swipeStep", () => {
  it("answers the next image for a leftward swipe", () => {
    expect(swipeStep(-80, 10)).toBe(1)
  })

  it("answers the previous image for a rightward swipe", () => {
    expect(swipeStep(80, -10)).toBe(-1)
  })

  it("counts a sideways move of exactly 50px as a swipe", () => {
    expect(swipeStep(-50, 0)).toBe(1)
  })

  it("ignores a sideways move shorter than 50px", () => {
    expect(swipeStep(-49, 0)).toBe(0)
  })

  it("ignores a drag that travels further up or down than sideways", () => {
    expect(swipeStep(-80, 90)).toBe(0)
  })
})

describe("Lightbox naming and captions", () => {
  it("names the dialog after the image it shows when label is a function", () => {
    const html = render(
      <Lightbox
        images={IMAGES}
        index={1}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
        label={(image, position, total) => `${image.alt}, ${position} of ${total}`}
      />,
    )

    expect(html).toMatch(/<dialog [^>]*aria-label="A team, 2 of 3"/)
  })

  it("leaves out the visible caption with caption={false}, in both layouts", () => {
    for (const controls of ["overlay", "below"] as const) {
      const html = render(
        <Lightbox
          images={IMAGES}
          index={1}
          open
          onClose={() => {}}
          onIndexChange={() => {}}
          controls={controls}
          caption={false}
        />,
      )

      expect(html).not.toMatch(/<p [^>]*>A team<\/p>/)
      expect(html).toContain('alt="A team"')
      expect(html).toContain("A team — 2 of 3")
    }
  })

  it("shows the visible caption by default, in both layouts", () => {
    for (const controls of ["overlay", "below"] as const) {
      const html = render(
        <Lightbox
          images={IMAGES}
          index={1}
          open
          onClose={() => {}}
          onIndexChange={() => {}}
          controls={controls}
        />,
      )

      expect(html).toMatch(/<p [^>]*>A team<\/p>/)
    }
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

  it("shows the counter as its own visible chip, not only in the live region", () => {
    const html = render(
      <Lightbox images={IMAGES} index={1} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    // "2 of 3" appears twice: once in the sr-only live region, once in the visible counter.
    expect(html.split("2 of 3").length - 1).toBe(2)
  })

  it("renders no counter for a single image, alongside no previous/next controls", () => {
    const html = render(
      <Lightbox
        images={[IMAGES[0]]}
        index={0}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
      />,
    )

    expect(html).not.toContain("1 of 1")
  })

  it("takes a counterLabel override, used both visibly and in the announcement", () => {
    const html = render(
      <Lightbox
        images={IMAGES}
        index={1}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
        counterLabel={(position, total) => `image ${position}/${total}`}
      />,
    )

    expect(html).not.toContain("2 of 3")
    expect(html.split("image 2/3").length - 1).toBe(2)
  })

  it("opens nothing when every image lacks a description", () => {
    const images = [{ src: "https://acme.example/img/x.png", alt: "" }]
    const html = render(
      <Lightbox images={images} index={0} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    expect(html).not.toContain("<img")
    expect(html).not.toContain("<button")
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
        class="backdrop-blur-sm"
      />,
    )

    expect(html).toContain("backdrop-blur-sm")
    expect(html).not.toContain("bg-black/95")
  })

  it("mounts no listeners during server rendering", () => {
    expect(
      render(
        <Lightbox images={IMAGES} index={0} open onClose={() => {}} onIndexChange={() => {}} />,
      ),
    ).toContain("<dialog")
  })

  it("offers webpSrc as an image/webp source inside a picture, with src as the fallback", () => {
    const html = render(
      <Lightbox
        images={[{ ...IMAGES[0], webpSrc: "https://acme.example/img/a.webp" }]}
        index={0}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
      />,
    )

    expect(html).toMatch(
      /<picture><source type="image\/webp" srcset="https:\/\/acme\.example\/img\/a\.webp"\/><img src="https:\/\/acme\.example\/img\/a\.png"/,
    )
  })

  it("renders a bare image, with no picture, when the image has no webpSrc", () => {
    const html = render(
      <Lightbox images={IMAGES} index={0} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    expect(html).not.toContain("<picture")
    expect(html).toContain('<img src="https://acme.example/img/a.png"')
  })

  it("puts previous, the counter and next in one row after the caption with controls below", () => {
    const html = render(
      <Lightbox
        images={IMAGES}
        index={1}
        open
        onClose={() => {}}
        onIndexChange={() => {}}
        controls="below"
      />,
    )

    const caption = html.indexOf(">A team</p>")
    const previous = html.indexOf('aria-label="Previous image"')
    const counter = html.indexOf(">2 of 3</p>")
    const next = html.indexOf('aria-label="Next image"')
    expect(caption).toBeGreaterThan(html.indexOf("<img"))
    expect([caption < previous, previous < counter, counter < next]).toEqual([true, true, true])
    // The row's buttons flow in it; none is positioned over the image.
    expect(html).not.toMatch(/class="absolute[^"]*"[^>]*aria-label="(Previous|Next) image"/)
  })

  it("floats previous and next over the image by default", () => {
    const html = render(
      <Lightbox images={IMAGES} index={1} open onClose={() => {}} onIndexChange={() => {}} />,
    )

    expect(html).toMatch(/<button type="button" aria-label="Previous image" class="absolute /)
    expect(html).toMatch(/<button type="button" aria-label="Next image" class="absolute /)
    expect(html.indexOf('aria-label="Next image"')).toBeLessThan(html.indexOf("<img"))
  })
})
