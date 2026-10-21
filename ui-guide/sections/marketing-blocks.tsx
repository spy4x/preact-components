/**
 * The cards of the blocks a public, server-rendered site is built from. None needs JavaScript;
 * `DemoVideo` uses it to play its clip in place, and without it the play link opens the clip.
 * `BrandMark`, `DemoVideo`, `FaqList`, `FeatureCard`, `ScreenTour`, `Steps` and `WindowFrame` are
 * spread into the
 * Display section. `PageHero` draws the page's `<h1>`, so its card closes the UI page's last section (see
 * {@link pageHeroDemo}).
 */

import { useSignal } from "@preact/signals"
import { IconSprout } from "@spy4x/preact-icons"
import {
  Badge,
  BrandMark,
  Button,
  Checkbox,
  DemoVideo,
  FaqList,
  FeatureCard,
  Field,
  Input,
  PageHero,
  ScreenTour,
  type ScreenTourStep,
  Steps,
  ThemePreview,
  WindowFrame,
} from "@spy4x/preact-ui"
import type { DemoFragment } from "../registry.ts"

const FAQ = [
  {
    question: "Can I export my data?",
    answer: "Yes. Every record exports to CSV from the settings page, at any time.",
    id: "faq-export",
  },
  {
    question: "Is there a free plan?",
    answer: "Yes, for one person, with every feature and no time limit.",
  },
  {
    question: "Can I host it myself?",
    answer: "Yes. The source is open and runs on any server with Docker.",
  },
]

/**
 * The `DemoVideo` card's clip: a four-second silent test pattern `pages/build.ts` copies into
 * `video-demo/`, beside its poster. Relative, as `form-demo/` is, so it resolves under the guide's
 * base path.
 */
const DEMO_CLIP = {
  poster: { src: "video-demo/poster.webp", width: 640, height: 360 },
  sources: [
    { src: "video-demo/clip.webm", type: "video/webm" },
    { src: "video-demo/clip.mp4", type: "video/mp4" },
  ],
} as const

const STEPS = [
  { title: "Sign up", text: "Create an account with your email; no card needed." },
  { title: "Import", text: "Bring your records in from a CSV file." },
  { title: "Invite", text: "Add the people you work with." },
]

/**
 * A placeholder screenshot as a data URI: a header bar, a side column and two content blocks in one
 * hue, so the tour's cards need no image asset and no network. Each screen gets its own hue, so a
 * swap is visible.
 *
 * @param hue The screen's hue, `0`-`360`.
 * @param phone Draw a tall phone screen instead of a wide browser one.
 */
