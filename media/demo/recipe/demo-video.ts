/**
 * Remakes `media/demo/`'s video end to end: builds the guide, serves it locally, records a take
 * and encodes it with the title card, captions, end card and music. See `README.md`.
 *
 * Usage (from the repository root):
 *
 *   deno task demo-video                 build, record, encode
 *   deno task demo-video --encode-only   encode the last take again (a caption or music change)
 *   deno task demo-video --url <guide>   record another copy of the guide, such as the live one
 */
import { serveDist } from "../../../pages/serve.ts"
import { encodeDemo } from "./encode.ts"
import { record } from "./record.ts"

const root = new URL("../../../", import.meta.url).pathname
const media = `${root}media/demo`
/** The last raw take; gitignored, never committed. */
const take = `${media}/recipe/.take`

const encodeOnly = Deno.args.includes("--encode-only")
const url = Deno.args[Deno.args.indexOf("--url") + 1]
if (Deno.args.includes("--url") && !url) throw new Error("--url needs the guide's address")

if (!encodeOnly) {
  await Deno.remove(take, { recursive: true }).catch(() => {})
  await Deno.mkdir(take, { recursive: true })
  if (Deno.args.includes("--url")) {
    await record(url, take)
  } else {
    const build = await new Deno.Command(Deno.execPath(), {
      args: ["task", "--cwd", "pages", "build"],
      cwd: root,
      stdout: "inherit",
      stderr: "inherit",
    }).output()
    if (!build.success) throw new Error("the guide's build failed")
    const server = await serveDist(`${root}pages/dist`, "/preact-components/")
    try {
      await record(server.url, take)
    } finally {
      await server.close()
    }
  }
}

await encodeDemo({
  take: `${take}/frames.txt`,
  out: media,
  title: "preact-components",
  claim: "Server-rendered Preact and Tailwind components with a live guide",
  end: "github.com/spy4x/preact-components",
  poster: `${take}/poster.png`,
})
