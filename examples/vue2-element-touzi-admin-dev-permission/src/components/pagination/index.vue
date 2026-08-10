<template>
    <div class="pagination">
        <el-pagination
            v-if='pageTotal > 0'
            background
            :page-sizes="paginations.pageSizes"
            :page-size="paginations.pageSize"
            :layout="paginations.layout"
            :total="pageTotal"
            :current-page='paginations.pageIndex'
            @current-change='handleCurrentChange'
            @size-change='handleSizeChange'>
        </el-pagination>
    </div>
</template>


<script>export default {
  name: 'pagination',
  /*
   * vue3-types inferred data() return type:
   * @returns {{paginations: { pageIndex: number; pageSize: number; pageSizes: number[]; layout: string }}}
   */
  data() {
    return {
      paginations: {
        pageIndex: 1,
        // 当前位于哪页
        pageSize: 20,
        // 1页显示多少条
        pageSizes: [5, 10, 15, 20],
        //每页显示多少条
        layout: "total, sizes, prev, pager, next, jumper" // 翻页属性
      }
    };
  },
  /*
   * vue3-types inferred props shape:
   * @type {{ pageTotal: number }}
   * (In Vue3, the recommended equivalent is
   *   const props = defineProps<{ pageTotal: number }>()
   *   in <script setup>. For Options API, runtime props are kept as-is.)
   */
  props: {
    pageTotal: Number
  },
  created() {},
  mounted() {},
  methods: {
    // 上下分页 pageIndex
    /*
     * this 类型:
     * {
     *   $emit: unknown
     * }
     */
    handleCurrentChange(page) {
      this.$emit('handleCurrentChange', page);
    },
    // 每页多少条切换 pageSize
    /*
     * this 类型:
     * {
     *   $emit: unknown
     * }
     */
    handleSizeChange(page_size) {
      this.$emit('handleSizeChange', page_size);
    }
  }
};</script>

<style lang="less" scoped>
    .pagination{
        text-align: right;
        padding: 10px 18px;
    }
</style>
