// src/wasm/emscripten.js
// Emscripten 输出 wrapper
let Module = null

export async function loadModule() {
  if (Module) return Module
  Module = await import('@/wasm/image_processor.js')
  return Module
}

export async function processImage(inputBuffer, width, height) {
  const M = await loadModule()
  const resultPtr = M._processImage(inputBuffer.byteLength, width, height)
  const result = new Uint8Array(M.HEAPU8.buffer, resultPtr, inputBuffer.byteLength)
  return result.slice()
}
