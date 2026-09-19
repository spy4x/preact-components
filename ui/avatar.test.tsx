import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import { Avatar, avatarFace, AvatarGroup, groupLabel, groupSplit, initials } from "./avatar.tsx"

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("John Smith")).toBe("JS")
  })

  it("stops at two letters for a three-word name", () => {
    expect(initials("John Paul Smith")).toBe("JP")
  })

  it("takes the first letter of a single-word name", () => {
    expect(initials("Cher")).toBe("C")
  })

  it("ignores leading, trailing and repeated whitespace", () => {
    expect(initials("  John   Smith  ")).toBe("JS")
    expect(initials("\tJohn\nSmith ")).toBe("JS")
  })

  it("keeps a hyphenated word as one word", () => {
    expect(initials("Anne-Marie Dupont")).toBe("AD")
    expect(initials("Mary-Jane")).toBe("M")
  })

  it("keeps an apostrophe inside the word", () => {
    expect(initials("O'Brien")).toBe("O")
    expect(initials("D'Angelo Smith")).toBe("DS")
  })

  it("uppercases a lower-case name", () => {
    expect(initials("john smith")).toBe("JS")
  })

  it("takes one code point, not one UTF-16 unit, of a combined Latin name", () => {
    expect(initials("Émile Zola")).toBe("ÉZ")
  })

  it("takes a digit as an initial", () => {
    expect(initials("7 of 9")).toBe("7O")
  })
})

describe("initials for CJK names", () => {
  it("treats every CJK character as its own word", () => {
    // The bug this guards: with a space-only word split, "王小明" is one word and the avatar shows
    // "王" — one letter of a three-letter name.
    expect(initials("王小明")).toBe("王小")
    expect(initials("欧阳修文")).toBe("欧阳")
  })

  it("returns two characters, not the whole name", () => {
    expect(initials("王小明").length).toBe(2)
    expect(initials("王小明")).not.toBe("王小明")
  })

  it("returns the single character of a one-character name", () => {
    expect(initials("李")).toBe("李")
  })

  it("reads a spaced CJK name as the same two characters", () => {
    expect(initials("李 明")).toBe("李明")
  })

  it("handles kana and hangul as well as ideographs", () => {
    expect(initials("山田太郎")).toBe("山田")
    expect(initials("김철수")).toBe("김철")
  })

  it("mixes scripts by the same rule", () => {
    // Two Han words fill both initials, so the Latin word after them is not reached; one Han word
    // is followed by the Latin one.
    expect(initials("李明 John")).toBe("李明")
    expect(initials("李 John")).toBe("李J")
  })
})

describe("initials with nothing usable", () => {
  it("returns an empty string for an empty name", () => {
    expect(initials("")).toBe("")
  })

  it("returns an empty string for a whitespace-only name", () => {
    expect(initials("   ")).toBe("")
    expect(initials("\n\t")).toBe("")
  })

  it("returns an empty string for null and undefined", () => {
    expect(initials(null)).toBe("")
    expect(initials(undefined)).toBe("")
    expect(initials()).toBe("")
  })

  it("returns an empty string for a name of punctuation only", () => {
    expect(initials("!!!")).toBe("")
    expect(initials("--")).toBe("")
  })

  it("returns an empty string for an emoji-only name", () => {
    expect(initials("😀")).toBe("")
    expect(initials("👩💻")).toBe("")
  })

  it("skips an emoji word rather than half of it", () => {
    expect(initials("Ada 😀 Lovelace")).toBe("AL")
    expect(initials("😀 Ada")).toBe("A")
  })

  it("skips leading punctuation instead of using it", () => {
    expect(initials("-John Smith")).toBe("JS")
    expect(initials("(Ada) Lovelace")).toBe("AL")
  })
})

describe("avatarFace", () => {
  it("shows the image while the source has not failed", () => {
    expect(avatarFace({ src: "/ada.png", name: "Ada Lovelace" })).toBe("image")
  })

  it("shows the image before it knows anything has failed", () => {
    expect(avatarFace({ src: "/ada.png" })).toBe("image")
  })

  it("falls back to the initials once the source has failed", () => {
    expect(avatarFace({ src: "/ada.png", failed: true, name: "Ada Lovelace" })).toBe("initials")
  })

  it("falls back to the initials for a single-name user", () => {
    expect(avatarFace({ src: "/ada.png", failed: true, name: "Ada" })).toBe("initials")
  })

  it("falls back to the initials when no source was given", () => {
    expect(avatarFace({ name: "Ada Lovelace" })).toBe("initials")
    expect(avatarFace({ src: "", name: "王小明" })).toBe("initials")
  })

  it("falls back to the icon when there is no usable name", () => {
    expect(avatarFace({})).toBe("icon")
    expect(avatarFace({ src: "/ada.png", failed: true })).toBe("icon")
    expect(avatarFace({ name: "" })).toBe("icon")
    expect(avatarFace({ name: "   " })).toBe("icon")
    expect(avatarFace({ name: "😀" })).toBe("icon")
    expect(avatarFace({ name: null })).toBe("icon")
  })

  it("prefers the image over a name it could draw initials from", () => {
    expect(avatarFace({ src: "/ada.png", name: "Ada Lovelace" })).toBe("image")
  })
})

