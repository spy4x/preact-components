/**
 * Two small pages outside the catalogue that show the Arabic type rule (#876): `type-demo/` in
 * Arabic, right to left, and `type-demo/latin.html`, the same page in English with no Arabic letter.
 * Both load the catalogue's stylesheet, so they use the real `@font-face` of `styles.css` and the
 * real `:lang(ar)` rules of `theme/preset.css`. `e2e/theme.spec.ts` proves the Arabic page draws in
 * the Arabic face with the rule applied, and that the English page never downloads that face.
 *
 * The catalogue itself cannot prove the second half: its prerendered document holds every page at
 * once, Arabic words among them, so it downloads the face on every first load.
 */

/** Where `build.ts` writes the pages, under the artefact root. */
export const TYPE_DEMO_DIRECTORY = "type-demo"

/** The words of one page, in its language. */
interface TypePageText {
  lang: string
  dir: "ltr" | "rtl"
  title: string
  heading: string
  body: string
  emphasis: string
  slanted: string
}

const ARABIC: TypePageText = {
  lang: "ar",
  dir: "rtl",
  title: "الخط العربي",
  heading: "مرحبًا بك في التطبيق",
  body: "هذا نص تجريبي يعرض الخط العربي بارتفاع سطر أكبر قليلًا، ومن دون تباعد بين الحروف.",
  emphasis: "نص مؤكد",
  slanted: "نص بخط مائل",
}

/**
 * The same page in English. The hyphen and the en dash are on purpose: U+2010 is in the range the
 * upstream package gives its Arabic file, and the page proves it no longer downloads the face.
 */
const ENGLISH: TypePageText = {
  lang: "en",
  dir: "ltr",
  title: "Arabic type, English page",
  heading: "Welcome to the app",
  body: "A sample text with no Arabic letter in it: a hyphen‐like mark – and a dash.",
  emphasis: "Emphasised text",
  slanted: "Slanted text",
}

/**
 * Render one of the two pages.
 *
 * @param cssHref Href of the compiled stylesheet, already base-prefixed.
 * @param language `ar` for the Arabic page, `en` for the English one.
 * @returns The document.
 */
export function renderTypePage(cssHref: string, language: "ar" | "en"): string {
  const text = language === "ar" ? ARABIC : ENGLISH
  return `<!DOCTYPE html>
<html lang="${text.lang}" dir="${text.dir}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>${text.title}</title>
    <link rel="stylesheet" href="${cssHref}">
  </head>
  <body class="theme-base">
    <main class="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 class="text-4xl font-semibold tracking-tight" data-e2e="type-heading">${text.heading}</h1>
      <p class="text-base" data-e2e="type-body">${text.body}</p>
      <p class="text-sm">
        <em data-e2e="type-emphasis">${text.emphasis}</em> ·
        <span class="italic" data-e2e="type-slanted">${text.slanted}</span>
      </p>
    </main>
  </body>
</html>
`
}
