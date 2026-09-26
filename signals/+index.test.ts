/**
 * What importing this package does to the rest of the process: nothing.
 *
 * The package used to ship `<For>`, `<Show>` and a `Signal.prototype.map` patch applied as a side
 * effect of the import, and the barrel pulled that module in — so importing the package for a pure
 * function also mutated a type belonging to `@preact/signals`, for every consumer downstream. The
 * components are gone (`@preact/signals/utils` ships its own), and this is the guard on the part
 * nothing else can see: a global that has not changed leaves no trace anywhere else in the suite.
 */

import { expect } from "@std/expect"
import { describe, it } from "@std/testing/bdd"
import { computed, Signal, signal } from "@preact/signals"
import * as barrel from "./+index.ts"

describe("importing @spy4x/preact-signals", () => {
  it("adds no member to Signal.prototype", () => {
    // Referenced so the import is unmistakably evaluated before the assertion, whatever a bundler
    // or a future module-graph optimisation would like to do with an unused namespace import.
    expect(typeof barrel.createThemeStore).toBe("function")
    expect(typeof barrel.themeBootstrapScript).toBe("function")

    expect("map" in Signal.prototype, "Signal.prototype.map").toBe(false)
  })

  it("leaves a signal with no method a plain signal does not have", () => {
    const list = signal([1, 2])
    // A computed signal is the other half: it inherits from the same prototype the patch reached.
    const doubled = computed(() => list.value.map((value) => value * 2))

    expect("map" in list, "a signal").toBe(false)
    expect("map" in doubled, "a computed signal").toBe(false)
  })

  it("exports no component", () => {
    // The package is factories and pure functions now, which is what `ui-guide/coverage.ts` was
    // told when `signals` moved to its excluded list: a component here would mean that reason is
    // out of date. A component-named export is fine — every one today is an `enum` — so what is
    // asserted is that none of them is callable, which is what a component is. Adding an enum
    // leaves this test alone; adding a component fails it.
    const componentNamed = Object.entries(barrel).filter(([name]) =>
      /^[A-Z]/.test(name) && /[a-z]/.test(name)
    )
    expect(componentNamed.length, "component-named exports read").toBeGreaterThan(0)

    const callable = componentNamed.filter(([, value]) => typeof value === "function")
    expect(callable.map(([name]) => name)).toEqual([])
  })
})
