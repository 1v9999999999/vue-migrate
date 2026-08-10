/**
 * @vue-migrate/core 入口
 */

export * from './types.js'
export * from './plugin.js'
export * from './utils.js'
export { runPipeline } from './orchestrator.js'
export type { OrchestratorOptions } from './orchestrator.js'
export { scanProject } from './scanner.js'
export { parseProject } from './parser.js'
export { codegenProject } from './codegen.js'
export { reportProject } from './reporter.js'
