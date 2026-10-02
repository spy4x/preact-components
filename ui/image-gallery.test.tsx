import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { options, type VNode } from "preact"
import { render } from "preact-render-to-string"
import {
  ImageGallery,
  type ImageGalleryImage,
  stripPosition,
  thumbnailKey,
} from "./image-gallery.tsx"
import { Lightbox, type LightboxProps } from "./lightbox.tsx"

const IMAGES: ImageGalleryImage[] = [
  { src: "https://acme.example/img/a.png", alt: "A hero" },
  {
    src: "https://acme.example/img/b.png",
    alt: "A team",
    thumbSrc: "https://acme.example/thumb/b.png",
  },
  { src: "https://acme.example/img/c.png", alt: "A product" },
]

describe("thumbnailKey", () => {
  it("keeps a thumbnail's key stable when an earlier, differently-sourced image is removed", () => {
    const before = [{ src: "a.png" }, { src: "b.png" }, { src: "c.png" }]
    const after = [{ src: "b.png" }, { src: "c.png" }] // "a.png" removed

    // The same key for "b.png" before and after is what keeps Preact's reconciliation — and so a
    // focused thumbnail, or the element the lightbox restores focus to by reference — on the same
    // image once an earlier one is gone. A key by position alone gives "b.png" "1" before removal
    // and "0" after, which is a *different* key for the same image.
    expect(thumbnailKey(before, 1)).toBe(thumbnailKey(after, 0))
  })

  it("does not keep a later copy's key stable when an earlier copy of the same src is removed", () => {
    // The one residual case this helper does not fix, documented rather than hidden: two
    // thumbnails sharing a src still collide with each other if the earlier one goes, because the
    // later one's own occurrence count recomputes. Narrower than the bug this replaces — it takes
    // two thumbnails sharing a source, not any two thumbnails anywhere in the list.
    const before = [{ src: "a.png" }, { src: "a.png" }, { src: "b.png" }]
    const after = [{ src: "a.png" }, { src: "b.png" }] // the first "a.png" removed

    expect(thumbnailKey(before, 1)).not.toBe(thumbnailKey(after, 0))
  })

  it("gives two thumbnails sharing one src different keys", () => {
    const images = [{ src: "a.png" }, { src: "a.png" }]

    expect(thumbnailKey(images, 0)).not.toBe(thumbnailKey(images, 1))
  })

  it("counts only earlier occurrences of the same src, not later ones", () => {
    const images = [{ src: "a.png" }, { src: "b.png" }, { src: "a.png" }]

    expect(thumbnailKey(images, 0)).toBe("a.png#0")
    expect(thumbnailKey(images, 2)).toBe("a.png#1")
  })
})

