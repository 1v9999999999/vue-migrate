<!--
  iter-122a: 复杂 class 组件 (lifecycle + mixins + custom decorators) 覆盖率测试
  覆盖 Mixins + 异步组件 + 自定义指令 + lifecycle + @Prop + async 方法
-->
<template>
  <div class="complex-form" v-if="!loading">
    <h2>Form: {{ formId }}</h2>
    <p v-if="isEmpty">no items</p>
    <ul>
      <li v-for="(item, i) in items" :key="i" v-focus>{{ item }}</li>
    </ul>
    <ChildComp v-if="!isEmpty" />
    <button :disabled="loading" @click="loadForm">reload</button>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from 'vue-property-decorator'
import ChildComp from './Child.vue'

// Vue.extend 定义的 mixin
const FormMixin = Vue.extend({
  data() {
    return {
      formData: {} as Record<string, any>,
      errors: {} as Record<string, string>
    }
  },
  methods: {
    validate(): boolean {
      return Object.keys(this.errors).length === 0
    },
    setField(key: string, value: any): void {
      this.$set(this.formData, key, value)
    }
  }
})

// 自定义装饰器 (项目内常见: 记录方法调用)
function LogCall(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log(`[LogCall] ${key} called with`, args)
    return original.apply(this, args)
  }
  return descriptor
}

@Component({
  components: {
    ChildComp: () => import('./Child.vue'),
    InlineChild: ChildComp
  },
  directives: {
    focus: {
      inserted(el: HTMLElement) {
        el.focus()
      }
    }
  },
  filters: {
    formTag(id: string): string {
      return '#' + id
    }
  }
})
export default class ComplexForm extends Mixins(FormMixin) {
  @Prop({ type: String, required: true }) formId!: string
  @Prop({ type: Boolean, default: false }) readonly readonly!: boolean

  loading = false
  items: any[] = []

  get isEmpty(): boolean {
    return this.items.length === 0
  }

  get formTag(): string {
    return '#' + this.formId
  }

  mounted(): void {
    this.loadForm()
  }

  beforeDestroy(): void {
    this.cleanup()
  }

  @LogCall
  async loadForm(): Promise<void> {
    this.loading = true
    try {
      await this.fetchItems()
      this.validate()
    } catch (e) {
      this.errors = { load: String(e) }
    } finally {
      this.loading = false
    }
  }

  @LogCall
  async fetchItems(): Promise<any[]> {
    return []
  }

  cleanup(): void {
    this.formData = {}
    this.errors = {}
    this.items = []
  }

  handleSubmit(): void {
    if (this.validate()) {
      this.$emit('submit', this.formData)
    }
  }
}
</script>

<style scoped>
.complex-form {
  padding: 16px;
}
</style>
