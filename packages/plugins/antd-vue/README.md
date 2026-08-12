# @vue-migrate/plugin-antd-vue

iter-121: ant-design-vue 1.x (Vue 2) → 2.x (Vue 3) migration.

Ant Design Vue 2.x is the Vue 3 compatible major. Breaking changes from 1.x:

| 1.x (Vue 2) | 2.x (Vue 3) | Action |
|---|---|---|
| `<a-form-model>` | `<a-form>` | **auto-rename** |
| `v-decorator="['field', { rules: [...] }]"` | `form.useForm()` + `<a-form-item name="field" :rules="[...]">` | **review** (no auto — design change) |
| `@click="..."` on `<a-modal>` (with no `@ok` / `@cancel`) | `@ok` / `@cancel` events | **review** |
| `this.$form.createForm(this)` | `Form.useForm(...)` | **review** |
| `form.validateFields((err, values) => ...)` callback | `await form.validateFields()` (Promise) | **review** |
| `slot="title"` | `#title` | already handled by vue3-template |
| `<a-icon type="search" />` | use `@ant-design/icons-vue` separately | **review** (icon migration is its own concern) |
| `<a-tree-select :treeData="data" :replaceFields="{...}">` | `fieldNames` instead of `replaceFields` | **review** |
| `<a-cascader :fieldNames="{...}">` | same | no-op (already correct name) |

## What this plugin does

### Auto-rename (no review)

- `<a-form-model ...>` → `<a-form ...>` (open + close tags)
- `import { Form } from 'ant-design-vue'` — keep (Form is still the export, but `<a-form-model>` is gone)

### Reviews (no auto)

- `v-decorator="..."` on any element — review "use Form.useForm() + form-item name prop"
- `@click` on `<a-modal>` (when there's no `@ok` / `@cancel` already) — review "split into @ok and @cancel events"
- `this.$form.createForm(this)` — review
- `form.validateFields(cb)` callback form — review "convert to await form.validateFields()"
- `<a-tree-select :replaceFields="...">` — review "rename replaceFields → fieldNames"

## Priority

`26` — runs after `elementui` (priority 25) so that elementui rules don't accidentally touch antd components. It runs **after** `vue3-template` (9) so that `slot="title"` etc. have already been converted by vue3-template. Priority is 26 because in priority sort, higher numbers run first (per `getPlugins()`); 26 > 25 > 9 > 0, so antd-vue runs before elementui. That's actually OK because antd-vue only touches `a-` prefixed tags that elementui doesn't touch.

## File kinds

`vue`, `js`, `ts` — only operates on files that have an `ant-design-vue` import or `a-*` antd component usage in template.
