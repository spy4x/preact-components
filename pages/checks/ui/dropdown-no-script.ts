import { check, type Devtools, poll, pressKey } from "../harness.ts"
import { clickAtPoint, elementCenter, waitForNavigation } from "./shared-forms.ts"
import { restoreHydratedPage } from "./shared-links.ts"

/** The `Dropdown` card's icon trigger, as the server renders it: the fallback's `<summary>`. */
const DROPDOWN_FALLBACK_TRIGGER = '#demo-Dropdown summary[aria-label="Row actions"]'

/**
 * How many `Dropdown`s each card renders, so the no-script role check reads every one of them and
 * notices one that stopped rendering its `<details>` fallback: the `Dropdown` card's four demos and
 * `Shell`'s user menu.
 */
const DROPDOWN_FALLBACKS: Readonly<Record<string, number>> = { "demo-Dropdown": 4, "demo-Shell": 1 }

/** The `Shell` card's user menu trigger; a `<summary>` before hydration, a `<button>` after. */
const SHELL_MENU_TRIGGER = '#demo-Shell [data-e2e="shell-user-menu-button"]'

/** The `Shell` card's form-post item with no `onClick`: a plain sign-out post. */
const SHELL_SIGN_OUT_EVERYWHERE = '#demo-Shell [data-e2e="signout-everywhere"]'

/** Whether the `<details>` around `selector`'s summary is open and its panel is on screen. */
function fallbackOpen(selector: string): string {
  return `(() => {
    const summary = document.querySelector('${selector}')
    const details = summary?.parentElement
    const panel = details?.querySelector(":scope > div")
    return details instanceof HTMLDetailsElement && details.open && panel !== null &&
      panel !== undefined && panel.checkVisibility()
  })()`
}

