/**
 * The cards of the blocks a public, server-rendered site is built from. None needs JavaScript.
 * `BrandMark`, `FaqList`, `FeatureCard`, `Steps` and `WindowFrame` are spread into the Display section.
 * `PageHero` draws the page's `<h1>`, so its card closes the UI page's last section (see
 * {@link pageHeroDemo}).
 */

import { IconSprout } from "@spy4x/preact-icons"
import {
  BrandMark,
  Button,
  FaqList,
  FeatureCard,
  PageHero,
  Steps,
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

const STEPS = [
  { title: "Sign up", text: "Create an account with your email; no card needed." },
  { title: "Import", text: "Bring your records in from a CSV file." },
  { title: "Invite", text: "Add the people you work with." },
]

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
  WindowFrame: {
    summary:
      "A browser window, a terminal or a phone drawn around a screenshot or a snippet, with an optional caption.",
    wide: true,
    props: [
      {
        name: "variant",
        type: `"browser" | "terminal" | "phone"`,
        description: "The device drawn around the content; the terminal is dark in both themes.",
      },
      {
        name: "title",
        type: "string",
        description:
          "The browser's address or the terminal's title; it also names the terminal's output.",
      },
      { name: "caption", type: "ComponentChildren", description: "The figure's caption." },
    ],
    snippet: `<WindowFrame variant="browser" title="app.example.com" caption="The dashboard">
  <img src="/dashboard.png" alt="The dashboard with this month's totals" />
</WindowFrame>
<WindowFrame variant="terminal" title="Install">
  {"$ docker compose up -d"}
</WindowFrame>
<WindowFrame variant="phone">
  <img src="/phone.png" alt="The app on a phone" />
</WindowFrame>`,
    render: () => (
      <div class="grid gap-6 lg:grid-cols-3">
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
      "The top band of a public site's inner page: an eyebrow, the page's heading, a lead and its buttons, in the marketing column.",
    wide: true,
    props: [
      { name: "title", type: "ComponentChildren", description: "The page's `<h1>`." },
      { name: "eyebrow", type: "ComponentChildren", description: "A short line above the title." },
      { name: "lead", type: "ComponentChildren", description: "One or two sentences under it." },
      { name: "children", type: "ComponentChildren", description: "The page's buttons." },
      { name: "class", type: "string", description: "The band's background, such as a glow." },
    ],
    snippet: `<PageHero
  eyebrow="Pricing"
  title="One price per seat"
  lead="Every feature on every plan. Pay monthly, cancel any time."
>
  <Button href="/sign-up">Start free</Button>
</PageHero>`,
    render: () => (
      <PageHero
        eyebrow="Pricing"
        title="One price per seat"
        lead="Every feature on every plan. Pay monthly, cancel any time."
      >
        <div>
          <Button href="#demo-PageHero">Start free</Button>
        </div>
      </PageHero>
    ),
  },
}
