import { centreInView, type Devtools, pointerToCorner } from "../harness.ts"

/** What one read of a combobox says about its list, its highlight and its status message. */
export interface ComboboxReading {
  /** `false` when the card has no combobox under the parked id; every other field is then noise. */
  ok: boolean
  expanded: string | null
  /** `true` while the popup carries the `hidden` attribute. */
  listHidden: boolean
  options: number
  /** `aria-activedescendant` of the input, or `null` when nothing is highlighted. */
  active: string | null
  /** The highlighted row's text, cut short, or `""` when nothing is highlighted. */
  activeText: string
  /** `true` when `aria-activedescendant` names an element the page no longer holds. */
  activeDangles: boolean
  describedBy: string | null
  /** The live region's role, or `null` when the component renders no region at all. */
  statusRole: string | null
  statusLive: string | null
  statusAtomic: string | null
  statusText: string
  /** How many element children the region holds; `0` is the empty region the field starts with. */
  statusChildren: number
  inputValue: string
  /** The popup's scroll position and box, which is where a highlight goes to get lost. */
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  /** `true` when the highlighted row's own box lies inside the popup's visible band. */
  activeInView: boolean
  /** The page's own scroll position: `scrollIntoView` moves every scrollable ancestor it has. */
  pageScrollY: number
}

/**
 * Park one combobox's input and popup on `globalThis`.
 *
 * @param id The `id` the catalogue gave the input, which is also the base of every derived id.
 */
export function comboboxSetup(id: string): string {
  return `(() => {
    const id = ${JSON.stringify(id)}
    globalThis.__verifyCombobox = {
      id,
      input: document.getElementById(id),
      list: document.getElementById(id + "-listbox"),
    }
    return null
  })()`
}

/**
 * The parked combobox's list, highlight, live region and popup geometry, in one round trip.
 *
 * The region is looked up by the id the component derives rather than by `role="status"`: a reading
 * has to be able to say "this field has none" without a selector coming back empty because it
 * found some other component's region instead.
 *
 * `statusText` is the whole answer to "what would a reader be told", and `statusChildren` separates
 * the two ways of being empty — a region holding an empty message element, and a region holding
 * nothing at all.
 */
export const COMBOBOX_STATE = `(() => {
  const { id, input, list } = globalThis.__verifyCombobox ?? {}
  if (!input || !list) {
    return {
      ok: false, expanded: null, listHidden: false, options: -1, active: null, activeText: "",
      activeDangles: false,
      describedBy: null, statusRole: null, statusLive: null, statusAtomic: null, statusText: "",
      statusChildren: -1, inputValue: "",
      scrollTop: -1, clientHeight: -1, scrollHeight: -1, activeInView: false, pageScrollY: -1,
    }
  }
  const status = document.getElementById(id + "-status")
  const active = input.getAttribute("aria-activedescendant")
  const row = active === null ? null : document.getElementById(active)
  return {
    ok: true,
    expanded: input.getAttribute("aria-expanded"),
    listHidden: list.hidden,
    options: list.querySelectorAll('[role="option"]').length,
    active,
    activeText: (row?.textContent ?? "").trim().slice(0, 40),
    activeDangles: active !== null && row === null,
    describedBy: input.getAttribute("aria-describedby"),
    statusRole: status?.getAttribute("role") ?? null,
    statusLive: status?.getAttribute("aria-live") ?? null,
    statusAtomic: status?.getAttribute("aria-atomic") ?? null,
    statusText: (status?.textContent ?? "").trim().slice(0, 40),
    statusChildren: status?.childElementCount ?? -1,
    inputValue: input.value,
    scrollTop: Math.round(list.scrollTop),
    clientHeight: Math.round(list.clientHeight),
    scrollHeight: Math.round(list.scrollHeight),
    activeInView: row !== null && row.offsetTop >= list.scrollTop - 1 &&
      row.offsetTop + row.offsetHeight <= list.scrollTop + list.clientHeight + 1,
    pageScrollY: Math.round(globalThis.scrollY),
  }
})()`

/**
 * Bring the parked combobox into view and wait for the page to stop moving.
 *
 * Coordinates are derived one round trip and used the next, in viewport pixels, so the page has to
 * have settled in between — the same reason `strayClickCheck` waits above.
 *
 * @param devtools The connected session.
 */
export async function scrollToParked(devtools: Devtools): Promise<void> {
  await centreInView(devtools, `globalThis.__verifyCombobox?.input ?? null`)
  await pointerToCorner(devtools)
}
