import { centreInView, check, type Devtools, poll, settledScroll } from "./harness.ts"

/**
 * `crud/`'s browser checks: `CrudEditor`'s form-level message, driven on the `CrudEditor` catalogue
 * card. `ui-guide/sections/crud.tsx` gives that card's demo a schema with one cross-field rule — Name
 * must differ from Notes — so there is a real `.narrow` failure with no field of its own to report
 * against. This file drives the demo's `Name`/`Notes` `TextField` rows through a real focus/blur pair
 * (which is what commits a `TextField` — it writes on blur, not on input) and Save through
 * `.click()`, and reads back the live region, Save's `disabled`/`aria-describedby`, and the store
 * port's own log of what it was asked to do.
 *
 * Also drives the `DeletionValidation` catalogue demo (`#255`): its alert region is present and
 * empty on load, a new non-empty dependency list brings it into view and is announced as a change to
 * the region, a re-render for a reason unrelated to the dependency list does not scroll the page, and
 * emptying the list clears the region's content without removing the region itself.
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

  await deletionValidationChecks(devtools)
}

/** The card {@link deletionValidationChecks} drives: the `DeletionValidation` catalogue demo. */
const DELETION_CARD = "#demo-DeletionValidation"

/**
 * One reading of the `DeletionValidation` demo's alert region and its place on the page.
 *
 * `ok` and `regionFound` are separate on purpose: `ok` is only about the demo card, which is always
 * on the page once the catalogue has rendered, whatever `DeletionValidation` itself does. A check
 * that needs the region present has to read `regionFound` — folding the two into one flag would let
 * a region that never renders while the list is empty hide behind "card not found" instead of
 * failing the check that is actually about the region.
 */
interface DeletionValidationReading {
  /** `false` when the demo card itself was not found; every other field is then noise. */
  ok: boolean
  /** Whether the alert region was found on the page at all. */
  regionFound: boolean
  /** Whether the region carries `role="alert"`. `false` when the region was not found. */
  hasAlertRole: boolean
  /** The region's own `class` attribute, `""` when it has none or was not found. */
  regionClass: string
  /** The region's text, trimmed — `""` while the dependency list is empty or not found. */
  regionText: string
  /** Whether the region's top sits inside the viewport. `false` when not found. */
  inViewport: boolean
}

/** Read every field {@link DeletionValidationReading} declares, in one round trip. */
function readDeletionState(devtools: Devtools): Promise<DeletionValidationReading> {
  return devtools.evaluate<DeletionValidationReading>(`(() => {
    const notFound = {
      regionFound: false, hasAlertRole: false, regionClass: "", regionText: "", inViewport: false,
    }
    const card = document.querySelector('${DELETION_CARD}')
    if (!card) return { ok: false, ...notFound }
    const region = card.querySelector('[role="alert"]')
    if (!region) return { ok: true, ...notFound }
    const box = region.getBoundingClientRect()
    const viewport = document.documentElement.clientHeight
    return {
      ok: true,
      regionFound: true,
      hasAlertRole: region.getAttribute("role") === "alert",
      regionClass: region.getAttribute("class") ?? "",
      regionText: region.textContent.trim(),
      inViewport: box.top >= 0 && box.top < viewport,
    }
  })()`)
}

/**
 * Park a reference to the `DeletionValidation` region on `globalThis`, with a `MutationObserver`
 * watching it — the same technique {@link parkRegion} elsewhere in this file uses for `CrudEditor`'s
 * region, under its own global names so the two do not collide. Call this only while the region is
 * known to exist
 * (`readDeletionState`'s `regionFound`); a region that only renders once the list is non-empty
 * cannot be parked before that, which is itself the failure {@link deletionValidationChecks} needs
 * to see rather than paper over.
 *
 * @param devtools The connected session.
 * @returns Whether a region was found to park.
 */