describe("groupSplit", () => {
  it("counts the members that do not fit behind the chip", () => {
    expect(groupSplit(6, 4)).toEqual({ visible: 4, overflow: 2 })
  })

  it("shows every avatar when the group is under the maximum", () => {
    expect(groupSplit(3, 4)).toEqual({ visible: 3, overflow: 0 })
  })

  it("shows every avatar when the group is exactly the maximum", () => {
    expect(groupSplit(4, 4)).toEqual({ visible: 4, overflow: 0 })
  })

  it("counts every member behind the chip for a maximum of zero", () => {
    expect(groupSplit(5, 0)).toEqual({ visible: 0, overflow: 5 })
  })

  it("renders an empty group without a chip", () => {
    expect(groupSplit(0, 4)).toEqual({ visible: 0, overflow: 0 })
  })

  it("never counts more overflow than there are members", () => {
    expect(groupSplit(2, 10)).toEqual({ visible: 2, overflow: 0 })
  })

  it("floors a fractional count and treats a negative maximum as zero", () => {
    expect(groupSplit(4.9, 2.9)).toEqual({ visible: 2, overflow: 2 })
    expect(groupSplit(4, -1)).toEqual({ visible: 0, overflow: 4 })
  })

  it("treats a non-finite count as zero instead of producing NaN", () => {
    expect(groupSplit(Number.NaN, 4)).toEqual({ visible: 0, overflow: 0 })
    expect(groupSplit(Number.POSITIVE_INFINITY, 4)).toEqual({ visible: 0, overflow: 0 })
  })

  it("splits every member into exactly one of the two counts", () => {
    for (const total of [0, 1, 5, 12]) {
      for (const max of [0, 1, 4, 20]) {
        const { visible, overflow } = groupSplit(total, max)

        expect(visible + overflow, `${total}/${max}`).toBe(total)
        expect(overflow, `${total}/${max}`).toBe(Math.max(0, total - max))
      }
    }
  })
})

describe("groupLabel", () => {
  it("falls back to a generic group name", () => {
    expect(groupLabel(undefined, 3)).toBe("Avatars (3)")
  })

  it("keeps the caller's description and adds the total", () => {
    expect(groupLabel("Project members", 12)).toBe("Project members (12)")
  })

  it("trims the description and ignores a blank one", () => {
    expect(groupLabel("  Project members ", 2)).toBe("Project members (2)")
    expect(groupLabel("   ", 2)).toBe("Avatars (2)")
  })

  it("reports the total count, not the number of visible avatars", () => {
    expect(groupLabel("Project members", 12)).toContain("12")
  })
})

