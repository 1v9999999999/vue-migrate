<template>
    <div class="header_container">

		<el-breadcrumb separator="/">
			<el-breadcrumb-item :to="{ path: '/manage' }">首页</el-breadcrumb-item>
			<el-breadcrumb-item v-for="(item, index) in route.meta" :key="index">{{item}}</el-breadcrumb-item>
		</el-breadcrumb>
		<el-dropdown @command="handleCommand" menu-align='start'>
			<img :src="baseImgPathData + store.adminInfo.avatar" class="avator">
			<template #dropdown>
			    <el-dropdown-menu>
    				<el-dropdown-item command="home">首页</el-dropdown-item>
    				<el-dropdown-item command="signout">退出</el-dropdown-item>
			    </el-dropdown-menu>
			</template>
		</el-dropdown>
    </div>
</template>

<script setup>
import { signout } from '@/api/getData';

import { baseImgPath } from '@/config/env';

import { ElMessage } from "element-plus";

import { useRoute } from 'vue-router';

import { useRouter } from 'vue-router';

import { useAppStore } from '@/store';


import { computed, ref } from 'vue';


const baseImgPathData = ref(baseImgPath)

const adminInfo = computed(() => useAppStore().adminInfo)

const getAdminData = (...args) => useAppStore().getAdminData(...args)

const route = useRoute()
const router = useRouter()
// --- created() inline ---
  if (!adminInfo.value.id) {
    getAdminData();
  }
async function handleCommand(command) {
    if (command == 'home') {
    router.push('/manage');
  } else if (command == 'signout') {
    const res = await signout();
    if (res.status == 1) {
      ElMessage({
        type: 'success',
        message: '退出成功'
      });
      router.push('/');
    } else {
      ElMessage({
        type: 'error',
        message: res.message
      });
    }
  }
}


;
</script>

<style lang="less">
	@import '../style/mixin';
	.header_container{
		background-color: #EFF2F7;
		height: 60px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-left: 20px;
	}
	.avator{
		.wh(36px, 36px);
		border-radius: 50%;
		margin-right: 37px;
	}
	.el-dropdown-menu__item{
        text-align: center;
    }
</style>
