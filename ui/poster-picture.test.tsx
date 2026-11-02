import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { aspectRef } from "./poster-picture.tsx"

describe("aspectRef", () => {
  it("sets the poster's aspect ratio on the box through the CSSOM, which a strict CSP allows", () => {
    const set: [string, string][] = []
    const box = { style: { setProperty: (name: string, value: string) => set.push([name, value]) } }
    aspectRef({ src: "/p.webp", width: 1440, height: 900 })(box as unknown as HTMLElement)
    expect(set).toEqual([["aspect-ratio", "1440 / 900"]])
  })

  it("does nothing when the box goes away", () => {
    expect(() => aspectRef({ src: "/p.webp", width: 1, height: 1 })(null)).not.toThrow()
  })
})