describe("Avatar", () => {
  it("renders the image with the name as its alt text", () => {
    const html = render(<Avatar src="/ada.png" name="Ada Lovelace" />)

    expect(html).toContain('<img src="/ada.png"')
    expect(html).toContain('alt="Ada Lovelace"')
    expect(html).toContain("size-full object-cover")
  })

  it("lets an explicit alt win over the name", () => {
    const html = render(<Avatar src="/ada.png" name="Ada Lovelace" alt="The author" />)

    expect(html).toContain('alt="The author"')
    expect(html).not.toContain('alt="Ada Lovelace"')
  })

  it("marks a decorative image with an empty alt", () => {
    const html = render(<Avatar src="/ada.png" name="Ada Lovelace" alt="" />)

    expect(bareAltCount(html)).toBe(1)
    expect(html).not.toContain('alt="Ada Lovelace"')
  })

  it("leaves the image unnamed when there is neither an alt nor a name", () => {
    expect(bareAltCount(render(<Avatar src="/ada.png" />))).toBe(1)
  })

  it("draws the initials when no image is given", () => {
    const html = render(<Avatar name="Ada Lovelace" />)

    expect(html).toContain(">AL<")
    expect(html).not.toContain("<img")
  })

  it("draws the initials of a CJK name", () => {
    expect(render(<Avatar name="王小明" />)).toContain(">王小<")
  })

  it("names the fallback box for assistive tech", () => {
    const html = render(<Avatar name="Ada Lovelace" />)

    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Ada Lovelace"')
    expect(html).not.toContain("aria-hidden")
  })

  it("hides the fallback box when it is decorative", () => {
    const html = render(<Avatar name="Ada Lovelace" alt="" />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain("aria-label")
    expect(html).not.toContain('role="img"')
  })

  it("prefers the caller's empty alt over the name for the initials face too", () => {
    expect(render(<Avatar name="Ada Lovelace" alt="" />)).toContain(">AL<")
  })

  it("falls back to a generic icon when there is no usable name", () => {
    const html = render(<Avatar />)

    expect(html).toContain("<svg")
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain("aria-label")
  })

  it("falls back to the generic icon for an emoji-only name", () => {
    expect(render(<Avatar name="😀" />)).toContain("<svg")
  })

  it("does not treat an empty source as an image", () => {
    const html = render(<Avatar src="" name="Ada Lovelace" />)

    expect(html).not.toContain("<img")
    expect(html).toContain(">AL<")
  })

  it("renders a box, not a button", () => {
    expect(render(<Avatar name="Ada Lovelace" />)).toMatch(/^<span/)
  })

  it("appends a caller class to the box", () => {
    expect(render(<Avatar name="Ada Lovelace" class="size-16" />)).toContain("size-16")
  })

  it("sizes the box and its initials by name", () => {
    expect(render(<Avatar name="Ada Lovelace" size="xs" />)).toContain("size-6")
    expect(render(<Avatar name="Ada Lovelace" size="lg" />)).toContain("text-base")
  })

  it("sizes the fallback glyph to the box", () => {
    expect(render(<Avatar size="lg" />)).toContain("shrink-0 size-7")
  })
})

describe("AvatarGroup", () => {
  const members = [
    { name: "Ada Lovelace", src: "/ada.png" },
    { name: "Grace Hopper", src: "/grace.png" },
    { name: "Alan Turing", src: "/alan.png" },
  ]

  it("renders one avatar per member in a labelled list", () => {
    const html = render(<AvatarGroup items={members} />)

    expect(html).toMatch(/^<ul/)
    expect(html).toContain('role="list"')
    expect(html).toContain('aria-label="Avatars (3)"')
    expect((html.match(/<img/g) ?? []).length).toBe(3)
    expect((html.match(/<li/g) ?? []).length).toBe(3)
  })

  it("overlaps the stack", () => {
    expect(render(<AvatarGroup items={members} />)).toContain("-space-x-2")
  })

  it("keeps the stack avatars decorative so no name is announced twice", () => {
    const html = render(<AvatarGroup items={members} label="Project members" />)

    expect(bareAltCount(html)).toBe(3)
    expect(html).not.toContain('aria-label="Ada Lovelace"')
    expect(html).toContain('aria-label="Project members (3)"')
  })

  it("counts the members that do not fit behind a plus chip", () => {
    const html = render(<AvatarGroup items={members} max={2} />)

    expect(html).toContain("+1")
    expect((html.match(/<img/g) ?? []).length).toBe(2)
    expect((html.match(/<li/g) ?? []).length).toBe(3)
  })

  it("reports the total, chip included, on the group label", () => {
    const html = render(<AvatarGroup items={members} max={1} label="Project members" />)

    expect(html).toContain('aria-label="Project members (3)"')
    expect(html).toContain("+2")
  })

  it("hides the chip from assistive tech, whose number the label already carries", () => {
    const html = render(<AvatarGroup items={members} max={1} />)

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("+2")
  })

  it("renders no chip when nothing overflows", () => {
    const html = render(<AvatarGroup items={members} max={4} />)

    expect(html).not.toContain(">+")
    expect((html.match(/<li/g) ?? []).length).toBe(3)
  })

  it("renders no chip for an empty group", () => {
    const html = render(<AvatarGroup items={[]} />)

    expect(html).toContain('aria-label="Avatars (0)"')
    expect(html).not.toContain("<li")
    expect(html).not.toContain(">+")
  })

  it("falls back to the initials for members whose image is missing", () => {
    const html = render(<AvatarGroup items={[{ name: "王小明" }, { name: "Ada" }]} />)

    expect(html).not.toContain("<img")
    expect(html).toContain(">王小<")
    expect(html).toContain(">A<")
  })

  it("sizes every avatar in the stack", () => {
    const html = render(<AvatarGroup items={members} size="xs" max={2} />)

    expect((html.match(/size-6/g) ?? []).length).toBe(3)
  })

  it("appends a caller class to the list", () => {
    expect(render(<AvatarGroup items={members} class="mt-4" />)).toContain("mt-4")
  })
})

/**
 * Count images that carry an empty `alt`.
 *
 * `preact-render-to-string` renders `alt=""` as the bare attribute `alt`, which is the same thing
 * to a browser — an image with an empty alternative, i.e. a decorative one — but not the same
 * string, so the assertions count it instead of matching it.
 */
function bareAltCount(html: string): number {
  return (html.match(/alt(?=[\s>])/g) ?? []).length
}
