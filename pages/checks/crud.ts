import { check, type Devtools, poll } from "./harness.ts"

/**
 * `crud/`'s browser checks: `CrudEditor`'s form-level message, driven on the `CrudEditor` catalogue
 * card. `ui-guide/sections/crud.tsx` gives that card's demo a schema with one cross-field rule — Name
 * must differ from Notes — so there is a real `.narrow` failure with no field of its own to report
 * against. This file drives the demo's `Name`/`Notes` `TextField` rows through a real focus/blur pair
 * (which is what commits a `TextField` — it writes on blur, not on input) and Save through
 * `.click()`, and reads back the live region, Save's `disabled`/`aria-describedby`, and the store
 * port's own log of what it was asked to do.
 *
 * `CrudList`/`AssociationEditor` keyboard and focus behaviour has no check yet; anything behind a
 * ref, an effect or a key press that a string-rendering test cannot execute belongs here once it is
 * covered.
 *
 * @param devtools The connected session, on a hydrated page.
 */
export async function crudChecks(devtools: Devtools): Promise<void> {
  const initial = await readState(devtools)
  check("the CrudEditor demo card is on the page", initial.ok, initial.ok ? "found" : "not found")
  if (!initial.ok) return

  check(
    "the form-level live region exists on load, marked polite and atomic",
    initial.statusRole === "status" && initial.statusLive === "polite" &&
      initial.statusAtomic === "true",
    `role="${initial.statusRole}" aria-live="${initial.statusLive}" aria-atomic="${initial.statusAtomic}"`,
  )
  check(
    "Save's aria-describedby already names the live region on load",
    initial.describedBy !== null && initial.describedBy === initial.statusId,
    `aria-describedby="${initial.describedBy}" id="${initial.statusId}"`,
  )

  // The demo's blank row starts with Name and Notes equal — both "" — which the schema's
  // cross-field rule rejects. That is the starting state this check reads, not one it has to
  // provoke first: it is what #119 asked to stop happening silently.
  check(
    "a blank row fails the cross-field rule and blocks Save from the start",
    initial.saveDisabled === true && initial.statusText === CROSS_FIELD_MESSAGE,
    `disabled=${initial.saveDisabled} message="${initial.statusText}"`,
  )

  await commitField(devtools, "Name", "Alpha")
  const distinct = await waitForState(devtools, (reading) => reading.statusText === "")
  check(
    "giving Name and Notes different values clears the message and enables Save",
    distinct.saveDisabled === false && distinct.statusText === "",
    `disabled=${distinct.saveDisabled} message="${distinct.statusText}"`,
  )

  // The region is empty right here — Name and Notes differ — which is the moment `parkRegion` has
  // to run: a reading taken only after the message arrives could not tell "the same element gained
  // text" from "a new element carrying the text replaced the old one", and that second shape is
  // exactly what a region keyed on its message, or rendered only while a message exists, produces.
  const parked = await parkRegion(devtools)

  const validClick = await clickSave(devtools)
  const afterValidClick = await waitForState(
    devtools,
    (reading) => reading.writesText.includes("create #"),
  )
  check(
    "Save works while valid: a click reaches the store and the port logs a create",
    // "create #" cannot appear in the paragraph's own label text ("the create port logged: …"), only
    // in an entry the store's own `create` port appended — the distinction the next check needs, once
    // a click while invalid is supposed to add nothing.
    validClick && afterValidClick.writesText.includes("create #") &&
      afterValidClick.writesText !== distinct.writesText,
    afterValidClick.writesText,
  )

  await commitField(devtools, "Notes", "Alpha")
  const equalAgain = await waitForState(devtools, (reading) => reading.statusText !== "")
  check(
    "making Notes equal Name again reinstates the message and disables Save",
    equalAgain.saveDisabled === true && equalAgain.statusText === CROSS_FIELD_MESSAGE,
    `disabled=${equalAgain.saveDisabled} message="${equalAgain.statusText}"`,
  )

  const identity = await readRegionIdentity(devtools)
  check(
    "the message lands inside the region parked while it was empty, and a MutationObserver caught it",
    parked && identity.found && identity.same && identity.connected &&
      identity.text === CROSS_FIELD_MESSAGE && identity.mutations >= 1,
    !parked
      ? "there was no region to park before Name and Notes were made equal"
      : `same=${identity.same} connected=${identity.connected} text="${identity.text}" ` +
        `mutations=${identity.mutations} — a region keyed on its message, or rendered only while ` +
        `one exists, would replace rather than mutate the parked element`,
  )

  const beforeScriptSubmit = equalAgain.writesText
  const submitted = await requestSubmitForm(devtools)
  const scriptSubmitLeaked = await poll(
    async () => (await readState(devtools)).writesText !== beforeScriptSubmit,
    500,
  )
  const afterScriptSubmit = await readState(devtools)
  check(
    "form.requestSubmit() writes nothing while the cross-field rule fails",
    // A script-triggered submit reaches the `<form>`'s `onSubmit` handler directly, bypassing both
    // the disabled Save button (which a click or Enter cannot activate) and the browser's own
    // implicit-submission rule (which refuses to submit through Enter when the only submit control is
    // disabled) — so the guard has to live in the handler itself, not only in the button's own state.
    submitted && !scriptSubmitLeaked && afterScriptSubmit.writesText === beforeScriptSubmit,
    scriptSubmitLeaked
      ? `writes before "${beforeScriptSubmit}" after "${afterScriptSubmit.writesText}"`
      : "no write followed requestSubmit() within 500ms",
  )

  const ignoredClick = await clickSave(devtools)
  const clickLeaked = await poll(
    async () => (await readState(devtools)).writesText !== afterScriptSubmit.writesText,
    500,
  )
  const afterBlockedClick = await readState(devtools)
  check(
    "a disabled Save ignores a click — no write reaches the store while the rule fails",
    // Compared against `afterScriptSubmit`, not `equalAgain`: this check has to stand on its own.
    // Baselined on `equalAgain` — the reading from before the `requestSubmit()` check above — a leak
    // from that check alone would turn this one red too, and its own detail would blame the click.
    ignoredClick && !clickLeaked && afterBlockedClick.writesText === afterScriptSubmit.writesText,
    `writes before "${afterScriptSubmit.writesText}" after "${afterBlockedClick.writesText}"`,
  )

  await commitField(devtools, "Notes", "Beta")
  const fixedAgain = await waitForState(devtools, (reading) => reading.statusText === "")
  check(
    "making the two fields distinct again clears the message and re-enables Save",
    fixedAgain.saveDisabled === false && fixedAgain.statusText === "",
    `disabled=${fixedAgain.saveDisabled} message="${fixedAgain.statusText}"`,
  )
}

