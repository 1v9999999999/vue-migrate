<!--
  element-ui/Pagination.vue — Pagination 分页穷举
  iter-090 P3 验证: layout / current-page.sync / size-change / prev-click / next-click
-->
<template>
  <div>
    <h2>Pagination 分页</h2>

    <!-- 1. 完整 layout -->
    <el-pagination
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :page-size="pageSize"
      :current-page.sync="currentPage"
      :layout="layout"
      background
      @size-change="onSizeChange"
      @current-change="onCurrentChange"
      @prev-click="onPrevClick"
      @next-click="onNextClick"
    />

    <!-- 2. 简版 layout -->
    <el-pagination
      :total="total"
      :current-page.sync="currentPage"
      layout="prev, pager, next"
    />

    <!-- 3. small + hidden-on-single-page -->
    <el-pagination
      small
      :total="total"
      :page-size="pageSize"
      :current-page.sync="currentPage"
      :layout="'total, sizes, prev, pager, next, jumper'"
      :hide-on-single-page="true"
    />

    <!-- 4. 不带 background -->
    <el-pagination
      :total="total"
      :page-size="pageSize"
      :current-page.sync="currentPage"
      layout="prev, pager, next, jumper"
    />

    <!-- 5. server-side (P3 高级) -->
    <el-pagination
      :total="serverTotal"
      :current-page.sync="serverPage"
      :page-size="serverPageSize"
      layout="total, prev, pager, next, jumper"
      @current-change="onServerPageChange"
    />

    <!-- 6. 自定义 prev/next slot (生僻) -->
    <el-pagination
      :total="total"
      :current-page.sync="currentPage"
      :page-size="pageSize"
      layout="slot, prev, slot, pager, slot, next, slot"
    >
      <template #prev>
        <el-button>上一页</el-button>
      </template>
      <template #next>
        <el-button>下一页</el-button>
      </template>
    </el-pagination>
  </div>
</template>

<script>
export default {
  data() {
    return {
      total: 1000,
      pageSize: 20,
      currentPage: 1,
      layout: 'total, sizes, prev, pager, next, jumper',
      serverTotal: 0,  // 服务端总数,初始为 0
      serverPage: 1,
      serverPageSize: 20
    }
  },
  methods: {
    onSizeChange(size) { this.pageSize = size; this.fetchData() },
    onCurrentChange(page) { this.currentPage = page; this.fetchData() },
    onPrevClick(page) { console.log('prev', page) },
    onNextClick(page) { console.log('next', page) },
    onServerPageChange(page) { this.fetchData() },
    fetchData() {
      // 服务端分页 - 调 API
      // 实际项目里这里调后端
    }
  }
}
</script>
