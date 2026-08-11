<template>
  <div class="vxe-form-demo">
    <h3>vxe-form 基础 (rules + 3 控件类型)</h3>
    <vxe-form
      ref="xForm"
      :data="formData"
      :rules="formRules"
      :items="formItems"
      :title-bold="true"
      :title-align="'right'"
      :title-width="120"
      :title-colon="true"
      :prevent-submit="false"
      :loading="submitting"
      @submit="onFormSubmit"
      @reset="onFormReset"
    >
      <!-- 自定义 title slot -->
      <template #name_title="{ item }">
        <span style="color: #1890ff">{{ item.title }}</span>
      </template>
      <!-- 自定义默认渲染 slot -->
      <template #name_default="{ data, item }">
        <vxe-input v-model="data.name" placeholder="请输入姓名" clearable />
      </template>
      <template #age_default="{ data }">
        <vxe-input-number v-model="data.age" :min="0" :max="150" />
      </template>
      <template #gender_default="{ data }">
        <vxe-radio-group v-model="data.gender">
          <vxe-radio value="male" label="男" />
          <vxe-radio value="female" label="女" />
        </vxe-radio-group>
      </template>
      <template #hobbies_default="{ data }">
        <vxe-checkbox-group v-model="data.hobbies">
          <vxe-checkbox value="reading" label="阅读" />
          <vxe-checkbox value="music" label="音乐" />
          <vxe-checkbox value="sports" label="运动" />
        </vxe-checkbox-group>
      </template>
      <template #city_default="{ data }">
        <vxe-select v-model="data.city" :options="cityOptions" filterable clearable />
      </template>
      <template #birthday_default="{ data }">
        <vxe-date-picker v-model="data.birthday" type="date" format="yyyy-MM-dd" />
      </template>
      <template #bio_default="{ data }">
        <vxe-textarea v-model="data.bio" :rows="4" placeholder="自我介绍" />
      </template>
      <template #status_default="{ data }">
        <vxe-switch v-model="data.status" open-label="开" close-label="关" />
      </template>
      <template #tags_default="{ data }">
        <vxe-tag v-for="tag in data.tags" :key="tag" :status="getTagStatus(tag)">
          {{ tag }}
        </vxe-tag>
      </template>
      <template #agreement_default="{ data }">
        <vxe-checkbox v-model="data.agreement">
          我已阅读 <a href="#">协议</a>
        </vxe-checkbox>
      </template>
      <template #action_default>
        <vxe-button type="submit" status="primary" @click="onSubmit">提交</vxe-button>
        <vxe-button type="reset" @click="onReset">重置</vxe-button>
        <vxe-button @click="onValidate">手动校验</vxe-button>
      </template>
    </vxe-form>

    <h3>vxe-form 弹窗模式 (modal 嵌入)</h3>
    <vxe-button @click="modalVisible = true">打开表单弹窗</vxe-button>
    <vxe-modal
      v-model="modalVisible"
      title="编辑"
      width="800"
      :loading="submitting"
      :show-footer="false"
    >
      <vxe-form
        ref="modalForm"
        :data="modalFormData"
        :rules="formRules"
        :items="formItems"
        :prevent-submit="true"
      >
        <template #name_default="{ data }">
          <vxe-input v-model="data.name" />
        </template>
        <template #action_default>
          <vxe-button @click="modalVisible = false">取消</vxe-button>
          <vxe-button status="primary" @click="onModalSubmit">确定</vxe-button>
        </template>
      </vxe-form>
    </vxe-modal>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxeForm',
  data() {
    return {
      submitting: false,
      modalVisible: false,
      formData: {
        name: '',
        age: 18,
        gender: 'male',
        hobbies: [],
        city: undefined,
        birthday: '',
        bio: '',
        status: true,
        tags: ['新用户'],
        agreement: false
      },
      modalFormData: {
        name: '',
        age: 18
      },
      formItems: [
        { field: 'name', title: '姓名', span: 12, itemRender: { name: 'input' } },
        { field: 'age', title: '年龄', span: 12, itemRender: { name: 'inputNumber' } },
        { field: 'gender', title: '性别', span: 12, itemRender: { name: 'radio' } },
        { field: 'hobbies', title: '爱好', span: 12, itemRender: { name: 'checkboxGroup' } },
        { field: 'city', title: '城市', span: 12, itemRender: { name: 'select' } },
        { field: 'birthday', title: '生日', span: 12, itemRender: { name: 'datePicker' } },
        { field: 'bio', title: '简介', span: 24, itemRender: { name: 'textarea' } },
        { field: 'status', title: '状态', span: 12, itemRender: { name: 'switch' } },
        { field: 'tags', title: '标签', span: 12, slots: { default: 'tags_default' } },
        { field: 'agreement', title: '协议', span: 24, slots: { default: 'agreement_default' } },
        { field: 'action', title: '操作', span: 24, slots: { default: 'action_default' } }
      ],
      formRules: {
        name: [
          { required: true, message: '请输入姓名' },
          { min: 2, max: 20, message: '长度 2-20 字符' }
        ],
        age: [
          { required: true, message: '请输入年龄' },
          { type: 'number', min: 0, max: 150, message: '年龄 0-150' }
        ],
        city: [
          { required: true, message: '请选择城市' }
        ],
        agreement: [
          { validator: ({ cellValue }) => cellValue === true ? null : new Error('请勾选协议') }
        ]
      },
      cityOptions: [
        { label: '北京', value: 'beijing' },
        { label: '上海', value: 'shanghai' },
        { label: '深圳', value: 'shenzhen' },
        { label: '广州', value: 'guangzhou' }
      ]
    }
  },
  methods: {
    onFormSubmit() {
      this.submitting = true
      setTimeout(() => {
        this.$message.success('提交成功')
        this.submitting = false
      }, 1000)
    },
    onFormReset() {
      this.$message.info('已重置')
    },
    onSubmit() {
      this.$refs.xForm.validate((errMap) => {
        if (errMap) {
          this.$message.error('请检查表单')
        } else {
          this.onFormSubmit()
        }
      })
    },
    onReset() {
      this.$refs.xForm.reset()
    },
    onValidate() {
      this.$refs.xForm.validate()
    },
    onModalSubmit() {
      this.$refs.modalForm.validate((errMap) => {
        if (errMap) {
          this.$message.error('校验失败')
        } else {
          this.modalVisible = false
          this.$message.success('已保存')
        }
      })
    },
    getTagStatus(tag) {
      return { '新用户': 'primary', 'VIP': 'success' }[tag] || 'info'
    }
  },
  beforeDestroy() {
    console.log('form destroying')
  }
}
</script>

<style lang="scss" scoped>
.vxe-form-demo { padding: 16px; }
</style>
