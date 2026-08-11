/**
 * @vue-migrate/plugin-this-replacer
 *
 * Vue 2 项目里非常常见的一类模式: 把工具方法 / http 客户端 / eventBus / 全局 store
 * 挂到 Vue.prototype 上,然后在组件里通过 `this.$http` / `this.$axios` / `this.$api`
 * / `this.$util` / `this.$bus` 等形式调用。
 *
 * Vue 3 移除了 Vue.prototype 注入,所有这类属性需要在 setup() 顶部显式 import 或通过
 * inject() 拿。本 plugin 负责:
 *
 *   1) 扫描文件里的 this.$XXX 使用,XXX ∈ 内置白名单
 *   2) 如果当前文件已经有同名(或别名)的 import,自动把 this.$XXX 替换为该 import 名
 *      (字符串级 — 这样在 composition 已经走 useRawSource 之后也能正确处理)
 *   3) 否则标 manualReview,告诉用户"建议在 setup 顶部加 import"
 *
 * 默认白名单:
 *   - 网络层: http, axios, fetch, api, request, service, httpClient
 *   - 工具:   util, utils, common, helper, helpers
 *   - 状态:   bus, eventBus, event, emitter
 *   - 路由:   route, router (低优先级 — 容易误判)
 *
 * 策略:
 *   - priority 5 (在 composition 0 之后,import-cleaner -1 之前)
 *   - 字符串级 replace,既兼容 file.source 已被 composition 改写的情况
 *     (composition 在 transform 阶段会读 file.source 并 replace),也兼容 AST 阶段
 *   - 不修改 AST,只标 review + 改 file.source
 *   - 单测覆盖 6 个核心场景
 */

// @ts-ignore — babel/traverse 在 ESM 下没有 .d.ts
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

/** 内置白名单:this.$XXX 的 XXX 部分 */
const BUILTIN_THIS_DOLLAR = new Set([
  // 网络层
  'http',
  'axios',
  'fetch',
  'api',
  'request',
  'service',
  'httpClient',
  '$http', // 防御:本身写了 $http
  // 工具
  'util',
  'utils',
  'common',
  'helper',
  'helpers',
  'lodash',
  // 事件总线
  'bus',
  'eventBus',
  'emitter',
  'event',
  // 路由相关 (低优,先标 review)
  'route',
])

/**
 * 尝试在文件源码里找到"网络层"模块的 import 别名。
 *
 * 扫描的 import source 类型:
 *   - 'axios'
 *   - '@/utils/request' / '@/request' / '@/http'
 *   - '@/api/xxx' / '@/api' / '@/services/xxx' / '@/service/xxx'
 *
 * 返回的是 import 语句里的"本地 alias"名 (即 `import X from '...'` 中的 X),
 * 由 caller 决定是否适合替换 `this.$hint`。
 *
 * 如果没找到,返回 null。
 */
function findImportAliasFor(
  source: string,
  _hint: string,
): string | null {
  // 1) 默认 import: import <alias> from 'axios' / '@/utils/request' / ...
  const defaultRe =
    /\bimport\s+(\w+)\s+from\s+['"](?:axios|@?\/utils\/request|@?\/api(?:\/[\w-]+)?|@?\/services?(?:\/[\w-]+)?|@?\/http|@?\/request)['"]/
  const m1 = source.match(defaultRe)
  if (m1) {
    return m1[1]
  }

  // 2) named import: import { xxx as alias } from 'axios' / '@/utils/request' / ...
  const namedRe =
    /\bimport\s*\{([^}]+)\}\s*from\s+['"](?:axios|@?\/utils\/request|@?\/api(?:\/[\w-]+)?|@?\/services?(?:\/[\w-]+)?|@?\/http|@?\/request)['"]/
  const m2 = source.match(namedRe)
  if (m2) {
    const specs = m2[1]
    // 2a) `request as alias` / `axios as alias` 优先
    const asRe = /\b(request|axios)\s+as\s+(\w+)\b/
    const m3 = specs.match(asRe)
    if (m3) return m3[2]
    // 2b) 直接 `request` / `axios`
    const plainRe = /\b(axios|request)\b/
    const m4 = specs.match(plainRe)
    if (m4) return m4[1]
    // 2c) 第一个标识符 (兜底)
    const anyRe = /\b(\w+)\b/
    const m5 = specs.match(anyRe)
    if (m5) return m5[1]
  }

  return null
}

/**
 * 主 transform:扫描 this.$X 出现位置,根据 import 情况做替换或标 review。
 */
function applyThisReplacer(file: any, utils: any): void {
  if (!file.source) return

  const source: string = file.source
  // 1) 收集所有 this.$X 出现的位置 (X 在白名单)
  const usageRe = /\bthis\.(\$?\$?[A-Za-z_]\w*)\b/g
  const hits: Array<{ full: string; name: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = usageRe.exec(source)) !== null) {
    const raw = m[1]
    // 去掉前导 $: $axios → axios, $$bus → bus
    const name = raw.replace(/^\$+/, '')
    if (BUILTIN_THIS_DOLLAR.has(raw) || BUILTIN_THIS_DOLLAR.has(name)) {
      hits.push({ full: m[0], name, index: m.index })
    }
  }
  if (hits.length === 0) return

  // 2) 去重,按 name 分组
  const byName = new Map<string, number>()
  for (const h of hits) {
    byName.set(h.name, (byName.get(h.name) || 0) + 1)
  }

  // 3) 对每个 name,尝试自动替换
  // 策略: 只在 alias 是 'axios' / 'request' 时才认为"匹配"。其他 import
  //  (例如 import Vue from 'vue') 跟 this.$http 没有关系,不能盲目替换。
  let modified = false
  let cur = source
  for (const [name, count] of byName) {
    const alias = findImportAliasFor(cur, name)
    if (alias && (alias === 'axios' || alias === 'request' || alias === 'http' || alias === 'service' || alias === 'api')) {
      // 自动替换: this.$http → alias
      const replaceRe = new RegExp(String.raw`\bthis\.(\$+)?${name}\b`, 'g')
      const replaced = cur.replace(replaceRe, alias)
      if (replaced !== cur) {
        cur = replaced
        file.source = replaced
        modified = true
        utils.markChanged(`this.$${name} → ${alias} (${count} 处)`)
      }
    } else {
      // 标 review
      utils.manualReview(
        `this.$${name} 出现 ${count} 次,但本文件未发现 axios/request 类的 import。请在 <script setup> 顶部加 ` +
          `\`import ${name === 'http' || name === 'axios' || name === 'fetch' ? 'axios' : name} from '...'\` ` +
          `或通过 inject() 注入,然后把 this.$${name} 改为该变量。`,
      )
    }
  }
}

const plugin: TransformPlugin = {
  name: 'this-replacer',
  description:
    'Detect Vue2 prototype-injected properties (this.$http / $axios / $api / $bus / etc.) and either auto-rewrite to a discovered import or mark for manual review.',
  priority: 5, // 在 composition(0) 之后,import-cleaner(-1) 之前
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    applyThisReplacer(file, utils)
  },
}

// 单测入口
export const _testable_applyThisReplacer = applyThisReplacer
export const _testable_findImportAliasFor = findImportAliasFor

registerPlugin(plugin)
export default plugin
