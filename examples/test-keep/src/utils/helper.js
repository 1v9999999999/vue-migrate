// 不会被 vue-migrate 改动的工具函数
export function debounce(fn, wait) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), wait)
  }
}

export function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10)
}
