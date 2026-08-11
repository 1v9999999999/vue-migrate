<template>
  <div class="pagination-demo">
    <h3>基础分页 (current + total + showSizeChanger)</h3>
    <a-pagination
      v-model="current"
      :total="total"
      :page-size="pageSize"
      :show-size-changer="true"
      :show-quick-jumper="true"
      :page-size-options="['10', '20', '50', '100']"
      :show-total="total => `共 ${total} 条`"
      @change="onChange"
      @showSizeChange="onSizeChange"
    />

    <h3>mini + simple (2 种 size mode)</h3>
    <a-pagination
      v-model="current2"
      :total="50"
      :page-size="10"
      size="small"
    />
    <a-pagination
      v-model="current3"
      :total="50"
      :page-size="10"
      simple
    />

    <h3>完整事件 (change + showSizeChange + 2 itemRender)</h3>
    <a-pagination
      v-model="current4"
      :total="500"
      :page-size="20"
      :item-render="itemRender"
      @change="onFullChange"
    >
      <template slot="prev" slot-scope="props">
        <a-icon type="left" />
        <span>上一页 ({{ props.page }})</span>
      </template>
      <template slot="next" slot-scope="props">
        <span>下一页 ({{ props.page }})</span>
        <a-icon type="right" />
      </template>
    </a-pagination>

    <h3>服务端分页 (controlled 模式)</h3>
    <a-pagination
      :current="serverPage.current"
      :total="serverPage.total"
      :page-size="serverPage.pageSize"
      :loading="serverLoading"
      @change="onServerPage"
    />

    <h3>隐藏某字段 (hideOnSinglePage + showLessItems)</h3>
    <a-pagination
      v-model="current5"
      :total="5"
      :page-size="1"
      :hide-on-single-page="false"
      :show-less-items="true"
    />
  </div>
</template>

<script>
export default {
  name: 'AntPaginationDemo',
  data() {
    return {
      current: 1,
      current2: 1,
      current3: 1,
      current4: 1,
      current5: 1,
      total: 380,
      pageSize: 10,
      serverPage: { current: 1, total: 1000, pageSize: 20 },
      serverLoading: false
    }
  },
  methods: {
    onChange(page, pageSize) {
      this.$message.info(`page ${page}, size ${pageSize}`)
    },
    onSizeChange(current, size) {
      this.$message.info(`size change: ${current}, ${size}`)
      this.current = current
      this.pageSize = size
    },
    onFullChange(page, pageSize) {
      console.log('full change', page, pageSize)
    },
    onServerPage(page, pageSize) {
      this.serverLoading = true
      setTimeout(() => {
        this.serverPage = { current: page, total: 1000, pageSize }
        this.serverLoading = false
        this.$message.success(`跳到第 ${page} 页`)
      }, 800)
    },
    itemRender(current, type, originalElement) {
      if (type === 'prev') {
        return <a>上一页</a>
      } else if (type === 'next') {
        return <a>下一页</a>
      } else if (type === 'page') {
        return <a>{current}</a>
      }
      return originalElement
    }
  }
}
</script>
