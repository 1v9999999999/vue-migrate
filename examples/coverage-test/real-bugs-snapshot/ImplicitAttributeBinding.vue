<template>
  <div class="implicit-binding-demo">
    <h2>隐式属性绑定 (Vue 2 → Vue 3 失效)</h2>

    <!--
      真实 bug 场景:
      Vue 2 的 v-model 编译产物是 :value + @input (组件声明 model: { prop: 'value', event: 'input' })
      Vue 3 的 v-model 编译产物是 :modelValue + @update:modelValue

      业务代码中常常写:
        <MyInput :value="x" @input="x = $event" />
      在 Vue 2 中等价于 v-model="x", 但 Vue 3 不会触发响应式更新,
      因为子组件声明的是 props.value / emit('input'), 而父组件只传了 modelValue.

      Vue 3 修复方案:
        选项 A: 子组件改用 modelValue / update:modelValue (推荐, 符合 v-model 新约定)
        选项 B: 父组件改用 v-model="x" (Vue 3 标准语法)
        选项 C: 父组件显式写 :modelValue + @update:modelValue
    -->

    <h3>1. 标准 v-model (跨版本通用)</h3>
    <CustomInput v-model="name" />
    <p>name: {{ name }}</p>

    <hr />

    <h3>2. Vue 2 写法 (:value + @input) — Vue 3 下静默失效</h3>
    <CustomInput :value="legacyName" @input="legacyName = $event" />
    <p>legacyName (Vue 3 下不会更新): {{ legacyName }}</p>
    <p class="warning">
      ⚠️ 在 Vue 2 编译产物下: :value + @input 等价于 v-model;
      在 Vue 3 编译产物下: 不会触发响应式, 需显式 :modelValue + @update:modelValue
    </p>

    <hr />

    <h3>3. Vue 3 显式写法 (修复方案)</h3>
    <CustomInput :modelValue="explicitName" @update:modelValue="explicitName = $event" />
    <p>explicitName: {{ explicitName }}</p>

    <hr />

    <h3>4. 自定义 v-model 参数 (Vue 3 新特性)</h3>
    <CustomInput v-model:title="titleText" />
    <p>titleText: {{ titleText }}</p>
    <p class="note">Vue 2 不支持 v-model:xxx 多参数, Vue 3 支持任意参数名</p>
  </div>
</template>

<script>
/**
 * 隐式属性绑定 真实 bug 复现
 *
 * 触发条件 (满足任一):
 * 1. 子组件没有声明 model 选项
 * 2. 父组件手动写 :value / @input 模拟 v-model
 * 3. Vue 2 → 3 升级但未更新编译产物
 *
 * 表现: 父组件 data 更新, 但 UI 不刷新; 或 UI 修改不写回父组件
 * 检测: 启用 Vue 3 的 v-model 兼容警告
 *
 * 注意: 本文件内 CustomInput 显式声明了 model 选项 (Vue 2 风格)
 *       Vue 3 实际不会处理, 仅作为代码分析样本
 */

/**
 * 模拟 el-input 风格的子组件
 * Vue 2: model 声明 value/input, 父组件传 :value + @input work
 * Vue 3: 必须用 modelValue/update:modelValue
 */
const CustomInput = {
  name: 'CustomInput',
  // Vue 2 风格 model 声明 (Vue 3 忽略此字段, 默认 modelValue/update:modelValue)
  model: {
    prop: 'value',
    event: 'input'
  },
  props: {
    value: { type: String, default: '' },
    // Vue 3 默认 prop 名
    modelValue: { type: String, default: '' },
    // Vue 3 自定义 v-model 参数
    title: { type: String, default: '' }
  },
  computed: {
    // Vue 2 模式下从 value 取值
    vue2Display() {
      return this.value
    },
    // Vue 3 模式下从 modelValue 取值
    vue3Display() {
      return this.modelValue || this.title
    }
  },
  methods: {
    onInput(e) {
      // Vue 2: 触发 input 事件
      this.$emit('input', e.target.value)
      // Vue 3: 同时触发 update:modelValue
      this.$emit('update:modelValue', e.target.value)
      // Vue 3: 自定义参数
      this.$emit('update:title', e.target.value)
    }
  }
}

export default {
  name: 'ImplicitAttributeBinding',
  components: { CustomInput },
  data() {
    return {
      name: 'alice',
      legacyName: 'bob', // Vue 3 下不会更新
      explicitName: 'carol',
      titleText: 'Vue 3 multi-arg v-model'
    }
  }
}
</script>

<style scoped>
.implicit-binding-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.implicit-binding-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.implicit-binding-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
.warning {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #c45656;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
.note {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  color: #67c23a;
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
