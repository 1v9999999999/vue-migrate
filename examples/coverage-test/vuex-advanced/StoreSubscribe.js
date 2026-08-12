import store from '@/store'

// 1. 通用 mutation 订阅
const unsubscribe = store.subscribe((mutation, state) => {
  console.log('mutation:', mutation.type, mutation.payload)
  if (mutation.type === 'auth/SET_TOKEN') {
    if (mutation.payload) {
      localStorage.setItem('token', mutation.payload)
      axios.defaults.headers.common['Authorization'] = `Bearer ${mutation.payload}`
    } else {
      localStorage.removeItem('token')
    }
  }
})

// 2. action 订阅 (Vuex 3.4+)
const unsubAction = store.subscribeAction({
  before: (action, state) => {
    console.log('before action:', action.type)
  },
  after: (action, state) => {
    console.log('after action:', action.type)
    if (action.type === 'auth/logout') {
      router.push('/login')
    }
  },
  error: (action, state, error) => {
    console.error('action error:', action.type, error)
  }
})

// 3. watch (Vuex 3.6+)
const stopWatch = store.watch(
  (state) => state.user.token,
  (newVal, oldVal) => {
    if (!newVal && oldVal) router.push('/login')
  }
)

// 4. 组件内订阅
export default {
  created() {
    this._unsub = this.$store.subscribe((mutation) => {
      if (mutation.type.startsWith('cart/')) this.recalc()
    })
  },
  beforeDestroy() { this._unsub?.() }
}
