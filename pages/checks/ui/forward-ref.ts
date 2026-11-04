import { check, type Devtools } from "../harness.ts"

/** One component whose card carries a ref-forwarding demo, and the card that holds it. */
const REF_FORWARDING_CARDS = [
  ["Input", "#demo-Input"],
  ["Button", "#demo-Button"],
  ["Checkbox", "#demo-Checkbox"],
  ["Radio", "#demo-Radio"],
] as const

/**
 * `Input`, `Button`, `Checkbox` and `Radio` forward the `ref` they are given to the native element
 * they render, instead of it landing on the component and going nowhere.
 *
 * Preact strips `ref` off a function component's props and applies it to the component instance,
 * so a plain wrapper function makes `<Input ref={box} />` type-check and throw at `box.current
 * .focus()` time — the component instance has no `.focus` method. No unit test can see this: the
 * unit tests render to a string, which never attaches a ref or calls a method on one.
 *
 * Each of the four cards this drives (`ui-guide/sections/fields.tsx`'s `InputDemo`, `CheckboxDemo`
 * and `RadioDemo`, and `ui-guide/sections/buttons.tsx`'s `ButtonClickDemo`) holds a ref to one of
 * its own native elements, marked `[data-e2e="ref-target"]`, and a "Focus via ref" button, marked
 * `[data-e2e="ref-focus"]`, whose `onClick` calls `.focus()` through that ref — the same thing a
 * form does to move focus to its first invalid field, which is what the ref exists for. Each check
 * is a transition: the target does not have focus before the trigger is clicked, and does
 * afterwards, so a target that already happened to hold focus could not pass by accident.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function refForwardingChecks(devtools: Devtools): Promise<void> {
  for (const [name, card] of REF_FORWARDING_CARDS) {
    const target = `${card} [data-e2e="ref-target"]`
    const trigger = `${card} [data-e2e="ref-focus"]`

    const before = await devtools.evaluate<{ found: boolean; onTarget: boolean }>(`(() => {
      return {
        found: document.querySelector('${trigger}') !== null,
        onTarget: document.activeElement === document.querySelector('${target}'),
      }
    })()`)
    // `?.click()`, not `.click()`: a renamed or missing trigger has to fail this one named check,
    // not throw a page exception that would end the rest of this file's checks along with it.
    await devtools.evaluate<null>(`(document.querySelector('${trigger}')?.click(), null)`)
    const after = await devtools.evaluate<{ onTarget: boolean; label: string }>(`(() => {
      const active = document.activeElement
      return {
        onTarget: active === document.querySelector('${target}'),
        label: active === document.body ? "the page" : (active?.tagName ?? "nothing"),
      }
    })()`)

    check(
      `${name} forwards its ref to the native element, so "Focus via ref" can focus it`,
      before.found && !before.onTarget && after.onTarget,
      !before.found
        ? `the ${card} card has no [data-e2e="ref-focus"] trigger to click`
        : before.onTarget
        ? "the target already had focus before the trigger was clicked, so this proves nothing"
        : after.onTarget
        ? "clicking the trigger moved focus onto the native element through the ref"
        : `clicking the trigger left focus on ${after.label} instead of the target`,
    )
  }
}
