/**
 * Runs one command and keeps a passing run short: `deno run --allow-run --allow-env quiet.ts
 * deno test …`. A passing run prints only its summary lines (`ok | 712 passed …`). A failing run
 * prints all of its output; Deno's test reporter puts the errors and failures at the end, so the
 * tail of a log holds them. `CHECK_VERBOSE=1` prints everything as it comes, pass or fail.
 */

// deno-lint-ignore no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g
const SUMMARY = /^(ok|FAILED) \| /

/** What a finished run prints: its summary lines when it passed, otherwise everything. */
export function quietOutput(output: string, passed: boolean): string {
  if (!passed) return output
  const summary = output.split(`\n`).filter((line) => SUMMARY.test(line.replace(ANSI, ``)))
  return summary.length > 0 ? `${summary.join(`\n`)}\n` : output
}

async function main(args: string[]): Promise<number> {
  const [program, ...rest] = args
  if (!program) {
    console.error(`Usage: quiet.ts <command> [args…]`)
    return 2
  }
  const verbose = Deno.env.get(`CHECK_VERBOSE`) === `1`
  const output = verbose ? `inherit` : `piped`
  const child = new Deno.Command(program, {
    args: rest,
    stdin: `null`,
    stdout: output,
    stderr: output,
  })
    .spawn()
  if (verbose) return (await child.status).code

  // Both streams go into one buffer in the order their chunks arrive, so an error keeps its place.
  const chunks: Uint8Array<ArrayBuffer>[] = []
  const collect = async (stream: ReadableStream<Uint8Array<ArrayBuffer>>) => {
    for await (const chunk of stream) chunks.push(chunk)
  }
  const [status] = await Promise.all([child.status, collect(child.stdout), collect(child.stderr)])
  const text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer())
  await Deno.stdout.write(new TextEncoder().encode(quietOutput(text, status.success)))
  return status.code
}

if (import.meta.main) Deno.exit(await main(Deno.args))