/**
 * `Dropdown` with scripts disabled outright, on the prerendered catalogue (#496): a real click on
 * the `<summary>` the server renders opens the panel, Tab walks from it to the first item, and
 * Enter on that item follows its link. Then `Shell`'s user menu, a `Dropdown` too, opens the same
 * way and its form-post sign-out item really posts — recorded off `Network.requestWillBeSent`, so
 * the proof is the request the browser sent, whatever the local preview server answers.
 *
 * `Emulation.setScriptExecutionDisabled` rather than holding the bundle, because the claim is
 * "with JavaScript off", and a held bundle still lets inline handlers and later scripts run. Clicks
 * and keys are real input events; `Runtime.evaluate` only reads.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function dropdownNoScriptChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")

  try {
    await devtools.send("Emulation.setScriptExecutionDisabled", { value: true })
    await devtools.send("Page.reload", { ignoreCache: true })
    const loaded = await waitForNavigation(devtools)
    const unhydrated = loaded &&
      await devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated !== "true"`)
        .catch(() => false)
    const closedAtFirst = !await devtools.evaluate<boolean>(fallbackOpen(DROPDOWN_FALLBACK_TRIGGER))
      .catch(() => true)

    // Every Dropdown on the page, Shell's user menu among them, as the server rendered it.
    const fallbacks = await devtools.evaluate<string[]>(`[...document.querySelectorAll("details")]
      .filter((details) => details.closest("#demo-Dropdown, #demo-Shell") !== null &&
        details.querySelector(":scope > summary + div.shadow-popover") !== null)
      .map((details) => {
        const panel = details.querySelector(":scope > div")
        const items = panel.querySelectorAll("a, button").length
        const marked = [panel, ...panel.querySelectorAll("*")].filter((node) =>
          ["menu", "menuitem"].includes(node.getAttribute("role")) ||
          node.hasAttribute("aria-orientation") ||
          (node === panel && node.hasAttribute("aria-label"))
        ).length
        return details.closest("#demo-Dropdown, #demo-Shell").id + ": " + items + " items, " +
          marked + " marked"
      })`).catch(() => [] as string[])
    const perCard = (card: string) =>
      fallbacks.filter((reading) => reading.startsWith(card + ": ")).length
    check(
      "with scripts off, no Dropdown panel or item announces a menu: no role, orientation or name " +
        "(#537)",
      unhydrated &&
        Object.entries(DROPDOWN_FALLBACKS).every(([card, count]) => perCard(card) === count) &&
        fallbacks.length === Object.values(DROPDOWN_FALLBACKS).reduce((a, b) => a + b) &&
        fallbacks.every((reading) => reading.endsWith(" 0 marked")),
      `${fallbacks.length} fallbacks: ${fallbacks.join("; ")}`,
    )

    const trigger = await elementCenter(devtools, DROPDOWN_FALLBACK_TRIGGER)
    if (trigger.ok) await clickAtPoint(devtools, trigger)
    const opened = trigger.ok &&
      await poll(() => devtools.evaluate<boolean>(fallbackOpen(DROPDOWN_FALLBACK_TRIGGER)), 3_000)
    check(
      "with scripts off, a real click on a Dropdown's server-rendered trigger opens its menu",
      unhydrated && closedAtFirst && opened,
      !unhydrated
        ? "the reload hydrated anyway, so this proves nothing about a page without scripts"
        : !closedAtFirst
        ? "the menu was already open before the click"
        : !trigger.ok
        ? `could not aim at the trigger: ${trigger.reason}`
        : opened
        ? "closed on load; the details opened and its panel is on screen"
        : "the details never opened, or its panel stayed off screen",
    )

    await pressKey(devtools, "Tab")
    const focused = await devtools.evaluate<string>(`(() => {
      const first = document.querySelector('${DROPDOWN_FALLBACK_TRIGGER}')
        ?.parentElement?.querySelector(":scope > div :is(a, button)")
      return first && document.activeElement === first
        ? "first item"
        : (document.activeElement?.outerHTML ?? "nothing").slice(0, 80)
    })()`).catch(() => "(page unreadable)")
    check(
      "with scripts off, Tab from an open Dropdown's trigger reaches its first item",
      opened && focused === "first item",
      `focus is on ${focused}`,
    )

    const hashBefore = await devtools.evaluate<string>("location.hash").catch(() => "")
    await devtools.evaluate<null>(`(history.replaceState(null, "", "#no-script-start"), null)`)
    await pressKey(devtools, "Enter")
    const followed = await poll(
      () => devtools.evaluate<boolean>(`location.hash === "#inputs"`).catch(() => false),
      3_000,
    )
    check(
      "with scripts off, Enter on a Dropdown's link item follows the link",
      focused === "first item" && followed,
      followed
        ? "the address moved to the item's #inputs"
        : `the address stayed off #inputs (it was ${JSON.stringify(hashBefore)} on load)`,
    )

    const shellTrigger = await elementCenter(devtools, SHELL_MENU_TRIGGER)
    if (shellTrigger.ok) await clickAtPoint(devtools, shellTrigger)
    const shellOpened = shellTrigger.ok &&
      await poll(() => devtools.evaluate<boolean>(fallbackOpen(SHELL_MENU_TRIGGER)), 3_000)

    const item = shellOpened
      ? await elementCenter(devtools, SHELL_SIGN_OUT_EVERYWHERE)
      : { ok: false, x: -1, y: -1, reason: "the menu did not open" }
    // The post is held and answered with 204 No Content, which leaves the browser on the page: the
    // preview server has no `/sign-out-everywhere` route, and its 404 would be a failed request.
    await devtools.send("Fetch.enable", {
      patterns: [{ urlPattern: "*sign-out-everywhere*", requestStage: "Request" }],
    })
    const paused = devtools.once<{ requestId: string; request: { method: string; url: string } }>(
      "Fetch.requestPaused",
      10_000,
    ).catch(() => null)
    if (item.ok) await clickAtPoint(devtools, item)
    const request = item.ok ? await paused : null
    if (request) {
      await devtools.send("Fetch.fulfillRequest", {
        requestId: request.requestId,
        responseCode: 204,
      })
    }
    await devtools.send("Fetch.disable")
    const method = request?.request.method ?? ""
    check(
      "with scripts off, Shell's user menu opens and its sign-out item posts its form",
      unhydrated && shellOpened && method === "POST",
      !shellTrigger.ok
        ? `could not aim at Shell's user menu trigger: ${shellTrigger.reason}`
        : !shellOpened
        ? "Shell's user menu never opened"
        : !item.ok
        ? `could not aim at the sign-out item: ${item.reason}`
        : request === null
        ? "no request to sign-out-everywhere was sent"
        : `${method} ${request.request.url}`,
    )
  } finally {
    await restoreHydratedPage(devtools, restoreUrl, "the Dropdown no-script checks")
  }
}

/**
 * The fallback hands over to the menu button when the bundle arrives late (#496). The island
 * bundle is held with the Fetch domain — the technique `system/`'s `siteHeaderHydrationSyncChecks`
 * documents — so the prerendered page is live but unhydrated. Two loads:
 *
 * 1. The `Dropdown` card's trigger is clicked open before hydration. Once hydrated, the trigger is
 *    the menu button, open (`aria-expanded="true"`), focus is on its first item, and Escape closes
 *    it and returns focus to the trigger — the hydrated keyboard contract, on an upgraded menu.
 * 2. The same trigger only has focus before hydration. Once hydrated, the menu button has it.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function dropdownHydrationUpgradeChecks(devtools: Devtools): Promise<void> {
  const restoreUrl = await devtools.evaluate<string>("location.href").catch(() => "")
  const islandUrl = await devtools.evaluate<string>(
    `document.querySelector('script[type="module"]')?.src ?? ""`,
  ).catch(() => "")
  const hydratedTrigger = `#demo-Dropdown button[aria-haspopup="menu"][aria-label="Row actions"]`

  /** Reload with the bundle held, run `before` on the unhydrated page, release, wait to hydrate. */
  const withLateBundle = async (before: () => Promise<boolean>) => {
    if (!islandUrl) return { held: false, acted: false, hydrated: false }
    let requestId: string | undefined
    try {
      await devtools.send("Fetch.enable", {
        patterns: [{ urlPattern: islandUrl, requestStage: "Request" }],
      })
      const paused = devtools.once<{ requestId: string }>("Fetch.requestPaused", 20_000)
      await devtools.send("Page.reload", { ignoreCache: true })
      requestId = (await paused.catch(() => null))?.requestId
      if (!requestId) return { held: false, acted: false, hydrated: false }
      const ready = await poll(
        () =>
          devtools.evaluate<boolean>(
            `document.querySelector('${DROPDOWN_FALLBACK_TRIGGER}') !== null`,
          )
            .catch(() => false),
        10_000,
      )
      const acted = ready && await before()
      await devtools.send("Fetch.continueRequest", { requestId })
      requestId = undefined
      await devtools.send("Fetch.disable")
      const hydrated = await poll(
        () =>
          devtools.evaluate<boolean>(`document.documentElement.dataset.hydrated === "true"`)
            .catch(() => false),
        10_000,
      )
      return { held: true, acted, hydrated }
    } finally {
      if (requestId) await devtools.send("Fetch.continueRequest", { requestId }).catch(() => {})
      await devtools.send("Fetch.disable").catch(() => {})
    }
  }

  try {
    const opened = await withLateBundle(async () => {
      const trigger = await elementCenter(devtools, DROPDOWN_FALLBACK_TRIGGER)
      if (!trigger.ok) return false
      await clickAtPoint(devtools, trigger)
      return await poll(
        () => devtools.evaluate<boolean>(fallbackOpen(DROPDOWN_FALLBACK_TRIGGER)),
        3_000,
      )
    })
    const upgraded = opened.hydrated && await poll(
      () =>
        devtools.evaluate<boolean>(`(() => {
          const trigger = document.querySelector('${hydratedTrigger}')
          const first = trigger?.parentElement?.querySelector('[role="menuitem"]')
          return trigger?.getAttribute("aria-expanded") === "true" &&
            first !== undefined && first !== null && document.activeElement === first
        })()`).catch(() => false),
      3_000,
    )
    check(
      "a Dropdown opened before hydration is the open menu after it, with focus on its first item",
      opened.held && opened.acted && upgraded,
      !opened.held
        ? "the island bundle was never held, so the page was not unhydrated"
        : !opened.acted
        ? "the fallback did not open on a click before hydration"
        : !opened.hydrated
        ? "the page never hydrated once the bundle was released"
        : upgraded
        ? "aria-expanded true on the menu button, focus on its first item"
        : "after hydration the trigger is not an expanded menu button, or focus is not on its item",
    )

    await pressKey(devtools, "Escape")
    const escaped = upgraded && await poll(
      () =>
        devtools.evaluate<boolean>(`(() => {
          const trigger = document.querySelector('${hydratedTrigger}')
          return trigger?.getAttribute("aria-expanded") === "false" &&
            document.activeElement === trigger
        })()`).catch(() => false),
      3_000,
    )
    check(
      "Escape closes the upgraded Dropdown and returns focus to its trigger",
      escaped,
      !upgraded
        ? "the menu never upgraded open"
        : escaped
        ? "aria-expanded false, focus on the trigger"
        : "the menu stayed open, or focus did not return",
    )

    // The roles the fallback leaves out (#537) are back once the menu has taken over.
    const hydratedRoles = await devtools.evaluate<string>(`(() => {
      const panel = document.querySelector('${hydratedTrigger}')?.parentElement
        ?.querySelector(":scope > div")
      if (!panel) return "no hydrated panel"
      const items = [...panel.querySelectorAll("a, button")]
      return [
        panel.getAttribute("role"),
        panel.getAttribute("aria-orientation"),
        panel.getAttribute("aria-label"),
        items.length + " items",
        items.filter((item) =>
          item.getAttribute("role") === "menuitem" && item.getAttribute("tabindex") === "-1"
        ).length + " menuitems out of the tab order",
      ].join(", ")
    })()`).catch(() => "(page unreadable)")
    check(
      "after hydration a Dropdown's panel is a named vertical menu and every item a menuitem out " +
        "of the tab order (#537)",
      upgraded && /^menu, vertical, Row actions, (\d+) items, \1 menuitems/.test(hydratedRoles),
      hydratedRoles,
    )

    const focused = await withLateBundle(() =>
      devtools.evaluate<boolean>(`(() => {
        const summary = document.querySelector('${DROPDOWN_FALLBACK_TRIGGER}')
        summary?.focus({ preventScroll: true })
        return summary !== null && document.activeElement === summary
      })()`).catch(() => false)
    )
    const kept = focused.hydrated && await poll(
      () =>
        devtools.evaluate<boolean>(
          `document.activeElement === document.querySelector('${hydratedTrigger}')`,
        ).catch(() => false),
      3_000,
    )
    const activeAfter = await devtools.evaluate<string>(
      `(document.activeElement?.outerHTML ?? "nothing").slice(0, 100)`,
    ).catch(() => "(page unreadable)")
    check(
      "a Dropdown trigger focused before hydration still has focus after it",
      focused.held && focused.acted && kept,
      !focused.held
        ? "the island bundle was never held"
        : !focused.acted
        ? "the fallback's summary did not take focus before hydration"
        : !focused.hydrated
        ? "the page never hydrated once the bundle was released"
        : kept
        ? "the menu button has focus"
        : `focus is on ${activeAfter}`,
    )
  } finally {
    await restoreHydratedPage(devtools, restoreUrl, "the Dropdown hydration-upgrade checks")
  }
}
