# Pre-publish checks

A JSR version cannot be changed or deleted once it is published — a name that should not have gone
out stays out there forever. [Issue #237](https://github.com/spy4x/preact-components/issues/237)
removed every private application name, path and file list from the files each package publishes,
and this page is its second box: a check the owner re-runs before every `deno publish`, rather than
a one-time cleanup that could silently regress.

## What it checks

`infra/scripts/private-names.ts` takes the path to a names file and, for each published package:

1. runs `deno publish --dry-run --allow-dirty` from that package's directory and reads the file
   list it prints — exactly the files that command would upload to JSR;
2. reads each of those files and checks every line against every name in the list, case-insensitively
   and at a whole word boundary — a hyphen counts as part of a word here, not as a separator, so a
   short name does not match inside an unrelated hyphenated token such as a locale code, but a
   capitalised mention (an application named at the start of a sentence, say) is still caught;
3. prints every hit as `path/to/file:line` and exits non-zero if it found any, zero if it found
   none.

```bash
deno task private-names /path/to/names.txt
```

The script never embeds a name anywhere in this repository. The names file itself is not tracked
here either — keep it in a file you keep outside the repository, one name per line, and point the
task at it. A short name can still match an unrelated word that happens to share it — the script
narrows candidates, it does not replace reading each match.

## When to run it

Before every `deno publish`, against the names file described above. A clean run — zero matches
for every package — is what "safe to publish" means here; it is not part of `deno task check`
because that task has to pass with no such file present.

## If it finds something

Fix the file, matching the tone the rest of the published prose already uses: say "a source
application" or "an earlier application" where the fact that something was extracted from
somewhere matters, and drop the sentence where it does not. Re-run the check afterward — the same
command, against the same file.
