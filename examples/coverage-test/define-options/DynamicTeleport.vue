<template>
  <div>
    <!-- 动态 to 字符串 (响应式) -->
    <Teleport :to="target">
      <div class="dynamic-content">动态 teleport</div>
    </Teleport>

    <button @click="target = '#header-portal'">到头部</button>
    <button @click="target = '#footer-portal'">到尾部</button>
    <button @click="target = 'body'">到 body</button>

    <!-- 嵌套 Teleport -->
    <Teleport to="#outer-teleport">
      <div class="outer">
        Outer
        <Teleport to="#inner-teleport" :disabled="!nestedEnabled">
          <div class="inner">Inner nested</div>
        </Teleport>
      </div>
    </Teleport>
  </div>
</template>

<script>
export default {
  data() {
    return { target: '#header-portal', nestedEnabled: true }
  }
}
</script>
