/**
 * Naive UI 组件示例
 * Vue 3 改法: Naive UI 本身只支持 Vue 3, 迁移需改 template 语法
 */
<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <div class="naive-demo">
        <n-card title="Naive UI Demo" hoverable>
          <n-form :model="formValue" :rules="rules" ref="formRef">
            <n-form-item label="Name" path="name">
              <n-input v-model:value="formValue.name" placeholder="Name" />
            </n-form-item>
            <n-form-item label="Age" path="age">
              <n-input-number v-model:value="formValue.age" :min="0" :max="150" />
            </n-form-item>
            <n-form-item label="Gender" path="gender">
              <n-select v-model:value="formValue.gender" :options="genderOptions" />
            </n-form-item>
            <n-form-item label="Hobbies" path="hobbies">
              <n-checkbox-group v-model:value="formValue.hobbies">
                <n-space>
                  <n-checkbox value="reading">Reading</n-checkbox>
                  <n-checkbox value="sports">Sports</n-checkbox>
                  <n-checkbox value="music">Music</n-checkbox>
                </n-space>
              </n-checkbox-group>
            </n-form-item>
            <n-button @click="handleSubmit" type="primary">Submit</n-button>
          </n-form>
        </n-card>

        <n-data-table
          :columns="columns"
          :data="data"
          :pagination="pagination"
          :bordered="false"
        />

        <n-modal v-model:show="showModal" preset="card" title="Modal" style="width: 600px">
          Modal content
        </n-modal>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script>
import { darkTheme, useMessage } from 'naive-ui'

export default {
  name: 'NaiveDemo',
  data() {
    return {
      darkTheme,
      formValue: { name: '', age: null, gender: null, hobbies: [] },
      rules: {
        name: { required: true, message: 'Name is required', trigger: 'blur' },
        age: { type: 'number', required: true, message: 'Age is required', trigger: 'change' }
      },
      genderOptions: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' }
      ],
      columns: [
        { title: 'Name', key: 'name' },
        { title: 'Age', key: 'age' },
        { title: 'Address', key: 'address' }
      ],
      data: [
        { name: 'Alice', age: 25, address: 'NYC' },
        { name: 'Bob', age: 30, address: 'LA' }
      ],
      pagination: { pageSize: 10 },
      showModal: false
    }
  },
  methods: {
    handleSubmit() {
      this.$refs.formRef.validate((errors) => {
        if (!errors) {
          this.$message.success('Valid!')
        } else {
          this.$message.error('Invalid')
        }
      })
    }
  }
}
</script>