/** The card these checks drive: the `CrudEditor` demo, whose schema adds one cross-field rule. */
const CARD = "#demo-CrudEditor"

/** The exact text `regionCrossFieldSchema`'s `ctx.reject` gives its one rule, in `ui-guide/sections/crud.tsx`. */
const CROSS_FIELD_MESSAGE = "Name must differ from Notes"

/** One reading of the demo: what Save and the live region answer, and what the store port logged. */
interface CrudEditorReading {
  /** `false` when the card itself was not found; every other field is then noise. */
  ok: boolean
  /** Whether the Save button carries the `disabled` attribute, or `null` when there is no button. */
  saveDisabled: boolean | null
  /** Save's `aria-describedby`, or `null` when there is no button. */
  describedBy: string | null
  /** The live region's own id, or `null` when there is no region. */
  statusId: string | null
  /** The live region's `role`, or `null`. */
  statusRole: string | null
  /** The live region's `aria-live`, or `null`. */
  statusLive: string | null
  /** The live region's `aria-atomic`, or `null`. */
  statusAtomic: string | null
  /** The live region's text, trimmed — `""` while no form-level issue is showing. */
  statusText: string
  /** The demo's own log of what the store's `create`/`update` ports were called with. */
  writesText: string
}

/** Read every field {@link CrudEditorReading} declares, in one round trip. */
async function readState(devtools: Devtools): Promise<CrudEditorReading> {
  return await devtools.evaluate<CrudEditorReading>(`(() => {
    const card = document.querySelector('${CARD}')
    if (!card) {
      return {
        ok: false, saveDisabled: null, describedBy: null, statusId: null, statusRole: null,
        statusLive: null, statusAtomic: null, statusText: "", writesText: "",
      }
    }
    const save = card.querySelector('button[type="submit"]')
    const status = card.querySelector('[role="status"]')
    const model = card.querySelector('[data-e2e="model"]')
    return {
      ok: true,
      saveDisabled: save ? save.disabled : null,
      describedBy: save ? save.getAttribute("aria-describedby") : null,
      statusId: status ? status.id : null,
      statusRole: status ? status.getAttribute("role") : null,
      statusLive: status ? status.getAttribute("aria-live") : null,
      statusAtomic: status ? status.getAttribute("aria-atomic") : null,
      statusText: status ? status.textContent.trim() : "",
      writesText: model ? model.textContent.trim() : "",
    }
  })()`)
}

/**
 * Poll {@link readState} until `predicate` holds, or 2s pass — whichever comes first — and return
 * the last reading either way, so a caller whose predicate never holds still gets a reading a `check`
 * can report against, rather than a thrown timeout.
 *
 * @param devtools The connected session.
 * @param predicate What the next `check` in this file needs to be true before it reads the state.
 */
