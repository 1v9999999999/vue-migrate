import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCounterStore } from '@/store/counter'

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial state is 0', () => {
    const store = useCounterStore()
    expect(store.count).toBe(0)
  })

  it('increment', () => {
    const store = useCounterStore()
    store.increment()
    expect(store.count).toBe(1)
  })

  it('double getter', () => {
    const store = useCounterStore()
    store.count = 3
    expect(store.double).toBe(6)
  })

  it('async action', async () => {
    const store = useCounterStore()
    await store.fetchIncrement()
    expect(store.count).toBeGreaterThan(0)
  })

  it('reset action', () => {
    const store = useCounterStore()
    store.count = 10
    store.reset()
    expect(store.count).toBe(0)
  })
})
