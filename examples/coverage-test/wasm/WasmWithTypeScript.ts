// src/wasm/bindings.ts
interface WasmModule {
  add: (a: number, b: number) => number
  fibonacci: (n: number) => number
  process: (data: Uint8Array) => Uint8Array
  memory: WebAssembly.Memory
  __pin: (ptr: number) => number
  __unpin: (ptr: number) => void
  _malloc: (size: number) => number
  _free: (ptr: number) => void
}

let module: WasmModule | null = null

export async function loadWasm(): Promise<WasmModule> {
  if (module) return module
  const wasmUrl = new URL('./pkg/calc_bg.wasm', import.meta.url)
  const response = await fetch(wasmUrl)
  const bytes = await response.arrayBuffer()
  const { instance } = await WebAssembly.instantiate(bytes, { env: {} })
  module = instance.exports as unknown as WasmModule
  return module
}
