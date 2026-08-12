<!--
  TargetContainer.vue — TeleportToComponent.vue 的容器组件
  暴露 #target slot, 作为父组件 <Teleport :to="..."> 的实际挂载点
-->
<template>
  <div class="container">
    <header>容器头部</header>
    <!-- #target slot 由父组件 <Teleport> 填充 -->
    <slot name="target" />
    <main>
      <slot />
    </main>
    <footer>容器尾部</footer>
  </div>
</template>

<script>
export default {
  name: 'TargetContainer'
}
</script>
