<template>
  <div class="mixin-mix">
    <h2>Mixin Composition Demo</h2>
    <p>From Mixin A: {{ mixinAData }}</p>
    <p>From Mixin B: {{ mixinBData }}</p>
    <p>Own data: {{ ownData }}</p>
    <p>Merged computed (from mixin + own): {{ mergedValue }}</p>
    <button @click="handleClick">Click (mixin method + own)</button>
    <p>Click count: {{ clickCount }}</p>
  </div>
</template>

<script>
import { debounce } from 'lodash'

// === Mixin A: 数据请求 ===
const fetchDataMixin = {
  data() {
    return {
      mixinAData: 'default from A',
      loading: false,
      error: null
    }
  },
  computed: {
    isLoading() {
      return this.loading
    }
  },
  methods: {
    async fetchData(url) {
      this.loading = true
      this.error = null
      try {
        const res = await fetch(url)
        this.mixinAData = await res.json()
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
    handleClick() {
      // 这个会被组件内同名方法覆盖 (mixin 合并策略)
      console.log('mixin A handleClick')
    }
  },
  mounted() {
    console.log('mixin A mounted')
  }
}

// === Mixin B: 分页 ===
const paginationMixin = {
  data() {
    return {
      mixinBData: 'default from B',
      currentPage: 1,
      pageSize: 10,
      total: 0
    }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.total / this.pageSize)
    },
    hasNext() {
      return this.currentPage < this.totalPages
    },
    hasPrev() {
      return this.currentPage > 1
    }
  },
  methods: {
    nextPage() {
      if (this.hasNext) this.currentPage++
    },
    prevPage() {
      if (this.hasPrev) this.currentPage--
    },
    goToPage(page) {
      this.currentPage = page
    }
  },
  watch: {
    currentPage(newVal, oldVal) {
      this.$emit('page-change', newVal)
    }
  }
}

// === Mixin C: 防抖搜索 ===
const searchMixin = {
  data() {
    return {
      searchQuery: '',
      searchResults: []
    }
  },
  created() {
    this.debouncedSearch = debounce(this.performSearch, 300)
  },
  beforeDestroy() {
    this.debouncedSearch.cancel()
  },
  methods: {
    performSearch() {
      // 子组件实现
    },
    handleSearchInput(e) {
      this.searchQuery = e.target.value
      this.debouncedSearch()
    }
  }
}

// === Mixin D: 权限控制 ===
const permissionMixin = {
  inject: {
    permissions: { default: () => [] }
  },
  computed: {
    hasPermission() {
      return (perm) => this.permissions.includes(perm)
    },
    canView() {
      return this.hasPermission('view')
    },
    canEdit() {
      return this.hasPermission('edit')
    },
    canDelete() {
      return this.hasPermission('delete')
    },
    canAdmin() {
      return this.hasPermission('admin')
    }
  }
}

// === 全局 mixin (危险, 但老项目常见) ===
// Vue.mixin({
//   created() {
//     this.$trackEvent('page_view')
//   }
// })

// === 组件使用多个 mixin ===
export default {
  name: 'MixinMix',
  mixins: [fetchDataMixin, paginationMixin, searchMixin, permissionMixin],
  data() {
    return {
      ownData: 'own data',
      clickCount: 0
    }
  },
  computed: {
    // 跟 mixin 的 computed 合并
    mergedValue() {
      return `${this.mixinAData} + ${this.mixinBData} + ${this.ownData}`
    }
  },
  methods: {
    // 覆盖 mixin 的 handleClick (组件内方法优先级高于 mixin)
    handleClick() {
      this.clickCount++
      console.log('own handleClick, count:', this.clickCount)
    },
    // 实现 mixin 声明但未实现的 performSearch
    performSearch() {
      console.log('searching for:', this.searchQuery)
      // 实际搜索逻辑
    }
  },
  // mounted 合并: 先执行 mixin 的, 再执行组件的
  mounted() {
    console.log('component mounted')
    this.fetchData('/api/data')
  },
  // beforeDestroy 合并
  beforeDestroy() {
    console.log('component beforeDestroy')
  }
}
</script>

<style scoped>
.mixin-mix {
  padding: 20px;
}
button {
  padding: 8px 16px;
  margin: 10px 0;
  cursor: pointer;
}
</style>
