<template>
  <div class="button-demo">
    <h3>基础按钮 (6 type)</h3>
    <a-button type="primary" @click="onPrimary">Primary</a-button>
    <a-button type="default" @click="onDefault">Default</a-button>
    <a-button type="dashed">Dashed</a-button>
    <a-button type="danger" @click="onDanger">Danger</a-button>
    <a-button type="link" href="https://www.antdv.com" target="_blank">Link</a-button>
    <a-button type="text">Text</a-button>

    <h3>3 size</h3>
    <a-button size="large">Large</a-button>
    <a-button size="default">Default</a-button>
    <a-button size="small">Small</a-button>

    <h3>状态</h3>
    <a-button :loading="loading1" @click="toggleLoading1">Toggle loading</a-button>
    <a-button :loading="loading2" loading-type="spinner" />
    <a-button :disabled="disabled" @click="onDisable">Disabled after click</a-button>
    <a-button ghost type="primary">Ghost</a-button>
    <a-button block type="primary">Block (full width)</a-button>

    <h3>icon (3 种用法)</h3>
    <a-button type="primary" icon="search">Search</a-button>
    <a-button type="primary">
      <template #icon>
        <a-icon type="search" />
      </template>
      <span>slot icon (Vue 2.6 旧)</span>
    </a-button>
    <a-button type="primary" @click="onDownload">
      <a-icon type="download" />
      <span>icon component</span>
    </a-button>

    <h3>shape / nativeType</h3>
    <a-button shape="circle" icon="search" />
    <a-button shape="round" type="primary">Round</a-button>
    <a-button html-type="submit" type="primary">Submit</a-button>
    <a-button html-type="reset">Reset</a-button>
    <a-button html-type="button">Plain button</a-button>

    <h3>ButtonGroup (Vue 2.x 旧 API)</h3>
    <a-button-group>
      <a-button type="primary">
        <a-icon type="left" />Backward
      </a-button>
      <a-button type="primary">
        Forward<a-icon type="right" />
      </a-button>
    </a-button-group>

    <h3>Dropdown trigger</h3>
    <a-dropdown>
      <template #overlay>
        <a-menu @click="onMenuClick">
          <a-menu-item key="1">
            <a-icon type="user" />1st menu item
          </a-menu-item>
          <a-menu-item key="2">
            <a-icon type="user" />2nd menu item
          </a-menu-item>
          <a-menu-divider />
          <a-menu-item key="3">3rd menu item</a-menu-item>
        </a-menu>
      </template>
      <a-button>
        Actions <a-icon type="down" />
      </a-button>
    </a-dropdown>

    <h3>权限 / 异步 loading</h3>
    <a-button :loading="asyncLoading" @click="onAsyncAction" type="primary">
      异步操作
    </a-button>
  </div>
</template>

<script setup>
import { ElMessage, ElMessageBox } from "element-plus";

import { onBeforeUnmount, onMounted, ref } from 'vue'

const loading1 = ref(false)
const loading2 = ref(false)
const disabled = ref(false)
const asyncLoading = ref(false)

function onPrimary() {
    ElMessage.success('Primary clicked');
}
function onDefault() {
    ElMessage.info('Default clicked');
}
function onDanger() {
    ElMessageBox.confirm({
    title: '危险操作',
    content: '确认执行?',
    onOk() {
      console.log('ok');
    },
    onCancel() {
      console.log('cancel');
    }
  });
}
function onDisable() {
    disabled.value = true;
  ElMessage.warning('Button disabled');
}
function onDownload() {
    // Vue 2.x 旧 instance API
  const blob = new Blob(['hello']);
  /* $forceUpdate removed */triggerRef() /* 请选择要 trigger 的 ref */; // 强制刷新
}
function onMenuClick({
  key
}) {
    ElMessage.info(`menu: ${key}`);
}
function onAsyncAction() {
    asyncLoading.value = true;
  setTimeout(() => {
    asyncLoading.value = false;
    ElMessage.success('done');
  }, 1500);
}
function toggleLoading1() {
    loading1.value = !loading1.value;
}

onMounted(() => {
    timer = setTimeout(() => {
    loading2.value = true;
  }, 2000);
})
onBeforeUnmount(() => {
    clearTimeout(timer);
})

;
</script>
