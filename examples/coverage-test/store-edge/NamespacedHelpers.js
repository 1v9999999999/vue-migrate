// createNamespacedHelpers + map* helpers (含别名 / 多 namespace 混用)
import { createNamespacedHelpers } from 'vuex'

// 绑定到 user 命名空间 (解构时重命名, 避免与其它空间冲突)
const {
  mapState: mapUserState,
  mapGetters: mapUserGetters,
  mapMutations: mapUserMutations,
  mapActions: mapUserActions
} = createNamespacedHelpers('user')

// 绑定到 app 命名空间
const { mapState: mapAppState } = createNamespacedHelpers('app')

export default {
  name: 'UserPanel',
  computed: {
    // 数组形式: 直接映射 state / getter 名
    ...mapUserState(['name', 'avatar', 'token']),
    ...mapUserGetters(['isAdmin', 'roles']),

    // 对象形式 (别名): 本地属性名 -> 模块内 state/getter
    ...mapUserState({ username: 'name', userAvatar: 'avatar' }),
    ...mapUserGetters({ userAdmin: 'isAdmin' }),

    // 多 namespace 混用 (app 命名空间的 state)
    ...mapAppState(['sidebar', 'device']),

    // 本地计算属性
    displayName() {
      return this.username || '游客'
    }
  },
  methods: {
    // 数组形式
    ...mapUserMutations(['SET_NAME', 'SET_TOKEN']),
    ...mapUserActions(['login', 'logout']),

    // 对象形式 (别名)
    ...mapUserMutations({ updateName: 'SET_NAME' }),
    ...mapUserActions({ signIn: 'login' })
  },
  created() {
    // 触发一次 displayName 计算, 避免未使用告警
    if (this.token) {
      console.log(this.displayName)
    }
  }
}
