/**
 * The guide's front page (#400): what the library is, a live app built from it, why a reader would
 * pick it, how to start, and the packages.
 *
 * It serves a developer first: the two primary actions are the install line and the repository
 * ("Star on GitHub"). Every number it prints is computed here from the registry and the icon set
 * ({@link overviewTotals}), never written by hand; `overview.test.tsx` fails on a digit in the
 * page's own words that is not one of those counts.
 */

import { cn } from "@spy4x/preact-cn"
import {
  IconArrowRight,
  IconBookOpen,
  IconCursorArrowRays,
  IconDocumentText,
  IconGlobe,
  IconPackage,
  IconServer,
  IconSparkle,
  IconStar,
} from "@spy4x/preact-icons"
import { buttonClasses } from "@spy4x/preact-ui/button"
import { CopyBlock } from "@spy4x/preact-ui/copy-block"
import { CopyButton } from "@spy4x/preact-ui/copy-button"
import { Cluster, Grid, Section, Stack } from "@spy4x/preact-ui/layout"
import type { ComponentType, JSX } from "preact"
import { DemoCard } from "./card.tsx"
import { iconNames } from "./icons.tsx"
import { CatalogInstructions } from "./instructions.tsx"
import { InlineMarkdown } from "./markdown.tsx"
import { MINI_APP_SNIPPET, MiniApp } from "./mini-app.tsx"
import {
  catalogueNames,
  catalogueSections,
  helperPackageIds,
  packagePages,
  type PartialDemoRegistry,
} from "./registry.ts"
import { pageHref } from "./routes.ts"

/** This package's own directory: the guide is published beside the packages it shows. */
export const GUIDE_PACKAGE_ID = "ui-guide"

/**
 * Every package the library publishes, in the order the guide lists them: the packages with a page,
 * then the helper packages that have none, then the guide itself. Derived from the registry, so a
 * new page or helper package is counted and linked without a second edit; `overview.test.tsx` holds
 * it to the workspace's own `deno.json` files.
 */
export const libraryPackageIds: readonly string[] = [
  ...packagePages.map((page) => page.id),
  ...helperPackageIds.filter((id) => !packagePages.some((page) => page.id === id)),
  GUIDE_PACKAGE_ID,
]

/** Where every package is published: the scope's page on JSR lists them all. */
export const JSR_SCOPE_URL = "https://jsr.io/@spy4x"

/** The counts the overview prints, all computed. */
export interface OverviewTotals {
  /** Every card the registry carries: components and class cards. */
  cards: number
  /** Component cards the registry carries. */
  components: number
  /** Glyphs the icon package exports. */
  icons: number
  /** Packages the library publishes ({@link libraryPackageIds}), this guide's included. */
  packages: number
}

/**
 * The overview's counts for a registry.
 *
 * @param registry The registry the guide renders, complete or trimmed.
 * @returns What the overview's line of totals prints.
 */
export function overviewTotals(registry: PartialDemoRegistry): OverviewTotals {
  const components = catalogueSections
    .filter((section) => section.kind === "component")
    .flatMap((section) => section.names)
    .filter((name) => name in registry).length
  return {
    cards: catalogueNames.filter((name) => name in registry).length,
    components,
    icons: iconNames.length,
    packages: libraryPackageIds.length,
  }
}

/**
 * The overview's line of totals in English. Every number in it is one of `totals`, which is what
 * `overview.test.tsx` holds it to by calling it with numbers no registry has.
 *
 * @param totals The computed counts.
 */
export function defaultStats({ components, icons, packages }: OverviewTotals): string {
  return `${components} components · ${icons} icons · ${packages} packages`
}

/**
 * A package tile's count of cards, in English.
 *
 * @param count The page's cards in the registry.
 */
export function defaultCardCount(count: number): string {
  return `${count} ${count === 1 ? "card" : "cards"}`
}

/**
 * The icons tile's count, in English.
 *
 * @param count The glyphs the icon package exports.
 */
export function defaultIconCount(count: number): string {
  return `${count} ${count === 1 ? "icon" : "icons"}`
}

/**
 * Where a package's README is read: in the repository when the host gave one, on JSR otherwise,
 * where the package's page is its README.
 *
 * @param id The package's directory.
 * @param repository The repository's URL, when the host passed one.
 */
