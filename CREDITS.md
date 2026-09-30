# Credits

The design system in this repository, the component styling, and the original HTML, CSS and Tailwind
behind the UI-guide pages are Eirene's work. She did the design, wrote the original markup and
stylesheets, and built the UI-guide pages the components were first extracted from. If something here
looks considered, it started with her.

- Eirene — https://github.com/Eirene
- https://isorokina.com/

What this repository added is the JavaScript: extracting that markup into a reusable package, the
Preact and signals implementation, the interactivity, server rendering, tests, packaging and
documentation. Anton Shubin (`spy4x`) wrote that part. The design and the styling are Eirene's; the
extraction and the code around them are his.

Thank you, Eirene. The library is a thin wrapper around work you had already done well.

## Preferred form of credit

The wording above was written without asking you first, which is not ideal. If you would prefer a
different name, handle, link or sentence, say so and it will be used verbatim — here, in the README,
and in the demo footer.

## Icons

Every glyph in `@spy4x/preact-icons` is a drawing copied from one of four open-source icon packs:
Heroicons (v1 and v2), Feather, Lucide and Simple Icons. Heroicons and Feather are MIT-licensed and
Lucide is ISC-licensed; all three require their notice to travel with copies of their work. Simple
Icons is CC0 and does not, but its licence is quoted as well. Those notices, with the exact licence
text of each pack, are in [`icons/THIRD_PARTY_NOTICES.md`](./icons/THIRD_PARTY_NOTICES.md), not
here: that file ships inside the published `@spy4x/preact-icons` package, and this one does not. See
[`icons/README.md`](./icons/README.md) → "Provenance" for how each glyph's source is checked.

## What this file is not

This is attribution, not a licence statement. It grants and transfers no rights, and says nothing
about what rights anyone holds. The MIT licence in [`LICENSE`](./LICENSE) covers the code in this
repository.
