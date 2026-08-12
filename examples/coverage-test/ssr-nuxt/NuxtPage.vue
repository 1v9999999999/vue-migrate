<template>
  <div class="article-detail">
    <h1>{{ article.title }}</h1>
    <div class="meta">
      <span>作者: {{ article.author }}</span>
      <span>发布: {{ article.publishedAt | formatDate }}</span>
      <span>阅读: {{ article.views }}</span>
    </div>
    <div class="content" v-html="article.content"></div>

    <div class="related" v-if="related.length">
      <h3>相关文章</h3>
      <ul>
        <li v-for="item in related" :key="item.id">
          <router-link :to="{ name: 'article', params: { id: item.id } }">
            {{ item.title }}
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { fetchArticle, fetchRelated } from '@/api/article'

export default {
  name: 'ArticleDetail',

  // Nuxt 2 asyncData — 服务端执行, 客户端 hydration
  // Vue 3 / Nuxt 3 改法: useAsyncData / useFetch
  async asyncData({ params, $axios, error }) {
    try {
      const [article, related] = await Promise.all([
        $axios.$get(`/api/articles/${params.id}`),
        $axios.$get(`/api/articles/${params.id}/related`)
      ])
      return { article, related }
    } catch (e) {
      error({ statusCode: 404, message: 'Article not found' })
    }
  },

  // Nuxt 2 fetch — 只在客户端执行 (用于非关键数据)
  // Vue 3 / Nuxt 3: useFetch (服务端+客户端都可)
  async fetch() {
    const comments = await this.$axios.$get(`/api/articles/${this.$route.params.id}/comments`)
    this.comments = comments
  },

  data() {
    return {
      comments: []
    }
  },

  head() {
    return {
      title: this.article.title,
      meta: [
        { hid: 'description', name: 'description', content: this.article.summary },
        { property: 'og:title', content: this.article.title },
        { property: 'og:type', content: 'article' }
      ]
    }
  },

  // Nuxt middleware (路由中间件)
  middleware: 'auth',

  // Nuxt validate (路由参数验证)
  validate({ params }) {
    return /^\d+$/.test(params.id)
  },

  // Nuxt layout
  layout: 'article',

  // Nuxt loading
  loading: false,

  filters: {
    formatDate(v) {
      if (!v) return ''
      const d = new Date(v)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  },

  watch: {
    '$route.params.id'(newId) {
      this.$fetch()
    }
  },

  methods: {
    async addComment(content) {
      const res = await this.$axios.$post(`/api/articles/${this.$route.params.id}/comments`, { content })
      this.comments.unshift(res)
    }
  }
}
</script>

<style scoped>
.article-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.meta {
  color: #999;
  font-size: 13px;
  margin: 10px 0;
}

.meta span {
  margin-right: 15px;
}

.content {
  line-height: 1.8;
  margin: 20px 0;
}
</style>
