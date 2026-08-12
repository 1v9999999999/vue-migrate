<template>
  <header>Header</header>
  <main>
    <h1>主内容</h1>
    <p>Vue 3 组件可以有多个根节点 (Fragment)</p>
  </main>
  <footer>Footer</footer>
</template>

<script>
// 无需包裹元素, Vue 3 自动用 Fragment
export default {
  name: 'MultiRoot'
}
</script>
