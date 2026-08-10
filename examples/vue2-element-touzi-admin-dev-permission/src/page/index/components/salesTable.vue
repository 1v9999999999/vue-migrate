<template>
  <div class="salesTable">
    <el-table
      :data="tableData"
      stripe
      height="424"
      style="width: 100%">
      <el-table-column
        class-name="salesUsername"
        prop="username"
        label="USERNAME"
        width="150"
      >
        <template #default="scope">
          <template>
              <img class="userImg" :src="userImg" alt="tuxiang"/>
              {{(scope.row.username).substring(0,12)}}
          </template>
        </template>
      </el-table-column>
      <el-table-column
        class-name="salesPrice"
        prop="price"
        label="PRICE"
        width="80"
      >
        <template #default="scope">
          <template>
            <span v-if="scope.row.status === 1" class="saleColor">$ {{scope.row.price}}</span>
            <span v-if="scope.row.status === 2" class="taxColor">$ {{scope.row.price}}</span>
            <span v-if="scope.row.status === 3" class="extenedColor">$ {{scope.row.price}}</span>
            <span v-if="scope.row.status0 === 4" class="likeColor">$ {{scope.row.price}}</span>
          </template>
        </template>
      </el-table-column>
      <el-table-column
        prop="date"
        label="DATE"
        width="160"
      >
        <template #default="scope">
          <template>
             <icon-svg icon-class="icontime" />
             {{scope.row.date}}
          </template>
        </template>
      </el-table-column>
      <el-table-column
        class-name="salesStatus"
        prop="status"
        label="STATUS"
        >
        <template #default="scope">
          <template>
            <span v-if="scope.row.status === 1" class="saleBgcolor">SALE</span>
            <span v-if="scope.row.status === 2" class="taxBgcolor">TAX</span>
            <span v-if="scope.row.status === 3" class="extenedBgcolor">EXTENDED</span>
            <span v-if="scope.row.status === 4" class="likeBgcolor">LIKE</span>
          </template>
        </template>
      </el-table-column>
    
    </el-table>
  </div>
</template>

<script>import { getSalesTableList } from "@/api/sales";
import userImg from "@/assets/img/avatar-3.png";
export default {
  /*
   * vue3-types inferred data() return type:
   * @returns {{tableData: any[], userImg: unknown}}
   */
  data() {
    return {
      tableData: [],
      userImg: userImg
    };
  },
  mounted() {
    this.getSalesList();
  },
  methods: {
    // 获取列表数据
    /*
     * this 类型:
     * {
     *   pageTotal: unknown,
      tableData: unknown
     * }
     */
    getSalesList() {
      getSalesTableList({}).then(res => {
        console.log(res);
        this.pageTotal = res.data.total;
        this.tableData = res.data.list;
      });
    }
  }
};</script>

<style lang="less" scoped>

</style>