export function readmeHref(id: string, repository: string | undefined): string {
  return repository
    ? `${repository.replace(/\/$/, "")}/blob/main/${id}/README.md`
    : `${JSR_SCOPE_URL}/preact-${id}`
}

/**
 * A file in the repository, on its default branch.
 *
 * @param repository The repository's URL.
 * @param path The file's path from the repository's root.
 */
export function repositoryFile(repository: string, path: string): string {
  return `${repository.replace(/\/$/, "")}/blob/main/${path}`
}

/** One fact of the "why" strip. */
export interface WhyFact {
  title: string
  /** One or two sentences, in inline Markdown. */
  body: string
}

/** The "why" strip's facts, in order. */
export const whyFactIds = [
  "standards",
  "server",
  "browser",
  "dependencies",
  "theming",
  "licence",
] as const

/** Identifier of one fact of the "why" strip. */
export type WhyFactId = (typeof whyFactIds)[number]

/** The strip's English facts. Plain claims the repository backs; none carries a number. */
export const DEFAULT_WHY: Record<WhyFactId, WhyFact> = {
  standards: {
    title: "Web standards first",
    body:
      "Native `<dialog>`, `<details>` and forms that post before a script has run. The browser does what it already knows how to do.",
  },
  server: {
    title: "Rendered on the server",
    body:
      "Every component renders complete HTML on the server and hydrates in the browser. This page is served that way and reads with JavaScript off.",
  },
  browser: {
    title: "Proven in a real browser",
    body:
      "Key presses, focus moves, dialogs and toasts are driven in headless Chromium on every pull request, not assumed from the markup.",
  },
  dependencies: {
    title: "No third-party component library",
    body:
      "No Radix, Headless UI or Material underneath. Every component's markup, keyboard handling and focus are written, and tested, here.",
  },
  theming: {
    title: "Themed by tokens",
    body:
      "Set `--color-primary` for light and `--color-accent` for dark, and the components' accent follows: buttons, switches, tabs, focus rings. Status colours stay fixed on purpose.",
  },
  licence: {
    title: "MIT licensed",
    body:
      "Use it in any project, commercial or not. Every package is on JSR under `@spy4x`, all at one version.",
  },
}

/** Each fact's glyph. */
const WHY_ICONS: Record<WhyFactId, ComponentType<{ class?: string }>> = {
  standards: IconGlobe,
  server: IconServer,
  browser: IconCursorArrowRays,
  dependencies: IconPackage,
  theming: IconSparkle,
  licence: IconDocumentText,
}

/**
 * The one usage snippet "Get started" shows. Its lines are kept short enough to fit a phone's
 * column without scrolling (`pages/checks/ui-guide.ts` measures it at 390 px).
 */
export const USAGE_SNIPPET = `import {
  Badge,
  Button,
  Cluster,
} from "@spy4x/preact-ui"

export function Toolbar(
  { onSave }: { onSave: () => void },
) {
  return (
    <Cluster>
      <Button onClick={onSave}>
        Save
      </Button>
      <Badge text="Draft" />
    </Cluster>
  )
}`

/** The file name over the usage snippet. */
const USAGE_FILE = "toolbar.tsx"

/** The command "Get started" offers for the styles. */
export const THEME_INSTALL = "deno add jsr:@spy4x/preact-theme"

/** Every word the overview prints of its own. The shell fills each from its labels. */
export interface OverviewLabels {
  title: string
  headline: string
  tagline: string
  browse: string
  star: string
  copyInstall: string
  stats: (totals: OverviewTotals) => string
  exampleHeading: string
  exampleTitle: string
  exampleSummary: string
  copyExample: string
  whyHeading: string
  why: Record<WhyFactId, WhyFact>
  startHeading: string
  startLead: string
  startStyles: string
  startStylesBody: string
  copyThemeInstall: string
  themeReadme: string
  startUse: string
  startUseBody: string
  copyUsage: string
  startRead: string
  startReadBody: string
  usageDoc: string
  readme: (packageName: string) => string
  packagesHeading: string
  cardCount: (count: number) => string
  iconCount: (count: number) => string
  examplesComing: string
  card: Parameters<typeof DemoCard>[0]["labels"]
}

