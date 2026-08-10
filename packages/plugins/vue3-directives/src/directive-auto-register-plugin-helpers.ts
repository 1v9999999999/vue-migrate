/**
 * iter-048a F6 helpers — exported for testability
 *
 * 把 directive-auto-register-plugin.ts 的核心逻辑拆出来,
 * 供单测直接测 AST 注入。
 */

import _generate from '@babel/generator'
import * as t from '@babel/types'
import { relative as pathRelative, dirname } from 'node:path'
import type { FileNode } from '@vue-migrate/core'

import {
  extractDirectiveName,
  toPascalCase,
} from './rules/directive-auto-register.js'

const generate = (_generate as any).default || _generate

/** Check if file is main.js (entry) */
export function isMainFile(file: FileNode): boolean {
  return /[\\/]src[\\/]main\.(js|ts|vue)$/i.test(file.path)
}

/** Collect all directive files with install field from project */
export function collectDirectivesFromProject(
  project: { files: Map<string, FileNode> },
): Array<{ name: string; dirName: string; importPath: string }> {
  const out: Array<{ name: string; dirName: string; importPath: string }> = []
  for (const [path, f] of project.files) {
    if (f.kind !== 'js' && f.kind !== 'ts') continue
    const m = /[\\/](directives?)[\\/]([\w-]+)(?:[\\/]index)?\.(js|ts)$/i.exec(path)
    if (!m) continue
    const dirName = m[2]
    const name = extractDirectiveName(f.source)
    if (!name) continue
    const idx = path.replace(/\\/g, '/')
    const mainIdx = findMainFilePath(project)
    if (!mainIdx) continue
    const rel = pathRelative(dirname(mainIdx), idx).replace(/\\/g, '/').replace(/\/index\.(js|ts)$/, '')
    const importPath = rel.startsWith('./') || rel.startsWith('../') ? rel : './' + rel
    out.push({ name, dirName, importPath })
  }
  return out
}

export function findMainFilePath(project: { files: Map<string, FileNode> }): string | null {
  for (const [path, f] of project.files) {
    if (f.metadata?.isEntry && (f.kind === 'js' || f.kind === 'ts')) return path.replace(/\\/g, '/')
  }
  for (const [path, f] of project.files) {
    if (f.kind === 'js' || f.kind === 'ts') {
      if (/[\\/]src[\\/]main\.(js|ts)$/i.test(path)) return path.replace(/\\/g, '/')
    }
  }
  return null
}

/** Inject import + .use() for each directive into main.js AST. Returns count. */
export function injectDirectivesIntoMainAst(
  file: FileNode,
  directives: Array<{ name: string; dirName: string; importPath: string }>,
  _project?: any,
): number {
  if (!file.scriptAst || !t.isFile(file.scriptAst)) return 0
  const ast = file.scriptAst
  const body = ast.program.body
  let injected = 0

  for (const d of directives) {
    const pascal = toPascalCase(d.dirName)
    const localCandidates = [pascal, d.dirName, d.name]

    const hasImport = localCandidates.some(loc =>
      body.some((n: any) =>
        t.isImportDeclaration(n) &&
        t.isStringLiteral(n.source) &&
        new RegExp(`\\b${loc}\\b`).test(getImportSpecifiersText(n)) &&
        n.source.value.includes(d.dirName),
      ),
    )

    if (!hasImport) {
      const importDecl = t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier(pascal))],
        t.stringLiteral(d.importPath),
      )
      let lastImportIdx = -1
      for (let i = 0; i < body.length; i++) {
        if (t.isImportDeclaration(body[i])) lastImportIdx = i
      }
      if (lastImportIdx >= 0) {
        body.splice(lastImportIdx + 1, 0, importDecl)
      } else {
        body.unshift(importDecl)
      }
      injected++
    }

    const hasUse = localCandidates.some(loc =>
      body.some((n: any) => hasUseCall(n, loc)),
    )

    if (!hasUse) {
      const mounted = body.findIndex((n: any) => isMountCall(n))
      if (mounted >= 0) {
        const expr = (body[mounted] as any).expression
        if (
          t.isMemberExpression(expr.callee) &&
          t.isCallExpression(expr.callee.object)
        ) {
          const chainEnd = expr.callee.object
          const newChainEnd = t.callExpression(
            t.memberExpression(chainEnd, t.identifier('use')),
            [t.identifier(pascal)],
          )
          expr.callee.object = newChainEnd
          injected++
        }
      }
    }
  }

  return injected
}

function getImportSpecifiersText(decl: t.ImportDeclaration): string {
  return decl.specifiers.map(s => {
    if (t.isImportDefaultSpecifier(s) || t.isImportNamespaceSpecifier(s)) {
      return s.local?.name ?? ''
    }
    if (t.isImportSpecifier(s)) {
      return s.local?.name ?? ''
    }
    return ''
  }).join(' ')
}

function hasUseCall(node: any, localName: string): boolean {
  try {
    const src = generate(node, { compact: true }).code
    return new RegExp(`\\.use\\s*\\(\\s*${localName}\\b`).test(src)
  } catch {
    return false
  }
}

function isMountCall(node: any): boolean {
  if (!t.isExpressionStatement(node)) return false
  const e = node.expression
  if (!t.isCallExpression(e)) return false
  if (!t.isMemberExpression(e.callee)) return false
  if (!t.isIdentifier(e.callee.property, { name: 'mount' })) return false
  return true
}
