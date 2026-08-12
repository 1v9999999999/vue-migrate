<template>
  <div class="router-props-demo">
    <h2>路由 props: false 关闭自动解耦</h2>

    <!--
      真实 bug 场景:
      Vue 2:
        - 路由配置默认不传 props, 组件内必须 this.$route.params.id
        - 路由参数变化时, 组件不会自动响应 (除非 watch $route)
        - 测试时需要 mock $route
      Vue 3:
        - 仍支持 props: false (默认)
        - 但官方推荐 props: true 解耦, 方便测试
        - 函数形式 props: route => ({ id: route.params.id })

      业务危害:
        - 路由参数变化不触发视图更新
        - 单元测试必须 mock $route
        - 组件强耦合 router
    -->

    <h3>1. 默认写法 (耦合 $route)</h3>
    <UserDetail :id="$route.params.id" :user-name="$route.query.name" />

    <hr />

    <h3>2. props: true 解耦 (推荐)</h3>
    <UserDetailProps :id="$route.params.id" :user-name="$route.query.name" />

    <hr />

    <h3>3. props 函数形式 (动态处理)</h3>
    <UserDetailFn :id="$route.params.id" />

    <hr />

    <p class="warning">
      ⚠️ Vue 2: 默认 props: false, 路由参数变化不触发 props 更新, 必须 watch $route
      Vue 3: 推荐 props: true 或函数形式, 让路由参数像普通 props 一样响应
    </p>
  </div>
</template>

<script>
/**
 * 路由 props 解耦 真实 bug 复现
 *
 * 默认行为对比:
 *   Vue 2 路由组件:
 *     {
 *       path: '/user/:id',
 *       component: UserDetail
 *     }
 *     UserDetail 内: this.$route.params.id (强耦合)
 *     $route 变化时, 同一组件实例不会触发 props 更新
 *
 *   Vue 3 推荐:
 *     {
 *       path: '/user/:id',
 *       component: UserDetail,
 *       props: true   // 或 route => ({ id: route.params.id })
 *     }
 *     UserDetail 内: props.id (解耦, 可测试)
 */

const UserDetail = {
  name: 'UserDetail',
  // Vue 2 写法: 不声明 props, 直接读 $route
  // Vue 3 中若想保持兼容, 可加 props 兜底
  props: {
    id: { type: [String, Number], default: '' },
    userName: { type: String, default: '' }
  },
  computed: {
    // 模拟 Vue 2 中直接读 $route
    routeId() {
      return this.id || (this.$route && this.$route.params.id)
    }
  },
  template: `
    <div class="user-card">
      <h4>UserDetail (默认 $route 读取)</h4>
      <p>id: {{ routeId }}</p>
      <p>userName: {{ userName }}</p>
    </div>
  `
}

const UserDetailProps = {
  name: 'UserDetailProps',
  props: {
    id: { type: [String, Number], required: true },
    userName: { type: String, default: 'guest' }
  },
  template: `
    <div class="user-card">
      <h4>UserDetailProps (props 解耦)</h4>
      <p>id (from props): {{ id }}</p>
      <p>userName (from props): {{ userName }}</p>
    </div>
  `
}

const UserDetailFn = {
  name: 'UserDetailFn',
  props: {
    id: { type: [String, Number], required: true }
  },
  computed: {
    // 函数形式 props 可在组件内做转换
    normalizedId() {
      return String(this.id).toUpperCase()
    }
  },
  template: `
    <div class="user-card">
      <h4>UserDetailFn (props 函数形式)</h4>
      <p>raw id: {{ id }}</p>
      <p>normalized: {{ normalizedId }}</p>
    </div>
  `
}

export default {
  name: 'RouterPropsFalse',
  components: { UserDetail, UserDetailProps, UserDetailFn },
  data() {
    return {
      // 模拟 $route 对象 (Vue Router 注入)
      $route: {
        params: { id: 42 },
        query: { name: 'alice' }
      }
    }
  }
}
</script>

<style scoped>
.router-props-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.router-props-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.router-props-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
.user-card {
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
  margin: 8px 0;
}
.user-card h4 {
  margin: 0 0 8px;
  color: #303133;
}
.user-card p {
  margin: 4px 0;
  font-size: 14px;
}
.warning {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #c45656;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
