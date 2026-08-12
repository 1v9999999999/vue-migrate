// workers/worker.js
import * as Comlink from 'comlink'

function fibonacci(n) {
  if (n < 2) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

function heavyComputation(data) {
  // 复杂计算
  return data.map(x => x * 2).filter(x => x > 10)
}

const api = {
  fibonacci,
  heavyComputation
}

Comlink.expose(api)
