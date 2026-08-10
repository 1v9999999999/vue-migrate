<template>
    <div class="fillcontain">
        <search-item @showDialog="showAddFundDialog" @searchList="getMoneyList" @onBatchDelMoney="onBatchDelMoney"></search-item>
        <div class="table_container">
            <el-table
                v-loading="loading"
                :data="tableData"
                style="width: 100%"
                align='center'
                @select="selectTable"
                @select-all="selectAll"
                >
              <el-table-column
                v-if="idFlag"
                prop="id"
                label="id"
                align='center'
                width="180">
            </el-table-column>
            <el-table-column
                type="selection"
                align='center'
                width="60">
            </el-table-column>
              <el-table-column
                prop="username"
                label="用户姓名"
                align='center'
                width="80">
            </el-table-column>
              <el-table-column
                v-if="idFlag"
                prop="address"
                label="籍贯"
                align='center'
                >
            </el-table-column>
            <el-table-column
                prop="address"
                label="籍贯"
                align='center'
                >
                 <template #default="scope">
                     <template>
                        <span style="color:#00d053">+ {{ scope.row.tableAddress || scope.row.address }}</span>
                     </template>
                 </template>
            </el-table-column>
            <el-table-column
                prop="createTime"
                label="投资时间"
                align='center'
                sortable
                width="170">
                <template #default="scope">
                    <template>
                        <el-icon name="time"></el-icon>
                        <span style="margin-left: 10px">{{ scope.row.createTime }}</span>
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="incomePayType"
                label="收支类型"
                align='center'
                width="130"
                :formatter="formatterType"
                :filters="fields.incomePayType.filter.list"
                :filter-method="filterType">
            </el-table-column>
            <el-table-column
                prop="income"
                label="收入"
                align='center'
                width="130"
                sortable> 
                <template #default="scope">
                    <template>
                        <span style="color:#00d053">+ {{ scope.row.income }}</span>
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="pay"
                label="支出"
                align='center'
                width="130"
                sortable>
                <template #default="scope">
                    <template>
                        <span style="color:#f56767">{{ scope.row.pay }}</span>
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="accoutCash"
                label="账户现金"
                align='center'
                width="130"
                sortable>
                <template #default="scope">
                    <template>
                        <span style="color:#4db3ff">{{ scope.row.accoutCash }}</span>
                    </template>
                </template>
            </el-table-column>
            <el-table-column
                prop="operation"
                align='center'
                label="操作"
                width="180">
                <template #default="scope">
                    <template>
                        <el-button 
                            type="warning" 
                            icon='edit' 
                            size="small"
                            @click='onEditMoney(scope.row)'
                        >编辑</el-button>
                        <el-button 
                            type="danger" 
                            icon='delete' 
                            size="small"
                            @click='onDeleteMoney(scope.row,scope.$index)'
                        >删除</el-button>
                    </template>
                </template>
            </el-table-column>
            </el-table>
            <pagination :pageTotal="pageTotal" @handleCurrentChange="handleCurrentChange" @handleSizeChange="handleSizeChange"></pagination>
            <addFundDialog  v-if="addFundDialog.show" :isShow="addFundDialog.show" :dialogRow="addFundDialog.dialogRow"  @getFundList="getMoneyList"  @closeDialog="hideAddFundDialog"></addFundDialog>
        </div>
    </div>
</template>

