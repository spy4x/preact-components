/**
 * The cards of a shop's catalog that takes orders by chat: `LookTile`, `StoryTile`, `LookGrid` and
 * `OrderBar`, spread into the Display section, and `SwatchChips`, spread into the Fields section beside
 * `RadioChips`. None needs JavaScript.
 */

import {
  LookGrid,
  LookTile,
  type LookTileProps,
  OrderBar,
  RadioChips,
  StoryTile,
  SwatchChips,
} from "@spy4x/preact-ui"
import type { ResponsiveImageVariant } from "@spy4x/platform/universal/srcset"
import { IconPlus } from "@spy4x/preact-icons"
import type { DemoFragment } from "../registry.ts"

/**
 * A placeholder photo as a data URI, 3:4: a person's head and a garment in one colour on a light
 * backdrop, so the cards need no image asset and no network.
 *
 * @param garment The garment's colour, any CSS colour.
 * @param width The stored width in pixels; the height is a third more.
 */
function lookPhoto(garment: string, width: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${
      width * 4 / 3
    }' viewBox='0 0 300 400'>` +
    `<rect width='300' height='400' fill='#e9e5df'/>` +
    `<circle cx='150' cy='78' r='34' fill='#c9a68a'/>` +
    `<rect x='138' y='108' width='24' height='22' fill='#c9a68a'/>` +
    `<path d='M88 130h124l46 150-30 8-26-92v204H98V196l-26 92-30-8z' fill='${garment}'/>` +
    `<rect x='148' y='130' width='4' height='180' fill='#00000026'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** A look's photo at two stored widths, as `responsiveImage` takes them. */
function variants(garment: string): ResponsiveImageVariant[] {
  return [480, 960].map((width) => ({
    url: lookPhoto(garment, width),
    width,
    height: width * 4 / 3,
    type: "image/svg+xml",
  }))
}

const SIZES = [{ label: "S" }, { label: "M" }, { label: "L", soldOut: true }]
const COLOURS = [
  { name: "Brown", color: "#7a5230" },
  { name: "Grey", color: "#8a8d91" },
]

/** The looks of the grid card, the third sold out. */
const LOOKS: LookTileProps[] = [
  {
    href: "#demo-LookGrid",
    name: "Zip jacket",
    price: "590.000 ₫",
    photo: { variants: variants("#7a5230"), alt: "A brown zip jacket, worn closed" },
    sizes: SIZES,
    colors: COLOURS,
  },
  {
    href: "#demo-LookGrid",
    name: "Running shorts",
    price: "250.000 ₫",
    photo: { variants: variants("#2f4a6b"), alt: "Navy running shorts and a white top" },
    sizes: [{ label: "S" }, { label: "M" }, { label: "L" }],
  },
  {
    href: "#demo-LookGrid",
    name: "Red training set",
    price: "390.000 ₫",
    photo: { variants: variants("#a8322d"), alt: "A red top and leggings" },
    sizes: [{ label: "S", soldOut: true }, { label: "M", soldOut: true }],
    soldOut: true,
  },
  {
    href: "#demo-LookGrid",
    name: "Green training set with a long name that wraps",
    price: "390.000 ₫",
    photo: { variants: variants("#3d6b4a"), alt: "A green top and leggings" },
    sizes: [{ label: "XS" }, { label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }],
    colors: [{ name: "Green", color: "#3d6b4a" }, { name: "Black", color: "#1d1d1f" }],
  },
  {
    href: "#demo-LookGrid",
    name: "Sand hoodie",
    price: "450.000 ₫",
    photo: { variants: variants("#cdb894"), alt: "A sand-coloured hoodie" },
    sizes: SIZES,
  },
]

const MESSAGE = `Hi, I'd like to order:
• Zip jacket, colour Brown, size M, 590.000 ₫`

export const storefrontDemos: DemoFragment = {
  LookTile: {
    summary:
      "One look of a shop's catalog: a tall 3:4 photo as the card, then the name, the price and the sizes, all one link.",
    wide: false,
    props: [
      {
        name: "href / name / price",
        type: "string / string / ComponentChildren",
        description: "The item's page, its name (the link's text) and its formatted price.",
      },
      {
        name: "photo",
        type: "{ variants, alt, sizes? }",
        description:
          "The stored widths as `responsiveImage` takes them, cropped to 3:4; `sizes` defaults to the tile's width in a `LookGrid`.",
      },
      {
        name: "sizes / chosenSize",
        type: "{ label, soldOut? }[] / string",
        description:
          "A sold-out size is struck through and announced; the chosen one is marked in the accent.",
      },
      {
        name: "colors",
        type: "{ name, color }[]",
        description: "Dots after the sizes, each named for screen readers.",
      },
      {
        name: "soldOut",
        type: "boolean",
        default: "false",
        description: "Strikes the price and says “Sold out” beside it.",
      },
      {
        name: "viewTransitionName",
        type: "string",
        description:
          "Names the photo, so it grows into the item page's photo of the same name in a cross-document view transition.",
      },
      {
        name: "priority / headingLevel / labels",
        type: "boolean / 2 | 3 | 4 / object",
        default: "false / 2",
        description: "Load the photo first, the name's heading level, and the words.",
      },
    ],
    snippet: `<LookTile
  href="/jackets/zip-brown"
  name="Zip jacket"
  price="590.000 ₫"
  photo={{ variants: photoVariants, alt: "A brown zip jacket, worn closed" }}
  sizes={[{ label: "S" }, { label: "M" }, { label: "L", soldOut: true }]}
  chosenSize="M"
  colors={[{ name: "Brown", color: "#7a5230" }, { name: "Grey", color: "#8a8d91" }]}
  viewTransitionName="look-zip-brown"
/>`,
    render: () => (
      <div class="max-w-xs">
        <LookTile
          {...LOOKS[0]}
          href="#demo-LookTile"
          chosenSize="M"
          headingLevel={4}
          viewTransitionName="guide-look-zip"
        />
      </div>
    ),
  },
  StoryTile: {
    summary:
      "One post of a photo-led blog, made to sit beside `LookTile`s: a 3:4 cover, the topic, the title and the date, all one link.",
    wide: true,
    props: [
      {
        name: "href / title / publishedAt",
        type: "string / string / string",
        description:
          "The post's page, its title (the link's text and name) and the day it went live, shown in UTC.",
      },
      {
        name: "topic / readMinutes",
        type: "ComponentChildren / number",
        description: "A small line above the title, and the reading time after the date.",
      },
      {
        name: "cover",
        type: "{ variants, alt, sizes? }",
        description:
          "As `LookTile`'s photo, cropped to 3:4. Left out, the title is drawn large on a plain panel instead.",
      },
      {
        name: "lead",
        type: "boolean",
        default: "false",
        description:
          "The post the list opens with: a larger title, and from 1024 px two columns of a `LookGrid` with a 4:3 cover.",
      },
      {
        name: "navigate",
        type: "(href: string) => void",
        description: "Takes a plain click instead of the browser, as `Link`'s port does.",
      },
      {
        name: "priority / viewTransitionName / headingLevel / labels",
        type: "boolean / string / 2 | 3 | 4 / object",
        default: "false / – / 2",
        description:
          "Load the cover first, let it grow into the post, the title's heading level, and `PostList`'s words.",
      },
    ],
    snippet: `<LookGrid label="Stories">
  {posts.map((post, index) => (
    <StoryTile
      key={post.id}
      href={post.href}
      title={post.title}
      topic={post.topic}
      publishedAt={post.publishedAt}
      readMinutes={post.readMinutes}
      cover={post.cover}
      lead={index === 0}
      priority={index === 0}
    />
  ))}
</LookGrid>`,
    render: () => (
      <LookGrid label="Stories">
        <StoryTile
          href="#demo-StoryTile"
          title="Three ways to wear one zip jacket"
          topic="Styling"
          publishedAt="2026-10-28"
          readMinutes={4}
          cover={{ variants: variants("#7a5230"), alt: "" }}
          lead
          headingLevel={4}
        />
        <StoryTile
          href="#demo-StoryTile"
          title="Washing linen without shrinking it"
          topic="Care"
          publishedAt="2026-10-21"
          readMinutes={3}
          cover={{ variants: variants("#cdb894"), alt: "" }}
          headingLevel={4}
        />
        <StoryTile
          href="#demo-StoryTile"
          title="How we choose our fabrics"
          topic="Fabrics"
          publishedAt="2026-10-14"
          readMinutes={6}
          headingLevel={4}
        />
        <StoryTile
          href="#demo-StoryTile"
          title="A week in the workshop"
          topic="Behind the scenes"
          publishedAt="2026-10-07"
          readMinutes={5}
          cover={{ variants: variants("#2f4a6b"), alt: "" }}
          headingLevel={4}
        />
        <StoryTile
          href="#demo-StoryTile"
          title="Sizing a set that fits from the first wear"
          topic="Fit"
          publishedAt="2026-09-30"
          readMinutes={2}
          cover={{ variants: variants("#3d6b4a"), alt: "" }}
          headingLevel={4}
        />
      </LookGrid>
    ),
  },
  LookGrid: {
    summary:
      "A catalog's looks in staggered columns, one on a phone, two from 768 px and three from 1024 px, with no script.",
    wide: true,
    props: [
      {
        name: "children",
        type: "ComponentChildren",
        description:
          "The looks, usually `LookTile`s, each put in its own list item. None renders nothing.",
      },
      {
        name: "label",
        type: "string",
        description: "The list's accessible name, such as “New in”.",
      },
    ],
    snippet:
      `<h1 class="text-6xl leading-tight font-extrabold tracking-tighter text-balance lg:text-9xl">
  Made to move.
</h1>
<LookGrid label="New in">
  {looks.map((look, index) => <LookTile key={look.id} {...look} priority={index === 0} />)}
</LookGrid>`,
    render: () => (
      <div class="flex flex-col gap-8">
        <p class="text-6xl leading-tight font-extrabold tracking-tighter text-balance lg:text-9xl">
          Made to move.
        </p>
        <LookGrid label="New in">
          {LOOKS.map((look, index) => (
            <LookTile key={look.name} {...look} headingLevel={4} priority={index === 0} />
          ))}
        </LookGrid>
      </div>
    ),
  },
  OrderBar: {
    summary:
      "The order step of a shop that sells by chat: the message about to be sent, in a bubble, above the buttons that send it.",
    wide: true,
    props: [
      {
        name: "message",
        type: "ComponentChildren",
        description: "The message as it will be sent; line breaks are kept and it can be selected.",
      },
      {
        name: "actions",
        type: "[OrderBarAction] | [OrderBarAction, OrderBarAction]",
        description:
          "The first is accent-filled, a second outlined. Each is `{ label, shortLabel?, icon?, href?, name?, value?, attributes? }`: a link with `href`, else a submit button.",
      },
      {
        name: "secondary",
        type: "OrderBarAction",
        description: "A quieter action, such as “Add to list”: its icon alone on a phone.",
      },
      {
        name: "note",
        type: "ComponentChildren",
        description:
          "One short muted line under the actions at every width, such as a delivery promise.",
      },
      {
        name: "status / form / labels",
        type: "ComponentChildren / string / object",
        description:
          "A line in a live region (“Sold out”, “Message copied”), the form the submit buttons send, and the words.",
      },
    ],
    snippet: `<OrderBar
  form="order"
  message={message}
  actions={[
    { label: "Order on Telegram", shortLabel: "Telegram", href: telegramLink },
    { label: "Order on Zalo", shortLabel: "Zalo", name: "via", value: "zalo" },
  ]}
  secondary={{ label: "Add to list", icon: <IconPlus />, name: "add", value: item.id }}
  note="Same-day delivery in Da Nang if you order before 16:00."
/>`,
    render: () => (
      <div class="grid gap-6 lg:grid-cols-2">
        <img
          src={lookPhoto("#7a5230", 480)}
          width={480}
          height={640}
          alt="A brown zip jacket, worn closed"
          class="aspect-3/4 w-full rounded-primary object-cover max-lg:hidden"
        />
        <div class="flex flex-col gap-4">
          <p class="text-4xl font-extrabold tracking-tighter text-balance">Zip jacket</p>
          <p class="text-2xl font-bold tabular-nums">590.000 ₫</p>
          <form
            id="guide-order"
            class="flex flex-col gap-4"
            onSubmit={(event) => event.preventDefault()}
          >
            <SwatchChips
              legend="Colour"
              name="guide-order-colour"
              defaultValue="brown"
              options={[
                { value: "brown", name: "Brown", color: "#7a5230" },
                { value: "grey", name: "Grey", color: "#8a8d91" },
              ]}
            />
            <RadioChips
              legend="Size"
              name="guide-order-size"
              defaultValue="M"
              options={[
                { value: "S", label: "S" },
                { value: "M", label: "M" },
                {
                  value: "L",
                  label: (
                    <>
                      <s>L</s>
                      <span class="sr-only">, sold out</span>
                    </>
                  ),
                  disabled: true,
                },
              ]}
            />
          </form>
          <OrderBar
            note="Same-day delivery in Da Nang if you order before 16:00."
            form="guide-order"
            message={MESSAGE}
            actions={[
              { label: "Order on Telegram", shortLabel: "Telegram", href: "#demo-OrderBar" },
              { label: "Order on Zalo", shortLabel: "Zalo", name: "via", value: "zalo" },
            ]}
            secondary={{
              label: "Add to list",
              icon: <IconPlus class="size-5" />,
              name: "add",
              value: "zip",
            }}
          />
        </div>
      </div>
    ),
  },
}

export const swatchChipsDemo: DemoFragment = {
  SwatchChips: {
    summary:
      "A choice of colour as chips with a swatch before each name, on native radios, so it works with JavaScript off.",
    wide: false,
    props: [
      {
        name: "legend / name",
        type: "ComponentChildren / string",
        description: "The group's name, and the radios' shared `name` the form submits.",
      },
      {
        name: "options",
        type: "{ value, name, color, disabled?, id?, inputAttributes? }[]",
        description:
          "One chip per colour: its written name, and any CSS colour for the swatch. A colour with none left is `disabled`.",
      },
      {
        name: "defaultValue / value / onChange",
        type: "string / string | null / (value, event) => void",
        description: "The colour checked in the server markup, or control it from an island.",
      },
    ],
    snippet: `<SwatchChips
  legend="Colour"
  name="colour"
  defaultValue="brown"
  options={[
    { value: "brown", name: "Brown", color: "#7a5230" },
    { value: "grey", name: "Grey", color: "#8a8d91" },
    { value: "white", name: "White", color: "#ffffff", disabled: true },
  ]}
/>`,
    render: () => (
      <SwatchChips
        legend="Colour"
        name="guide-swatch-chips"
        defaultValue="brown"
        options={[
          { value: "brown", name: "Brown", color: "#7a5230" },
          { value: "grey", name: "Grey", color: "#8a8d91" },
          { value: "black", name: "Black", color: "#1d1d1f" },
          { value: "white", name: "White", color: "#ffffff", disabled: true },
        ]}
      />
    ),
  },
}