describe("ImageGallery", () => {
  it("renders one named button per image", () => {
    const html = render(<ImageGallery images={IMAGES} />)

    expect(html).toContain('aria-label="A hero"')
    expect(html).toContain('aria-label="A team"')
    expect(html).toContain('aria-label="A product"')
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })

  it("uses thumbSrc for the thumbnail image, falling back to the full src", () => {
    const html = render(<ImageGallery images={IMAGES} />)

    expect(html).toContain("https://acme.example/thumb/b.png")
    expect(html).toContain("https://acme.example/img/a.png")
    expect(html).toContain("https://acme.example/img/c.png")
    // The full-size src of the thumbnail that has its own thumbSrc is not also rendered as a src.
    expect(html).not.toContain('src="https://acme.example/img/b.png"')
  })

  it("renders every thumbnail image decorative, since the button already carries the name", () => {
    // `preact-render-to-string` renders `alt=""` as the bare attribute `alt` — see
    // `ui/avatar.test.tsx`'s `bareAltCount` for the same measurement.
    const html = render(<ImageGallery images={[IMAGES[0]]} />)

    expect(html.match(/alt(?=[\s>])/g) ?? []).toHaveLength(1)
  })

  it("renders the lightbox closed, with no image inside it, before anything is pressed", () => {
    const html = render(<ImageGallery images={IMAGES} />)

    expect(html).toContain("<dialog")
    // The three thumbnail images are the only <img> tags; the lightbox itself carries none while closed.
    expect((html.match(/<img/g) ?? []).length).toBe(3)
  })

  it("drops an image with no description from the strip", () => {
    const images = [...IMAGES, { src: "https://acme.example/img/d.png", alt: "  " }]
    const html = render(<ImageGallery images={images} />)

    expect(html).not.toContain("https://acme.example/img/d.png")
    expect((html.match(/<button/g) ?? []).length).toBe(3)
  })

  it("passes custom lightbox labels through", () => {
    const html = render(
      <ImageGallery
        images={IMAGES}
        label="Photo viewer"
        closeLabel="Dismiss"
        previousLabel="Earlier"
        nextLabel="Later"
      />,
    )

    expect(html).toContain('aria-label="Photo viewer"')
  })

  it("threads counterLabel through to the lightbox it renders", () => {
    // `Lightbox` computes its counter text unconditionally, on every render, not only once the
    // dialog is open — see `ui/lightbox.tsx`'s `counter` — so a spy recording its own calls proves
    // the prop actually reaches `Lightbox` rather than being dropped along the way. Reading the
    // rendered HTML could not show this: the dialog stays closed and the counter chip does not
    // appear in it either way.
    const seen: Array<[number, number]> = []
    const counterLabel = (position: number, total: number) => {
      seen.push([position, total])
      return `${position}/${total}`
    }

    render(<ImageGallery images={IMAGES} counterLabel={counterLabel} />)

    expect(seen).toEqual([[1, IMAGES.length]])
  })

  it("keeps the caller's utilities on the thumbnail strip", () => {
    const html = render(<ImageGallery images={IMAGES} class="scroll-smooth" />)

    expect(html).toContain("scroll-smooth")
  })

  it("threads controls through to the lightbox it renders", () => {
    // The dialog is closed during a server render, so its HTML is the same for either value; the
    // props the `Lightbox` element was created with are what show the value arrived.
    const seen: LightboxProps[] = []
    const previous = options.vnode
    options.vnode = (vnode: VNode) => {
      if (vnode.type === Lightbox) seen.push(vnode.props as unknown as LightboxProps)
      previous?.(vnode)
    }
    try {
      render(<ImageGallery images={IMAGES} controls="below" />)
    } finally {
      options.vnode = previous
    }

    expect(seen.map((props) => props.controls)).toEqual(["below"])
  })

  it("keeps the default grid's markup and classes exactly as they were before the strip existed", () => {
    // Rendered from the component as it stood before `layout` was added (#539), and pasted here: the
    // default must not move by one class or one attribute.
    const thumb =
      "block cursor-pointer overflow-hidden rounded-md border border-subtle transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus"
    const before = `<ul class="flex flex-wrap gap-3">` +
      `<li><button type="button" class="${thumb}" aria-label="A hero"><img src="a.png" alt class="size-20 object-cover sm:size-24"/></button></li>` +
      `<li><button type="button" class="${thumb}" aria-label="A team"><img src="tb.png" alt class="size-20 object-cover sm:size-24"/></button></li>` +
      `</ul>`
    const images = [
      { src: "a.png", alt: "A hero" },
      { src: "b.png", alt: "A team", thumbSrc: "tb.png" },
    ]

    for (
      const html of [
        render(<ImageGallery images={images} />),
        render(<ImageGallery images={images} layout="grid" />),
      ]
    ) {
      expect(html.slice(0, html.indexOf("<dialog"))).toBe(before)
    }
  })
})