/** Props of {@link Overview}. */
export interface OverviewProps {
  labels: OverviewLabels
  registry: PartialDemoRegistry
  /** The shell's link port: called on every in-guide link's click. */
  follow: (href: string, event: JSX.TargetedMouseEvent<HTMLAnchorElement>) => void
  install: string
  /** The repository the host links to; left out, the page offers no repository link. */
  repository?: string
  copy?: (text: string) => void | Promise<void>
}

const MUTED = "text-muted"
const LINK =
  "font-medium text-purple-800 underline decoration-purple-300 underline-offset-4 hover:decoration-purple-700 dark:text-purple-300 dark:decoration-purple-700 dark:hover:decoration-purple-300"

/**
 * The landing page: the hero, the live mini app, the "why" strip, "Get started", the packages
 * and the design rules, `2xl` apart.
 *
 * @param props See {@link OverviewProps}.
 */
export function Overview(
  { labels, registry, follow, install, repository, copy }: OverviewProps,
): JSX.Element {
  const totals = overviewTotals(registry)
  const firstPage = packagePages[0]
  return (
    <Stack gap="2xl" data-e2e="ui-guide-overview">
      <header class="flex flex-col gap-6" data-overview-part="hero">
        <Stack gap="md">
          <p class="font-mono text-sm font-medium text-purple-700 dark:text-purple-300">
            {labels.title}
          </p>
          <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-balance text-foreground sm:text-5xl">
            {labels.headline}
          </h1>
          <p class={cn("max-w-2xl text-lg", MUTED)}>{labels.tagline}</p>
        </Stack>
        <Cluster>
          <a
            href={pageHref(firstPage.id)}
            onClick={(event) => follow(pageHref(firstPage.id), event)}
            class={buttonClasses("primary", "md")}
            data-e2e="ui-guide-browse"
          >
            {labels.browse}
            <IconArrowRight class="size-4" />
          </a>
          {repository
            ? (
              <a
                href={repository}
                rel="noreferrer"
                class={buttonClasses("outline", "md")}
                data-e2e="ui-guide-star"
              >
                <IconStar class="size-4" />
                {labels.star}
              </a>
            )
            : null}
        </Cluster>
        <CopyBlock
          text={install}
          singleLine
          copy={copy}
          copyLabel={labels.copyInstall}
          class="max-w-md bg-surface"
        />
        <p class="text-sm text-muted" data-overview-stats>
          {labels.stats(totals)}
        </p>
      </header>

      <Section as="section" title={labels.exampleHeading} data-overview-part="app">
        <DemoCard
          name="overview-app"
          anchorId="overview-app"
          label={labels.exampleTitle}
          copyLabel={labels.copyExample}
          labels={labels.card}
          title={labels.exampleTitle}
          summary={labels.exampleSummary}
          snippet={MINI_APP_SNIPPET}
          copy={copy}
          wide
        >
          <MiniApp />
        </DemoCard>
      </Section>

      <Section as="section" title={labels.whyHeading} data-overview-part="why">
        <Grid as="ul" minColumnWidth="lg">
          {whyFactIds.map((id) => {
            const Icon = WHY_ICONS[id]
            const fact = labels.why[id]
            return (
              <li
                key={id}
                data-why={id}
                class="flex min-w-0 gap-4 rounded-xl border border-subtle bg-surface p-4 sm:p-6"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200">
                  <Icon class="size-5" />
                </span>
                <span class="flex min-w-0 flex-col gap-1">
                  <span class="font-semibold text-foreground">{fact.title}</span>
                  <span class={cn("text-sm [overflow-wrap:anywhere]", MUTED)}>
                    <InlineMarkdown text={fact.body} />
                  </span>
                </span>
              </li>
            )
          })}
        </Grid>
      </Section>

      <Section
        as="section"
        title={labels.startHeading}
        description={labels.startLead}
        data-overview-part="start"
      >
        <ol class="flex flex-col gap-4">
          <Step
            number={1}
            title={labels.startStyles}
            body={labels.startStylesBody}
            footer={
              <a href={readmeHref("theme", repository)} class={cn("text-sm", LINK)}>
                {labels.themeReadme}
              </a>
            }
          >
            <CopyBlock
              text={THEME_INSTALL}
              singleLine
              copy={copy}
              copyLabel={labels.copyThemeInstall}
              class="bg-canvas max-sm:[&_code]:text-xs"
            />
          </Step>
          <Step number={2} title={labels.startUse} body={labels.startUseBody}>
            <div
              class="min-w-0 overflow-hidden rounded-lg bg-scrim-strong text-scrim-foreground"
              data-e2e="ui-guide-usage"
            >
              <div class="flex items-center justify-between gap-2 border-b border-on-scrim py-1 pr-2 pl-4">
                <span class="font-mono text-xs text-on-scrim-muted">{USAGE_FILE}</span>
                <CopyButton
                  textToCopy={USAGE_SNIPPET}
                  copy={copy}
                  copyLabel={labels.copyUsage}
                  class="text-on-scrim-muted hover:bg-on-scrim hover:text-scrim-foreground"
                />
              </div>
              <pre class="overflow-x-auto p-4 text-xs leading-relaxed"><code>{USAGE_SNIPPET}</code></pre>
            </div>
          </Step>
          <Step number={3} title={labels.startRead} body={labels.startReadBody}>
            <ul
              class="grid gap-x-6 gap-y-2 text-sm @2xl:grid-cols-2"
              data-e2e="ui-guide-readmes"
            >
              {repository
                ? (
                  <li class="@2xl:col-span-2">
                    <a
                      href={repositoryFile(repository, "docs/usage.md")}
                      class={cn("inline-flex items-center gap-2", LINK)}
                    >
                      <IconBookOpen class="size-4" />
                      {labels.usageDoc}
                    </a>
                  </li>
                )
                : null}
              {libraryPackageIds.map((id) => (
                <li key={id} class="min-w-0">
                  <a
                    href={readmeHref(id, repository)}
                    class={cn("font-mono text-xs break-words", LINK)}
                  >
                    {labels.readme(`@spy4x/preact-${id}`)}
                  </a>
                </li>
              ))}
            </ul>
          </Step>
        </ol>
      </Section>

      <Section as="section" title={labels.packagesHeading} data-overview-part="packages">
        <Grid as="ul" minColumnWidth="lg">
          {packagePages.map((page) => {
            const count = page.sections.reduce(
              (total, section) => total + section.names.filter((name) => name in registry).length,
              0,
            )
            const href = pageHref(page.id)
            return (
              <li key={page.id} class="min-w-0">
                <a
                  href={href}
                  onClick={(event) => follow(href, event)}
                  class="flex h-full flex-col gap-2 rounded-xl border border-subtle bg-surface p-4 shadow-xs transition-colors hover:border-purple-400 sm:p-6 dark:hover:border-purple-500"
                >
                  <span class="flex flex-wrap items-baseline justify-between gap-2">
                    <span class="text-base font-semibold text-foreground">
                      {page.title}
                    </span>
                    <span class="text-xs text-muted" data-count={page.id}>
                      {page.id === "icons"
                        ? labels.iconCount(totals.icons)
                        : count > 0
                        ? labels.cardCount(count)
                        : labels.examplesComing}
                    </span>
                  </span>
                  <span class="font-mono text-xs text-purple-700 dark:text-purple-300">
                    {page.packageName}
                  </span>
                  <span class={cn("text-sm", MUTED)}>
                    <InlineMarkdown text={page.summary} />
                  </span>
                </a>
              </li>
            )
          })}
        </Grid>
      </Section>

      <div data-overview-part="rules">
        <CatalogInstructions />
      </div>
    </Stack>
  )
}

/**
 * One numbered step of "Get started": a card with its number, title and sentence beside what the
 * step hands over (a command, a snippet, the links), stacked on a narrow column. Full width, so a
 * command and a snippet get the room their longest line needs.
 */
function Step(
  { number, title, body, footer, children }: {
    number: number
    title: string
    body: string
    footer?: JSX.Element
    children: JSX.Element
  },
): JSX.Element {
  return (
    <li class="grid min-w-0 gap-4 rounded-xl border border-subtle bg-surface p-4 sm:p-6 @3xl:grid-cols-[16rem_minmax(0,1fr)] @3xl:gap-8">
      <div class="flex min-w-0 flex-col gap-2">
        <span class="flex items-center gap-2">
          <span
            aria-hidden="true"
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-200"
            data-step={number}
          >
            {number}
          </span>
          <span class="font-semibold text-foreground">{title}</span>
        </span>
        <p class={cn("text-sm", MUTED)}>
          <InlineMarkdown text={body} />
        </p>
        {footer}
      </div>
      <div class="min-w-0 self-center">{children}</div>
    </li>
  )
}
