import { centreInView, check, type Devtools, poll, pressKey } from "../harness.ts"

/** What one read of the `ToggleChips` card sees: each chip's `aria-pressed`, by group and text. */
const TOGGLE_CHIPS_STATE = `(() => {
  const groups = [...document.querySelectorAll('#demo-ToggleChips [role="group"]')]
  const read = (group) =>
    Object.fromEntries([...group.querySelectorAll("button")].map((chip) =>
      [chip.textContent.trim(), chip.getAttribute("aria-pressed")]
    ))
  return {
    tags: read(groups.find((group) => group.getAttribute("aria-label") === "Tags")),
    status: read(groups.find((group) => group.getAttribute("aria-label") === "Status")),
    echo: document.querySelector('#demo-ToggleChips [data-e2e="toggle-chips-value"]').textContent.trim(),
  }
})()`

/** A {@link TOGGLE_CHIPS_STATE} read. */
interface ToggleChipsState {
  tags: Record<string, string | null>
  status: Record<string, string | null>
  echo: string
}

/**
 * `ToggleChips` answers real Space and Enter presses: a multi-select chip flips `aria-pressed` and
 * the controlled value both ways, and a single-select group moves its one pressed chip, then
 * clears it when the pressed chip is pressed again.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function toggleChipsChecks(devtools: Devtools): Promise<void> {
  const chip = (group: string, text: string) =>
    `[...document.querySelectorAll('#demo-ToggleChips [role="group"][aria-label="${group}"] button')]
      .find((chip) => chip.textContent.trim() === "${text}")`
  const read = () => devtools.evaluate<ToggleChipsState>(TOGGLE_CHIPS_STATE)
  await centreInView(devtools, chip("Tags", "home"))

  const before = await read()
  await devtools.evaluate<null>(`(${chip("Tags", "home")}.focus(), null)`)
  await pressKey(devtools, "Space")
  await poll(async () => (await read()).tags.home === "true", 2_000)
  const spaced = await read()
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).tags.home === "false", 2_000)
  const entered = await read()
  check(
    "Space and Enter each toggle a ToggleChips chip, flipping aria-pressed and the value",
    before.tags.home === "false" && spaced.tags.home === "true" &&
      spaced.echo.includes("tags: work, home") && entered.tags.home === "false" &&
      entered.echo.includes("tags: work ·") && entered.tags.work === "true",
    `home ${before.tags.home} → ${spaced.tags.home} → ${entered.tags.home}; ` +
      `"${spaced.echo}" → "${entered.echo}"`,
  )

  await devtools.evaluate<null>(`(${chip("Status", "Done")}.focus(), null)`)
  await pressKey(devtools, "Enter")
  await poll(async () => (await read()).status.Done === "true", 2_000)
  const moved = await read()
  await pressKey(devtools, "Space")
  await poll(async () => (await read()).status.Done === "false", 2_000)
  const cleared = await read()
  check(
    "a single-select ToggleChips moves its one pressed chip, and clears it when pressed again",
    before.status.Open === "true" && moved.status.Done === "true" &&
      moved.status.Open === "false" && moved.echo.endsWith("status: done") &&
      Object.values(cleared.status).every((pressed) => pressed === "false") &&
      cleared.echo.endsWith("status: (none)"),
    `Open ${before.status.Open} → ${moved.status.Open}, Done → ${moved.status.Done} → ` +
      `${cleared.status.Done}; "${moved.echo}" → "${cleared.echo}"`,
  )
}