describe('ImageGallery with layout="strip"', () => {
  it("lays the images out in one row that scrolls sideways and snaps to each image", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" />)
    const list = html.match(/<ul class="([^"]*)"/)?.[1].split(" ") ?? []
    const items = [...html.matchAll(/<li class="([^"]*)"/g)].map((match) => match[1].split(" "))

    expect(list).toEqual(
      expect.arrayContaining(["flex", "snap-x", "snap-mandatory", "overflow-x-auto"]),
    )
    expect(list).not.toContain("flex-wrap")
    expect(items).toHaveLength(3)
    for (const item of items) {
      expect(item).toEqual(expect.arrayContaining(["snap-start", "shrink-0"]))
    }
  })

  it("shows each full-size image uncropped, not the small square thumbnail", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" />)

    expect(html).toContain('src="https://acme.example/img/b.png"')
    expect(html).not.toContain("https://acme.example/thumb/b.png")
    expect(html).not.toContain("object-cover")
    expect(html).not.toContain("size-20")
  })

  it("keeps every image a real named button, with room for its focus ring inside the row", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" />)

    expect((html.match(/<button type="button"/g) ?? []).length).toBe(3)
    expect(html).toContain('aria-label="A team"')
    expect(html).toContain("focus-visible:ring-2")
    expect(html.match(/<ul class="([^"]*)"/)?.[1].split(" ")).toContain("p-1")
  })

  it("renders each image's width and height on its strip image", () => {
    const sized = IMAGES.map((image) => ({ ...image, width: 1600, height: 900 }))
    const imgs = render(<ImageGallery images={sized} layout="strip" />).match(/<img [^>]*>/g) ?? []

    expect(imgs).toHaveLength(3)
    for (const img of imgs) {
      expect(img).toContain('width="1600"')
      expect(img).toContain('height="900"')
    }
  })

  it("loads only the first strip image up front and every later one lazily", () => {
    const imgs = render(<ImageGallery images={IMAGES} layout="strip" />).match(/<img [^>]*>/g) ?? []

    expect(imgs).toHaveLength(3)
    expect(imgs[0]).not.toContain("loading=")
    expect(imgs[1]).toContain('loading="lazy"')
    expect(imgs[2]).toContain('loading="lazy"')
  })

  it("leaves the grid's fixed-size thumbnails without a size or lazy loading", () => {
    const sized = IMAGES.map((image) => ({ ...image, width: 1600, height: 900 }))
    const html = render(<ImageGallery images={sized} />)

    expect(html.slice(0, html.indexOf("<dialog"))).not.toMatch(/width=|height=|loading=/)
  })

  it("keeps the caller's utilities on the strip's row", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" class="max-w-xl" />)

    expect(html.match(/<ul class="([^"]*)"/)?.[1].split(" ")).toEqual(
      expect.arrayContaining(["snap-x", "max-w-xl"]),
    )
  })
})

/** Everything a render puts before the lightbox's `<dialog>`: the strip and what sits under it. */
function beforeDialog(html: string): string {
  return html.slice(0, html.indexOf("<dialog"))
}

/** Every `<img>` tag before the lightbox. */
function stripImgs(html: string): string[] {
  return beforeDialog(html).match(/<img [^>]*>/g) ?? []
}

describe('ImageGallery with layout="strip", defaults', () => {
  it("keeps the strip's markup exactly as it was before its options existed", () => {
    // Rendered from the component at 3.2.0, before `hero`, `captions`, `navigation`, `snap` and
    // `slideWidth` were added, and pasted here: a strip that sets none of them must not move by one
    // class or one attribute.
    const button =
      "block cursor-pointer overflow-hidden rounded-md border border-subtle transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-focus w-full"
    const before = `<ul class="flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto p-1">` +
      `<li class="w-5/6 shrink-0 snap-start sm:w-2/3"><button type="button" class="${button}" aria-label="A hero"><img src="a.png" alt width="1600" height="900" class="block h-auto w-full"/></button></li>` +
      `<li class="w-5/6 shrink-0 snap-start sm:w-2/3"><button type="button" class="${button}" aria-label="A team"><img src="b.png" alt loading="lazy" class="block h-auto w-full"/></button></li>` +
      `</ul>`
    const images = [
      { src: "a.png", alt: "A hero", width: 1600, height: 900 },
      { src: "b.png", alt: "A team" },
    ]

    expect(beforeDialog(render(<ImageGallery images={images} layout="strip" />))).toBe(before)
  })
})

