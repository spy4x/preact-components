/**
 * The cards of the blocks a blog and a record's detail page are read in: `Prose`, `TldrBox`,
 * `PostList` and `FactList`. None needs JavaScript. They are spread into the Display section.
 */

import { FactList, PostList, Prose, TldrBox } from "@spy4x/preact-ui"
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
<table><thead><tr><th>Setting</th><th>Default</th></tr></thead>
<tbody><tr><td>Attempts</td><td>20</td></tr><tr><td>Kept after it finished</td><td>7 days</td></tr></tbody></table>
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
  },
  {
    href: "#demo-PostList",
    title: "Write once, publish on a schedule",
    description: "Posts are written in the admin panel and go live at the time you pick.",
    publishedAt: "2026-10-02T09:00:00.000Z",
    readMinutes: 4,
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
    ],
    snippet: `<Prose as="article" html={renderedMarkdown} />`,
    render: () => <Prose html={ARTICLE} />,
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
        type: "{ href, title, description?, publishedAt, readMinutes? }[]",
        description:
          "The posts, newest first. `publishedAt` is shown as its UTC day. An empty list renders nothing.",
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
    snippet: `<PostList posts={posts} />`,
    render: () => <PostList posts={POSTS} headingLevel={4} label="Recent posts" />,
  },
  FactList: {
    summary:
      "Labels and their values, such as a record's details, as a description list that reads on a phone and a desktop.",
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
