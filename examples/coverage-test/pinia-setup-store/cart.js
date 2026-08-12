// iter-coverage: Pinia setup-style store - 跨 store 引用 (在 action 内 useStore)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './user'

export const useCartStore = defineStore('cart', () => {
  const items = ref([])
  const loading = ref(false)

  const totalCount = computed(() => items.value.reduce((sum, i) => sum + i.qty, 0))
  const totalPrice = computed(() => items.value.reduce((sum, i) => sum + i.qty * i.price, 0))

  async function addItem(product, qty = 1) {
    const userStore = useUserStore()  // 在 action 内 useStore (lazy)
    if (!userStore.isLoggedIn) throw new Error('login required')
    const existing = items.value.find(i => i.id === product.id)
    if (existing) existing.qty += qty
    else items.value.push({ ...product, qty })
  }

  function clear() { items.value = [] }

  return { items, loading, totalCount, totalPrice, addItem, clear }
})
