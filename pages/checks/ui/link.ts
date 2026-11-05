import { check, type Devtools, pointerToCorner } from "../harness.ts"
import {
  BUTTON_LINK,
  describeLinkOutcome,
  LINK_CARD,
  linkFocusRingCheck,
  type LinkPress,
  pressLink,
} from "./shared-links.ts"

/** The focus ring of a linked Badge and of a Button link. */
export async function linkFocusRingChecks(devtools: Devtools): Promise<void> {
  // The pill itself is the link, unlike the link inside the static badge beside it.
  await linkFocusRingCheck(devtools, {
    selector: "#demo-Badge a[href].inline-flex",
    name: "linked Badge",
  })
  await linkFocusRingCheck(devtools, { selector: BUTTON_LINK, name: "Button link" })
}

const ROUTED_LINK = `${LINK_CARD} [data-e2e="link-routed"]`

const PLAIN_LINK = `${LINK_CARD} [data-e2e="link-plain"]`

/** The `Link` card's link to another site, given the same `navigate` port as the routed one. */
const FOREIGN_LINK = `${LINK_CARD} [data-e2e="link-foreign"]`

/**
 * `Link` takes over a plain click only when it has a `navigate` port, and leaves every modified
 * and middle click to the browser. Each case is one real press through the browser's input
 * pipeline; see {@link pressLink} for how the page is kept from really following the link.
 *
 * @param devtools The connected session, on the `ui` page.
 */
export async function linkChecks(devtools: Devtools): Promise<void> {
  const plain: LinkPress = { name: "a plain click", button: "left", modifiers: 0 }

  const routed = await pressLink(devtools, ROUTED_LINK, plain)
  check(
    "a plain click on a Link with navigate calls navigate and cancels the browser's navigation",
    routed.aimed && routed.type === "click" && routed.prevented === true &&
      routed.navigations === 1 && !routed.navigated,
    describeLinkOutcome(routed),
  )

  const bare = await pressLink(devtools, PLAIN_LINK, plain)
  check(
    "a plain click on a Link without navigate is left to the browser",
    bare.aimed && bare.type === "click" && bare.prevented === false && !bare.navigated,
    describeLinkOutcome(bare),
  )

  const foreign = await pressLink(devtools, FOREIGN_LINK, plain)
  check(
    "a plain click on a Link with navigate to another origin is left to the browser and does not call navigate",
    foreign.aimed && foreign.type === "click" && foreign.prevented === false &&
      foreign.navigations === 0 && !foreign.navigated,
    describeLinkOutcome(foreign),
  )

  const leftAlone: LinkPress[] = [
    { name: "a Ctrl click", button: "left", modifiers: 2 },
    { name: "a Meta click", button: "left", modifiers: 4 },
    { name: "a Shift click", button: "left", modifiers: 8 },
    { name: "an Alt click", button: "left", modifiers: 1 },
    { name: "a middle click", button: "middle", modifiers: 0 },
  ]
  for (const press of leftAlone) {
    const outcome = await pressLink(devtools, ROUTED_LINK, press)
    const type = press.button === "middle" ? "auxclick" : "click"
    check(
      `${press.name} on a Link with navigate is left to the browser and does not call navigate`,
      outcome.aimed && outcome.type === type && outcome.prevented === false &&
        outcome.navigations === 0 && !outcome.navigated,
      describeLinkOutcome(outcome),
    )
  }

  await pointerToCorner(devtools)
}
