# Vuex 3/4 → Pinia 规则目录

**15 条规则**。plugin: `packages/plugins/vuex-pinia/`, priority 9。

## Store 构造

| # | 规则 | Vuex | Pinia |
|---|---|---|---|
| 1 | Store 类改 defineStore | `new Vuex.Store({...})` | `export const useXxxStore = defineStore('xxx', {...})` |
| 2 | state 改箭头函数 | `state: { count: 0 }` | `state: () => ({ count: 0 })` |
| 3 | mutations 合并到 actions | `mutations: { inc(s) { s.count++ } }` | `actions: { inc() { this.count++ } }` |
| 4 | actions 保留 | `actions: { async fetch() {...} }` | `actions: { async fetch() {...} }` |
| 5 | getters 保留 | `getters: { double(s) { return s.count * 2 } }` | `getters: { double: (s) => s.count * 2 }` |

## State 访问

| # | 规则 | Vuex | Pinia |
|---|---|---|---|
| 6 | `this.$store.state.x` | 全局 state | `useStore().x` |
| 7 | `store.state.x` | 同上 | `store.x`（自动解包） |
| 8 | `state.x.y` | 嵌套 | `x.y`（reactive proxy） |

## Mutations 改造

| # | 规则 | Vuex | Pinia |
|---|---|---|---|
| 9 | `commit('inc')` 字符串字面量 | `store.commit('inc')` | `store.inc()` |
| 10 | `commit('inc', payload)` 带参 | `store.commit('inc', 5)` | `store.inc(5)` |
| 11 | mutation 名提取 | `commit('user/setName', x)` | `store.setName(x)`（review note 当跨模块） |
| 12 | mutations 体 → actions | `inc(state) { state.count++ }` | `inc() { this.count++ }`（`state` 参数移除） |

## Actions

| # | 规则 | Vuex | Pinia |
|---|---|---|---|
| 13 | `dispatch('fetch')` | `store.dispatch('fetch')` | `store.fetch()` |
| 14 | `dispatch('fetch', payload)` | 带参 | `store.fetch(payload)` |
| 15 | async action 保留 | `async fetch({ commit }) {...}` | `async fetch() { this.x = ... }` |

## Map Helpers

| # | 规则 | Vuex | Pinia |
|---|---|---|---|
| (注) | `mapState` | `...mapState(['count'])` | review note（推荐 storeToRefs） |
| (注) | `mapGetters` | `...mapGetters(['double'])` | review note |
| (注) | `mapActions` | `...mapActions(['inc'])` | review note |
| (注) | `mapMutations` | `...mapMutations(['inc'])` | `store.inc` 直接调用 |

> map helpers 在 Options API 里使用；本插件**不能自动替换**为 setup 形式（setup 里直接用 `storeToRefs`），所以加 review note。

## Store 拆分

**Vuex 单文件**:
```js
export default new Vuex.Store({
  state: { user: null },
  mutations: {
    setUser(state, user) { state.user = user },
  },
  actions: {
    async login({ commit }, payload) {
      const u = await api.login(payload)
      commit('setUser', u)
    },
  },
})
```

**Pinia 转换后**:
```ts
export const useStoreStore = defineStore('store', {
  state: () => ({ user: null }),
  actions: {
    setUser(user) { this.user = user },  // mutations 合并
    async login(payload) {
      const u = await api.login(payload)
      this.setUser(u)
    },
  },
})
```

## 关键实现

### `commit('xxx', p)` → `this.xxx(p)`

预扫描整个 store 文件，提取所有 `mutations` 的 key，构建 `mutationsMap`。然后：
```js
// 输入
commit('setUser', user)

// 转换
this.setUser(user)
```

如果 commit 的 key 不在 mutationsMap → review note（可能是跨模块）。

### `state` 参数移除

```js
// Vuex
inc(state) { state.count++ }
// Pinia
inc() { this.count++ }  // state 参数移除，body 里所有 state.xxx 改成 this.xxx
```

### `Babel API gotcha`

`t.objectMethod(kind, key, params, body, async, generator)`:
- 第 5 个参数是 `async`
- 第 6 个参数是 `generator`
- (TS 类型签名可能误导成反的)

`t.objectMethod` 的 key **默认 `computed: true`**，会输出 `[xxx]()` 形式！

**安全做法**:
```ts
t.objectProperty(
  key,
  t.functionExpression(null, params, body, false, isAsync),
  false,  // 4-arg 版本第 4 个是 `decorators` 数组，false 表示无装饰器
)
```

## 已知 issue

- `commit('xxx')` 第二个参数不是字符串字面量（如 `commit('save' + name, x)`）未处理
- 跨模块 `commit('module/action')` 仅 review note
- `subscribe` / `watch` Vuex 特性在 Pinia 等价物需要 review note
- `plugins` 数组需要 review note

## 测试

样本 `examples/vue2-manage-master/src/store/index.js` 转换验证：
- 0 errors
- 完整 store 转 defineStore
- mutations 全部合并到 actions
- `this.state.x` 改 `this.x`
