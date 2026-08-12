<template>
  <div>
    <h1>{{ article.title }}</h1>
    <p>{{ article.content }}</p>
  </div>
</template>

<script>
export default {
  name: 'ServerPrefetch',
  data() { return { article: {} } },
  async serverPrefetch() {
    // 仅在 SSR 时调用
    const res = await fetch(`/api/articles/${this.$route.params.id}`)
    this.article = await res.json()
  },
  async mounted() {
    // 客户端 hydration 后, 如果 serverPrefetch 已 fetch 过, 不再 fetch
    if (!this.article.id) {
      const res = await fetch(`/api/articles/${this.$route.params.id}`)
      this.article = await res.json()
    }
  }
}
</script>
