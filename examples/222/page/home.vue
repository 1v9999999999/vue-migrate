<template>
    <div>
        <head-top></head-top>
		<section class="data_section">
			<header class="section_title">数据统计</header>
			<el-row :gutter="20" style="margin-bottom: 10px;">
                <el-col :span="4"><div class="data_list today_head"><span class="data_num head">当日数据：</span></div></el-col>
				<el-col :span="4"><div class="data_list"><span class="data_num">{{userCountData}}</span> 新增用户</div></el-col>
				<el-col :span="4"><div class="data_list"><span class="data_num">{{orderCountData}}</span> 新增订单</div></el-col>
                <el-col :span="4"><div class="data_list"><span class="data_num">{{adminCountData}}</span> 新增管理员</div></el-col>
			</el-row>
            <el-row :gutter="20">
                <el-col :span="4"><div class="data_list all_head"><span class="data_num head">总数据：</span></div></el-col>
                <el-col :span="4"><div class="data_list"><span class="data_num">{{allUserCount}}</span> 注册用户</div></el-col>
                <el-col :span="4"><div class="data_list"><span class="data_num">{{allOrderCount}}</span> 订单</div></el-col>
                <el-col :span="4"><div class="data_list"><span class="data_num">{{allAdminCount}}</span> 管理员</div></el-col>
            </el-row>
		</section>
		<tendency :sevenDate='sevenDate' :sevenDay='sevenDay'></tendency>
    </div>
</template>

<script setup>
import headTop from '../components/headTop';
import tendency from '../components/tendency';
import dtime from 'time-formater';
import { userCount, orderCount, getUserCount, getOrderCount, adminDayCount, adminCount } from '@/api/getData';

import { onMounted, reactive, ref } from 'vue'

const userCountData = ref(null)
const orderCountData = ref(null)
const adminCountData = ref(null)
const allUserCount = ref(null)
const allOrderCount = ref(null)
const allAdminCount = ref(null)
const sevenDay = reactive([])
const sevenDate = reactive([[], [], []])

async function initData() {
    const today = dtime().format('YYYY-MM-DD');
  Promise.all([userCount(today), orderCount(today), adminDayCount(today), getUserCount(), getOrderCount(), adminCount()]).then(res => {
    userCountData.value = res[0].count;
    orderCountData.value = res[1].count;
    adminCountData.value = res[2].count;
    allUserCount.value = res[3].count;
    allOrderCount.value = res[4].count;
    allAdminCount.value = res[5].count;
  }).catch(err => {
    console.log(err);
  });
}
async function getSevenData() {
    const apiArr = [[], [], []];
  sevenDay.forEach(item => {
    apiArr[0].push(userCount(item));
    apiArr[1].push(orderCount(item));
    apiArr[2].push(adminDayCount(item));
  });
  const promiseArr = [...apiArr[0], ...apiArr[1], ...apiArr[2]];
  Promise.all(promiseArr).then(res => {
    const resArr = [[], [], []];
    res.forEach((item, index) => {
      if (item.status == 1) {
        resArr[Math.floor(index / 7)].push(item.count);
      }
    });
    sevenDate.splice(0, sevenDate.length, ...resArr);
  }).catch(err => {
    console.log(err);
  });
}

onMounted(() => {
    initData();
  for (let i = 6; i > -1; i--) {
    const date = dtime(new Date().getTime() - 86400000 * i).format('YYYY-MM-DD');
    sevenDay.push(date);
  }
  getSevenData();
})

;
</script>

<style lang="less">
	@import '../style/mixin';
	.data_section{
		padding: 20px;
		margin-bottom: 40px;
		.section_title{
			text-align: center;
			font-size: 30px;
			margin-bottom: 10px;
		}
		.data_list{
			text-align: center;
			font-size: 14px;
			color: #666;
            border-radius: 6px;
            background: #E5E9F2;
            .data_num{
                color: #333;
                font-size: 26px;

            }
            .head{
                border-radius: 6px;
                font-size: 22px;
                padding: 4px 0;
                color: #fff;
                display: inline-block;
            }
        }
        .today_head{
            background: #FF9800;
        }
        .all_head{
            background: #20A0FF;
        }
	}
    .wan{
        .sc(16px, #333)
    }
</style>
