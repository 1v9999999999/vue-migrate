# sample-collector — implementation summary

## What was built

A complete, self-contained Vue 2 sample collector under
`D:\Projects\NB_EST\qiuzhi\vue-migrate\tools\sample-collector\`. It pulls
real GitHub repos into `D:\Projects\NB_EST\qiuzhi\vue-migrate\samples\`
and writes a `SampleEntry`-shaped row per repo to
`samples\INDEX.json`. The next subsystem (`rule-generator/`) reads that
index.

### Files delivered

| File | Purpose |
| ---- | ------- |
| `package.json` | Local Node + tsx package; declares `@octokit/rest`, `commander`, `extract-zip`, `tsx`, `typescript` |
| `src/queries.ts` | 10-query diversity matrix (state / router / ui / scale / ts) |
| `src/classify.ts` | Hermetic `classify(input) → SampleEntry` + `classifyFromLocal(path, meta)` + `walkLocalSample(path)` |
| `src/collect.ts` | `collectSamples(opts) → SampleEntry[]`; GitHub search → metadata → zip → extract → classify → INDEX |
| `src/index.ts` | CLI (`collect` / `classify` subcommands) + library re-exports |
| `src/__tests__/classify.test.ts` | 27 unit tests covering every classifier branch |
| `README.md` | Operating guide for humans |
| `SUMMARY.md` | This file |

### SampleEntry shape (what `samples\INDEX.json` entries look like)

```json
{
  "org": "lin-xin",
  "repo": "vue2-manage",
  "shortSha": "9f2c1a4",
  "localPath": "D:\\Projects\\NB_EST\\qiuzhi\\vue-migrate\\samples\\lin-xin__vue2-manage__9f2c1a4",
  "stars": 1280,
  "size": "large",
  "framework": "element-ui",
  "state": "vuex",
  "router": true,
  "typescript": false,
  "fileCount": 412,
  "vueFileCount": 87,
  "collectedAt": "2024-...Z"
}
```

## Test results

### Unit tests — 27/27 pass

```
$ tsx --test tools/sample-collector/src/__tests__/classify.test.ts
✔ classify — framework detection (5/5)
✔ classify — state management  (3/3)
✔ classify — router            (4/4)
✔ classify — typescript        (3/3)
✔ classify — size bucketing    (5/5)
✔ classify — file counts       (3/3)
✔ classify — robustness        (4/4)
ℹ tests 27 / pass 27 / fail 0
```

Coverage includes:
- element-ui > vant > iview preference order
- pinia > vuex preference order
- hand-rolled `src/router/index.*` recognized as router even without dep
- TypeScript detected from dep OR `.ts`/`.tsx` file in the path list
- `repoSizeKB` is the primary size signal; falls back to `totalBytes`
- `null` / malformed `package.json` does not throw
- A real-world regression test mirroring `examples/vue2-manage-master`

### Acceptance criteria

| # | Check | Result |
| - | ----- | ------ |
| 1 | `pnpm run dev:cli` still works | ✅ |
| 2 | `tsx tools/sample-collector/src/index.ts classify --sample examples/vue2-manage-master` returns `stars=0, framework='element-ui', state='vuex', router=true, typescript=false, size='large'` | ✅ |
| 3 | `tsx tools/sample-collector/src/index.ts --help` shows help | ✅ (also includes the diversity matrix) |
| 4 | `tsx tools/sample-collector/src/index.ts collect --out samples/test-only --max 1 --dry-run` prints plan, makes no network calls, leaves no directory | ✅ |
| 5 | `tsx --test tools/sample-collector/src/__tests__/classify.test.ts` runs cleanly | ✅ 27/27 |

### Out-of-bounds checks

Confirmed not modified:
- `tools/orchestrate.ts` — untouched
- `tools/baseline-comparator/` — untouched
- `tools/regression-suite/` — untouched
- `tools/scheduler/` — untouched
- `tools/rule-generator/` — untouched
- `packages/core/`, `packages/plugins/*` — untouched
- `samples/INDEX.json` — does not yet exist (the collector creates it on first live run)
- The 7 directories under `examples/` — untouched

## Key design decisions

1. **Hermetic classifier.** `classify()` takes a `package.json` string + a
   file path list. It never opens `.vue` files. This keeps the unit test
   fast and disk-free, and makes the classifier reusable from anywhere
   (including a future agent that wants to re-classify INDEX entries
   after the rules evolve).

2. **One transient dir per repo.** `downloadAndExtract` lands the unzipped
   repo under `samples/__pending__<org>__<repo>/`, then the main loop
   renames it to `samples/<org>__<repo>__<shortSha>/`. The rename is
   atomic on Windows, so a partial extraction never appears under the
   final name.

3. **Idempotency via INDEX.** The dedup key is `org/repo` (sha-agnostic,
   per spec). Every successful add writes the new INDEX, so a re-run
   re-reads the latest state. No on-disk "already-downloaded" marker is
   needed.

4. **Best-effort, never abort.** Search failures, download failures,
   extraction failures, and size-cap failures are all logged and
   continued. The iteration only fails if `GITHUB_TOKEN` is missing in
   non-dry-run mode.

5. **Disk-safe.** The per-repo cap (default 50 MB, configurable via
   `--max-repo-kb`) is checked against GitHub's `repo.size` (KB) **before**
   download — no wasted bandwidth. The on-disk extractor doesn't enforce
   the cap, so a malicious `repo.size=10KB` containing 500 MB of node
   modules would still expand; treat the GitHub number as advisory and
   use `--max-repo-kb` with a low number for untrusted input.

6. **No LLM.** This subsystem is purely mechanical. Rule generation is
   out of scope per spec.

## Known limitations

1. **GitHub zip → local rename can fail cross-drive.** `rename` only
   works within a single volume. Since everything is under
   `D:\Projects\NB_EST\qiuzhi\vue-migrate\samples\`, this is a non-issue
   in practice, but if a future caller passes an outDir on a different
   drive, the rename will throw `EXDEV`. The fix would be a copy + rm
   fallback; not done here because no such caller exists yet.

2. **GitHub's `repo.size` is the unpacked size of the *default branch*
   including history.** A repo with a fat `node_modules/` checked in (yes,
   some do) will report a huge size and get skipped by the cap. This is
   actually desired — we want to *avoid* those.

3. **No pagination.** Each query fetches up to `maxPerQuery` results
   (≤ 100). If the diversity matrix ever needs more, `--max 100` plus
   per-query pagination would be the next step. Out of scope today.

4. **No GitHub Enterprise / custom API host support.** Hardcoded to
   `https://api.github.com`. If the team ever needs a self-hosted
   Enterprise, Octokit's `baseUrl` option is the place to plumb it.

5. **`commander@12.1.0` argv quirk.** When you pass a sliced
   `process.argv.slice(2)` to `program.parse()`, commander treats the
   array as `[node, script, ...userArgs]` and discards everything before
   index 2. The fix is `program.parse(argv, { from: 'user' })`. This is
   called out in `src/index.ts` for the next person who edits the CLI.

6. **`pnpm install --dir` is a no-op for non-workspace packages.** v11
   silently ignores unknown dirs. We worked around by running `npm
   install` inside `tools/sample-collector/`. The README documents the
   command. A future refactor could either (a) add
   `tools/sample-collector` to `pnpm-workspace.yaml` or (b) add a
   postinstall script at the repo root that `npm install`s the side
   package.

7. **Sample is left on disk if extraction succeeds but classify is
   interrupted.** The half-classified sample directory stays around
   (under its final `org__repo__sha` name) but no INDEX entry was
   written, so a re-run will re-download it. Acceptable waste; not worth
   a write-ahead log.

8. **No concurrency.** The loop processes repos serially. With the
   100ms sleep + GitHub's 5000/hr authed rate limit, a 50-repo pass
   takes ~30s. Plenty of headroom. Parallelism is a future optimization
   (and would need its own rate-limit budget).

## How the scheduler should call it

```powershell
cd D:\Projects\NB_EST\qiuzhi\vue-migrate
# ensure deps (idempotent — fast path)
if (-not (Test-Path "tools/sample-collector/node_modules/.bin/tsx.cmd")) {
  Push-Location tools/sample-collector; npm install --no-audit --no-fund; Pop-Location
}
# the actual run
$env:GITHUB_TOKEN = "<token>"
& "D:\Projects\NB_EST\qiuzhi\vue-migrate\tools\sample-collector\node_modules\.bin\tsx.cmd" `
   "tools/sample-collector/src/index.ts" `
   collect --out "samples/" --max 5
```

The scheduler should then read
`D:\Projects\NB_EST\qiuzhi\vue-migrate\samples\INDEX.json` and feed each
`entry.localPath` to `tools\orchestrate.ts --input <path>`.

## Suggestions for the next agent

1. **Add a `samples/INDEX.json` seeder.** The existing 7 `examples/`
   directories should be added to the INDEX before any `orchestrate` run,
   so the baseline has real data. The classifier already supports this:
   ```
   for d in examples/*/; do
     tsx tools/sample-collector/src/index.ts classify --sample "$d" --json >> samples/INDEX.json
   done
   ```
   (You'd want a small shell script that builds a proper INDEX file
   rather than appending raw JSON — but the primitive is there.)

2. **Add a `--refresh` flag** that re-classifies every existing INDEX
   entry in place. Useful after the classifier logic evolves (e.g. when
   we add a `vue3-test` framework detection).

3. **Capture more metadata.** Today we only keep `stars` and `repo.size`.
   A future agent might want `created_at`, `pushed_at`, default branch,
   and `license` — all available on the same Octokit `repos.get` call we
   already make.

4. **Move `tools/sample-collector` into the pnpm workspace** so the
   `pnpm install --dir` workaround goes away. The `pnpm-workspace.yaml`
   glob would need to include `tools/*`. Verify this doesn't break the
   `pnpm run dev:cli` filter, then drop the README's manual install
   step.

5. **Schedule-aware concurrency.** When the rule-generator asks "give
   me 10 more element-ui samples", the collector should be able to
   answer a *targeted* question, not just "fire the whole matrix
   again". A `collectTargeted({ framework: 'element-ui' })` API would
   be a natural extension.