describe('ImageGallery with layout="strip" and hero', () => {
  it("loads the first strip image eagerly at high priority and every later one lazily and async", () => {
    const imgs = stripImgs(render(<ImageGallery images={IMAGES} layout="strip" hero />))

    expect(imgs).toHaveLength(3)
    expect(imgs[0]).toContain('loading="eager"')
    expect(imgs[0]).toContain('fetchpriority="high"')
    expect(imgs[0]).not.toContain("decoding=")
    for (const img of imgs.slice(1)) {
      expect(img).toContain('loading="lazy"')
      expect(img).toContain('decoding="async"')
      expect(img).not.toContain("fetchpriority=")
    }
  })

  it("leaves the grid's thumbnails without a priority", () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} hero />))

    expect(html).not.toMatch(/fetchpriority=|loading=|decoding=/)
  })
})

describe("ImageGallery strip image attribute order", () => {
  it("writes src before loading on every strip image, so a page-level lazy count can match it", () => {
    const imgs = stripImgs(render(<ImageGallery images={IMAGES} layout="strip" hero />))

    expect(imgs[0]).toMatch(/src="[^"]+"[^>]*loading="eager"[^>]*fetchpriority="high"/)
    for (const img of imgs.slice(1)) expect(img).toMatch(/src="[^"]+"[^>]*loading="lazy"/)
  })
})

describe("ImageGallery hooks and lightbox options", () => {
  it("marks the row data-gallery-strip and the counter data-gallery-counter with navigation", () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} layout="strip" navigation />))

    expect(html).toMatch(/<ul [^>]*data-gallery-strip/)
    expect(html).toMatch(/<p [^>]*data-gallery-counter[^>]*>1 of 3<\/p>/)
  })

  it("adds neither hook without navigation", () => {
    const html = render(<ImageGallery images={IMAGES} layout="strip" captions hero />)

    expect(html).not.toContain("data-gallery-")
  })

  it("names the lightbox after the open image when label is a function", () => {
    const html = render(
      <ImageGallery
        images={IMAGES}
        layout="strip"
        label={(image) => image.alt}
      />,
    )

    expect(html).toMatch(/<dialog [^>]*aria-label="A hero"/)
  })
})

describe('ImageGallery with layout="strip" and captions', () => {
  it("shows each image's alt as a caption under its button, and as the image's own alt", () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} layout="strip" captions />))
    const slides = html.match(/<li [^>]*>.*?<\/li>/g) ?? []

    expect(slides).toHaveLength(3)
    slides.forEach((slide, index) => {
      const alt = IMAGES[index].alt
      expect(slide).toMatch(
        new RegExp(
          `^<li [^>]*><figure [^>]*><button [^>]*>.*</button><figcaption [^>]*>${alt}</figcaption></figure></li>$`,
        ),
      )
      expect(slide).toContain(`<img src="${IMAGES[index].src}" alt="${alt}"`)
    })
  })

  it("names each button by its image's alt, the caption's text, and not a second time by aria-label", () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} layout="strip" captions />))
    const buttons = html.match(/<button [^>]*>/g) ?? []

    expect(buttons).toHaveLength(3)
    for (const button of buttons) expect(button).not.toContain("aria-label")
  })

  it("leaves the grid uncaptioned", () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} captions />))

    expect(html).not.toContain("<figcaption")
    expect(html).toContain('aria-label="A hero"')
  })
})

describe('ImageGallery with layout="strip" and navigation', () => {
  it("renders a counter under the row, worded by counterLabel, at the first slide", () => {
    const html = beforeDialog(
      render(
        <ImageGallery
          images={IMAGES}
          layout="strip"
          navigation
          counterLabel={(position, total) => `${position} / ${total}`}
        />,
      ),
    )

    expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf("<p "))
    expect(html).toMatch(/<p [^>]*aria-live="polite"[^>]*>1 \/ 3<\/p>/)
  })

  it('counts "1 of 3" by default, the lightbox\'s own wording', () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} layout="strip" navigation />))

    expect(html).toMatch(/<p [^>]*>1 of 3<\/p>/)
  })

  it("renders no Previous or Next before it has measured that the row overflows", () => {
    const html = beforeDialog(render(<ImageGallery images={IMAGES} layout="strip" navigation />))

    expect(html.match(/<button/g) ?? []).toHaveLength(3)
    expect(html).not.toContain("Previous image")
    expect(html).not.toContain("Next image")
  })

  it("renders no counter for a single image, or for the grid", () => {
    for (
      const html of [
        render(<ImageGallery images={[IMAGES[0]]} layout="strip" navigation />),
        render(<ImageGallery images={IMAGES} navigation />),
      ]
    ) {
      expect(beforeDialog(html)).not.toContain("<p")
    }
  })
})