function tourScreen(hue: number, phone = false): string {
  const [width, height] = phone ? [390, 844] : [1280, 800]
  const block = (x: number, y: number, w: number, h: number, light: number) =>
    `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='12' fill='hsl(${hue} 60% ${light}%)'/>`
  const body = phone
    ? block(24, 120, 342, 220, 80) + block(24, 364, 342, 120, 88) + block(24, 508, 342, 120, 88)
    : block(32, 96, 240, 672, 88) + block(304, 96, 944, 360, 80) + block(304, 488, 456, 280, 88) +
      block(792, 488, 456, 280, 88)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
    `<rect width='${width}' height='${height}' fill='hsl(${hue} 60% 96%)'/>` +
    `<rect width='${width}' height='${phone ? 96 : 64}' fill='hsl(${hue} 60% 45%)'/>${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** The browser tour: four pages of an operations app, in two groups. */
const TOUR_PAGES: ScreenTourStep[] = [
  {
    id: "guide-tour-dashboard",
    label: "Dashboard",
    group: "Monitor",
    text: "Every device on one map, with its state.",
    image: {
      src: tourScreen(220),
      alt: "The dashboard, a map of devices",
      width: 1280,
      height: 800,
    },
  },
  {
    id: "guide-tour-alerts",
    label: "Alerts",
    group: "Monitor",
    text: "Failures raise an alert by push, chat or email.",
    image: { src: tourScreen(0), alt: "The alerts list, newest first", width: 1280, height: 800 },
  },
  {
    id: "guide-tour-schedules",
    label: "Schedules",
    group: "Automate",
    text: "Time-of-day rules, sensor triggers and manual overrides.",
    image: { src: tourScreen(140), alt: "The schedules calendar", width: 1280, height: 800 },
  },
  {
    id: "guide-tour-users",
    label: "Users",
    group: "Access",
    image: { src: tourScreen(280), alt: "The users table with roles", width: 1280, height: 800 },
  },
]

/** The phone tour: three steps a person follows in order. */
const TOUR_STEPS: ScreenTourStep[] = [
  {
    id: "guide-tour-pick",
    label: "Pick a template",
    image: { src: tourScreen(30, true), alt: "A list of templates", width: 390, height: 844 },
  },
  {
    id: "guide-tour-record",
    label: "Record",
    text: "One scene at a time, with the script on screen.",
    image: { src: tourScreen(190, true), alt: "The camera with a script", width: 390, height: 844 },
  },
  {
    id: "guide-tour-watch",
    label: "Watch",
    image: {
      src: tourScreen(320, true),
      alt: "The finished clip playing",
      width: 390,
      height: 844,
    },
  },
]

/** Both tours, with the last step `onSelect` reported, as a page's analytics would see it. */
function ScreenTourDemo() {
  const picked = useSignal<{ id: string; calls: number } | null>(null)
  return (
    <div class="flex flex-col gap-12">
      <ScreenTour
        steps={TOUR_PAGES}
        frame="browser"
        browserUrl="app.example.com"
        label="Pages of the app"
        onSelect={(id) => {
          picked.value = { id, calls: (picked.value?.calls ?? 0) + 1 }
        }}
      />
      <ScreenTour steps={TOUR_STEPS} frame="phone" numbered label="Steps to a clip" />
      <p class="text-sm text-muted" data-e2e="screen-tour-picked">
        {picked.value === null
          ? "onSelect: not called yet"
          : `onSelect: ${picked.value.id}, ${picked.value.calls} ${
            picked.value.calls === 1 ? "call" : "calls"
          }`}
      </p>
    </div>
  )
}

export const marketingBlockDemos: DemoFragment = {
  BrandMark: {
    summary:
      "A product's mark: one glyph in a tile at the card radius, filled with the brand hue, then the product's name.",
    wide: false,
    props: [
      {
        name: "Icon",
        type: "ComponentType<IconProps>",
        description: "The glyph in the tile, any icon of `@spy4x/preact-icons`.",
      },
      { name: "name", type: "string", description: "The product's name, printed after the tile." },
    ],
    snippet: `<a href="/" class="rounded-md">
  <BrandMark Icon={IconSprout} name="Acme" />
</a>`,
    render: () => (
      <a href="#demo-BrandMark" class="inline-flex rounded-md">
        <BrandMark Icon={IconSprout} name="Acme" />
      </a>
    ),
  },
  DemoVideo: {
    summary:
      "A demo clip that costs nothing until it is pressed: a poster with a play button, swapped for an inline video with sound and controls, one clip at a time.",
    wide: false,
    props: [
      {
        name: "poster",
        type: "{ src, srcset?, sizes?, width, height }",
        description: "The still frame shown before the press; its size keeps the box still.",
      },
      {
        name: "sources",
        type: "{ src, type }[]",
        description:
          "The clip's files, WebM before MP4. The first is where the link goes without JavaScript.",
      },
      {
        name: "title",
        type: "string",
        description: "What the clip shows; the link is named `Play video: {title}`.",
      },
      {
        name: "eager",
        type: "boolean",
        default: "false",
        description: "Load the poster at once, at high priority, for a clip on the first screen.",
      },
      {
        name: "loop",
        type: "boolean",
        default: "false",
        description: "Play in a loop, except when the reader asks for reduced motion.",
      },
      {
        name: "errorLabel",
        type: "string",
        default: `"The video didn't load."`,
        description: "Shown in the clip's box, with a link to the file, when no source can play.",
      },
      {
        name: "...rest",
        type: "anchor attributes",
        description:
          "Any other attribute, such as `id` or `data-*` for analytics, on the play link.",
      },
    ],
    snippet: `<WindowFrame variant="plain">
  <DemoVideo
    title="Creating an invoice"
    poster={{ src: "/demo.webp", width: 1280, height: 720 }}
    sources={[
      { src: "/demo.webm", type: "video/webm" },
      { src: "/demo.mp4", type: "video/mp4" },
    ]}
    data-umami-event="play-demo"
  />
</WindowFrame>`,
    render: () => (
      <div class="grid gap-6">
        <WindowFrame variant="browser" title="app.example.com" caption="A four-second test clip">
          <DemoVideo
            title="A test pattern"
            poster={DEMO_CLIP.poster}
            sources={DEMO_CLIP.sources}
            loop
          />
        </WindowFrame>
        <WindowFrame
          variant="plain"
          caption="A second clip, in the plain frame: starting one pauses the other"
        >
          <DemoVideo
            title="A second test pattern"
            poster={DEMO_CLIP.poster}
            sources={DEMO_CLIP.sources}
          />
        </WindowFrame>
        <WindowFrame
          variant="plain"
          caption="A clip whose file is missing: press it to see the error state"
        >
          <DemoVideo
            title="A missing clip"
            poster={DEMO_CLIP.poster}
            sources={[{ src: "video-demo/missing.webm", type: "video/webm" }]}
          />
        </WindowFrame>
      </div>
    ),
  },
  FaqList: {
    summary: "Questions and answers as native disclosures that open with no JavaScript.",
    wide: true,
    props: [
      {
        name: "items",
        type: "{ question, answer, id? }[]",
        description: "The questions; an `id` lets a link open the page at that question.",
      },
      {
        name: "headingLevel",
        type: "2 | 3 | 4",
        default: "3",
        description: "The level of each question's heading.",
      },
      {
        name: "name",
        type: "string",
        description: "Groups the questions so opening one closes the others, where supported.",
      },
    ],
    snippet: `<FaqList
  name="faq"
  items={[
    { question: "Can I export my data?", answer: "Yes, as CSV.", id: "faq-export" },
    { question: "Is there a free plan?", answer: "Yes, for one person." },
  ]}
/>`,
    render: () => <FaqList items={FAQ} name="guide-faq" />,
  },
  FeatureCard: {
    summary:
      "One feature of a product on its public site: an icon, a heading, a line of text, a link the heading describes and an optional picture to the card's edges.",
    wide: true,
    props: [
      { name: "id", type: "string", description: "The heading's id; it labels the card." },
      { name: "title", type: "string", description: "The feature's name, the card's heading." },
      { name: "children", type: "ComponentChildren", description: "A line or two on the feature." },
      { name: "Icon", type: "ComponentType<IconProps>", description: "A glyph in an accent tile." },
      { name: "href", type: "string", description: "Where the link goes; left out, no link." },
      {
        name: "linkLabel",
        type: "string",
        default: `"Learn more"`,
        description: "The link's text; the heading describes it.",
      },
      { name: "media", type: "ComponentChildren", description: "A picture under the text." },
      {
        name: "wide",
        type: "boolean",
        default: "false",
        description: "Spans two columns of the grid from `lg`.",
      },
      {
        name: "headingLevel",
        type: "2 | 3",
        default: "3",
        description: "The level of the heading.",
      },
    ],
    snippet: `<div class="grid gap-6 lg:grid-cols-3">
  <FeatureCard id="feature-sync" title="Works offline" Icon={IconSprout} href="/features#sync">
    Every record is on your device and syncs when you are back online.
  </FeatureCard>
  <FeatureCard
    id="feature-admin"
    title="An admin panel"
    href="/features#admin"
    wide
    media={<img src="/admin.png" alt="The admin panel's list of users" />}
  >
    Every feature has its operator view on a host of its own.
  </FeatureCard>
</div>`,
    render: () => (
      <div class="grid gap-6 lg:grid-cols-3">
        <FeatureCard
          id="guide-feature-sync"
          title="Works offline"
          Icon={IconSprout}
          href="#demo-FeatureCard"
        >
          Every record is on your device and syncs when you are back online.
        </FeatureCard>
        <FeatureCard
          id="guide-feature-admin"
          title="An admin panel"
          href="#demo-FeatureCard"
          wide
          media={
            <div class="flex h-32 items-center justify-center text-sm text-muted">
              Your screenshot
            </div>
          }
        >
          Every feature has its operator view on a host of its own.
        </FeatureCard>
      </div>
    ),
  },
  Steps: {
    summary:
      "A numbered how-it-works list, each number drawn by CSS in an accent circle and the steps joined by a thin line.",
    wide: true,
    props: [
      { name: "items", type: "{ title, text? }[]", description: "The steps, in order." },
      {
        name: "headingLevel",
        type: "3 | 4",
        default: "3",
        description: "The level of each step's heading.",
      },
      {
        name: "orientation",
        type: `"vertical" | "horizontal"`,
        default: `"vertical"`,
        description: "`horizontal` puts the steps in a row from `lg` up; they stack below it.",
      },
    ],
    snippet: `<Steps
  orientation="horizontal"
  items={[
    { title: "Sign up", text: "Create an account with your email." },
    { title: "Import", text: "Bring your records in from a CSV file." },
    { title: "Invite", text: "Add the people you work with." },
  ]}
/>`,
    render: () => <Steps items={STEPS} orientation="horizontal" />,
  },
  ThemePreview: {
    summary:
      "A frame that shows real components in the library's dark or light palette, switched by a Dark / Light pair that works without JavaScript.",
    wide: true,
    props: [
      {
        name: "children",
        type: "ComponentChildren",
        description: "What the frame shows, drawn in the checked palette.",
      },
      {
        name: "defaultTheme",
        type: `"dark" | "light"`,
        default: `"dark"`,
        description: "The palette checked in the server markup.",
      },
      {
        name: "labels",
        type: "{ legend?, dark?, light? }",
        default: `"Theme", "Dark", "Light"`,
        description: "The switch's words.",
      },
      {
        name: "name / hideLegend / class / frameClass",
        type: "string / boolean / string / string",
        description:
          "The radios' name (generated by default), a screen-reader-only legend, and utilities.",
      },
    ],
    snippet: `// The app's stylesheet imports the palettes after tokens.css:
// @import "@spy4x/preact-theme/theme-preview.css";
<ThemePreview>
  <Button variant="primary">Save</Button>
  <Badge text="Live" color="green" />
</ThemePreview>`,
    render: () => (
      <ThemePreview name="ui-guide-theme-preview">
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <Button variant="primary">Save</Button>
            <Button variant="secondary">Cancel</Button>
            <Badge text="Live" color="green" />
          </div>
          <Field id="theme-preview-email" label="Email">
            <Input type="email" placeholder="you@example.com" />
          </Field>
          <Checkbox>Send me the changelog</Checkbox>
        </div>
      </ThemePreview>
    ),
  },
  ScreenTour: {
    summary:
      "A product walkthrough: named steps as tabs beside one browser or phone frame whose screenshot swaps, with a caption, a line of text and View full size.",
    wide: true,
    props: [
      {
        name: "steps",
        type: "{ id, label, text?, group?, image: { src, alt, width, height, srcset?, sizes? } }[]",
        description:
          "The steps in order. `alt` is also the caption; `group` labels a run of steps in the column.",
      },
      {
        name: "frame",
        type: `"plain" | "browser" | "phone"`,
        description:
          "The frame drawn around the screenshot: `plain` for product screens, `browser` when the address matters.",
      },
      { name: "browserUrl", type: "string", description: "The address in the browser's bar." },
      {
        name: "numbered",
        type: "boolean",
        default: "false",
        description: "Number the tabs, for steps a person follows in order.",
      },
      {
        name: "fetchPriority",
        type: `"high" | "low" | "auto"`,
        description: "Set on the first screenshot, when the tour is the page's main image.",
      },
      {
        name: "onSelect",
        type: "(id: string) => void",
        description: "Called with the step a person picks, never on the first render.",
      },
      {
        name: "label",
        type: "string",
        default: `"Screens"`,
        description: "The tab list's accessible name.",
      },
      {
        name: "viewFullSizeLabel",
        type: "string",
        default: `"View full size"`,
        description: "The words of the link that opens the screenshot in the lightbox.",
      },
      {
        name: "closeLabel",
        type: "string",
        default: `"Close"`,
        description:
          "The lightbox's close control; `previousLabel`, `nextLabel` and `counterLabel` too.",
      },
    ],
    snippet: `<ScreenTour
  frame="browser"
  browserUrl="app.example.com"
  onSelect={(id) => track("tour", { step: id })}
  steps={[
    {
      id: "tour-dashboard",
      label: "Dashboard",
      group: "Monitor",
      text: "Every device on one map, with its state.",
      image: { src: "/dashboard.webp", alt: "The dashboard, a map of devices", width: 1280, height: 800 },
    },
    {
      id: "tour-alerts",
      label: "Alerts",
      group: "Monitor",
      image: { src: "/alerts.webp", alt: "The alerts list, newest first", width: 1280, height: 800 },
    },
  ]}
/>
<ScreenTour frame="phone" numbered steps={steps} />`,
    render: () => <ScreenTourDemo />,
  },
  WindowFrame: {
    summary:
      "A plain frame, a browser window, a terminal or a phone drawn around a screenshot or a snippet, with an optional caption.",
    wide: true,
    props: [
      {
        name: "variant",
        type: `"plain" | "browser" | "terminal" | "phone"`,
        description:
          "The frame drawn around the content: `plain` for product media, `browser` when the address matters; the terminal is dark in both themes.",
      },
      {
        name: "title",
        type: "string",
        description:
          "The browser's address or the terminal's title; it also names the terminal's output.",
      },
      { name: "caption", type: "ComponentChildren", description: "The figure's caption." },
    ],
    snippet: `<WindowFrame variant="plain" caption="The dashboard">
  <img src="/dashboard.png" alt="The dashboard with this month's totals" />
</WindowFrame>
<WindowFrame variant="browser" title="app.example.com/pricing">
  <img src="/pricing.png" alt="The pricing page" />
</WindowFrame>
<WindowFrame variant="terminal" title="Install">
  {"$ docker compose up -d"}
</WindowFrame>
<WindowFrame variant="phone">
  <img src="/phone.png" alt="The app on a phone" />
</WindowFrame>`,
    render: () => (
      <div class="grid gap-6 lg:grid-cols-2">
        <WindowFrame variant="plain" caption="A plain frame, for product media">
          <div class="flex h-32 items-center justify-center text-sm text-muted">
            Your screenshot
          </div>
        </WindowFrame>
        <WindowFrame variant="browser" title="app.example.com" caption="A browser window">
          <div class="flex h-32 items-center justify-center text-sm text-muted">
            Your screenshot
          </div>
        </WindowFrame>
        <WindowFrame variant="terminal" title="Install" caption="A terminal, dark in both themes">
          {"$ curl -fsSL https://example.com/install.sh | sh -s -- --version 1.0.0\nInstalled in /usr/local/bin"}
        </WindowFrame>
        <WindowFrame variant="phone" caption="A phone" class="max-w-48">
          <div class="flex h-full items-center justify-center text-sm text-muted">
            Your screenshot
          </div>
        </WindowFrame>
      </div>
    ),
  },
}

/**
 * The `PageHero` card, kept apart from {@link marketingBlockDemos} because of where it must sit.
 *
 * The hero's title is the page's `<h1>`, as on a site's own page. Every card title is an `<h3>`, so
 * a card after this one would follow an `<h1>` with an `<h3>`, and axe's `heading-order` rule fails
 * on that skipped level. The registry puts this card last on the UI page, where the next heading is
 * the page's own `<h2>`.
 */
export const pageHeroDemo: DemoFragment = {
  PageHero: {
    summary:
      "The top band of a public site's inner page: an eyebrow, the page's heading, a lead, its buttons and a quiet byline with the updated day, in the marketing column.",
    wide: true,
    props: [
      { name: "title", type: "ComponentChildren", description: "The page's `<h1>`." },
      { name: "eyebrow", type: "ComponentChildren", description: "A short line above the title." },
      { name: "lead", type: "ComponentChildren", description: "One or two sentences under it." },
      { name: "children", type: "ComponentChildren", description: "The page's buttons." },
      {
        name: "author",
        type: "{ name: string; href?: string }",
        description: "Who wrote the page, linked when `href` is given, in the meta line.",
      },
      {
        name: "updated",
        type: "string",
        description:
          "The day the page last changed, `YYYY-MM-DD`, as a `<time datetime>` in the meta line.",
      },
      {
        name: "note",
        type: "ComponentChildren",
        description: "A short caveat right under the meta line, in the same quiet text.",
      },
      {
        name: "labels",
        type: "Partial<PageHeroLabels>",
        description: "The meta line's words: `by` (`By`) and `updated` (`Updated`).",
      },
      { name: "class", type: "string", description: "The band's background, such as a glow." },
    ],
    snippet: `<PageHero
  eyebrow="Pricing"
  title="One price per seat"
  lead="Every feature on every plan. Pay monthly, cancel any time."
  author={{ name: "Anton Shubin", href: "/about" }}
  updated="2026-10-19"
  note="Prices in euros, before VAT."
>
  <Button href="/sign-up">Start free</Button>
</PageHero>`,
    render: () => (
      <PageHero
        eyebrow="Pricing"
        title="One price per seat"
        lead="Every feature on every plan. Pay monthly, cancel any time."
        author={{ name: "Anton Shubin", href: "#demo-PageHero" }}
        updated="2026-10-19"
        note="Prices in euros, before VAT."
      >
        <div>
          <Button href="#demo-PageHero">Start free</Button>
        </div>
      </PageHero>
    ),
  },
}
