/**
 * The cards of the blocks a blog, a docs site, a changelog and a record's detail page are read
 * in: `Prose`, `TldrBox`, `PostList`, `DocsNav`, `PrevNext`, `ChangeList`, `SectionHeading` and
 * `FactList`. None needs JavaScript. They are spread into the Display section.
 */

import {
  ChangeList,
  DocsNav,
  FactList,
  PostList,
  PrevNext,
  Prose,
  SectionHeading,
  TldrBox,
} from "@spy4x/preact-ui"
import type { DemoFragment } from "../registry.ts"

/** A short article, as a Markdown renderer hands it over: plain elements, no classes. */
const ARTICLE = `<p>A background job is work the server does after it has answered: an email, a
report, a clean-up. This post shows how to add one, with <a href="#demo-Prose">a worked example</a>
and the <code>enqueueJob</code> call.</p>
<h2 id="guide-prose-why">Why not do it in the request</h2>
<p>The person waits for the slowest step, and a crash halfway loses the work. A job is
<strong>written down first</strong> and run after, so a retry picks it up.</p>
<ul>
<li>It runs once the transaction that queued it commits.</li>
<li>It retries with a growing pause, up to twenty times.
<ul><li>Each failure keeps its error type.</li></ul></li>
</ul>
<h3 id="guide-prose-how">Queue it in the same transaction</h3>
<pre><code>await enqueueJob(tx, "blog.publish", post.id, { at: post.publishAt })</code></pre>
<blockquote><p>A job that sends email may send it twice if it partly ran before.</p></blockquote>
<h4 id="guide-prose-limits">Limits</h4>
<table><thead><tr><th>Setting</th><th>Default</th><th>Where it is set</th><th>What it changes</th></tr></thead>
<tbody><tr><td>Attempts</td><td>20</td><td><code>JOB_ATTEMPTS</code></td><td>How often a failed run is tried again</td></tr><tr><td>Kept after it finished</td><td>7 days</td><td><code>JOB_KEEP_DAYS</code></td><td>When a finished run leaves the Jobs page</td></tr><tr><td>Alert sent to</td><td><code>https://hooks.example.com/jobs/failed</code></td><td><code>JOB_FAILURE_WEBHOOK_URL</code></td><td>Where a run that failed for good is reported</td></tr></tbody></table>
<h4 id="guide-prose-files">Files</h4>
<table><thead><tr><th>File</th><th>What it holds</th></tr></thead>
<tbody><tr><td><code>apps/api/features/jobs/transports.test.ts</code></td><td>The tests of the HTTP and WebSocket routes that queue and rerun a job</td></tr><tr><td><code>apps/api/features/jobs/repository.ts</code></td><td>The queries that claim, finish and retry a run</td></tr></tbody></table>
<h4 id="guide-prose-runs">Runs per month</h4>
<table><thead><tr><th>Job</th><th>May</th><th>Jun</th><th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th></tr></thead>
<tbody><tr><td>Email</td><td>1,204</td><td>1,318</td><td>1,277</td><td>1,402</td><td>1,511</td><td>1,630</td></tr><tr><td>Report</td><td>31</td><td>30</td><td>31</td><td>31</td><td>30</td><td>31</td></tr></tbody></table>
<ol><li>Define the job.</li><li>Queue it.</li></ol>
<hr>
<p>That is all it takes.</p>`

const POSTS = [
  {
    href: "#demo-PostList",
    title: "Background jobs you can see and run again",
    description:
      "A Jobs page in the admin panel lists every run, its attempts and its last error, and runs a failed one again with one click.",
    publishedAt: "2026-10-23T09:00:00.000Z",
    readMinutes: 6,
    lang: "en",
  },
  {
    href: "#demo-PostList",
    title: "Write once, publish on a schedule",
    description: "Posts are written in the admin panel and go live at the time you pick.",
    publishedAt: "2026-10-02T09:00:00.000Z",
    readMinutes: 4,
    lang: "en",
  },
]