describe("stripPosition", () => {
  const row = { maxScroll: 1000, step: 250, total: 5 }

  it("names the first slide at the row's start", () => {
    expect(stripPosition({ ...row, scrollLeft: 0 })).toBe(0)
  })

  it("names the last slide at the row's end, even when it is not a whole step along", () => {
    expect(stripPosition({ ...row, maxScroll: 900, scrollLeft: 900 })).toBe(4)
  })

  it("names the slide nearest a centred position part-way along", () => {
    // A centred slide sits a little before its start position: 2 × 250 − 40.
    expect(stripPosition({ ...row, scrollLeft: 460 })).toBe(2)
  })

  it("never names the first or the last slide part-way along", () => {
    expect(stripPosition({ ...row, scrollLeft: 20 })).toBe(1)
    expect(stripPosition({ ...row, scrollLeft: 990 })).toBe(3)
  })
})

describe('ImageGallery with layout="strip" and webpSrc', () => {
  it("renders a strip image inside a picture with its WebP source and the src as fallback", () => {
    const images = [{ ...IMAGES[0], webpSrc: "https://acme.example/img/a.webp" }]
    const html = beforeDialog(render(<ImageGallery images={images} layout="strip" />))

    expect(html).toMatch(
      /<picture [^>]*><source type="image\/webp" srcset="https:\/\/acme\.example\/img\/a\.webp"\/><img src="https:\/\/acme\.example\/img\/a\.png"/,
    )
  })

  it("leaves the grid's thumbnail a plain image", () => {
    const images = [{ ...IMAGES[0], webpSrc: "https://acme.example/img/a.webp" }]
    const html = beforeDialog(render(<ImageGallery images={images} />))

    expect(html).not.toContain("<picture")
  })
})

describe('ImageGallery with layout="strip", snap and slideWidth', () => {
  /** Each slide's classes. */
  function slideClasses(html: string): string[][] {
    return [...beforeDialog(html).matchAll(/<li class="([^"]*)"/g)].map((match) =>
      match[1].split(" ")
    )
  }

  const portrait = IMAGES.map((image) => ({ ...image, width: 360, height: 780 }))
  const landscape = IMAGES.map((image) => ({ ...image, width: 1600, height: 900 }))

  it('snaps each slide to the row\'s centre with snap="center"', () => {
    const slides = slideClasses(
      render(<ImageGallery images={IMAGES} layout="strip" snap="center" />),
    )

    expect(slides).toHaveLength(3)
    for (const slide of slides) {
      expect(slide).toContain("snap-center")
      expect(slide).not.toContain("snap-start")
    }
  })

  it('gives narrower slides when the first image is portrait, with slideWidth="orientation"', () => {
    const slides = slideClasses(
      render(<ImageGallery images={portrait} layout="strip" slideWidth="orientation" />),
    )

    expect(slides).toHaveLength(3)
    for (const slide of slides) {
      expect(slide).toEqual(expect.arrayContaining(["w-11/20", "sm:w-7/20", "lg:w-2/7"]))
      expect(slide).not.toContain("w-5/6")
    }
  })

  it('keeps the wide slides for a landscape first image, with slideWidth="orientation"', () => {
    const slides = slideClasses(
      render(<ImageGallery images={landscape} layout="strip" slideWidth="orientation" />),
    )

    for (const slide of slides) {
      expect(slide).toEqual(expect.arrayContaining(["w-5/6", "sm:w-2/3"]))
      expect(slide).not.toContain("w-11/20")
    }
  })

  it("keeps the wide slides for a portrait first image by default", () => {
    for (const slide of slideClasses(render(<ImageGallery images={portrait} layout="strip" />))) {
      expect(slide).toContain("w-5/6")
      expect(slide).not.toContain("w-11/20")
    }
  })
})