function parkDeletionRegion(devtools: Devtools): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const region = document.querySelector('${DELETION_CARD} [role="alert"]')
    if (!region) return false
    globalThis.__deletionRegionElement = region
    globalThis.__deletionRegionMutations = 0
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === globalThis.__deletionRegionElement) globalThis.__deletionRegionMutations++
      }
    })
    observer.observe(region, { childList: true, subtree: true, characterData: true, attributes: true })
    globalThis.__deletionRegionObserver = observer
    return true
  })()`)
}

/** What {@link readDeletionRegionIdentity} answers about the region {@link parkDeletionRegion} parked. */
interface DeletionRegionIdentity {
  /** Whether a `role="alert"` region is still on the page at all. */
  found: boolean
  /** Whether it is the very element {@link parkDeletionRegion} parked, not a replacement. */
  same: boolean
  /** Whether that element is still attached to the document. */
  connected: boolean
  /** Its text, trimmed. */
  text: string
  /** Mutations the observer recorded whose target was the parked element itself. */
  mutations: number
}

/**
 * Read whether the page's `DeletionValidation` region is still the element
 * {@link parkDeletionRegion} parked, and disconnect the observer.
 *
 * @param devtools The connected session.
 */
function readDeletionRegionIdentity(devtools: Devtools): Promise<DeletionRegionIdentity> {
  return devtools.evaluate<DeletionRegionIdentity>(`(() => {
    const region = document.querySelector('${DELETION_CARD} [role="alert"]')
    const reading = {
      found: Boolean(region),
      same: Boolean(region) && region === globalThis.__deletionRegionElement,
      connected: Boolean(region) && region.isConnected,
      text: region ? region.textContent.trim() : "",
      mutations: globalThis.__deletionRegionMutations || 0,
    }
    globalThis.__deletionRegionObserver?.disconnect()
    return reading
  })()`)
}

/**
 * Click a demo card's button by its exact, current visible text — the toggle buttons in the
 * `DeletionValidation` demo relabel themselves, so a selector fixed on one label would stop
 * matching after the first click.
 *
 * @param devtools The connected session.
 * @param card The demo card's selector.
 * @param text The button's exact visible text right now.
 * @returns Whether a matching button was found and clicked.
 */
function clickButtonByText(devtools: Devtools, card: string, text: string): Promise<boolean> {
  return devtools.evaluate<boolean>(`(() => {
    const root = document.querySelector('${card}')
    const button = root && [...root.querySelectorAll("button")]
      .find((element) => element.textContent.trim() === ${JSON.stringify(text)})
    if (!button) return false
    button.click()
    return true
  })()`)
}

/**
 * `DeletionValidation`'s browser checks, on the catalogue's own demo (`#255`): the alert region is
 * present and empty on load, a non-empty dependency list brings it into view with the message
 * arriving as a mutation of the same, already-parked region (not a replacement), a re-render for a
 * reason unrelated to the dependency list does not move the page, emptying the list removes the
 * visible content while the region itself stays on the page, and a second blocked attempt — the
 * list restored to the same content after being emptied — scrolls into view again.
 *
 * @param devtools The connected session, on a hydrated page.
 */
