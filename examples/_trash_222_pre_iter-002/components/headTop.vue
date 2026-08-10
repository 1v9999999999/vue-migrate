<template>
    <div class="header_container">

		<el-breadcrumb separator="/">
			<el-breadcrumb-item :to="{ path: '/manage' }">首页</el-breadcrumb-item>
			<el-breadcrumb-item v-for="(item, index) in route.meta" :key="index">{{item}}</el-breadcrumb-item>
		</el-breadcrumb>
		<el-dropdown @command="handleCommand" menu-align='start'>
			<img :src="baseImgPath + store.adminInfo.avatar" class="avator">
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
import {signout} from '@/api/getData'
	import {baseImgPath} from '@/config/env'
	import {mapActions, mapState} from 'vuex'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'

const store = useStore()
// TODO: 迁移到 Pinia (useXxxStore)；暂时用 Vuex useStore()
const router = useRouter()

async function handleCommand(command) {
  if (command == 'home') {
  	router.push('/manage');
  }else if(command == 'signout'){
  	const res = await signout()
  	if (res.status == 1) {
  		ElMessage({
                       type: 'success',
                       message: '退出成功'
                   });
                   router.push('/');
  	}else{
  		ElMessage({
                       type: 'error',
                       message: res.message
                   });
  	}
  }
}

// --- created() inline ---
if (!store.adminInfo.id) {
	store.dispatch('getAdminData')
}

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
