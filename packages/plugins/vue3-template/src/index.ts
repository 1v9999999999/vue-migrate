/**
 * @vue-migrate/plugin-vue3-template
 *
 * P1 — 模板 & 脚本端 Vue2 → Vue3 兼容性规则
 *
 * 负责规则：
 *   2.1, 2.2  slot / slot-scope → <template #xxx>
 *   2.4       v-bind.sync → v-model:xxx
 *   2.5       $listeners → $attrs (script AST)
 *   2.6       $children  → manual review
 *   2.7       $scopedSlots → $slots (script AST)
 *   2.9       inline-template 移除
 *   2.10      $on / $off / $once → manual review
 *
 * 关键点：
 *   - template 改动后必须重写 file.source，并通过 sfc.template.loc 同步
 *     offset，否则 core codegen 会按旧 offset 切片错位。
 *   - 改完 file.source 后**不清空** scriptAst（保留给 codegen 用），
 *     而是仅调整 sfc 各 block 的 offset。
 *   - 优先级 = 9（在 vue2-compat=10 之后跑），这样 script AST
 *     已被 vue2-compat 处理过。
 */

import { registerPlugin, type TransformPlugin, type TransformContext } from '@vue-migrate/core'

import { replaceTemplateContent, findTemplateBlockRange } from './utils/sfc-source.js'
import { rewriteSlots } from './rules/slot-rewriting.js'
import { rewriteVbindSync } from './rules/vbind-sync.js'
import { removeInlineTemplate } from './rules/inline-template.js'
import { migrateScriptInstances } from './rules/script-instances.js'
import { removeNativeModifier } from './rules/native-modifier.js'
import { convertPrefixIconToSlot } from './rules/prefix-icon-to-slot.js'
import { reviewVAttrsVListeners, autoFixVOnAttrsListeners } from './rules/vbind-vattrs-vlisteners.js'

const plugin: TransformPlugin = {
  name: 'vue3-template',
  description:
    'Migrate Vue2 template (slot/slot-scope, v-bind.sync, inline-template) and script ($scopedSlots, $listeners, $children, $on/$off/$once) features to Vue3 idioms.',
  priority: 9, // run after vue2-compat (10)
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils, log } = ctx
    const messages: string[] = []

    // ========== 模板端规则（仅 .vue 文件） ==========
    if (file.kind === 'vue') {
      // prefer file.sfc.template.content; fallback to regex
      let template: string | null = file.sfc?.template?.content ?? null
      if (template === null) {
        const range = findTemplateBlockRange(file.source)
        if (range) {
          const block = file.source.slice(range.start, range.end)
          // 剥掉外层 <template> 和 </template>
          const openEnd = block.indexOf('>')
          if (openEnd >= 0) {
            template = block.slice(openEnd + 1, block.length - '</template>'.length)
          }
        }
      }

      if (template !== null) {
        // 1. slot / slot-scope 重写
        const slotResult = rewriteSlots(template)
        if (slotResult.changed) {
          for (const c of slotResult.changes) messages.push(c)
          for (const r of slotResult.reviewItems) utils.manualReview(r)

          const replaced = replaceTemplateContent(file, slotResult.out, 'slot → <template #xxx>')
          if (replaced.changed) {
            template = slotResult.out
          }
        }

        // 2. v-bind.sync → v-model:xxx
        const vbindResult = rewriteVbindSync(template)
        if (vbindResult.changed && vbindResult.changes.length > 0) {
          for (const c of vbindResult.changes) messages.push(c)
          for (const r of vbindResult.reviewItems) utils.manualReview(r)

          const replaced = replaceTemplateContent(file, vbindResult.out, 'v-bind.sync → v-model:xxx')
          if (replaced.changed) {
            template = vbindResult.out
          }
        } else if (vbindResult.changed) {
          for (const r of vbindResult.reviewItems) utils.manualReview(r)
        }

        // 3. inline-template 移除
        const inlineResult = removeInlineTemplate(template)
        if (inlineResult.changed) {
          for (const c of inlineResult.changes) messages.push(c)
          for (const r of inlineResult.reviewItems) utils.manualReview(r)

          const replaced = replaceTemplateContent(file, inlineResult.out, 'inline-template removed')
          if (replaced.changed) {
            template = inlineResult.out
          }
        }

        // 4. 移除 .native 修饰符
        const nativeResult = removeNativeModifier(template)
        if (nativeResult.changed) {
          for (const c of nativeResult.changes) messages.push(c)
          for (const r of nativeResult.reviewItems) utils.manualReview(r)

          const replaced = replaceTemplateContent(file, nativeResult.out, '.native modifier removed')
          if (replaced.changed) {
            template = nativeResult.out
          }
        }

        // 5. prefix-icon="el-icon-xxx" → <template #prefix><el-icon><Xxx /></el-icon></template>
        const prefixResult = convertPrefixIconToSlot(template)
        if (prefixResult.changed) {
          for (const c of prefixResult.changes) messages.push(c)
          for (const r of prefixResult.reviewItems) utils.manualReview(r)

          const replaced = replaceTemplateContent(file, prefixResult.out, 'prefix-icon → <template #prefix>')
          if (replaced.changed) {
            template = prefixResult.out
          }

          // 记录 icon 组件名，让后续 script 块 import
          if (prefixResult.iconImports.size > 0) {
            ;(file as any).__prefixIconImports = prefixResult.iconImports
          }
        }

        // 6. v-bind="$attrs" / v-on="$listeners" review 提示
        const vattrsResult = reviewVAttrsVListeners(template)
        if (vattrsResult.changed) {
          for (const c of vattrsResult.changes) messages.push(c)
          // iter-115: 降级为 ctx.log — v-bind="$attrs" Vue3 仍可用, v-on="$listeners"/"$attrs" 已被 autoFixVOnAttrsListeners 自动改
          //      真正的 inheritAttrs 设计选择属业务决策 (T2.6/T3.3 保留, 不强行改)
          for (const r of vattrsResult.reviewItems) ctx.log(`[vue3-template] ${r}`)
        }

        // 6.5. iter-112: 自动改 v-on="$listeners" / v-on="$attrs" → v-bind="$attrs"
        //   字符串级 replace, 不依赖 attr.start/end offset (避免跟 template offset 错位)
        //   review 提示跟 auto-fix 并行: 用户能看到 review 学到, 同时 source 也修了
        const autoFixed = autoFixVOnAttrsListeners(template)
        if (autoFixed !== template) {
          // 重新替换 template
          if (file.sfc?.template) {
            const tpl = file.sfc.template
            const start = tpl.loc.start.offset
            const end = tpl.loc.end.offset
            file.source = file.source.slice(0, start) + autoFixed + file.source.slice(end)
            // sync sfc loc (template 内容变了)
            tpl.loc.end.offset = start + autoFixed.length
            tpl.content = autoFixed
          }
          messages.push('[iter-112] auto-fixed v-on="$listeners"/"$attrs" → v-bind="$attrs"')
        }
      }
    }

    // ========== 脚本端规则 ==========
    if (file.scriptAst) {
      const scriptResult = migrateScriptInstances(file.scriptAst, utils.manualReview)
      if (scriptResult.modifications > 0) {
        messages.push(...scriptResult.changes)
        utils.markChanged()
      }
    }

    if (messages.length > 0) {
      log(messages.join('; '))
      utils.markChanged()
    }
  },
}

registerPlugin(plugin)
export default plugin