export const contentBlockDemos: DemoFragment = {
  Prose: {
    summary:
      "The type of an article: rendered Markdown set from the design tokens at about 65 characters a line, with no JavaScript.",
    wide: true,
    props: [
      {
        name: "html",
        type: "string",
        description:
          "Rendered article HTML, set as `innerHTML`. It must already be safe: `Prose` styles it and cleans nothing.",
      },
      {
        name: "children",
        type: "ComponentChildren",
        description: "The article as elements, when there is no `html`.",
      },
      {
        name: "as",
        type: `"div" | "article"`,
        default: `"div"`,
        description: "The wrapping element.",
      },
      {
        name: "anchors",
        type: "boolean",
        default: "false",
        description:
          "A “Link to this section” link beside every `h2` and `h3` with an `id`, shown on hover and on focus. Tables always scroll in their own focusable region, named after the heading before them.",
      },
      {
        name: "labels",
        type: "{ anchor?, table? }",
        description: `The anchor's name and the name of a table region with no heading before it.`,
      },
    ],
    snippet: `<Prose as="article" html={renderedMarkdown} anchors />`,
    render: () => <Prose html={ARTICLE} anchors />,
  },
  TldrBox: {
    summary:
      "The few points a reader takes from an article, in a hairline box headed “In short”, before the body.",
    wide: false,
    props: [
      {
        name: "items",
        type: "ComponentChildren[]",
        description: "The points, one sentence each. An empty list renders nothing.",
      },
      {
        name: "title",
        type: "ComponentChildren",
        default: `"In short"`,
        description: "The heading.",
      },
      {
        name: "headingLevel / id",
        type: "2 | 3 | 4 / string",
        default: "2 / generated",
        description: "The heading's level and its `id`, which names the section.",
      },
    ],
    snippet: `<TldrBox items={post.tldr} />`,
    render: () => (
      <TldrBox
        headingLevel={4}
        items={[
          "A job is written down first and run after, so a crash loses nothing.",
          "Failed runs retry on their own, and the admin can run one again.",
          "Repeating jobs follow a cron schedule in UTC.",
        ]}
      />
    ),
  },
  PostList: {
    summary:
      "A blog's index or its “Read next”: each post's day and reading time, its title as a link and two lines of description.",
    wide: true,
    props: [
      {
        name: "posts",
        type: "{ href, title, description?, publishedAt, readMinutes?, lang?, dir? }[]",
        description:
          'The posts, newest first. `publishedAt` is shown as its UTC day. An empty list renders nothing. `lang` marks the title and description, such as an English post on an Arabic page, with `dir="auto"` unless `dir` is given.',
      },
      {
        name: "headingLevel / label",
        type: "2 | 3 | 4 / string",
        default: "2",
        description: "Each title's heading level, and the list's accessible name.",
      },
      {
        name: "labels",
        type: "{ readTime? }",
        description: `The reading time's words, "6 min read" by default.`,
      },
    ],
    snippet: `<PostList posts={posts.map((post) => ({ ...post, lang: "en" }))} />`,
    render: () => <PostList posts={POSTS} headingLevel={4} label="Recent posts" />,
  },
  DocsNav: {
    summary:
      "The side list of a set of guides, grouped, with the guide on screen marked; a <details> below lg.",
    wide: false,
    props: [
      {
        name: "groups",
        type: "{ title, items: { href, title }[] }[]",
        description:
          "The groups and their guides, in reading order. An empty list renders nothing.",
      },
      {
        name: "current",
        type: "string",
        description:
          'The `href` of the guide on screen: `aria-current="page"`, the bar on the inner edge, and the folded summary\'s title.',
      },
      {
        name: "labels",
        type: "{ label?, summary?, summaryNone? }",
        description: `The landmark's name ("Docs") and the folded summary ("Guides: {title}").`,
      },
    ],
    snippet: `<DocsNav groups={groups} current="/docs/deploy" />`,
    render: () => (
      <DocsNav
        current="#demo-DocsNav-deploy"
        groups={[
          {
            title: "Use",
            items: [
              { href: "#demo-DocsNav-apps", title: "The three apps" },
              { href: "#demo-DocsNav-deploy", title: "Deploy and operate" },
              { href: "#demo-DocsNav-guests", title: "Guest accounts" },
            ],
          },
          {
            title: "Build",
            items: [
              { href: "#demo-DocsNav-development", title: "Development" },
              { href: "#demo-DocsNav-feature", title: "Adding a feature" },
            ],
          },
        ]}
      />
    ),
  },
  PrevNext: {
    summary:
      "Two cards at the end of a guide, the previous one and the next one, each a whole-card link.",
    wide: true,
    props: [
      {
        name: "previous / next",
        type: "{ href, title }",
        description:
          "The neighbours. Either may be left out; the next card stays on the end side. Neither, nothing renders.",
      },
      {
        name: "labels",
        type: "{ label?, previous?, next? }",
        description: `The landmark's name and the line over each title, "Previous" and "Next".`,
      },
    ],
    snippet: `<PrevNext previous={{ href: "/docs/apps", title: "The three apps" }} next={next} />`,
    render: () => (
      <PrevNext
        previous={{ href: "#demo-PrevNext", title: "The three apps" }}
        next={{ href: "#demo-PrevNext", title: "Guest accounts" }}
      />
    ),
  },
  ChangeList: {
    summary:
      "What changed, month by month: new things listed, fixes folded in a <details> that counts them, each with its pull request.",
    wide: true,
    props: [
      {
        name: "months",
        type: "{ id, title, added, fixed, note? }[]",
        description:
          "The months, newest first; `added` and `fixed` are `{ text, number?, href? }[]`. An empty list renders nothing.",
      },
      {
        name: "headingLevel",
        type: "2 | 3",
        default: "2",
        description: "The month's heading level; New and Fixed sit one below.",
      },
      {
        name: "labels",
        type: "{ added?, fixed?, changes?, fixes?, pullRequest?, anchor? }",
        description: `The words shown, such as "Pull request 612" for each number link.`,
      },
    ],
    snippet: `<ChangeList months={months} />`,
    render: () => (
      <ChangeList
        headingLevel={3}
        months={[
          {
            id: "guide-changes-2026-10",
            title: "October 2026",
            added: [
              { text: "People can sign in with a passkey.", number: 612, href: "#demo-ChangeList" },
              {
                text: "The admin panel lists every background job and runs a failed one again.",
                number: 609,
                href: "#demo-ChangeList",
              },
            ],
            fixed: [
              { text: "The menu closes on Escape.", number: 611, href: "#demo-ChangeList" },
              { text: "A long name wraps on a phone.", number: 607, href: "#demo-ChangeList" },
            ],
          },
        ]}
      />
    ),
  },
  SectionHeading: {
    summary:
      "A heading written as elements with Prose's “Link to this section” anchor beside it, for a page that is not one article.",
    wide: false,
    props: [
      {
        name: "children",
        type: "ComponentChildren",
        description: "The heading's text.",
      },
      {
        name: "id",
        type: "string",
        description:
          "The heading's own `id`, such as the one its section's `aria-labelledby` names.",
      },
      {
        name: "targetId",
        type: "string",
        default: "id",
        description:
          "The `id` the anchor links to, when not the heading's. Give that element `scroll-mt-16`, as the heading has, so a sticky header does not cover it.",
      },
      {
        name: "headingLevel",
        type: "2 | 3 | 4",
        default: "2",
        description: "The heading's level; each is drawn at Prose's size for it.",
      },
      {
        name: "labels",
        type: "{ anchor? }",
        description: "The anchor's name.",
      },
      {
        name: "class",
        type: "string",
        description: "Utilities on the heading, merged after the defaults.",
      },
    ],
    snippet: `<section aria-labelledby="pricing">
  <SectionHeading id="pricing">Pricing</SectionHeading>
  …
</section>`,
    render: () => (
      <section aria-labelledby="guide-section-heading" class="flex flex-col gap-3">
        <SectionHeading id="guide-section-heading">Pricing</SectionHeading>
        <p class="text-pretty">
          One plan, free while you host it yourself.{" "}
          <a href="#demo-SectionHeading" class="underline">Compare plans</a>
        </p>
      </section>
    ),
  },
  FactList: {
    summary:
      "Labels and their values, such as a record's details, as a description list: stacked on a phone, two columns from `sm`.",
    wide: false,
    props: [
      {
        name: "facts",
        type: "{ label, value, hint?, id? }[]",
        description:
          "The rows in reading order. A `hint` is a muted line under the value; `id` is the row's key and `data-e2e`.",
      },
    ],
    snippet: `<FactList
  facts={[
    { label: "Status", value: "Failed" },
    { label: "Attempts", value: "20 of 20" },
    { label: "Last error", value: "TimeoutError", hint: "The error type only." },
  ]}
/>`,
    render: () => (
      <FactList
        facts={[
          { label: "Job", value: "Password reset email" },
          { label: "Status", value: "Failed" },
          { label: "Attempts", value: "20 of 20" },
          {
            label: "Last error",
            value: "TimeoutError",
            hint: "The error type only. The message is not stored.",
          },
          { label: "Kind", value: "auth.password-reset-mail-with-a-long-name" },
        ]}
      />
    ),
  },
}
