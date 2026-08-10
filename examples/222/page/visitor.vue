<template>
    <div>
        <head-top></head-top>
        <visitor-pie :pieData="pieData"></visitor-pie>
    </div>
</template>

<script setup>
import headTop from '../components/headTop';
import visitorPie from '@/components/visitorPie';
import { getUserCity } from '@/api/getData';

import { onMounted, reactive } from 'vue'

const pieData = reactive({})

async function initData() {
    try {
    const res = await getUserCity();
    if (res.status == 1) {
      Object.assign(pieData, res.user_city);
    } else {
      throw new Error(res);
    }
  } catch (err) {
    console.log('获取用户分布信息失败', err);
  }
}

onMounted(() => {
    initData();
})

;
</script>

<style lang="less">
	@import '../style/mixin';
	
</style>
