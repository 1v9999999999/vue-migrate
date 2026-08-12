// composables/useWorker.ts
import { ref, onUnmounted } from 'vue'
import * as Comlink from 'comlink'

export function useWorker<T>(workerFactory: () => T) {
  const worker = new Worker(new URL(workerFactory.toString(), import.meta.url), { type: 'module' })
  const proxy = Comlink.wrap(worker)
  const result = ref(null)
  const error = ref(null)
  const loading = ref(false)

  async function run(...args) {
    loading.value = true
    error.value = null
    try {
      result.value = await proxy(...args)
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
    return result.value
  }

  onUnmounted(() => worker.terminate())
  return { result, error, loading, run }
}

// 用法
// const { result, loading, run } = useWorker(async () => {
//   return await import('./worker.js')
// })
