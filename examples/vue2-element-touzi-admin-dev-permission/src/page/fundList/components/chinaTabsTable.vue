<template>
    <div class="chinaTabsTable">
       <el-table 
          :data="tableData" 
          style="width: 100%" align='center'>
            <el-table-column
                prop="ID"
                label="序号"
                align='center'
                width="80">
                <template #default="scope">
                    <template>
                        {{scope.$index+1}}
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="provinces"
                label="省份"
                align='center'
                width="140">
            </el-table-column>
            <el-table-column
                prop="orderMoney"
                label="投资总额"
                align='center'
                width="120"
                sortable>
                <template #default="scope">
                    <template>
                        <span style="color:#CC0033">{{ scope.row.orderMoney }}</span>
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="incomeMoney"
                label="收益金额"
                align='center'
                width="120"
                sortable>
                <template #default="scope">
                    <template>
                        <span style="color:#00d053;">+{{ scope.row.incomeMoney }}</span>
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="payType"
                label="主要投资项目"
                align='center'
                width="120">
            <template #default="scope">
                <template>
                    <el-tag
                        type="info"
                            close-transition>
                        {{scope.row.payType}}
                    </el-tag>
                </template>
            </template>
            </el-table-column>
            <el-table-column
                prop="orderPeriod"
                label="投资周期"
                align='center'
                width="120">
            </el-table-column>
            <el-table-column
                prop="orderPersonConunt"
                label="投资人数"
                align='center'
                width="120">
            </el-table-column>
            <el-table-column
                prop="orderYearRate"
                label="投资年变化率"
                align='center'
                width='120'
            >
            </el-table-column>
            <el-table-column
                prop="remarks"
                label="备注"
                align='left'
                >
                <template #default="scope">
                    <template>
                        <span style="color:#3366CC">{{scope.row.remarks}}</span>
                    </template>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script>import data from '../data/chinaTabs.json';
export default {
  /*
   * vue3-types inferred data() return type:
   * @returns {{tableData: any[], tableHeight: number}}
   */
  data() {
    return {
      tableData: [],
      tableHeight: 0
    };
  },
  /*
   * vue3-types inferred props shape:
   * @type {{ toggleData?: string }}
   * (In Vue3, the recommended equivalent is
   *   const props = defineProps<{ toggleData?: string }>()
   *   in <script setup>. For Options API, runtime props are kept as-is.)
   */
  props: {
    toggleData: [String]
  },
  mounted() {
    this.setTableHeight();
    window.onresize = () => {
      this.setTableHeight();
    };
  },
  methods: {
    /*
     * this 类型:
     * {
     *   $nextTick: unknown,
      tableHeight: unknown
     * }
     */
    setTableHeight() {
      this.$nextTick(() => {
        this.tableHeight = document.body.clientHeight - 280;
      });
    },
    /*
     * this 类型:
     * {
     *   tableData: unknown
     * }
     */
    showTableData(item) {
      switch (item) {
        case 'eastChina':
          this.tableData = data.china.eastChina;
          break;
        case 'southChina':
          this.tableData = data.china.southChina;
          break;
        case 'centralChina':
          this.tableData = data.china.centralChina;
          break;
        case 'northChina':
          this.tableData = data.china.northChina;
          break;
        case 'northwestChina':
          this.tableData = data.china.northwestChina;
          break;
        case 'southwestChina':
          this.tableData = data.china.southwestChina;
          break;
        case 'northeastChina':
          this.tableData = data.china.northeastChina;
          break;
        case 'specialareaChina':
          this.tableData = data.china.specialareaChina;
          break;
      }
    }
  },
  watch: {
    // 监听属性的变化，可以接收参数;
    toggleData(v) {
      this.showTableData(v);
    }
  }
};</script>

<style lang="less">

</style>
