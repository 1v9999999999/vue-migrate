/**
 * iter-121: vue-i18n v8 → v9 模板端规则
 *
 * 检测 (template 字符串端, 不解析 AST):
 *   1. {{ $t('xxx') }} / {{ $tc('xxx') }}      → review
 *      (除非文件已有 useI18n import, 此时可以放心改 {{ $t → {{ t)
 *   2. :title="$t('xxx')" 等 prop 绑定          → review
 *
 * 设计：
 *   - 字符串扫描，不解析 template AST (避免依赖 @vue/compiler-dom)
 *   - 简单 regex, 处理 {{ ... }} 和 属性值
 *   - 改不改由 hasUseI18n 决定：有 useI18n import → 自动改 t( ); 没有 → review
 *
 * 复用 elementui 的 template-scanner 解析 attr 文本，但我们这里 regex 简化
 * 处理 (模板里 $t 通常是简单调用, 不需要完整 attr parser)
 */

import { replaceTemplateContent } from '../utils/sfc-source.js'

export interface I18nTemplateResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

/**
 * 匹配 {{ ... }} 内 $t(...) / $tc(...) 调用
 *  - {{ $t('key') }}
 *  - {{ $t('key', { name: 'vue' }) }}
 *  - {{ $tc('key', n) }}
 */
const MUSTACHE_T_RE = /\{\{\s*(\$t|\$tc)\s*\(/g

/** 匹配属性值里的 $t(...): :title="$t('key')" 或 :title="$t('key', { x: 1 })" */
const ATTR_T_RE = /("[^"]*"|'[^']*')(\s*=\s*["'])([^"']*\$t\(|[^"']*\$tc\()/g
// 简化: 用一个更直接的 regex: 在属性值 (双引号或单引号) 里找 $t( / $tc(
const ATTR_T_SIMPLE_RE = /([:=])\s*["']([^"']*?\$(?:t|tc)\s*\([^"']*?)["']/g

export function transformI18nTemplate(
  template: string,
  hasUseI18n: boolean,
): I18nTemplateResult {
  const reviewItems: string[] = []
  const changes: string[] = []
  let out = template

  if (hasUseI18n) {
    // 自动改: 文本级替换 $t( → t(, $tc( → t(
    //   - 这种简单替换对 mustache 和 attribute 值都安全
    //   - 前提: useI18n 解构出 t() — 用户得自己保证
    //   - 不动 '$tc' 单独出现: $tc → t 是合理的(v9 plural 用 t(key, n))
    const before = out
    out = out.replace(/\$t(c?)\s*\(/g, (_m, c) => `t(`)
    if (out !== before) {
      changes.push(`vue-i18n v8 → v9: $t(/$tc( → t( (template)`)
    }
  } else {
    // 标 review 模式: 扫 mustache + 属性值
    // 1. {{ $t('xxx') }} / {{ $tc('xxx') }}
    const mustacheTRe = /\{\{\s*(\$t|\$tc)\s*\([^}]*\}\}/g
    let m: RegExpExecArray | null
    while ((m = mustacheTRe.exec(out))) {
      reviewItems.push(
        `{{ ${m[1]}('...') }} — vue-i18n v9 需在 <script setup> 引入 useI18n() 后改用 {{ t('...') }}`,
      )
    }
    // 2. 属性值: :title="$t('xxx')" / :title='$t("xxx")' / 任意 prop/event
    // 简化: 扫整个模板, 找 "$t(" / "$tc(" 出现在双引号或单引号值内
    const attrTRe = /(\s|:)([\w-]+)\s*=\s*(["'])([^"']*\$t\(|[^"']*\$tc\()/g
    const seenAttrs = new Set<string>()
    while ((m = attrTRe.exec(out))) {
      const attrName = m[2]
      if (seenAttrs.has(attrName)) continue
      seenAttrs.add(attrName)
      reviewItems.push(
        `${attrName}="$t('...')" 属性 — vue-i18n v9 需在 <script setup> 引入 useI18n() 后改用 ${attrName}="t('...')"`,
      )
    }
  }

  const changed = out !== template
  return { out, changed, changes, reviewItems }
}

/** 在 ctx 里跑整个 template 转换 pipeline */
export function applyTemplateTransform(ctx: any, hasUseI18n: boolean, markMessage: string): void {
  if (!ctx.file.kind || ctx.file.kind !== 'vue') return

  // 优先用 file.sfc.template.content；fallback 用正则
  let template: string | null = ctx.file.sfc?.template?.content ?? null
  if (template === null) return

  const result = transformI18nTemplate(template, hasUseI18n)

  // 先 push review items (不管改没改)
  for (const r of result.reviewItems) ctx.utils.manualReview(r)

  if (!result.changed) return

  const replaced = replaceTemplateContent(ctx.file, result.out, markMessage)
  if (replaced.changed) {
    ctx.utils.markChanged(markMessage)
  }
}
