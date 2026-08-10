<template>
    <div class="fillcontain">
        <head-top></head-top>
        <div class="table_container">
            <el-table
		      :data="tableData"
		      style="width: 100%">
		      <el-table-column
		        prop="user_name"
		        label="姓名"
		        width="180">
		      </el-table-column>
		      <el-table-column
		        prop="create_time"
		        label="注册日期"
		        width="220">
		      </el-table-column>
              <el-table-column
                prop="city"
                label="地址"
                width="180">
              </el-table-column>
		      <el-table-column
		        prop="admin"
		        label="权限">
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
import headTop from '../components/headTop';
import { adminList, adminCount } from '@/api/getData';

import { reactive, ref } from 'vue'

const tableData = reactive([])
const currentRow = ref(null)
const offset = ref(0)
const limit = ref(20)
const count = ref(0)
const currentPage = ref(1)

// --- created() inline ---
  initData();
async function initData() {
    try {
    const countData = await adminCount();
    if (countData.status == 1) {
      count.value = countData.count;
    } else {
      throw new Error('获取数据失败');
    }
    getAdmin();
  } catch (err) {
    console.log('获取数据失败', err);
  }
}
function handleSizeChange(val) {
    console.log(`每页 ${val} 条`);
}
function handleCurrentChange(val) {
    currentPage.value = val;
  offset.value = (val - 1) * limit.value;
  getAdmin();
}
async function getAdmin() {
    try {
    const res = await adminList({
      offset: offset.value,
      limit: limit.value
    });
    if (res.status == 1) {
      tableData.splice(0, tableData.length, ...[]);
      res.data.forEach(item => {
        const tableItem = {
          create_time: item.create_time,
          user_name: item.user_name,
          admin: item.admin,
          city: item.city
        };
        tableData.push(tableItem);
      });
    } else {
      throw new Error(res.message);
    }
  } catch (err) {
    console.log('获取数据失败', err);
  }
}


;
</script>

<style lang="less">
	@import '../style/mixin';
    .table_container{
        padding: 20px;
    }
</style>


