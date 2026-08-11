<template>
  <el-config-provider>
    <a-config-provider>
      <div class="app">
        <h1>vue-migrate coverage-test build verification</h1>
        <p>Total components: {{ totalComponents }}</p>
        <p>Total styles: {{ totalStyles }}</p>

        <el-row :gutter="16">
          <el-col :span="12">
            <h2>Vue 2 写法测试 (MultipleStyles)</h2>
            <MultipleStylesDemo />
          </el-col>
          <el-col :span="12">
            <h2>Vue 2 UI 库测试 (UILibrariesAndStyles)</h2>
            <UILibrariesAndStylesDemo />
          </el-col>
        </el-row>
      </div>
    </a-config-provider>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MultipleStylesDemo from './MultipleStyles.vue'
import UILibrariesAndStylesDemo from './UILibrariesAndStyles.vue'

const totalComponents = computed(() => 70) // coverage-test 总数
const totalStyles = computed(() => 19) // styles/ 目录文件数
</script>
