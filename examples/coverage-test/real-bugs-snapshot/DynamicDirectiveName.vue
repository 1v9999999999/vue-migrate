<template>
  <div class="dynamic-directive-demo">
    <h2>动态指令名失效</h2>

    <!--
      真实 bug 场景:
      Vue 2:
        - v-[dynamicName]="value" 支持动态指令名
        - 必须用 Vue.directive 全局注册或 components 局部注册
      Vue 3:
        - 移除 v-[xxx] 动态指令语法
        - 必须显式用 v-directiveName 或 v-bind 形式
        - 自定义指令名变为参数: v-directiveName:value 仍然支持, 但指令本身必须存在

      业务危害:
        - 动态主题切换时指令不生效
        - 动态表单验证指令失效
        - 自定义组件库需要重写

      替代方案:
        1. 显式 v-name
        2. 用 component is + props 替代
        3. 用 mixin 注入
    -->

    <h3>1. 错误写法: 动态指令名 (Vue 2 work, Vue 3 失效)</h3>
    <!-- eslint-disable-next-line vue/no-parsing-error -->
    <!-- <div v-[directiveName]="value" /> -->
    <p class="comment">
      // ❌ Vue 3: v-[directiveName] 语法已移除
      <br />// 编译报错: "v-[directiveName]="'value'" Directive 'v-[directiveName]' is missing
    </p>

    <hr />

    <h3>2. 显式指令调用 (通用写法)</h3>
    <div v-highlight="'yellow'">静态 highlight</div>
    <div v-pin="200">Pin top 200px (参数)</div>

    <hr />

    <h3>3. 模拟动态切换: 手动控制指令行为</h3>
    <div :class="dynamicClass" :data-theme="currentTheme">
      根据 currentTheme 切换 (用 :class 模拟 v-name 切换)
    </div>
    <button @click="toggleTheme">toggle theme: {{ currentTheme }}</button>

    <hr />

    <h3>4. 动态组件 + 自定义指令 (Vue 3 推荐替代)</h3>
    <component :is="currentComp" v-my-directive="value" />

    <hr />

    <p class="warning">
      ⚠️ Vue 2 动态指令 v-[name] 在 Vue 3 中已移除
      迁移: 把动态指令名替换为组件 props / class / computed
    </p>
  </div>
</template>

<script>
/**
 * 动态指令名 真实 bug 复现
 *
 * Vue 2 动态指令源码片段 (编译器):
 *   <div v-[name]="val" />
 *   编译为:
 *   h('div', { directives: [{ name, value: val }] })
 *
 * Vue 3 改动:
 *   - 完全移除 v-[xxx] 语法
 *   - 编译时必须能解析出具体指令名
 *   - 动态行为通过 props/class/component is 实现
 *
 * 真实 bug 案例:
 *   <input v-[validate]="rules[name]" />
 *   Vue 3 中: 编译报错
 */

// ====== 自定义指令定义 (Vue 2/3 通用) ======
const highlightDirective = {
  // Vue 2: bind / inserted / update / unbind
  // Vue 3: created / beforeMount / mounted / beforeUpdate / updated / beforeUnmount / unmounted
  bind(el, binding) {
    el.style.background = binding.value
  },
  update(el, binding) {
    el.style.background = binding.value
  }
}

const pinDirective = {
  // v-pin:200 表示参数 200
  inserted(el, binding) {
    el.style.position = 'fixed'
    el.style.top = binding.value + 'px'
  }
}

const myDirective = {
  bind(el, binding) {
    el.setAttribute('data-my-directive', String(binding.value))
  }
}

export default {
  name: 'DynamicDirectiveName',
  directives: {
    highlight: highlightDirective,
    pin: pinDirective,
    'my-directive': myDirective
  },
  data() {
    return {
      directiveName: 'highlight',
      value: 'yellow',
      currentTheme: 'light',
      currentComp: 'span',
      customVal: 'dynamic'
    }
  },
  computed: {
    dynamicClass() {
      return {
        'theme-light': this.currentTheme === 'light',
        'theme-dark': this.currentTheme === 'dark'
      }
    }
  },
  methods: {
    toggleTheme() {
      this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light'
    }
  }
}
</script>

<style scoped>
.dynamic-directive-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.dynamic-directive-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.dynamic-directive-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
.comment {
  font-family: monospace;
  font-size: 12px;
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  color: #606266;
}
.theme-light {
  background: #fff;
  color: #303133;
  padding: 12px;
  border: 1px solid #ebeef5;
}
.theme-dark {
  background: #1a1a1a;
  color: #e0e0e0;
  padding: 12px;
  border: 1px solid #333;
}
button {
  margin-top: 8px;
  padding: 4px 12px;
  cursor: pointer;
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
