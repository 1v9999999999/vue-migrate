# sample-collector

Pulls real Vue 2 repos from GitHub and stages them under `samples/` so the
rest of the vue-migrate self-evolution system has something to migrate.

This is the **first** subsystem of the self-evolution loop. It runs on a
30-minute schedule and only handles **collect + classify** — the next
subsystem (`rule-generator/`) consumes what this one writes to
`samples/INDEX.json` to propose new codemod rules.

---

## What it does

1. Hits GitHub's `search/repositories` API with the `DIVERSITY_QUERIES`
   matrix (10 narrow queries across state, router, UI lib, scale, TS).
2. Dedups against `samples/INDEX.json` (key: `owner/repo`, sha-agnostic).
3. For each new repo: GETs the metadata + zipball, extracts it under
   `samples/{owner}__{repo}__{shortSha}/`, then classifies the unpacked
   contents (package.json + file list).
4. Appends one `SampleEntry` to `samples/INDEX.json`.

Failure isolation: any single repo that errors out is logged and skipped —
the whole batch never aborts on a bad apple.

---

## Running

This subsystem lives in `tools/sample-collector/` with its own
`package.json`. Install its deps once:

```powershell
cd D:\Projects\NB_EST\qiuzhi\vue-migrate
pnpm install --filter @vue-migrate/sample-collector... 2>$null
# or, since it's outside the pnpm workspace:
pnpm install --dir tools/sample-collector
```

You need a `GITHUB_TOKEN` env var (with `public_repo` scope) for live
collection. The unauthenticated rate limit (10 req/min) is too low for the
diversity matrix. Without a token you can still run `--dry-run`.

### Show help

```powershell
tsx tools/sample-collector/src/index.ts --help
```

### Dry-run (no network)

```powershell
tsx tools/sample-collector/src/index.ts collect --out samples/test-only --max 1 --dry-run
```

### Real run (small batch)

```powershell
$env:GITHUB_TOKEN = "<your-token>"
tsx tools/sample-collector/src/index.ts collect --out samples/ --max 3
```

### Classify a local sample (no GitHub)

```powershell
tsx tools/sample-collector/src/index.ts classify --sample examples/vue2-manage-master
```

The classifier works against any directory that has a `package.json` —
useful for seeding the INDEX with the existing `examples/` set.

---

## Diversity matrix

The collector fires **all 10** of these per pass. Adjust counts with
`--max` (default 5 per query → up to 50 new samples per iteration).

| Bucket | Query name    | What it pulls                              |
| ------ | ------------- | ------------------------------------------ |
| state  | `vuex`        | Real Vuex stores                           |
| state  | `pinia_early` | Early Pinia adopters (Vue 2 era)           |
| router | `vue_router`  | Repos using `Vue.use(Router)`              |
| router | `no_router`   | Single-page apps without a router          |
| ui     | `element_ui`  | element-ui users                           |
| ui     | `vant`        | vant users                                 |
| ui     | `iview`       | iview / view-design users                  |
| scale  | `small`       | 10..200★ — exercise the "tiny repo" path   |
| scale  | `large`       | ≥500★ — exercise the "huge repo" path      |
| ts     | `ts`          | Projects with `.ts` Vue SFCs               |

The matrix is defined in `src/queries.ts` — that's the single place to
edit if you want to add or remove a bucket.

---

## Outputs

### `samples/INDEX.json`

```json
{
  "version": 1,
  "updatedAt": "2024-...Z",
  "entries": [
    {
      "org": "acme",
      "repo": "vue2-admin",
      "shortSha": "9f2c1a4",
      "localPath": "D:\\Projects\\NB_EST\\qiuzhi\\vue-migrate\\samples\\acme__vue2-admin__9f2c1a4",
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
  ]
}
```

The shape is a `SampleEntry` (see `src/classify.ts`).

### `samples/{owner}__{repo}__{shortSha}/`

The unzipped repo. `node_modules/`, `dist/`, `build/`, `.git/`,
`coverage/`, `out/`, `.cache/` are skipped when counting files for the
classifier.

---

## Hooking into the scheduler

The scheduler (separate subsystem, not this one) should:

1. Every 30 minutes, run:
   ```powershell
   pnpm install --dir tools/sample-collector 2>$null  # idempotent
   tsx tools/sample-collector/src/index.ts collect --out samples/ --max 5
   ```
2. Read `samples/INDEX.json` to enumerate samples for the next
   `orchestrate` pass. The default path is
   `D:\Projects\NB_EST\qiuzhi\vue-migrate\samples\INDEX.json`.
3. Pass each `entry.localPath` to `tools/orchestrate.ts --input ...`.

The collector never writes outside `samples/` and never deletes existing
samples — only adds.

---

## Configuration knobs

| Flag            | Default     | Notes                                  |
| --------------- | ----------- | -------------------------------------- |
| `--out`         | `samples`   | Output directory                       |
| `--max`         | `5`         | Max repos per query                    |
| `--since`       | `2020-01-01`| Earliest pushed-at                     |
| `--until`       | `2022-01-01`| Latest pushed-at (Vue 2 era cutoff)    |
| `--max-repo-kb` | `51200`     | Skip repos bigger than 50 MB unpacked  |
| `--sleep-ms`    | `100`       | Sleep between API calls                |
| `--dry-run`     | `false`     | Print the plan; no network / disk      |

---

## Library surface

```typescript
import {
  collect,                // alias of collectSamples
  collectSamples,
  classify,                // pure: input → SampleEntry
  classifyFromLocal,       // walks a local dir, calls classify
  DIVERSITY_QUERIES,
} from './tools/sample-collector/src/index.js'
```

`classify` is fully hermetic — pass a `package.json` string + a file path
list, get back a `SampleEntry`. The unit test
(`src/__tests__/classify.test.ts`) demonstrates every code path.
