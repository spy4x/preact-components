import { check, type Devtools, PAGE_UNTIL } from "../harness.ts"

/** ToggleSwitch toggles its controlled value. */
export async function toggleSwitchChecks(devtools: Devtools): Promise<void> {
  const switches = await devtools.evaluate<{ count: number; before: string; after: string }>(
    `(async () => {
      const card = document.querySelector("#demo-ToggleSwitch")
      const switches = [...card.querySelectorAll('button[role="switch"]')]
      const before = switches[0].getAttribute("aria-checked")
      switches[0].click()
      await ${PAGE_UNTIL}(() => switches[0].getAttribute("aria-checked") !== before)
      return { count: switches.length, before, after: switches[0].getAttribute("aria-checked") }
    })()`,
  )
  check(
    "ToggleSwitch toggles its controlled value",
    switches.before !== switches.after,
    `${switches.before} → ${switches.after} across ${switches.count} switches`,
  )
}
