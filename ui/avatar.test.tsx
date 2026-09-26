import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { render } from "preact-render-to-string"
import {
  Avatar,
  avatarFace,
  AvatarGroup,
  failedAfterSrcChange,
  groupLabel,
  groupSplit,
} from "./avatar.tsx"

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

describe("failedAfterSrcChange", () => {
  it("keeps a failure while the source stays the same", () => {
    expect(failedAfterSrcChange("/ada.png", "/ada.png", true)).toBe(true)
    expect(failedAfterSrcChange("/ada.png", "/ada.png", false)).toBe(false)
    expect(failedAfterSrcChange(null, null, true)).toBe(true)
  })

  it("clears a failure when the source becomes a different URL", () => {
    expect(failedAfterSrcChange("/ada.png", "/grace.png", true)).toBe(false)
    expect(failedAfterSrcChange(null, "/ada.png", true)).toBe(false)
    expect(failedAfterSrcChange("/ada.png", null, true)).toBe(false)
    expect(failedAfterSrcChange("/ada.png", "", true)).toBe(false)
  })

  it("treats absent, null and empty as the same source", () => {
    expect(failedAfterSrcChange(undefined, null, true)).toBe(true)
    expect(failedAfterSrcChange(null, undefined, true)).toBe(true)
    expect(failedAfterSrcChange(undefined, "", true)).toBe(true)
    expect(failedAfterSrcChange("", undefined, true)).toBe(true)
  })

  it("never invents a failure for a source that had none", () => {
    expect(failedAfterSrcChange("/ada.png", "/grace.png", false)).toBe(false)
    expect(failedAfterSrcChange(null, "/ada.png", false)).toBe(false)
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

  it("trims the name before it becomes the image's alt text", () => {
    expect(render(<Avatar src="/ada.png" name="  Ada Lovelace  " />))
      .toContain('alt="Ada Lovelace"')
  })

  it("trims the name before it becomes the fallback box's label", () => {
    const html = render(<Avatar name="  Ada Lovelace  " />)

    expect(html).toContain('aria-label="Ada Lovelace"')
    expect(html).not.toContain(">  Ada")
  })

  it("leaves a whitespace-only name unnamed instead of labelling the box with spaces", () => {
    const html = render(<Avatar name="   " />)

    expect(html).not.toContain("aria-label")
    expect(html).not.toContain('role="img"')
    expect(html).toContain('aria-hidden="true"')
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

  it("renders one avatar per member in a labelled group", () => {
    const html = render(<AvatarGroup items={members} />)

    expect(html).toMatch(/^<div/)
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Avatars (3)"')
    expect((html.match(/<img/g) ?? []).length).toBe(3)
    expect((html.match(/-space-x-2 flex/g) ?? []).length).toBe(1)
  })

  it("is a group, not a list, so no item count contradicts the total", () => {
    const html = render(<AvatarGroup items={members} max={2} label="Project members" />)

    expect(html).not.toContain('role="list"')
    expect(html).not.toContain("<ul")
    expect(html).not.toContain("<li")
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Project members (3)"')
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
    expect(html).toContain('aria-label="Avatars (3)"')
    expect(chipCount(html)).toBe(1)
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
    expect(chipCount(html)).toBe(0)
    expect((html.match(/<img/g) ?? []).length).toBe(3)
  })

  it("renders no chip for an empty group", () => {
    const html = render(<AvatarGroup items={[]} />)

    expect(html).toContain('aria-label="Avatars (0)"')
    expect(html).not.toContain("<img")
    expect(chipCount(html)).toBe(0)
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

/**
 * Count the `+N` chips in a group's markup.
 *
 * Replaces the old `<li>` count, which pinned the tag rather than the thing it stood for: the chip
 * is hidden from assistive tech and there is no list to belong to any more.
 */
function chipCount(html: string): number {
  return (html.match(/aria-hidden="true"[^>]*>\+/g) ?? []).length
}
