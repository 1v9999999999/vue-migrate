/**
 * tools/sample-collector/src/queries.ts
 *
 * GitHub search queries that drive the diversity matrix.
 *
 * Each query is intentionally narrow so the resulting repos skew into a
 * specific bucket of the matrix (state management, router, UI lib, scale,
 * TypeScript, etc). A single iteration of the collector hits every query
 * in this file and stitches the union into `samples/INDEX.json`.
 *
 * Why this lives in its own file:
 *   - Schedulers/tests import DIVERSITY_QUERIES without dragging the rest of
 *     the collector in.
 *   - Editing the matrix is a 1-file change.
 */

export interface DiversityQuery {
  /** Stable machine name (used in logs, INDEX metadata). */
  name: string
  /** Human readable bucket label (state / router / ui / scale / ts). */
  bucket: 'state' | 'router' | 'ui' | 'scale' | 'ts'
  /** Raw GitHub search query string. */
  q: string
  /** Optional: sort override. GitHub default is "best match". */
  sort?: 'stars' | 'updated' | 'forks'
}

export const DIVERSITY_QUERIES: DiversityQuery[] = [
  // ───── state management ─────
  {
    name: 'vuex',
    bucket: 'state',
    q: 'language:Vue stars:>50 archived:false pushed:<2022-01-01 "new Vuex.Store"',
  },
  {
    name: 'pinia_early',
    bucket: 'state',
    q: 'language:Vue stars:>20 archived:false pushed:<2022-06-01 "defineStore"',
  },

  // ───── router ─────
  {
    name: 'vue_router',
    bucket: 'router',
    q: 'language:Vue stars:>50 archived:false pushed:<2022-01-01 "Vue.use(Router)"',
  },
  {
    name: 'no_router',
    bucket: 'router',
    q: 'language:Vue stars:>50 archived:false pushed:<2022-01-01 "new Vue({"',
  },

  // ───── UI library ─────
  {
    name: 'element_ui',
    bucket: 'ui',
    q: 'language:Vue stars:>50 archived:false pushed:<2022-01-01 "element-ui"',
  },
  {
    name: 'vant',
    bucket: 'ui',
    q: 'language:Vue stars:>30 archived:false pushed:<2022-01-01 "vant"',
  },
  {
    name: 'iview',
    bucket: 'ui',
    q: 'language:Vue stars:>30 archived:false pushed:<2022-01-01 "iview"',
  },

  // ───── scale ─────
  {
    name: 'small',
    bucket: 'scale',
    q: 'language:Vue stars:10..200 archived:false pushed:<2022-01-01',
  },
  {
    name: 'large',
    bucket: 'scale',
    q: 'language:Vue stars:>500 archived:false pushed:<2022-01-01',
  },

  // ───── TypeScript support ─────
  {
    name: 'ts',
    bucket: 'ts',
    q: 'language:Vue stars:>30 archived:false pushed:<2022-01-01 "lang=\\"ts\\""',
  },
]
