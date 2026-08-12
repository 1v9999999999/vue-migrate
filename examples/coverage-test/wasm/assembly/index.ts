// assembly/index.ts
// AssemblyScript 源码, 编译为 WASM
// 编译命令: npx asc assembly/index.ts --outFile as_wasm.wasm --optimize

export function fib(n: i32): i32 {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}

export function sum(arr: Int32Array): i32 {
  let total = 0
  for (let i = 0; i < arr.length; i++) total += arr[i]
  return total
}
