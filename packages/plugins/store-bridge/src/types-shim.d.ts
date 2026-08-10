// types-shim for local dev
declare module '@vue-migrate/core' {
  export interface TransformPlugin { name: string; description?: string; priority?: number; fileKinds?: string[]; transform?(ctx: any): void | Promise<void>; scan?(ctx: any): void | Promise<void>; analyze?(ctx: any): void | Promise<void> }
  export interface TransformContext { file: any; project: any; utils: any; log(msg: string): void; syncScriptAstToSource(): void; __changed?: boolean; __lastMessage?: string }
  export interface ProjectContext { root: string; files: Map<string, any>; dependencyGraph: Map<string, string[]>; typeCache: Map<string, any>; plugins: any[]; stats: any; config: any; storeNames?: { mainExportName?: string; mainId?: string; mainFilePath?: string } }
  export interface FileNode { path: string; relativePath: string; kind: string; source: string; sfc?: any; scriptAst?: any; templateAst?: any; metadata: any; transforms: any[]; changed: boolean; useRawSource?: boolean }
  export interface TransformUtils { reparse(): void; syncScriptAstToSource(): void; markChanged(msg?: string): void; manualReview(reason: string): void }
  export function registerPlugin(plugin: TransformPlugin): void
  export function getPlugins(): TransformPlugin[]
  export function getMainStoreExportName(ctx: any, defaultName?: string): string
  export function setMainStoreExportName(ctx: any, exportName: string): void
  export function inferStoreNameFromPath(filePath: string): string | null
  export function storeIdToExportName(id: string): string
}
