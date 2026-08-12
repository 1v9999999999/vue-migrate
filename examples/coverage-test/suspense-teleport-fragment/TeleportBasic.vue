<template>
  <div class="page">
    <h1>主页面内容</h1>
    <button @click="showModal = true">打开 Modal</button>

    <!-- Teleport 到 body -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
        <div class="modal-body">
          <h3>Teleport Modal</h3>
          <p>这个 modal 渲染在 body 末尾, 不会被父组件的 overflow:hidden 影响</p>
          <button @click="showModal = false">关闭</button>
        </div>
      </div>
    </Teleport>

    <!-- Teleport 到 selector -->
    <Teleport to="#sidebar-portal">
      <div class="widget">侧边栏小工具</div>
    </Teleport>

    <!-- 动态 disabled -->
    <Teleport to="#footer" :disabled="!hasFooter">
      <div class="footer-widget">底部挂件</div>
    </Teleport>
  </div>
</template>

<script>
export default {
  data() {
    return { showModal: false, hasFooter: true }
  }
}
</script>
