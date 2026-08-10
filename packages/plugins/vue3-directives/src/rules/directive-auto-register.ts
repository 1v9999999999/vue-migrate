/**
 * iter-048a F6: 扫 directive 子目录的 index.js + main.js,自动注入 import + .use() chain
 *
 * 场景:
 *   原项目有 src/directive/waves/index.js,里面有 `install` 字段。
 *   模板里用 <el-button v-waves> 但 main.js 没 import 也没 .use()。
 *   Vue 2 时代是因为 main.js 顶部调了 `Vue.use(wavesInstall)` (虽然 B 版本没看到)。
 *   Vue 3 时代这个调用必须显式写。
 *
 * 改写策略:
 *   1. 扫 outDir/src/directive/(xxx)/index.js  提取 directive 名 (e.g. 'waves')
 *      - 解析 index.js 找 `app.directive('xxx', ...)` 或 `<module>.install = function(app) { app.directive('xxx', ...) }`
 *   2. 读 main.js 源码
 *   3. 检查 main.js 是否已经 import 这个 directive (从路径包含 directive 名)
 *   4. 如果没 import:
 *      - 在最后一个 import 之后加 `import Xxx from './directive/xxx'`
 *      - 在 `createApp(...).use(router)` chain 里加 `.use(Xxx)`
 *   5. 写回 main.js
 *
 * 实现用纯文本 + 正则 (避免 AST 解析 babel 包开销,main.js 简单)。
 */

import { readFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'

/** 从 directive/xxx/index.js 源码里找 app.directive('xxx', ...) 的名字 */
export function extractDirectiveName(source: string): string | null {
  // 匹配 app.directive('foo', ...) 或 .directive("foo", ...)
  const m = source.match(/\.directive\(\s*['"]([\w-]+)['"]\s*,/)
  if (m) return m[1]
  // 匹配 Vue.directive('foo', ...) (老语法,有些文件可能没被 vue3-directives 改过)
  const m2 = source.match(/Vue\.directive\(\s*['"]([\w-]+)['"]\s*,/)
  if (m2) return m2[1]
  return null
}

/** 把 directive 子目录名转成 PascalCase (e.g. 'el-drag-dialog' → 'ElDragDialog', 'waves' → 'Waves') */
export function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

/** 扫 directive 子目录的 index.js 拿 (name, dir, importPath) */
async function scanDirectives(
  directiveFiles: string[],
  mainPath: string,
): Promise<Array<{ name: string; dirName: string; importPath: string }>> {
  const out: Array<{ name: string; dirName: string; importPath: string }> = []
  for (const f of directiveFiles) {
    let src: string
    try {
      src = await readFile(f, 'utf-8')
    } catch {
      continue
    }
    const name = extractDirectiveName(src)
    if (!name) continue
    // import 路径: main.js 在 src/main.js,directive 在 src/directive/xxx/index.js
    // 相对 import: './directive/xxx' (始终带 ./ 前缀,即使同一目录)
    const dir = dirname(f)
    const dirName = dir.split(/[\\/]/).pop() || ''
    let rel = relative(dirname(mainPath), f).replace(/\\/g, '/').replace(/\/index\.js$/, '')
    // ESM relative import 必须以 ./ 或 ../ 开头,否则 Node 解析成 bare specifier
    if (!rel.startsWith('./') && !rel.startsWith('../')) {
      rel = './' + rel
    }
    out.push({ name, dirName, importPath: rel })
  }
  return out
}

export interface AutoRegisterResult {
  modified: boolean
  content: string
  injected: string[]
}

/** 主函数:在 main.js 里注入 import + .use() for each directive */
export async function autoRegisterDirectivesInMain(
  mainPath: string,
  directiveFiles: string[],
): Promise<AutoRegisterResult> {
  let mainSrc: string
  try {
    mainSrc = await readFile(mainPath, 'utf-8')
  } catch {
    return { modified: false, content: '', injected: [] }
  }

  const directives = await scanDirectives(directiveFiles, mainPath)
  if (directives.length === 0) {
    return { modified: false, content: mainSrc, injected: [] }
  }

  return autoRegisterDirectivesInMemoryFromMeta(
    mainSrc,
    mainPath,
    directives.map(d => ({ name: d.name, importPath: d.importPath, dirName: d.dirName })),
  )
}

/**
 * iter-048a F6 in-memory 版本 — 不读文件,直接处理 string
 * 在 analyze 钩子里调用,这时 main.js source 还在 ctx.files 里
 */
export function autoRegisterDirectivesInMemory(
  mainSrc: string,
  mainPath: string,
  directiveEntries: Array<{ source: string; path: string }>,
): AutoRegisterResult {
  // 从每个 directive 源码提 directive 名 + 计算 import path
  const directives: Array<{ name: string; dirName: string; importPath: string }> = []
  for (const e of directiveEntries) {
    const name = extractDirectiveName(e.source)
    if (!name) continue
    // dirName = 路径里 directive 后面那一段
    const m = e.path.match(/[\\/]([\w-]+)(?:[\\/]index)?\.(?:js|ts)$/i)
    const dirName = m ? m[1] : name
    // import 路径: 相对 mainPath
    const idx = e.path.replace(/\\/g, '/')
    let rel = relative(dirname(mainPath.replace(/\\/g, '/')), idx)
      .replace(/\/index\.(js|ts)$/, '')
    if (!rel.startsWith('./') && !rel.startsWith('../')) {
      rel = './' + rel
    }
    directives.push({ name, dirName, importPath: rel })
  }

  if (directives.length === 0) {
    return { modified: false, content: mainSrc, injected: [] }
  }

  return autoRegisterDirectivesInMemoryFromMeta(mainSrc, mainPath, directives)
}

/** 内部:对 (name, dirName, importPath) 列表做 main.js 注入 */
function autoRegisterDirectivesInMemoryFromMeta(
  mainSrc: string,
  mainPath: string,
  directives: Array<{ name: string; dirName: string; importPath: string }>,
): AutoRegisterResult {
  const injected: string[] = []
  let cur = mainSrc

  for (const d of directives) {
    // 1. 检查 main.js 是否已经 import
    const pascal = toPascalCase(d.dirName)
    // 多种可能的本地变量名
    const localCandidates = [pascal, d.dirName, d.name]
    const hasImport = localCandidates.some(loc =>
      new RegExp(`import\\s+.*\\b${loc}\\b.*from\\s+['"].*${escapeRegExp(d.dirName)}['"]`).test(cur),
    )
    if (hasImport) {
      // 已经 import 了 — 检查 .use 是否已经存在
      const hasUse = localCandidates.some(loc => new RegExp(`\\.use\\s*\\(\\s*${loc}\\b`).test(cur))
      if (!hasUse) {
        // import 了但没用 — 注入 .use()
        cur = injectUseCall(cur, localCandidates[0])
        injected.push(`${d.name}: 已 import, 注入 .use(${localCandidates[0]})`)
      }
      continue
    }

    // 2. 没 import — 加 import + .use()
    cur = injectImport(cur, pascal, d.importPath)
    cur = injectUseCall(cur, pascal)
    injected.push(`${d.name}: import { default as ${pascal} } from '${d.importPath}' + .use(${pascal})`)
  }

  return { modified: cur !== mainSrc, content: cur, injected }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 在 main.js 顶部最后一个 import 后插入 import 语句 */
function injectImport(source: string, localName: string, importPath: string): string {
  // 找最后一个 import 语句的结束位置
  const lines = source.split('\n')
  let lastImportEnd = -1
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trimStart()
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      // 多行 import: 找到闭合的行
      let j = i
      let openBraces = (line.match(/\{/g) || []).length
      let closeBraces = (line.match(/\}/g) || []).length
      while (j < lines.length - 1 && openBraces > closeBraces) {
        j++
        openBraces += (lines[j].match(/\{/g) || []).length
        closeBraces += (lines[j].match(/\}/g) || []).length
      }
      lastImportEnd = j
      i = j + 1
    } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed === '') {
      i++
    } else {
      // 非 import / 非空 / 非注释: 找 import 段结束
      break
    }
  }

  const newImportLine = `import ${localName} from '${importPath}';`

  if (lastImportEnd < 0) {
    // 没有任何 import — 插到文件顶部
    return newImportLine + '\n' + source
  }
  // 在 lastImportEnd 之后插入
  lines.splice(lastImportEnd + 1, 0, newImportLine)
  return lines.join('\n')
}

/** 在 createApp(...).use(...).mount(...) chain 里加 .use(localName) */
function injectUseCall(source: string, localName: string): string {
  // 找第一个 .mount('#app') 或 .mount("#app")
  // 在它前面插入 .use(localName)
  // 模式: .use(router).use(store).mount("#app")
  //   → .use(router).use(store).use(localName).mount("#app")
  // 或模式: .use(router).mount("#app")
  //   → .use(router).use(localName).mount("#app")

  // 简单做法: 在 .mount 之前插入 .use(localName).
  // 注意可能有 .use(ElementPlus, {...}) 这种带 options 的,我们不破坏它的 args。
  // 用 .use(<localName>).mount 替换 .mount
  const re = /(\.use\([^)]*\))(\.mount\()/
  const newSrc = source.replace(re, (_m, usePart, mountPart) => {
    return `${usePart}.use(${localName})${mountPart}`
  })

  if (newSrc === source) {
    // 没有 .use chain, 只有 .mount — 在 .mount 前插入
    return source.replace(/(\.mount\()/, `.use(${localName})$1`)
  }
  return newSrc
}