async function deletionValidationChecks(devtools: Devtools): Promise<void> {
  const initial = await readDeletionState(devtools)
  check(
    "the DeletionValidation demo card is on the page",
    initial.ok,
    initial.ok ? "found" : "not found",
  )
  if (!initial.ok) return

  check(
    "the region exists before there is anything to say, carrying role=alert and no class",
    initial.regionFound && initial.hasAlertRole && initial.regionText === "" &&
      initial.regionClass === "",
    `found=${initial.regionFound} role has "alert"=${initial.hasAlertRole} ` +
      `class="${initial.regionClass}" text="${initial.regionText}"`,
  )

  // Parked while the list is still empty, not after it arrives: a reading taken only once the
  // message is showing could not tell "the same region gained text" from "a new region, rendered
  // only because the list is non-empty now, replaced one that was never there" — and that second
  // shape is exactly what a region rendered only while `dependencies` is non-empty produces. If the
  // region cannot be parked here (`regionFound` was already false above), `parkedBeforeShow` carries
  // that failure into the check below rather than silently skipping it.
  const parkedBeforeShow = initial.regionFound && await parkDeletionRegion(devtools)

  const clickedRestore = await clickButtonByText(
    devtools,
    DELETION_CARD,
    "Restore the dependency list",
  )
  const settledOnShow = await settledScroll(devtools, { timeoutMs: 5_000 })
  const shown = await readDeletionState(devtools)
  const identity = await readDeletionRegionIdentity(devtools)
  check(
    "a new non-empty list brings the block into view, and the message arrives as a change to it",
    clickedRestore && settledOnShow && shown.inViewport && parkedBeforeShow &&
      identity.found && identity.same && identity.connected &&
      identity.text.startsWith("To archive this Team") && identity.mutations >= 1,
    !parkedBeforeShow
      ? "there was no region to park before the list went from empty to non-empty"
      : `clicked=${clickedRestore} settled=${settledOnShow} inViewport=${shown.inViewport} ` +
        `same=${identity.same} connected=${identity.connected} mutations=${identity.mutations} ` +
        `text="${identity.text}" — a region rendered only while the list is non-empty would ` +
        `replace rather than mutate the parked element, and inViewport would stay false if the ` +
        `block never scrolled into view`,
  )

  // Where the first attempt actually landed — read once, after it settled — is this run's own
  // target for the second attempt below, rather than a formula guessing at `scrollIntoView`'s
  // landing spot: the same content produces the same landing position, so the real first landing
  // is exactly right and needs no guessing.
  const firstLandingScrollY = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")

  // Scrolled to the top, deliberately away from the block, before the unrelated re-render: the
  // block is already in view right after the previous check, so a `scrollIntoView` this click
  // wrongly triggered would be a no-op there and this check would not catch it. Parked away from
  // the block instead, the same bug pulls the page back toward it, which this check can see.
  await devtools.evaluate(`globalThis.scrollTo({ top: 0, behavior: "instant" })`)
  await settledScroll(devtools, { timeoutMs: 2_000 })
  const clickedRerender = await clickButtonByText(
    devtools,
    DELETION_CARD,
    "Re-render for an unrelated reason",
  )
  // No scroll is expected here, so the plain settle — neither `target` nor `from` — answers only
  // whether anything is moving, and it should already be still.
  await settledScroll(devtools, { timeoutMs: 2_000 })
  const scrollAfterRerender = await devtools.evaluate<number>(
    "Math.round(globalThis.scrollY)",
  )
  check(
    "a re-render for a reason unrelated to the dependency list does not move the page",
    clickedRerender && scrollAfterRerender === 0,
    `clicked=${clickedRerender} scrollY after=${scrollAfterRerender} (parked at 0 before the click)`,
  )

  const clickedEmpty = await clickButtonByText(devtools, DELETION_CARD, "Empty the dependency list")
  const emptied = await waitForDeletionState(devtools, (reading) => reading.regionText === "")
  check(
    "emptying the list clears its content but keeps the alert region on the page",
    clickedEmpty && emptied.ok && emptied.regionFound && emptied.hasAlertRole &&
      emptied.regionText === "" && emptied.regionClass === "",
    `clicked=${clickedEmpty} found=${emptied.regionFound} role has "alert"=${emptied.hasAlertRole} ` +
      `class="${emptied.regionClass}" text="${emptied.regionText}"`,
  )

  // A second blocked archive attempt: `DeletionValidation` resets the signature it last scrolled
  // for whenever the list goes empty (`crud/deletion-validation.tsx`'s effect), which is what makes
  // it scroll again here even though the content restored is identical to the first attempt's. This
  // is the behaviour the old, dependency-free effect existed for — a comment there still says so —
  // and nothing in this file proved it kept working once the effect gained a signature check.
  //
  // Parked away from the block first, same reasoning as the unrelated-re-render check above: it is
  // still in view from the first attempt, so a scroll that silently did nothing here would look the
  // same as one that correctly did nothing. The wait for the second attempt targets
  // `firstLandingScrollY`, the position this run's own first attempt actually landed at — a plain
  // settle would pass on a read taken before the scroll's first frame runs, which is exactly the
  // blind spot the hydration check above had to be fixed for; a `target` wait only settles on a read
  // that has arrived there, so a scroll that has not started yet cannot pass for "done".
  await devtools.evaluate(`globalThis.scrollTo({ top: 0, behavior: "instant" })`)
  await settledScroll(devtools, { timeoutMs: 2_000 })
  const clickedRestoreAgain = await clickButtonByText(
    devtools,
    DELETION_CARD,
    "Restore the dependency list",
  )
  const settledOnSecondShow = await settledScroll(devtools, {
    target: firstLandingScrollY,
    timeoutMs: 5_000,
  })
  const shownAgain = await readDeletionState(devtools)
  const scrollYOnSecondShow = await devtools.evaluate<number>("Math.round(globalThis.scrollY)")
  check(
    "a second blocked attempt, with the list restored to the same content, scrolls into view again",
    clickedRestoreAgain && settledOnSecondShow && shownAgain.inViewport,
    `clicked=${clickedRestoreAgain} settled=${settledOnSecondShow} ` +
      `inViewport=${shownAgain.inViewport} target=${firstLandingScrollY} ` +
      `scrollY=${scrollYOnSecondShow}`,
  )
}

