/**
 * 缺类型定义的外部模块的本地 shim
 *
 * 1. @babel/generator — 当前安装的版本 (7.29.8) 没有发布 .d.ts,
 *    它的 .d.ts 仍在 https://github.com/babel/babel 仓库
 *    (https://github.com/babel/babel/issues/16033) 等不到
 *    短期里发布,我们用一个 minimal 的声明覆盖本项目实际用到的 API.
 *
 * 2. 任何其它 npm 包丢了 .d.ts 都加在这里.
 */

declare module '@babel/generator' {
  import type { Node } from '@babel/types'
  export interface GeneratorOptions {
    retainLines?: boolean
    comments?: boolean
    minified?: boolean
    compact?: boolean | 'auto'
    concise?: boolean
    filename?: string
    sourceMaps?: boolean
    sourceFileName?: string
    sourceRoot?: string
  }
  export interface GeneratorResult {
    code: string
    map?: object
    rawMappings?: object
  }
  const generate: (
    ast: Node | Node[],
    options?: GeneratorOptions,
    code?: string,
  ) => GeneratorResult
  export default generate
  export { generate }
}

declare module '@babel/traverse' {
  import type { Node, Visitor } from '@babel/types'
  export interface TraverseOptions<S = Node> {
    enter?: boolean
    noScope?: boolean
    scope?: object
    parent?: Node
    path?: unknown
    state?: S
  }
  export interface NodePath<N extends Node = Node> {
    node: N
    parent: Node | null
    parentPath: NodePath | null
    scope: object
    type: string
    removed: boolean
    isExpressionStatement(): boolean
    isProgram(): boolean
    isVariableDeclaration(): boolean
    insertAfter(stmt: Node | Node[]): number
    insertBefore(stmt: Node | Node[]): number
    remove(): void
    replaceWith(replacement: Node | Node[]): void
    skip(): void
    traverse(visitor: Visitor): void
    getStatementParent(): NodePath | null
  }
  export function traverse<S = Node>(
    parent: Node | Node[],
    opts: TraverseOptions<S> | Visitor<S>,
    scope?: unknown,
    state?: S,
    parentPath?: unknown,
  ): void
  export type NodePath<N extends Node = Node> = NodePath<N>
  export default traverse
}

