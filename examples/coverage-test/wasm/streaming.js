// src/wasm/streaming.js
export async function loadWasmStreaming(url) {
  // 边下载边编译, 比 fetch + ArrayBuffer 快
  const { instance, module } = await WebAssembly.instantiateStreaming(
    fetch(url),
    {
      env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 4096 }),
        table: new WebAssembly.Table({ initial: 10, element: 'anyfunc' }),
        __log: (ptr, len) => {
          const buffer = new Uint8Array(instance.exports.memory.buffer, ptr, len)
          const str = new TextDecoder().decode(buffer)
          console.log('wasm log:', str)
        }
      }
    }
  )
  return instance
}