async function waitForState(
  devtools: Devtools,
  predicate: (reading: CrudEditorReading) => boolean,
): Promise<CrudEditorReading> {
  let last = await readState(devtools)
  await poll(async () => {
    last = await readState(devtools)
    return predicate(last)
  }, 2_000)
  return last
}

/**
 * Park a reference to the live region on `globalThis`, with a `MutationObserver` watching it —
 * `pages/checks/system.ts`'s proof for `SWUpdater`'s region, adapted here. Call this only while the
 * region is empty: a reading that merely finds "a region with the message in it" afterwards would
 * pass just as well against a region that was replaced rather than updated, which is the defect this
 * guards against.
 *
 * @param devtools The connected session.
 * @returns Whether a region was found to park.
 */
function parkRegion(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const region = document.querySelector('${CARD} [role="status"]')
    if (!region) return false
    globalThis.__crudRegionElement = region
    globalThis.__crudRegionMutations = 0
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === globalThis.__crudRegionElement) globalThis.__crudRegionMutations++
      }
    })
    observer.observe(region, { childList: true, subtree: true, characterData: true })
    globalThis.__crudRegionObserver = observer
    return true
  })()`)
}

/** What {@link readRegionIdentity} answers about the region {@link parkRegion} parked. */
interface RegionIdentity {
  /** Whether a live region is still on the page at all. */
  found: boolean
  /** Whether it is the very element {@link parkRegion} parked, not a replacement. */
  same: boolean
  /** Whether that element is still attached to the document. */
  connected: boolean
  /** Its text, trimmed. */
  text: string
  /** Mutations the observer recorded whose target was the parked element itself. */
  mutations: number
}

/**
 * Read whether the page's live region is still the element {@link parkRegion} parked, and disconnect
 * the observer — this file reads identity once per run, so there is nothing left for it to watch.
 *
 * @param devtools The connected session.
 */
function readRegionIdentity(devtools: Devtools): Promise<RegionIdentity> {
  return devtools.evaluate<RegionIdentity>(`(() => {
    const region = document.querySelector('${CARD} [role="status"]')
    const reading = {
      found: Boolean(region),
      same: Boolean(region) && region === globalThis.__crudRegionElement,
      connected: Boolean(region) && region.isConnected,
      text: region ? region.textContent.trim() : "",
      mutations: globalThis.__crudRegionMutations || 0,
    }
    globalThis.__crudRegionObserver?.disconnect()
    return reading
  })()`)
}

/**
 * Commit one field by its visible label — a real focus/blur pair, which is what commits a
 * `TextField`: it writes on blur, not on input, so setting `.value` alone would leave the model
 * untouched. `.focus()`/`.blur()` move the browser's own focus, which is what makes the resulting
 * focus/blur events trusted.
 *
 * @param devtools The connected session.
 * @param label The field's visible label text, exactly as the card renders it.
 * @param value The value to commit.
 * @returns Whether a field with that label was found.
 */
function commitField(devtools: Devtools, label: string, value: string): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const card = document.querySelector('${CARD}')
    const target = card && [...card.querySelectorAll("label")]
      .find((element) => element.textContent.trim() === ${JSON.stringify(label)})
    const id = target ? target.getAttribute("for") : null
    const input = id ? document.getElementById(id) : null
    if (!input) return false
    input.focus()
    input.value = ${JSON.stringify(value)}
    input.blur()
    return true
  })()`)
}

/**
 * Click Save through the DOM's own `.click()` method.
 *
 * `.click()` dispatches an ordinary `click` event with `isTrusted: false` — it is not indistinguishable
 * from a person's own click, and this file does not claim otherwise — but the event still reaches
 * every listener a real click would, which is why it drives the same `onClick`/`onSubmit` path. The
 * one place the distrust would matter is exactly the one this file relies on going the other way:
 * `HTMLElement.click()` called on an actually-disabled button dispatches nothing at all, trusted or
 * not, which is how the "ignores a click" checks below tell a button that quietly does nothing from
 * one that was never found.
 *
 * @param devtools The connected session.
 * @returns Whether a Save button was found to click.
 */
function clickSave(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const save = document.querySelector('${CARD} button[type="submit"]')
    if (!save) return false
    save.click()
    return true
  })()`)
}

/**
 * Submit the form the way a keyboard shortcut or another script would: `HTMLFormElement.requestSubmit()`,
 * called directly on the `<form>` rather than through Save. This is the path a disabled Save button
 * does nothing to stop — the button's `disabled` attribute only keeps a click or Enter from reaching
 * it — so `submit()` in `crud/crud-editor.tsx` has to refuse the write itself.
 *
 * @param devtools The connected session.
 * @returns Whether a form was found to submit.
 */
function requestSubmitForm(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const form = document.querySelector('${CARD} form')
    if (!form) return false
    form.requestSubmit()
    return true
  })()`)
}
