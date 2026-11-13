/**
 * Icons by id, for an app that stores which icon a person chose: a category's, a list's, a folder's.
 *
 * Icons in the main entry are components with no id, so a choice could not be saved. Here every
 * glyph a picker offers has a kebab-case id (Lucide's own file name), an English name after what is
 * drawn, and English aliases after what it is used for. An app stores the id; a released id never
 * changes or disappears. A separate entry, so an app without a picker never loads these glyphs.
 *
 * ```tsx
 * import { ICONS, type IconName } from "@spy4x/preact-icons/registry"
 *
 * const { Icon, name } = ICONS[category.icon as IconName]
 * <Icon aria-label={name} />
 * ```
 *
 * Every glyph is Lucide at stroke 2 (`lucide-static@1.47.0`), so a grid of them is one family.
 * `@spy4x/preact-ui`'s `IconPicker` names them in nine languages.
 *
 * @module
 */
import type { JSX } from "preact"
import { IconBank, type IconProps, IconSprout, IconWallet } from "./+index.tsx"
import {
  LucideBaby,
  LucideBanknote,
  LucideBed,
  LucideBriefcase,
  LucideBus,
  LucideCar,
  LucideCircleEllipsis,
  LucideCoffee,
  LucideCreditCard,
  LucideDroplet,
  LucideDumbbell,
  LucideFilm,
  LucideFlame,
  LucideFuel,
  LucideGamepad2,
  LucideGift,
  LucideGraduationCap,
  LucideHandCoins,
  LucideHandHeart,
  LucideHeartPulse,
  LucideHouse,
  LucidePawPrint,
  LucidePiggyBank,
  LucidePill,
  LucidePlane,
  LucideReceipt,
  LucideRepeat,
  LucideScissors,
  LucideShieldCheck,
  LucideShirt,
  LucideShoppingBag,
  LucideShoppingCart,
  LucideSmartphone,
  LucideTag,
  LucideTrendingUp,
  LucideUtensils,
  LucideWifi,
  LucideWrench,
  LucideZap,
} from "./lucide.tsx"

/** One glyph of {@link ICONS}: its component, its English name and the words that find it. */
export interface IconEntry {
  /** The glyph, with the main entry's props: `class`, `aria-label`, `title`. */
  Icon: (props: IconProps) => JSX.Element
  /** English name, after what is drawn, such as `"Lightning bolt"`: the tile's accessible name. */
  name: string
  /** Lower-case English words for what it is used for, such as `"electricity"`: search finds them. */
  aliases: readonly string[]
}

/** The id of a glyph in {@link ICONS}: what an app stores. */
export type IconName =
  | "house"
  | "zap"
  | "flame"
  | "droplet"
  | "wifi"
  | "smartphone"
  | "receipt"
  | "repeat"
  | "wrench"
  | "shopping-cart"
  | "utensils"
  | "coffee"
  | "car"
  | "fuel"
  | "bus"
  | "plane"
  | "bed"
  | "shopping-bag"
  | "shirt"
  | "scissors"
  | "gift"
  | "heart-pulse"
  | "pill"
  | "dumbbell"
  | "baby"
  | "paw-print"
  | "graduation-cap"
  | "film"
  | "gamepad-2"
  | "banknote"
  | "briefcase"
  | "wallet"
  | "credit-card"
  | "piggy-bank"
  | "trending-up"
  | "landmark"
  | "hand-coins"
  | "shield-check"
  | "hand-heart"
  | "sprout"
  | "tag"
  | "circle-ellipsis"

/**
 * Every glyph a picker can offer, by id. `ICONS[id].Icon` is the component; `name` and `aliases`
 * are English (`IconPicker` translates the name and adds each language's own aliases).
 */
