<template>
    <div class="fillcontain">
        <head-top></head-top>
        <div class="table_container">
            <el-table
                :data="tableData"
                highlight-current-row
                style="width: 100%">
                <el-table-column
                  type="index"
                  width="100">
                </el-table-column>
                <el-table-column
                  property="registe_time"
                  label="注册日期"
                  width="220">
                </el-table-column>
                <el-table-column
                  property="username"
                  label="用户姓名"
                  width="220">
                </el-table-column>
                <el-table-column
                  property="city"
                  label="注册地址">
                </el-table-column>
            </el-table>
            <div class="Pagination" style="text-align: left;margin-top: 10px;">
                <el-pagination
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                  :current-page="currentPage"
                  :page-size="20"
                  layout="total, prev, pager, next"
                  :total="count">
                </el-pagination>
            </div>
        </div>
    </div>
</template>

<script setup>
import headTop from '../components/headTop'
    import {getUserList, getUserCount} from '@/api/getData'

import { reactive, ref } from 'vue'

const tableData = reactive<any[]>([{
    registe_time: '2016-05-02',
    username: '王小虎',
    city: '上海市普陀区金沙江路 1518 弄'
  }, {
    registe_time: '2016-05-04',
    username: '王小虎',
    city: '上海市普陀区金沙江路 1517 弄'
  }, {
    registe_time: '2016-05-01',
    username: '王小虎',
    city: '上海市普陀区金沙江路 1519 弄'
  }, {
    registe_time: '2016-05-03',
    username: '王小虎',
    city: '上海市普陀区金沙江路 1516 弄'
}])
const currentRow = ref<null>(null)
const offset = ref<number>(0)
const limit = ref<number>(20)
const count = ref<number>(0)
const currentPage = ref<number>(1)

async function initData() {
  try{
      const countData = await getUserCount();
      if (countData.status == 1) {
          count.value = countData.count;
      }else{
          throw new Error('获取数据失败');
      }
      getUsers();
  }catch(err){
      console.log('获取数据失败', err);
  }
}

function handleSizeChange(val) {
  console.log(`每页 ${val} 条`);
}

function handleCurrentChange(val) {
  currentPage.value = val;
  offset.value = (val - 1)*limit.value;
  getUsers()
}

async function getUsers() {
  const Users = await getUserList({offset: offset.value, limit: limit.value});
  Object.assign(tableData, []);
  Users.forEach(item => {
      const tableDataLocal = {};
      tableDataLocal.username = item.username;
      tableDataLocal.registe_time = item.registe_time;
      tableDataLocal.city = item.city;
      tableData.push(tableDataLocal);
  })
}

// --- created() inline ---
initData();

</script>

<style lang="less">
	@import '../style/mixin';
    .table_container{
        padding: 20px;
    }
</style>