/**
 * Poll {@link readDeletionState} until `predicate` holds, or 2s pass — whichever comes first — and
 * return the last reading either way.
 *
 * @param devtools The connected session.
 * @param predicate What the next `check` in this file needs to be true before it reads the state.
 */
async function waitForDeletionState(
  devtools: Devtools,
  predicate: (reading: DeletionValidationReading) => boolean,
): Promise<DeletionValidationReading> {
  let last = await readDeletionState(devtools)
  await poll(async () => {
    last = await readDeletionState(devtools)
    return predicate(last)
  }, 2_000)
  return last
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
 * Commit one field by its visible label, through a real click followed by a blur — what commits a
 * `TextField`: it writes on blur, not on input, so setting `.value` alone would leave the model
 * untouched. The real click is `#273`'s fix: see below for what a bare `.focus()`/`.blur()` pair
 * missed and why a full run never showed it.
 *
 * The click is a genuine `Input.dispatchMouseEvent` press-and-release at the input's own
 * coordinates, not `.focus()` — `#273` traced `verify --only=crud` failing four checks, every time,
 * to exactly this: a page that has never received one real click or key press through the DevTools
 * protocol answers `document.hasFocus() === false`, and on such a page `.focus()` updates
 * `document.activeElement` without Chromium ever dispatching the `focus`/`blur` events `TextField`'s
 * commit handler listens for. A full run never showed it because some earlier block — `system`'s
 * `AuthForm` checks send real key presses — had already given the document real focus by the time
 * `crud` ran, which is what let this block depend on state a run confined to `--only=crud` never
 * builds. This function no longer borrows that; it gives the document real focus itself, on its
 * first call, the same way a person's first click into the form would, and every commit after it
 * benefits from the same focus, in either kind of run.
 *
 * The element is centred in the viewport first (`centreInView`) so its coordinates are the ones the
 * click is sent to are real, on-screen ones — the field may sit anywhere on the page by the time this
 * runs, including outside the current viewport.
 *
 * @param devtools The connected session.
 * @param label The field's visible label text, exactly as the card renders it.
 * @param value The value to commit.
 * @returns Whether a field with that label was found, centred and clicked.
 */
async function commitField(devtools: Devtools, label: string, value: string): Promise<boolean> {
  const inputExpr = `(() => {
    const card = document.querySelector('${CARD}')
    const target = card && [...card.querySelectorAll("label")]
      .find((element) => element.textContent.trim() === ${JSON.stringify(label)})
    const id = target ? target.getAttribute("for") : null
    return id ? document.getElementById(id) : null
  })()`

  const centred = await centreInView(devtools, inputExpr)
  if (!centred) return false

  const point = await devtools.evaluate<{ x: number; y: number } | null>(`(() => {
    const input = ${inputExpr}
    if (!input) return null
    const box = input.getBoundingClientRect()
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
  })()`)
  if (!point) return false

  for (const type of ["mousePressed", "mouseReleased"] as const) {
    await devtools.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    })
  }

  return await devtools.evaluate<boolean>(`(() => {
    const input = ${inputExpr}
    if (!input || document.activeElement !== input) return false
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
