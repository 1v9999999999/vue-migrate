<template>
  <div class="search_container searchArea">
        <el-form 
            :inline="true" 
            :model='search_data' 
            :rules="rules"
            ref="search_data" 
            class="demo-form-inline search-form">
            <el-form-item label="">
                <el-input v-model="search_data.name" placeholder="用户名"  @keyup.enter.native='onScreeoutMoney("search_data")'></el-input>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" size="small" icon="search" @click='onScreeoutMoney("search_data")'>筛选</el-button>
            </el-form-item>

            <el-form-item class="btnRight">
                <el-button type="primary" size="small" icon="view" @click='onBatchDelMoney()' :disabled="searchBtnDisabled">批量删除</el-button>
                <!-- <el-button type="success" size ="mini" icon="view">导出Elcel</el-button> -->
                <el-button type="primary" size="small" icon="view" @click='onAddMoney()'>添加</el-button>
            </el-form-item>
        </el-form>
    </div>
</template>

<script>import { mapGetters } from 'vuex';
export default {
  name: 'searchItem',
  /*
   * vue3-types inferred data() return type:
   * @returns {{search_data: { startTime: string; endTime: string; name: string }, rules: { name: { required: boolean; message: string; trigger: string }[] }}}
   */
  data() {
    return {
      search_data: {
        startTime: '',
        endTime: '',
        name: ''
      },
      rules: {
        name: [{
          required: true,
          message: '请输入用户名',
          trigger: 'blur'
        }]
      }
    };
  },
  computed: {
    ...mapGetters(['searchBtnDisabled'])
  },
  created() {},
  methods: {
    /*
     * this 类型:
     * {
     *   $refs: unknown,
      $store: unknown,
      search_data: unknown,
      $emit: unknown
     * }
     */
    /*
     * vue3-types TODO:
     * 
     *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
     */
    onScreeoutMoney(searchForm) {
      this.$refs[searchForm].validate(
      /*
       * vue3-types TODO:
       * 
       *   - $store ×1: this.$store → useXxxStore() (Pinia). 依赖 @vue-migrate/plugin-vuex-pinia
       */
      valid => {
        if (valid) {
          this.$store.commit('SET_SEARCH', this.search_data);
          this.$emit("searchList");
        }
      });
    },
    /*
     * this 类型:
     * {
     *   $emit: unknown
     * }
     */
    onAddMoney() {
      this.$emit("showDialog", 'add');
    },
    /*
     * this 类型:
     * {
     *   $emit: unknown
     * }
     */
    onBatchDelMoney() {
      this.$emit("onBatchDelMoney");
    }
  }
};</script>

<style lang="less" scoped>
    .search_container{
        margin-bottom: 20px;
    }
    .btnRight{
        float: right;
        margin-right: 0px !important;
    }
    .searchArea{
        background:rgba(255,255,255,1);
        border-radius:2px;
        padding: 18px 18px 0;
    }
</style>
