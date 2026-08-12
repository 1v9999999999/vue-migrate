// 精简 shim — 跟 elementui/src/types-shim.d.ts 一样的策略

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
