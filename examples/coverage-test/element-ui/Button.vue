<!--
  element-ui/Button.vue — Button 组件穷举
  iter-090 P3 验证: 按钮各种 type / size / plain / round / circle / loading / disabled / icon / autofocus / nativeType
-->
<template>
  <div>
    <h2>Button 组件</h2>

    <!-- 1. type 6 种 -->
    <el-button>Default</el-button>
    <el-button type="primary">Primary</el-button>
    <el-button type="success">Success</el-button>
    <el-button type="info">Info</el-button>
    <el-button type="warning">Warning</el-button>
    <el-button type="danger">Danger</el-button>

    <!-- 2. plain / round / circle -->
    <el-button plain>Plain</el-button>
    <el-button round>Round</el-button>
    <el-button circle>?</el-button>

    <!-- 3. size 4 种 + medium default small -->
    <el-button>Default</el-button>
    <el-button size="medium">Medium</el-button>
    <el-button size="small">Small</el-button>
    <el-button size="mini">Mini</el-button>

    <!-- 4. icon 1 + loading -->
    <el-button icon="el-icon-edit" @click="onEdit">Edit</el-button>
    <el-button :icon="dynamicIcon">Dynamic Icon</el-button>
    <el-button :loading="loading" @click="toggleLoading">Loading</el-button>

    <!-- 5. disabled -->
    <el-button disabled>Disabled</el-button>
    <el-button :disabled="isDisabled">Dynamic Disabled</el-button>

    <!-- 6. autofocus + native-type -->
    <el-button autofocus @click="onAuto">Auto Focus</el-button>
    <el-button native-type="submit" @click="onSubmit">Submit</el-button>
    <el-button native-type="reset">Reset</el-button>
    <el-button native-type="button">Button</el-button>

    <!-- 7. button-group 组合 -->
    <el-button-group>
      <el-button>Left</el-button>
      <el-button>Middle</el-button>
      <el-button>Right</el-button>
    </el-button-group>

    <!-- 8. dropdown trigger (生僻) -->
    <el-dropdown trigger="click">
      <el-button>Dropdown<i class="el-icon-arrow-down el-icon--right"></i></el-button>
      <el-dropdown-menu slot="dropdown">
        <el-dropdown-item>Action 1</el-dropdown-item>
        <el-dropdown-item>Action 2</el-dropdown-item>
        <el-dropdown-item divided>Divided</el-dropdown-item>
      </el-dropdown-menu>
    </el-dropdown>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      isDisabled: false,
      dynamicIcon: 'el-icon-search'
    }
  },
  methods: {
    onEdit() { console.log('edit') },
    onAuto() { console.log('auto') },
    onSubmit() { console.log('submit') },
    toggleLoading() {
      this.loading = true
      setTimeout(() => { this.loading = false }, 1000)
    }
  }
}
</script>
