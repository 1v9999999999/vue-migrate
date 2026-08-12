<!--
  TeleportToComponent.vue — Vue 3.5+ Teleport 到组件 (通过 #target slot)
  本文件是父组件, 容器组件逻辑见同名 TargetContainer.vue
  Vue 3.5 起, <Teleport :to="..."> 可以接收一个组件 ref, 该组件通过
  名为 `target` 的 slot 提供实际挂载点, 或者直接作为 prop 接收
-->
<template>
  <TargetContainer>
    <template #target>
      <!-- 容器内部 #target slot 作为 teleport 目标 -->
      <Teleport :to="targetRef" :disabled="!enabled">
        <div class="custom-content">teleport into component slot</div>
      </Teleport>
    </template>
    <p>主内容 (容器内, 不受 teleport 影响)</p>
  </TargetContainer>
</template>

<script>
import { ref } from 'vue'
import TargetContainer from './TargetContainer.vue'

export default {
  components: { TargetContainer },
  setup() {
    // Vue 3.5+: ref 指向 TargetContainer 实例,
    // 编译时会被替换为该组件的 #target slot 节点
    const targetRef = ref(null)
    const enabled = ref(true)
    return { targetRef, enabled }
  }
}
</script>