export const ICONS: Readonly<Record<IconName, IconEntry>> = {
  "house": {
    Icon: LucideHouse,
    name: "House",
    aliases: ["home", "rent", "mortgage", "housing", "flat", "apartment"],
  },
  "zap": {
    Icon: LucideZap,
    name: "Lightning bolt",
    aliases: ["electricity", "power", "energy", "utilities"],
  },
  "flame": { Icon: LucideFlame, name: "Flame", aliases: ["heating", "gas bill", "boiler", "fire"] },
  "droplet": {
    Icon: LucideDroplet,
    name: "Water drop",
    aliases: ["water", "water bill", "utilities"],
  },
  "wifi": { Icon: LucideWifi, name: "Wi-Fi", aliases: ["internet", "broadband", "wifi", "router"] },
  "smartphone": {
    Icon: LucideSmartphone,
    name: "Phone",
    aliases: ["mobile", "cell phone", "phone bill", "data"],
  },
  "receipt": {
    Icon: LucideReceipt,
    name: "Receipt",
    aliases: ["bills", "invoice", "expenses", "purchase", "payment"],
  },
  "repeat": {
    Icon: LucideRepeat,
    name: "Repeat arrows",
    aliases: ["subscriptions", "recurring", "regular payments", "renewal"],
  },
  "wrench": {
    Icon: LucideWrench,
    name: "Spanner",
    aliases: ["repairs", "maintenance", "tools", "wrench", "plumber"],
  },
  "shopping-cart": {
    Icon: LucideShoppingCart,
    name: "Shopping trolley",
    aliases: ["groceries", "supermarket", "food shop", "cart", "basket"],
  },
  "utensils": {
    Icon: LucideUtensils,
    name: "Knife and fork",
    aliases: ["eating out", "restaurant", "dining", "meal", "food", "cutlery"],
  },
  "coffee": {
    Icon: LucideCoffee,
    name: "Coffee cup",
    aliases: ["coffee", "cafe", "tea", "drinks", "takeaway"],
  },
  "car": {
    Icon: LucideCar,
    name: "Car",
    aliases: ["parking", "driving", "vehicle", "auto", "taxi"],
  },
  "fuel": {
    Icon: LucideFuel,
    name: "Fuel pump",
    aliases: ["fuel", "petrol", "gas", "gasoline", "diesel", "filling station"],
  },
  "bus": {
    Icon: LucideBus,
    name: "Bus",
    aliases: ["public transport", "transit", "commute", "metro", "train", "tickets"],
  },
  "plane": {
    Icon: LucidePlane,
    name: "Plane",
    aliases: ["travel", "flight", "holiday", "vacation", "trip", "airport"],
  },
  "bed": { Icon: LucideBed, name: "Bed", aliases: ["hotel", "lodging", "accommodation", "stay"] },
  "shopping-bag": {
    Icon: LucideShoppingBag,
    name: "Shopping bag",
    aliases: ["shopping", "shop", "purchases", "retail", "mall"],
  },
  "shirt": { Icon: LucideShirt, name: "Shirt", aliases: ["clothes", "clothing", "fashion"] },
  "scissors": {
    Icon: LucideScissors,
    name: "Scissors",
    aliases: ["haircut", "hairdresser", "barber", "beauty", "personal care"],
  },
  "gift": { Icon: LucideGift, name: "Gift", aliases: ["present", "presents", "birthday"] },
  "heart-pulse": {
    Icon: LucideHeartPulse,
    name: "Heart with pulse",
    aliases: ["health", "medical", "doctor", "dentist", "hospital"],
  },
  "pill": {
    Icon: LucidePill,
    name: "Pill",
    aliases: ["pharmacy", "medicine", "chemist", "vitamins"],
  },
  "dumbbell": {
    Icon: LucideDumbbell,
    name: "Dumbbell",
    aliases: ["gym", "fitness", "sport", "workout", "training"],
  },
  "baby": {
    Icon: LucideBaby,
    name: "Baby",
    aliases: ["kids", "children", "childcare", "nappies", "diapers"],
  },
  "paw-print": {
    Icon: LucidePawPrint,
    name: "Paw print",
    aliases: ["pets", "dog", "cat", "vet", "pet food"],
  },
  "graduation-cap": {
    Icon: LucideGraduationCap,
    name: "Graduation cap",
    aliases: ["education", "school", "university", "course", "tuition", "books"],
  },
  "film": {
    Icon: LucideFilm,
    name: "Film",
    aliases: ["movies", "cinema", "entertainment", "streaming", "tv"],
  },
  "gamepad-2": {
    Icon: LucideGamepad2,
    name: "Game controller",
    aliases: ["games", "gaming", "video games", "console", "hobbies"],
  },
  "banknote": {
    Icon: LucideBanknote,
    name: "Banknote",
    aliases: ["cash", "salary", "income", "wages", "money"],
  },
  "briefcase": {
    Icon: LucideBriefcase,
    name: "Briefcase",
    aliases: ["work", "job", "business", "office", "freelance"],
  },
  "wallet": {
    Icon: IconWallet,
    name: "Wallet",
    aliases: ["money", "pocket money", "allowance", "spending"],
  },
  "credit-card": {
    Icon: LucideCreditCard,
    name: "Credit card",
    aliases: ["card", "payment", "credit", "repayment"],
  },
  "piggy-bank": {
    Icon: LucidePiggyBank,
    name: "Piggy bank",
    aliases: ["savings", "save", "emergency fund", "goal"],
  },
  "trending-up": {
    Icon: LucideTrendingUp,
    name: "Rising chart",
    aliases: ["investments", "stocks", "shares", "returns"],
  },
  "landmark": {
    Icon: IconBank,
    name: "Bank building",
    aliases: ["bank", "taxes", "government", "fees"],
  },
  "hand-coins": {
    Icon: LucideHandCoins,
    name: "Hand with coins",
    aliases: ["loan", "debt", "lend", "borrow", "interest"],
  },
  "shield-check": {
    Icon: LucideShieldCheck,
    name: "Shield with tick",
    aliases: ["insurance", "protection", "security", "warranty"],
  },
  "hand-heart": {
    Icon: LucideHandHeart,
    name: "Hand with heart",
    aliases: ["charity", "donation", "giving"],
  },
  "sprout": { Icon: IconSprout, name: "Sprout", aliases: ["garden", "plants", "growth"] },
  "tag": { Icon: LucideTag, name: "Tag", aliases: ["label", "sale", "discount", "tags"] },
  "circle-ellipsis": {
    Icon: LucideCircleEllipsis,
    name: "Three dots",
    aliases: ["other", "misc", "miscellaneous"],
  },
}

/**
 * The ids of the category set, in the order a picker shows them: grouped by meaning (home and
 * bills, food, getting around, shopping, health and family, leisure, money and work, other), not
 * by alphabet, because a grid is read in rows.
 */
export const CATEGORY_ICONS: readonly IconName[] = [
  "house",
  "zap",
  "flame",
  "droplet",
  "wifi",
  "smartphone",
  "receipt",
  "repeat",
  "wrench",
  "shopping-cart",
  "utensils",
  "coffee",
  "car",
  "fuel",
  "bus",
  "plane",
  "bed",
  "shopping-bag",
  "shirt",
  "scissors",
  "gift",
  "heart-pulse",
  "pill",
  "dumbbell",
  "baby",
  "paw-print",
  "graduation-cap",
  "film",
  "gamepad-2",
  "banknote",
  "briefcase",
  "wallet",
  "credit-card",
  "piggy-bank",
  "trending-up",
  "landmark",
  "hand-coins",
  "shield-check",
  "hand-heart",
  "sprout",
  "tag",
  "circle-ellipsis",
]
