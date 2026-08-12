// subscribe / subscribeAction / watch —— store 级订阅 + 组件级订阅
import router from '@/router'

// ---------- 插件: 全局订阅 ----------
export function loggerPlugin(store) {
  // 订阅 mutation
  store.subscribe((mutation, state) => {
    console.log('[mutation]', mutation.type, mutation.payload)
  })

  // 订阅 action (前 / 后 / 错误钩子)
  store.subscribeAction({
    before(action, state) {
      console.log('[action before]', action.type)
    },
    after(action, state) {
      console.log('[action after]', action.type)
    },
    error(action, state, error) {
      console.error('[action error]', action.type, error)
    }
  })

  // 监听 state 变化 (token 丢失则跳登录)
  store.watch(
    state => state.user.token,
    (newVal, oldVal) => {
      if (!newVal && oldVal) {
        router.push('/login')
      }
    }
  )
}

// ---------- 组件内订阅 ----------
export default {
  name: 'TokenWatcher',
  data() {
    return {
      token: '',
      actionLog: []
    }
  },
  created() {
    // 保存 unsubscribe 函数, 组件销毁时调用
    this.unsubscribeMutation = this.$store.subscribe((mutation, state) => {
      if (mutation.type === 'user/SET_TOKEN') {
        this.token = mutation.payload
      }
    })

    this.unsubscribeAction = this.$store.subscribeAction(action => {
      if (action.type === 'user/login') {
        this.actionLog.push(action.type)
      }
    })
  },
  beforeDestroy() {
    // 必须取消订阅, 避免重复回调与内存泄漏
    if (this.unsubscribeMutation) this.unsubscribeMutation()
    if (this.unsubscribeAction) this.unsubscribeAction()
  }
}
