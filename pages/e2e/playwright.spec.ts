/**
 * Playwright specs for the layout checks of `@spy4x/preact-playwright`. Every fixture is drawn into
 * the page with `setContent`, so the guide page a spec starts on plays no part in it.
 */
import { expectFitsInLanguages, expectNotCovered } from "@spy4x/preact-playwright"
import type { Locator, Page } from "playwright-core"
import type { Spec } from "./runner.ts"

const PREFIX = "preact-playwright:"

/** Reset every browser default that would shift a fixture by a few pixels. */
const RESET =
  `<!doctype html><style>*{box-sizing:border-box}body{margin:0;font:16px sans-serif}</style>`

/**
 * Run a check that must fail, and return its message.
 *
 * @throws When the check passes, or when its message lacks a text the spec expects.
 */
async function failureOf(check: () => Promise<void>, ...expected: string[]): Promise<string> {
  let message: string | undefined
  try {
    await check()
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  if (message === undefined) throw new Error("the check passed, and it had to fail")
  for (const text of expected) {
    if (!message.includes(text)) throw new Error(`"${text}" is missing from: ${message}`)
  }
  return message
}

/** Fail when a text that must stay out of a failure message is in it. */
function assertAbsent(message: string, ...absent: string[]): void {
  for (const text of absent) {
    if (message.includes(text)) throw new Error(`"${text}" must not be in: ${message}`)
  }
}

/** A spec on a fixture of its own; the theme page is only where the runner starts it. */
function spec(name: string, html: string, run: (page: Page) => Promise<void>): Spec {
  return {
    name: `${PREFIX} ${name}`,
    pageId: "theme",
    run: async (page) => {
      await page.setViewportSize({ width: 800, height: 600 })
      await page.setContent(RESET + html)
      await run(page)
    },
  }
}

/** A row 200 px wide holding a label that is as long as the language asks for. */
const LABEL_ROW =
  `<div id="row" style="width:200px"><span id="label" style="display:block;height:20px"></span></div>
<script>
  globalThis.show = (width) => { document.getElementById("label").style.width = width + "px" }
</script>`

/** The options for {@link LABEL_ROW}: each language gives the label one width. */
function labelOptions(page: Page, widths: Record<string, number>) {
  return {
    languages: Object.keys(widths),
    open: (language: string) =>
      page.evaluate(
        (width) => (globalThis as unknown as { show: (width: number) => void }).show(width),
        widths[language],
      ),
    target: (page: Page) => page.locator("#label"),
  }
}

/** The options for a screen that is already drawn, in one language. */
function one(target: (page: Page) => Locator) {
  return { languages: ["en"], open: () => {}, target }
}

const notCoveredSpecs: Spec[] = [
  spec(
    "expectNotCovered fails on a hidden element instead of passing it",
    `<button id="save" style="display:none">Save</button>`,
    async (page) => {
      page.setDefaultTimeout(300)
      await failureOf(() => expectNotCovered(page.locator("#save")), "Timeout 300ms")
    },
  ),
  spec(
    "expectNotCovered passes on a button nothing covers",
    `<button id="save" style="width:120px;height:40px">Save</button>`,
    (page) => expectNotCovered(page.locator("#save")),
  ),
  spec(
    "expectNotCovered fails on a button under a fixed bar that is still in the viewport",
    `<button id="save" style="position:fixed;bottom:0;left:0;width:120px;height:40px">Save</button>
     <div id="bar" style="position:fixed;bottom:0;left:0;right:0;height:60px;background:#222"></div>`,
    async (page) => {
      const inViewport = await page.locator("#save").evaluate((element) => {
        const box = element.getBoundingClientRect()
        return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth
      })
      if (!inViewport) throw new Error("the fixture's button must be in the viewport")
      await failureOf(
        () => expectNotCovered(page.locator("#save")),
        "button#save cannot be reached at 5 of 5 points",
        "centre (60, 580): covered by div#bar",
        "bottom right",
      )
    },
  ),
  spec(
    "expectNotCovered names only the one corner another element covers",
    `<button id="save" style="position:absolute;top:100px;left:100px;width:120px;height:40px">Save</button>
     <div class="corner-badge" style="position:absolute;top:90px;left:210px;width:20px;height:20px"></div>`,
    async (page) => {
      const message = await failureOf(
        () => expectNotCovered(page.locator("#save")),
        "at 1 of 5 points",
        "top right",
        "covered by div.corner-badge",
      )
      assertAbsent(message, "centre", "top left", "bottom left", "bottom right")
    },
  ),
  spec(
    "expectNotCovered describes a cover by its data-e2e first",
    `<button id="save" style="position:fixed;top:0;left:0;width:120px;height:40px">Save</button>
     <div id="bar" class="bar" data-e2e="cookie-bar"
       style="position:fixed;top:0;left:0;width:200px;height:60px"></div>`,
    (page) =>
      failureOf(
        () => expectNotCovered(page.locator("#save")),
        `covered by div[data-e2e="cookie-bar"]`,
      ).then(() => undefined),
  ),
  spec(
    "expectNotCovered fails on an element that scrolling cannot bring into the viewport",
    `<button id="save" style="position:fixed;top:100px;left:-300px;width:120px;height:40px">Save</button>`,
    async (page) => {
      await failureOf(
        () => expectNotCovered(page.locator("#save")),
        "at 5 of 5 points",
        "outside the viewport",
      )
    },
  ),
  spec(
    "expectNotCovered scrolls a far-away element into view and passes",
    `<div style="height:3000px"></div>
     <button id="save" style="width:120px;height:40px">Save</button>
     <div style="height:3000px"></div>`,
    (page) => expectNotCovered(page.locator("#save")),
  ),
  spec(
    "expectNotCovered passes when scrolling moves the element out from under a fixed bar",
    `<div id="bar" style="position:fixed;top:0;left:0;right:0;height:80px;background:#222"></div>
     <div style="height:1000px"></div>
     <button id="save" style="display:block;width:120px;height:40px">Save</button>
     <div style="height:3000px"></div>`,
    async (page) => {
      await page.evaluate(() => scrollTo(0, 980))
      const before = await page.evaluate(() => document.elementFromPoint(60, 40)?.id)
      if (before !== "bar") throw new Error(`the fixture must start covered, and hit "${before}"`)
      await expectNotCovered(page.locator("#save"))
    },
  ),
  spec(
    "expectNotCovered passes on a fully rounded pill on a differently coloured parent",
    `<div style="padding:32px;background:#fde68a">
       <button id="pill" style="width:160px;height:40px;border:0;border-radius:9999px;background:#1d4ed8">Go</button>
       <button id="circle" style="width:48px;height:48px;border:0;border-radius:50%;background:#1d4ed8">+</button>
       <button id="oval" style="width:160px;height:40px;border:0;border-radius:50%;background:#1d4ed8">Go</button>
     </div>`,
    async (page) => {
      await expectNotCovered(page.locator("#pill"))
      await expectNotCovered(page.locator("#circle"))
      await expectNotCovered(page.locator("#oval"))
    },
  ),
  spec(
    "expectNotCovered still fails on a pill whose rounded corner another element covers",
    `<button id="pill" style="position:absolute;top:100px;left:100px;width:160px;height:40px;border:0;border-radius:9999px">Go</button>
     <div id="patch" style="position:absolute;top:100px;left:100px;width:14px;height:14px"></div>`,
    async (page) => {
      const message = await failureOf(
        () => expectNotCovered(page.locator("#pill")),
        "top left",
        "covered by div#patch",
      )
      assertAbsent(message, "centre", "bottom right")
    },
  ),
  spec(
    "expectNotCovered passes when the hit lands on a child of the element",
    `<button id="save" style="display:block;width:120px;height:40px;padding:0;border:0">
       <span style="display:block;width:100%;height:100%">Save</span>
     </button>`,
    (page) => expectNotCovered(page.locator("#save")),
  ),
  spec(
    "expectNotCovered works inside a shadow root, on a slotted child and under a cover",
    `<div id="host"><span slot="label" style="display:block;width:100%;height:100%">Save</span></div>
     <div id="covered-host"></div>
     <button id="outer" style="position:absolute;top:200px;left:0;width:120px;height:40px;padding:0;border:0">
       <div id="wrap" style="height:100%"><span style="display:block;height:40px">Save</span></div>
     </button>
     <script>
       document.getElementById("wrap").attachShadow({ mode: "open" }).innerHTML = '<slot></slot>'
       document.getElementById("host").attachShadow({ mode: "open" }).innerHTML =
         '<button id="inner" style="display:block;width:120px;height:40px;padding:0;border:0"><slot name="label"></slot></button>'
       document.getElementById("covered-host").attachShadow({ mode: "open" }).innerHTML =
         '<button id="under" style="display:block;width:120px;height:40px">Save</button>' +
         '<div id="shade" style="position:absolute;top:40px;left:0;width:200px;height:60px"></div>'
     </script>`,
    async (page) => {
      await expectNotCovered(page.locator("#inner"))
      await expectNotCovered(page.locator("#outer"))
      await failureOf(() => expectNotCovered(page.locator("#under")), "covered by div#shade")
    },
  ),
]

const fitsSpecs: Spec[] = [
  spec(
    "expectFitsInLanguages passes when every language fits",
    LABEL_ROW,
    (page) => expectFitsInLanguages(page, labelOptions(page, { en: 80, de: 150, fr: 200 })),
  ),
  spec(
    "expectFitsInLanguages names only the language whose label leaves its container",
    LABEL_ROW,
    async (page) => {
      const message = await failureOf(
        () => expectFitsInLanguages(page, labelOptions(page, { en: 80, de: 260.26, fr: 120 })),
        "1 of 3 languages do not fit at 390 px wide",
        "- de: passes its container by 60.3 px on the right",
      )
      assertAbsent(message, "- en", "- fr")
    },
  ),
  spec(
    "expectFitsInLanguages lists every failing language, after one that could not be opened",
    LABEL_ROW,
    async (page) => {
      const options = labelOptions(page, { en: 260, de: 80, es: 80, fr: 300 })
      await failureOf(
        () =>
          expectFitsInLanguages(page, {
            ...options,
            open: (language) => {
              if (language === "de") throw new Error("no such route")
              if (language === "es") return Promise.reject("a rejection that is no Error")
              return options.open(language)
            },
          }),
        "4 of 4 languages",
        "- en: passes its container by 60 px",
        "- de: could not be checked: no such route",
        "- es: could not be checked: a rejection that is no Error",
        "- fr: passes its container by 100 px",
      )
    },
  ),
  spec(
    "expectFitsInLanguages measures against the container it is given",
    `<div id="outer" style="width:300px"><div id="inner" style="width:100px">
       <span id="label" style="display:block;width:200px">Label</span>
     </div></div>`,
    async (page) => {
      await expectFitsInLanguages(page, {
        languages: ["en"],
        open: () => {},
        target: (page) => page.locator("#label"),
        container: (page) => page.locator("#outer"),
      })
      await failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["en"],
            open: () => {},
            target: (page) => page.locator("#label"),
          }),
        "passes its container by 100 px on the right",
      )
    },
  ),
  spec(
    "expectFitsInLanguages fails on text cut off with an ellipsis",
    `<div style="width:200px"><p id="text" style="margin:0;width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">A sentence far too long for this box</p></div>`,
    (page) =>
      failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["fr"],
            open: () => {},
            target: (page) => page.locator("#text"),
          }),
        "- fr: its text is clipped: it needs",
        "the box has 100 px",
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages fails on text a fixed height cuts off",
    `<div style="width:200px;height:200px"><p id="text" style="margin:0;width:100px;height:24px;line-height:24px;overflow:hidden">A sentence far too long for this box, so it wraps</p></div>`,
    (page) =>
      failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["fr"],
            open: () => {},
            target: (page) => page.locator("#text"),
          }),
        "px of height, the box has 24 px",
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages passes on one tight line of truncating text that fits",
    `<div style="width:200px"><p id="text" style="margin:0;width:200px;font-size:48px;line-height:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Gyp</p></div>`,
    (page) =>
      expectFitsInLanguages(page, {
        languages: ["en"],
        open: () => {},
        target: (page) => page.locator("#text"),
      }),
  ),
  spec(
    "expectFitsInLanguages passes on overflowing text its element lets a person scroll to",
    `<div style="width:200px"><p id="text" style="margin:0;width:100px;overflow-x:auto;white-space:nowrap">A sentence far too long for this box</p></div>`,
    (page) =>
      expectFitsInLanguages(page, {
        languages: ["en"],
        open: () => {},
        target: (page) => page.locator("#text"),
      }),
  ),
  spec(
    "expectFitsInLanguages fails on a clipped input placeholder and passes on a short one",
    `<div style="width:200px"><input id="field" style="width:150px;padding:0 8px;font:16px sans-serif"></div>`,
    async (page) => {
      const field = page.locator("#field")
      const options = {
        languages: ["en", "fr"],
        open: (language: string) =>
          field.evaluate((element, language) => {
            ;(element as HTMLInputElement).placeholder = language === "fr"
              ? "Saisissez votre adresse e-mail professionnelle"
              : "Your email"
          }, language),
        target: () => field,
      }
      const message = await failureOf(
        () => expectFitsInLanguages(page, options),
        `- fr: its text is clipped: "Saisissez votre adresse e-mail professionnelle" needs`,
        "the box has 130 px",
      )
      assertAbsent(message, "- en")
    },
  ),
  spec(
    "expectFitsInLanguages measures an input's typed value before its placeholder",
    `<div style="width:200px"><input id="field" placeholder="Short" style="width:150px;padding:0 8px"
       value="A typed value that is far too long for this field"></div>`,
    (page) =>
      failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["en"],
            open: () => {},
            target: (page) => page.locator("#field"),
          }),
        `"A typed value that is far too long for this field" needs`,
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages ignores the value of an input that shows no text",
    `<div style="width:200px"><input id="box" type="checkbox" value="a value far wider than a checkbox"></div>`,
    (page) =>
      expectFitsInLanguages(page, {
        languages: ["en"],
        open: () => {},
        target: (page) => page.locator("#box"),
      }),
  ),
  spec(
    "expectFitsInLanguages lets a textarea placeholder wrap, and fails when its lines run out",
    `<div style="width:200px"><textarea id="field" rows="3" style="display:block;width:180px;padding:0;border:0;font:16px/20px sans-serif;resize:none"></textarea></div>`,
    async (page) => {
      const field = page.locator("#field")
      const withPlaceholder = (placeholder: string) => ({
        languages: ["en"],
        open: () =>
          field.evaluate((element, placeholder) => {
            ;(element as HTMLTextAreaElement).placeholder = placeholder
          }, placeholder),
        target: () => field,
      })
      await expectFitsInLanguages(page, withPlaceholder("Two short lines of words that wrap here"))
      await failureOf(
        () => expectFitsInLanguages(page, withPlaceholder("Words that wrap again ".repeat(12))),
        "lines need",
        "px of height, the box has 60 px",
      )
    },
  ),
  spec(
    "expectFitsInLanguages fails on an element past the viewport's edge",
    `<div id="wide" style="width:600px"><span id="label" style="display:block;margin-left:350px;width:100px">Label</span></div>`,
    async (page) => {
      const message = await failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["en"],
            open: () => {},
            target: (page) => page.locator("#label"),
          }),
        "- en: passes the viewport by 60 px on the right",
      )
      assertAbsent(message, "its container")
    },
  ),
  spec(
    "expectFitsInLanguages checks at the width it is given",
    `<div style="width:600px"><span id="label" style="display:block;width:400px">Label</span></div>`,
    async (page) => {
      await expectFitsInLanguages(page, {
        languages: ["en"],
        open: () => {},
        target: (page) => page.locator("#label"),
        width: 500,
      })
      await failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["en"],
            open: () => {},
            target: (page) => page.locator("#label"),
            width: 320,
          }),
        "do not fit at 320 px wide",
        "passes the viewport by 80 px on the right",
      )
    },
  ),
  spec(
    "expectFitsInLanguages reports a hidden element instead of passing it",
    `<div style="width:200px"><span id="label" style="display:none">Label</span></div>`,
    async (page) => {
      page.setDefaultTimeout(300)
      const message = await failureOf(
        () =>
          expectFitsInLanguages(page, {
            languages: ["en"],
            open: () => {},
            target: (page) => page.locator("#label"),
          }),
        "- en: could not be checked:",
      )
      assertAbsent(message, "Call log")
    },
  ),
  spec(
    "expectFitsInLanguages reports a browser that gives it no canvas to measure with",
    `<div style="width:200px"><span id="label" style="display:block">Label</span></div>`,
    async (page) => {
      await page.evaluate(() => {
        HTMLCanvasElement.prototype.getContext = () => null
      })
      await failureOf(
        () => expectFitsInLanguages(page, one((page) => page.locator("#label"))),
        "the browser gave no canvas to measure text with",
      )
    },
  ),
  spec(
    "expectFitsInLanguages allows one pixel of rounding on a box and on text, and no more",
    `<div style="width:200px;height:300px">
       <span id="box-1" style="display:block;width:201px;height:20px"></span>
       <span id="box-2" style="display:block;width:202px;height:20px"></span>
       <div id="wide-1" style="width:100px;height:20px;overflow:hidden"><div style="width:101px;height:20px"></div></div>
       <div id="wide-2" style="width:100px;height:20px;overflow:hidden"><div style="width:102px;height:20px"></div></div>
       <div id="tall-1" style="width:100px;height:20px;overflow:hidden"><div style="height:21px"></div></div>
       <div id="tall-2" style="width:100px;height:20px;overflow:hidden"><div style="height:22px"></div></div>
       <input id="field" value="Measured" style="display:block;padding:0;border:0;font:16px sans-serif">
       <textarea id="area-1" style="display:block;width:190px;height:59px;padding:0;border:0;font:16px/20px sans-serif;resize:none">a
b
c</textarea>
       <textarea id="area-2" style="display:block;width:190px;height:58px;padding:0;border:0;font:16px/20px sans-serif;resize:none">a
b
c</textarea>
     </div>`,
    async (page) => {
      for (const id of ["box-1", "wide-1", "tall-1", "area-1"]) {
        await expectFitsInLanguages(page, one((page) => page.locator(`#${id}`)))
      }
      for (const id of ["box-2", "wide-2", "tall-2", "area-2"]) {
        await failureOf(
          () => expectFitsInLanguages(page, one((page) => page.locator(`#${id}`))),
          "- en:",
        )
      }
      const field = page.locator("#field")
      const textWidth = await field.evaluate((element) => {
        const context = document.createElement("canvas").getContext("2d")
        if (!context) throw new Error("the fixture needs a canvas")
        context.font = getComputedStyle(element).font
        return context.measureText("Measured").width
      })
      const setWidth = (width: number) =>
        field.evaluate((element, width) => {
          element.style.width = `${width}px`
        }, width)
      await setWidth(textWidth - 0.5)
      await expectFitsInLanguages(page, one(() => field))
      await setWidth(textWidth - 2)
      await failureOf(() => expectFitsInLanguages(page, one(() => field)), "its text is clipped")
    },
  ),
  spec(
    "expectFitsInLanguages counts text an element hides with overflow: clip",
    `<div style="width:200px"><p id="text" style="margin:0;width:100px;overflow:clip;white-space:nowrap">A sentence far too long for this box</p></div>`,
    (page) =>
      failureOf(
        () => expectFitsInLanguages(page, one((page) => page.locator("#text"))),
        "its text is clipped: it needs",
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages measures a placeholder in the font the placeholder is drawn in",
    `<style>#field::placeholder{font-size:32px}</style>
     <div style="width:200px"><input id="field" placeholder="Your email" style="width:100px;padding:0;border:0;font:12px sans-serif"></div>`,
    (page) =>
      failureOf(
        () => expectFitsInLanguages(page, one((page) => page.locator("#field"))),
        `"Your email" needs`,
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages measures a field's text with its letter spacing",
    `<div style="width:200px"><input id="field" value="Spaced out" style="width:120px;padding:0;border:0;font:12px sans-serif;letter-spacing:12px"></div>`,
    (page) =>
      failureOf(
        () => expectFitsInLanguages(page, one((page) => page.locator("#field"))),
        `"Spaced out" needs`,
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages counts a textarea's line breaks and its default line height",
    `<div style="width:200px"><textarea id="field" style="display:block;width:180px;height:50px;padding:0;border:0;font:16px sans-serif;resize:none">one
two
three
four
five</textarea></div>`,
    (page) =>
      failureOf(
        () => expectFitsInLanguages(page, one((page) => page.locator("#field"))),
        "5 lines need",
      ).then(() => undefined),
  ),
  spec(
    "expectFitsInLanguages names every side an element leaves its container and the viewport by",
    `<div id="box" style="position:absolute;top:20px;left:20px;width:100px;height:100px">
       <span id="label" style="position:absolute;top:-30px;left:-30px;width:160px;height:160px"></span>
     </div>`,
    async (page) => {
      const message = await failureOf(
        () => expectFitsInLanguages(page, one((page) => page.locator("#label"))),
        "passes its container by 30 px on the left",
        "passes its container by 30 px on the right",
        "passes its container by 30 px on the top",
        "passes its container by 30 px on the bottom",
        "passes the viewport by 10 px on the left",
      )
      assertAbsent(message, "the viewport by 10 px on the top")
    },
  ),
  spec("expectFitsInLanguages throws on an empty language list", LABEL_ROW, async (page) => {
    let opened = false
    await failureOf(
      () =>
        expectFitsInLanguages(page, {
          languages: [],
          open: () => {
            opened = true
          },
          target: (page) => page.locator("#label"),
        }),
      "`languages` is empty",
    )
    if (opened) throw new Error("an empty list must open nothing")
    if (page.viewportSize()?.width !== 800) throw new Error("an empty list must not resize")
  }),
  spec(
    "expectFitsInLanguages throws on a page without a viewport size",
    LABEL_ROW,
    async (page) => {
      await failureOf(
        () =>
          expectFitsInLanguages({
            viewportSize: () => null,
            setViewportSize: () => page.waitForTimeout(0),
          }, {
            languages: ["en"],
            open: () => {},
            target: () => page.locator("#label"),
          }),
        "no viewport size",
      )
    },
  ),
  spec("expectFitsInLanguages restores the viewport after a failure", LABEL_ROW, async (page) => {
    await page.setViewportSize({ width: 1024, height: 700 })
    const seen: (number | undefined)[] = []
    const options = labelOptions(page, { en: 260 })
    await failureOf(
      () =>
        expectFitsInLanguages(page, {
          ...options,
          open: (language) => {
            seen.push(page.viewportSize()?.width, page.viewportSize()?.height)
            return options.open(language)
          },
        }),
      "- en:",
    )
    if (seen.join() !== "390,700") throw new Error(`the check ran at ${seen.join(" by ")}`)
    const after = page.viewportSize()
    if (after?.width !== 1024 || after.height !== 700) {
      throw new Error(`the viewport stayed at ${after?.width} by ${after?.height}`)
    }
  }),
]

/** Every layout check, passing and failing. */
export const specs: Spec[] = [...notCoveredSpecs, ...fitsSpecs]
