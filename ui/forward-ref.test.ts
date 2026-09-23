import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { Button } from "./button.tsx"
import { Checkbox } from "./checkbox.tsx"
import { Input } from "./input.tsx"
import { Radio } from "./radio.tsx"

/** A component {@link forwardRef} produced — enough of its shape to read `displayName` off it. */
interface HasDisplayName {
  displayName?: string
}

describe("forwardRef", () => {
  it("names each of the four wrapped components by its own name, not the wrapper's", () => {
    // `preact/debug` and Preact devtools fall back to a component's own function name only when
    // `displayName` is unset; every one of the four below is `forwardRef`'s internal `Forwarded`
    // function underneath, so this is the one property standing between a debug message reading
    // "in Button" and one reading "in Forwarded" for all four alike.
    //
    // This does not prove `forward-ref.ts` reads its `name` argument rather than `render.name`
    // for `displayName` — both give the same string here, since nothing in this Deno test process
    // bundles or renames the render functions the way `deno bundle` does. That distinction is
    // proven separately, by bundling: see `forward-ref.ts`'s own doc comment for what a bundler
    // does to a same-named `const X = forwardRef(function X(...) {...})`.
    expect((Button as HasDisplayName).displayName).toBe("Button")
    expect((Input as HasDisplayName).displayName).toBe("Input")
    expect((Checkbox as HasDisplayName).displayName).toBe("Checkbox")
    expect((Radio as HasDisplayName).displayName).toBe("Radio")
  })
})
