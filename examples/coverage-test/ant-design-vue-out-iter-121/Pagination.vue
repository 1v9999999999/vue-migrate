<template>
  <div class="pagination-demo">
    <h3>基础分页 (current + total + showSizeChanger)</h3>
    <a-pagination
      v-model="current"
      :total="total"
      :page-size="pageSize"
      :show-size-changer="true"
      :show-quick-jumper="true"
      :page-size-options="['10', '20', '50', '100']"
      :show-total="total => `共 ${total} 条`"
      @change="onChange"
      @showSizeChange="onSizeChange"
    />

    <h3>mini + simple (2 种 size mode)</h3>
    <a-pagination
      v-model="current2"
      :total="50"
      :page-size="10"
      size="small"
    />
    <a-pagination
      v-model="current3"
      :total="50"
      :page-size="10"
      simple
    />

    <h3>完整事件 (change + showSizeChange + 2 itemRender)</h3>
    <a-pagination
      v-model="current4"
      :total="500"
      :page-size="20"
      :item-render="itemRender"
      @change="onFullChange"
    >
      <template #prev="props">
        <a-icon type="left" />
        <span>上一页 ({{ props.page }})</span>
      </template>
      <template #next="props">
        <span>下一页 ({{ props.page }})</span>
        <a-icon type="right" />
      </template>
    </a-pagination>

    <h3>服务端分页 (controlled 模式)</h3>
    <a-pagination
      :current="serverPage.current"
      :total="serverPage.total"
      :page-size="serverPage.pageSize"
      :loading="serverLoading"
      @change="onServerPage"
    />

    <h3>隐藏某字段 (hideOnSinglePage + showLessItems)</h3>
    <a-pagination
      v-model="current5"
      :total="5"
      :page-size="1"
      :hide-on-single-page="false"
      :show-less-items="true"
    />
  </div>
</template>

<script setup>
import { ElMessage } from "element-plus";

import { reactive, ref } from 'vue'

const current = ref(1)
const current2 = ref(1)
const current3 = ref(1)
const current4 = ref(1)
const current5 = ref(1)
const total = ref(380)
const pageSize = ref(10)
const serverPage = reactive({
  current: 1,
  total: 1000,
  pageSize: 20
})
const serverLoading = ref(false)

function onChange(page, pageSize) {
    ElMessage.info(`page ${page}, size ${pageSize}`);
}
function onSizeChange(current, size) {
    ElMessage.info(`size change: ${current}, ${size}`);
  current.value = current;
  pageSize.value = size;
}
function onFullChange(page, pageSize) {
    console.log('full change', page, pageSize);
}
function onServerPage(page, pageSize) {
    serverLoading.value = true;
  setTimeout(() => {
    Object.assign(serverPage, {
      current: page,
      total: 1000,
      pageSize
    });
    serverLoading.value = false;
    ElMessage.success(`跳到第 ${page} 页`);
  }, 800);
}
function itemRender(current, type, originalElement) {
    if (type === 'prev') {
    return <a>上一页</a>;
  } else if (type === 'next') {
    return <a>下一页</a>;
  } else if (type === 'page') {
    return <a>{current}</a>;
  }
  return originalElement;
}

</script>
