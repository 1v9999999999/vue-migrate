#!/usr/bin/env node
/**
 * tools/sample-collector/src/index.ts
 *
 * CLI entry + library surface for the sample-collector.
 *
 * Usage (Windows):
 *   tsx tools/sample-collector/src/index.ts --help
 *   tsx tools/sample-collector/src/index.ts collect --out samples/ --max 3
 *   tsx tools/sample-collector/src/index.ts collect --out samples/test-only --max 1 --dry-run
 *   tsx tools/sample-collector/src/index.ts classify --sample examples/vue2-manage-master
 *
 * Library surface (re-exported for scheduler / agent use):
 *   import { collect, collectSamples, classify, classifyFromLocal, DIVERSITY_QUERIES } from '.../index.js'
 */

import { Command } from 'commander'
import { resolve as pathResolve } from 'node:path'

import { collectSamples, type CollectOptions } from './collect.js'
import { classify, classifyFromLocal, type SampleEntry } from './classify.js'
import { DIVERSITY_QUERIES } from './queries.js'

const program = new Command()

program
  .name('vue-migrate-collect')
  .description('Collects real Vue 2 repos from GitHub to seed the migration test sample library.')
  .version('0.1.0')

program
  .command('collect')
  .description('Run one full collect pass against every DIVERSITY_QUERIES entry.')
  .option('--out <dir>', 'Output directory for staged samples + INDEX.json', 'samples')
  .option('--max <n>', 'Max repos per search query', (v) => parseInt(v, 10), 5)
  .option('--since <iso>', 'Earliest pushed-at cutoff', '2020-01-01')
  .option('--until <iso>', 'Latest pushed-at cutoff', '2022-01-01')
  .option('--token <token>', 'GitHub token (falls back to GITHUB_TOKEN env var)')
  .option('--max-repo-kb <kb>', 'Skip repos whose declared size exceeds this (KB)', (v) => parseInt(v, 10), 50 * 1024)
  .option('--sleep-ms <ms>', 'Sleep between API calls in ms', (v) => parseInt(v, 10), 100)
  .option('--index <path>', 'Override INDEX.json path')
  .option('--dry-run', 'Print the query plan without making any network calls', false)
  .action(async (opts: {
    out: string
    max: number
    since: string
    until: string
    token?: string
    maxRepoKb: number
    sleepMs: number
    index?: string
    dryRun: boolean
  }) => {
    const outDir = pathResolve(opts.out)
    const collectOpts: CollectOptions = {
      outDir,
      maxPerQuery: Number.isFinite(opts.max) ? opts.max : 5,
      since: opts.since,
      until: opts.until,
      token: opts.token,
      maxRepoKB: Number.isFinite(opts.maxRepoKb) ? opts.maxRepoKb : 50 * 1024,
      sleepMs: Number.isFinite(opts.sleepMs) ? opts.sleepMs : 100,
      indexPath: opts.index ? pathResolve(opts.index) : undefined,
      dryRun: Boolean(opts.dryRun),
    }
    try {
      const added = await collectSamples(collectOpts)
      console.log(`\n[cli] INDEX: ${collectOpts.indexPath ?? outDir + '/INDEX.json'}`)
      console.log(`[cli] total entries added in this pass: ${added.length}`)
      if (!added.length && !collectOpts.dryRun) {
        // Exit 0 — empty pass is a valid steady state.
        process.exitCode = 0
      }
    } catch (e) {
      console.error(`[cli] collect failed: ${(e as Error).message}`)
      process.exit(2)
    }
  })

program
  .command('classify')
  .description('Classify a local sample directory and print the resulting SampleEntry.')
  .requiredOption('--sample <dir>', 'Path to the local sample directory')
  .option('--org <org>', 'Override org (otherwise derived from directory name)', '')
  .option('--repo <repo>', 'Override repo (otherwise derived from directory name)', '')
  .option('--sha <shortSha>', 'Short sha to record (default: 0000000 for local samples)', '0000000')
  .option('--stars <n>', 'Override stars', (v) => parseInt(v, 10), 0)
  .option('--json', 'Print raw JSON only (no pretty headers)', false)
  .action(async (opts: {
    sample: string
    org: string
    repo: string
    sha: string
    stars: number
    json: boolean
  }) => {
    const localPath = pathResolve(opts.sample)
    // Default org/repo derivation: the directory name is e.g.
    // "vue2-manage-master" or "org__repo__sha". We split on `__` and fall
    // back to the bare name as repo, org=local.
    let org = opts.org
    let repo = opts.repo
    if (!org || !repo) {
      const base = localPath.split(/[\\/]/).pop() || 'local'
      const parts = base.split('__')
      if (parts.length >= 3) {
        org = org || parts[0]
        repo = repo || parts[1]
      } else {
        org = org || 'local'
        repo = repo || base
      }
    }
    try {
      const entry = await classifyFromLocal(localPath, {
        org,
        repo,
        shortSha: opts.sha,
        stars: opts.stars,
      })
      if (opts.json) {
        process.stdout.write(JSON.stringify(entry, null, 2) + '\n')
      } else {
        console.log('SampleEntry:')
        console.log(JSON.stringify(entry, null, 2))
      }
    } catch (e) {
      console.error(`[cli] classify failed: ${(e as Error).message}`)
      process.exit(2)
    }
  })

// Bare `--help` / no-args handler. commander prints help on its own, but we
// add the diversity matrix listing so operators can sanity-check coverage
// without grep'ing queries.ts.
function printDiversityMatrix(): void {
  console.log('\nDiversity matrix (queries that drive every collect pass):')
  const byBucket = new Map<string, typeof DIVERSITY_QUERIES>()
  for (const q of DIVERSITY_QUERIES) {
    const arr = byBucket.get(q.bucket) ?? []
    arr.push(q)
    byBucket.set(q.bucket, arr)
  }
  for (const [bucket, queries] of byBucket) {
    console.log(`  [${bucket}]`)
    for (const q of queries) {
      console.log(`    - ${q.name}`)
    }
  }
  console.log('')
}

const argv = process.argv.slice(2)

// Special-case: bare invocation with no args → show help + matrix and exit.
if (argv.length === 0) {
  program.outputHelp()
  printDiversityMatrix()
  process.exit(0)
}

// When invoked with just `-h` / `--help`, print help and the matrix and exit.
if (argv.length === 1 && (argv[0] === '-h' || argv[0] === '--help')) {
  program.outputHelp()
  printDiversityMatrix()
  process.exit(0)
}

// `program.parse` triggers help when given `--help` automatically, and
// dispatches the `collect` / `classify` subcommands otherwise. We use
// `from: 'user'` because we're already passing only the user args (we
// sliced off node + script in `argv = process.argv.slice(2)` above).
program.parse(argv, { from: 'user' })

// Library re-exports
export { collectSamples as collect, classify, classifyFromLocal, DIVERSITY_QUERIES }
export type { CollectOptions, SampleEntry }
