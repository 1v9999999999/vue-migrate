<template>
    <div class="fillcontain">
        <head-top></head-top>
        <div class="table_container">
            <el-table
			    :data="tableData"
			    @expand='expand'
                :expand-row-keys='expendRow'
                :row-key="row => row.index"
			    style="width: 100%">
			    <el-table-column type="expand">
			      <template #default="props">
			        <el-form label-position="left" inline class="demo-table-expand">
			          <el-form-item label="用户名" >
			            <span>{{ props.row.user_name }}</span>
			          </el-form-item>
			          <el-form-item label="店铺名称">
			            <span>{{ props.row.restaurant_name }}</span>
			          </el-form-item>
			          <el-form-item label="收货地址">
			            <span>{{ props.row.address }}</span>
			          </el-form-item>
			          <el-form-item label="店铺 ID">
			            <span>{{ props.row.restaurant_id }}</span>
			          </el-form-item>
			          <el-form-item label="店铺地址">
			            <span>{{ props.row.restaurant_address }}</span>
			          </el-form-item>
			        </el-form>
			      </template>
			    </el-table-column>
			    <el-table-column
			      label="订单 ID"
			      prop="id">
			    </el-table-column>
			    <el-table-column
			      label="总价格"
			      prop="total_amount">
			    </el-table-column>
			    <el-table-column
			      label="订单状态"
			      prop="status">
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
import { getOrderList, getOrderCount, getResturantDetail, getUserInfo, getAddressById } from '@/api/getData';
import { useRoute } from 'vue-router'
import { nextTick } from 'vue'

import { onMounted, reactive, ref } from 'vue'

const tableData = reactive([])
const currentRow = ref(null)
const offset = ref(0)
const limit = ref(20)
const count = ref(0)
const currentPage = ref(1)
const restaurant_id = ref(null)
const expendRow = reactive([])

const route = useRoute()
// --- created() inline ---
  restaurant_id.value = route.query.restaurant_id;
  initData();
async function initData() {
    try {
    const countData = await getOrderCount({
      restaurant_id: restaurant_id.value
    });
    if (countData.status == 1) {
      count.value = countData.count;
    } else {
      throw new Error('获取数据失败');
    }
    getOrders();
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
  getOrders();
}
async function getOrders() {
    const Orders = await getOrderList({
    offset: offset.value,
    limit: limit.value,
    restaurant_id: restaurant_id.value
  });
  tableData.splice(0, tableData.length, ...[]);
  Orders.forEach((item, index) => {
    const tableData = {};
    tableData.id = item.id;
    tableData.total_amount = item.total_amount;
    tableData.status = item.status_bar.title;
    tableData.user_id = item.user_id;
    tableData.restaurant_id = item.restaurant_id;
    tableData.address_id = item.address_id;
    tableData.index = index;
    tableData.push(tableData);
  });
}
async function expand(row, status) {
    if (status) {
    const restaurant = await getResturantDetail(row.restaurant_id);
    const userInfo = await getUserInfo(row.user_id);
    const addressInfo = await getAddressById(row.address_id);
    tableData.splice(row.index, 1, {
      ...row,
      ...{
        restaurant_name: restaurant.name,
        restaurant_address: restaurant.address,
        address: addressInfo.address,
        user_name: userInfo.username
      }
    });
    nextTick(() => {
      expendRow.push(row.index);
    });
  } else {
    const index = expendRow.indexOf(row.index);
    expendRow.splice(index, 1);
  }
}

onMounted(() => {
  
})

;
</script>

<style lang="less">
	@import '../style/mixin';
    .table_container{
        padding: 20px;
    }
    .demo-table-expand {
	    font-size: 0;
	}
	.demo-table-expand label {
	    width: 90px;
	    color: #99a9bf;
	}
	.demo-table-expand .el-form-item {
	    margin-right: 0;
	    margin-bottom: 0;
	    width: 50%;
	}
</style>