<script>import { mapGetters } from "vuex";
import * as mutils from '@/utils/mUtils';
import SearchItem from "./components/searchItem";
import AddFundDialog from "./components/addFundDialog";
import Pagination from "@/components/pagination";
import { getMoneyIncomePay, removeMoney, batchremoveMoney } from "@/api/money";
import { ElMessageBox, ElMessage } from "element-plus";
export default {
  /*
   * vue3-types inferred data() return type:
   * @returns {{tableData: any[], tableHeight: number, loading: boolean, idFlag: boolean, isShow: boolean, editid: string, rowIds: any[], sortnum: number, format_type_list: {  }, addFundDialog: { show: boolean; dialogRow: {  } }, incomePayData: { page: number; limit: number; name: string }, pageTotal: number, fields: { incomePayType: { filter: { list: { text: string; value: number }[]; multiple: boolean } } }}}
   */
  data() {
    return {
      tableData: [],
      tableHeight: 0,
      loading: true,
      idFlag: false,
      isShow: false,
      // 是否显示资金modal,默认为false
      editid: '',
      rowIds: [],
      sortnum: 0,
      format_type_list: {
        0: '提现',
        1: '提现手续费',
        2: '提现锁定',
        3: '理财服务退出',
        4: '购买宜定盈',
        5: '充值',
        6: '优惠券',
        7: '充值礼券',
        8: '转账'
      },
      addFundDialog: {
        show: false,
        dialogRow: {}
      },
      incomePayData: {
        page: 1,
        limit: 20,
        name: ''
      },
      pageTotal: 0,
      // 用于列表筛选
      fields: {
        incomePayType: {
          filter: {
            list: [{
              text: '提现',
              value: 0
            }, {
              text: '提现手续费',
              value: 1
            }, {
              text: '提现锁定',
              value: 2
            }, {
              text: '理财服务退出',
              value: 3
            }, {
              text: '购买宜定盈',
              value: 4
            }, {
              text: '充值',
              value: 5
            }, {
              text: '优惠券',
              value: 6
            }, {
              text: '充值礼券',
              value: 7
            }, {
              text: '转账',
              value: 8
            }],
            multiple: true
          }
        }
      }
    };
  },
  components: {
    SearchItem,
    AddFundDialog,
    Pagination
  },
  computed: {
    ...mapGetters(['search'])
  },
  mounted() {
    this.getMoneyList();
  },
  methods: {
    setAddress(value) {},
    /*
     * this 类型:
     * {
     *   $nextTick: unknown,
      tableHeight: unknown
     * }
     */
    setTableHeight() {
      this.$nextTick(() => {
        this.tableHeight = document.body.clientHeight - 300;
      });
    },
    // 获取资金列表数据
    /*
     * this 类型:
     * {
     *   incomePayData: unknown,
      search: unknown,
      loading: unknown,
      pageTotal: unknown,
      tableData: unknown
     * }
     */
    getMoneyList() {
      const para = Object.assign({}, this.incomePayData, this.search);
      getMoneyIncomePay(para).then(res => {
        this.loading = false;
        this.pageTotal = res.data.total;
        this.tableData = res.data.moneyList;
      });
    },
    // 显示资金弹框
    /*
     * this 类型:
     * {
     *   $store: unknown,
      addFundDialog: unknown
     * }
     */
    /*
     * vue3-types TODO:
     * 
     *   - $store ×1: this.$store → useXxxStore() (Pinia). 依赖 @vue-migrate/plugin-vuex-pinia
     */
    showAddFundDialog(val) {
      this.$store.commit('SET_DIALOG_TITLE', val);
      this.addFundDialog.show = true;
    },
    /*
     * this 类型:
     * {
     *   addFundDialog: unknown
     * }
     */
    hideAddFundDialog() {
      this.addFundDialog.show = false;
    },
    // 上下分页
    /*
     * this 类型:
     * {
     *   incomePayData: unknown,
      getMoneyList: Function
     * }
     */
    handleCurrentChange(val) {
      this.incomePayData.page = val;
      this.getMoneyList();
    },
    // 每页显示多少条
    /*
     * this 类型:
     * {
     *   incomePayData: unknown,
      getMoneyList: Function
     * }
     */
    handleSizeChange(val) {
      this.incomePayData.limit = val;
      this.getMoneyList();
    },
    getPay(val) {
      if (mutils.isInteger(val)) {
        return -val;
      } else {
        return val;
      }
    },
    /**
    * 格式化状态
    */
    /*
     * this 类型:
     * {
     *   format_type_list: unknown
     * }
     */
    formatterType(item) {
      const type = parseInt(item.incomePayType);
      return this.format_type_list[type];
    },
    /*
     * this 类型:
     * {
     *   format_type_list: unknown
     * }
     */
    filterType(value, item) {
      const type = parseInt(item.incomePayType);
      return this.format_type_list[value] == this.format_type_list[type];
    },
    // 编辑操作方法
    /*
     * this 类型:
     * {
     *   addFundDialog: unknown,
      showAddFundDialog: Function
     * }
     */
    onEditMoney(row) {
      this.addFundDialog.dialogRow = {
        ...row
      };
      this.showAddFundDialog();
    },
    // 删除数据
    /*
     * this 类型:
     * {
     *   getMoneyList: Function
     * }
     */
    onDeleteMoney(row) {
      ElMessageBox.confirm('确认删除该记录吗?', '提示', {
        type: 'warning'
      }).then(() => {
        const para = {
          id: row.id
        };
        removeMoney(para).then(res => {
          ElMessage({
            message: '删除成功',
            type: 'success'
          });
          this.getMoneyList();
        });
      }).catch(() => {});
    },
    /*
     * this 类型:
     * {
     *   rowIds: unknown,
      getMoneyList: Function
     * }
     */
    onBatchDelMoney() {
      ElMessageBox.confirm('确认批量删除记录吗?', '提示', {
        type: 'warning'
      }).then(() => {
        const ids = this.rowIds.map(item => item.id).toString();
        const para = {
          ids: ids
        };
        batchremoveMoney(para).then(res => {
          ElMessage({
            message: '批量删除成功',
            type: 'success'
          });
          this.getMoneyList();
        });
      }).catch(() => {});
    },
    // 当用户手动勾选数据行的 Checkbox 时触发的事件
    /*
     * this 类型:
     * {
     *   setSearchBtn: Function
     * }
     */
    selectTable(val, row) {
      this.setSearchBtn(val);
    },
    // 用户全选checkbox时触发该事件
    /*
     * this 类型:
     * {
     *   rowIds: unknown,
      setSearchBtn: Function
     * }
     */
    selectAll(val) {
      val.forEach(item => {
        this.rowIds.push(item.id);
      });
      this.setSearchBtn(val);
    },
    /*
     * this 类型:
     * {
     *   $store: unknown
     * }
     */
    /*
     * vue3-types TODO:
     * 
     *   - $store ×1: this.$store → useXxxStore() (Pinia). 依赖 @vue-migrate/plugin-vuex-pinia
     */
    setSearchBtn(val) {
      let isFlag = true;
      if (val.length > 0) {
        isFlag = false;
      } else {
        isFlag = true;
      }
      this.$store.commit('SET_SEARCHBTN_DISABLED', isFlag);
    }
  }
};</script>

<style lang="less" scoped>
    .table_container{
        padding: 10px;
        background: #fff;
        border-radius: 2px;
    }
    .el-dialog--small{
       width: 600px !important;
    }
    .pagination{
        text-align: left;
        margin-top: 10px;
    }
     
</style>


