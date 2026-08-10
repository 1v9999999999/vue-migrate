// shim for Vue 3 + workspace packages
declare module '@vue-migrate/core' {
  export interface ProjectContext {
    root: string
    config: { dryRun?: boolean; backup?: boolean; outDir?: string }
  }
  export interface TransformContext {
    file: any
    utils: { markChanged(s: string): void }
  }
  export interface TransformPlugin {
    name: string
    description?: string
    priority?: number
    fileKinds?: string[]
    analyze?(ctx: ProjectContext): void | Promise<void>
    transform?(ctx: TransformContext): void | Promise<void>
  }
  export function registerPlugin(p: TransformPlugin): void
}
