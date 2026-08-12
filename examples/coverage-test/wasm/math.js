// src/wasm/math.js
// Rust 代码 (lib.rs):
// #[no_mangle]
// pub extern "C" fn add(a: i32, b: i32) -> i32 { a + b }
//
// #[no_mangle]
// pub extern "C" fn fibonacci(n: i32) -> i32 {
//   if n < 2 { n } else { fibonacci(n - 1) + fibonacci(n - 2) }
// }

import init, { add, fibonacci } from '@/wasm/math_wasm/pkg/math_wasm.js'

let initialized = false

export async function ensureInit() {
  if (!initialized) {
    await init()
    initialized = true
  }
}

export { add, fibonacci }
