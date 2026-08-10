<template>
	<div class="manage_page fillcontain">
		<el-row style="height: 100%;">
	  		<el-col :span="4"  style="min-height: 100%; background-color: #324057;">
				<el-menu :default-active="defaultActive" style="min-height: 100%;" theme="dark" router>
					<el-menu-item index="manage"><el-icon><Menu /></el-icon>首页</el-menu-item>
					<el-sub-menu index="2">
						<template #title><el-icon><Document /></el-icon>数据管理</template>
						<el-menu-item index="userList">用户列表</el-menu-item>
						<el-menu-item index="shopList">商家列表</el-menu-item>
						<el-menu-item index="foodList">食品列表</el-menu-item>
						<el-menu-item index="orderList">订单列表</el-menu-item>
						<el-menu-item index="adminList">管理员列表</el-menu-item>
					</el-sub-menu>
					<el-sub-menu index="3">
						<template #title><el-icon><Plus /></el-icon>添加数据</template>
						<el-menu-item index="addShop">添加商铺</el-menu-item>
						<el-menu-item index="addGoods">添加商品</el-menu-item>
					</el-sub-menu>
					<el-sub-menu index="4">
						<template #title><el-icon><Star /></el-icon>图表</template>
						<el-menu-item index="visitor">用户分布</el-menu-item>
						<!-- <el-menu-item index="newMember">用户数据</el-menu-item> -->
					</el-sub-menu>
					<el-sub-menu index="5">
						<template #title><el-icon><Edit /></el-icon>编辑</template>
						<!-- <el-menu-item index="uploadImg">上传图片</el-menu-item> -->
						<el-menu-item index="vueEdit">文本编辑</el-menu-item>
					</el-sub-menu>
					<el-sub-menu index="6">
						<template #title><el-icon><Setting /></el-icon>设置</template>
						<el-menu-item index="adminSet">管理员设置</el-menu-item>
						<!-- <el-menu-item index="sendMessage">发送通知</el-menu-item> -->
					</el-sub-menu>
					<el-sub-menu index="7">
						<template #title><el-icon><Warning /></el-icon>说明</template>
						<el-menu-item index="explain">说明</el-menu-item>
					</el-sub-menu>
				</el-menu>
			</el-col>
			<el-col :span="20" style="height: 100%;overflow: auto;">
				<keep-alive>
				    <router-view></router-view>
				</keep-alive>
			</el-col>
		</el-row>
  	</div>
</template>

<script setup>
import { useRoute } from 'vue-router'

import { computed } from 'vue'

const defaultActive = computed(() => {
    return route.path.replace('/', '');
})

const route = useRoute()
</script>


<style lang="less" scoped>
	@import '../style/mixin';
	.manage_page{
		
	}
</style>
