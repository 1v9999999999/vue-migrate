/**
 * Plugin Registry —— 插件注册中心
 */

import type { TransformPlugin } from './types.js'

const registry = new Map<string, TransformPlugin>()

/** 注册插件 */
export function registerPlugin(plugin: TransformPlugin): void {
  if (registry.has(plugin.name)) {
    throw new Error(`Plugin "${plugin.name}" already registered`)
  }
  registry.set(plugin.name, plugin)
}

/** 获取所有已注册插件（按 priority 倒序） */
export function getPlugins(): TransformPlugin[] {
  return [...registry.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

/** 按名字获取 */
export function getPlugin(name: string): TransformPlugin | undefined {
  return registry.get(name)
}

/** 列出所有插件名 */
export function listPluginNames(): string[] {
  return [...registry.keys()]
}

/** 清空（仅用于测试） */
export function _reset(): void {
  registry.clear()
}
