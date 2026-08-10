/**
 * 缂虹被鍨嬪畾涔夌殑澶栭儴妯″潡鐨勬湰鍦?shim
 *
 * 1. @babel/generator 鈥?褰撳墠瀹夎鐨勭増鏈?(7.29.8) 娌℃湁鍙戝竷 .d.ts,
 *    瀹冪殑 .d.ts 浠嶅湪 https://github.com/babel/babel 浠撳簱
 *    (https://github.com/babel/babel/issues/16033) 绛変笉鍒? *    鐭湡閲屽彂甯?鎴戜滑鐢ㄤ竴涓?minimal 鐨勫０鏄庤鐩栨湰椤圭洰瀹為檯鐢ㄥ埌鐨?API.
 *
 * 2. 浠讳綍鍏跺畠 npm 鍖呬涪浜?.d.ts 閮藉姞鍦ㄨ繖閲?
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

