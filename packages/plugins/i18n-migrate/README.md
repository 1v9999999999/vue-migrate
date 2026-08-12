# @vue-migrate/plugin-i18n-migrate

iter-121: vue-i18n v8 → v9 migration.

Vue I18n 9 is a major version bump with breaking changes from v8:

| v8 (Vue 2) | v9 (Vue 3) |
|---|---|
| `Vue.use(VueI18n)` | `app.use(i18n)` (in createApp) |
| `this.$t('key')` | `useI18n().t('key')` (or keep $t via plugin) |
| `this.$i18n.locale = 'zh'` | `useI18n().locale.value = 'zh'` (locale is ref) |
| `messages: { en: {...}, zh: {...} }` | same shape, but loaded async |
| `i18n.t('key', { x: 1 })` | same |
| `v-t="'key'"` directive | removed — use `t()` in JS or `<i18n-t>` component |

## What this plugin does

**Script AST side** (browses through `@babel/traverse`):

- Detect `this.$t(...)` / `this.$tc(...)` calls — emit **review** hint to use `useI18n().t(...)`.
- Detect `this.$i18n.locale = ...` assignment — emit **review** hint to use `useI18n().locale.value`.
- Detect `Vue.use(VueI18n)` — emit **review** hint to use `app.use(i18n)`.
- Detect `import VueI18n from 'vue-i18n'` (default import) — emit **review** hint to use `import { createI18n } from 'vue-i18n'`.

**Template side** (string scan, no AST):

- Detect `{{ $t('xxx') }}` / `{{ $tc('xxx') }}` — emit **review** hint unless the file already imports `useI18n` (then it's safe to rewrite to `{{ t('xxx') }}`).

**Files that already use `<script setup>` with `useI18n()` are no-ops** (e.g. I18nV9.vue in the gap test).

## Priority

`30` — runs after `composition` (priority 0) so the composition migration has had a chance to convert options API → `<script setup>` first. If a file is already converted, the i18n script patterns are no longer there (they used `this.$t` which composition would have turned into `const { t } = useI18n()`).

## File kinds

`vue`, `js`, `ts` — same as the rest of the pipeline.
