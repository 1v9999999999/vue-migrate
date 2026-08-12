<template>
  <div class="form-demo">
    <h3>基础表单 + v-decorator (1.x 旧 API)</h3>
    <a-form
      :form="form"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 12 }"
      @submit.prevent="handleSubmit"
    >
      <a-form-item label="Username" :validate-status="userStatus" :help="userHelp">
        <a-input
          v-decorator="[
            'username',
            { rules: [{ required: true, message: '请输入用户名' }] }
          ]"
          placeholder="Username"
        />
      </a-form-item>

      <a-form-item label="Password">
        <a-input-password
          v-decorator="[
            'password',
            { rules: [{ required: true, whitespace: true, min: 6 }] }
          ]"
          placeholder="Password"
        />
      </a-form-item>

      <a-form-item label="Email">
        <a-input
          v-decorator="[
            'email',
            {
              rules: [
                { type: 'email', message: '邮箱格式错误' },
                { required: true, message: '请输入邮箱' }
              ]
            }
          ]"
        />
      </a-form-item>

      <a-form-item label="Age">
        <a-input-number
          v-decorator="['age', { initialValue: 18 }]"
          :min="0"
          :max="150"
        />
      </a-form-item>

      <a-form-item label="Gender">
        <a-radio-group v-decorator="['gender', { initialValue: 'male' }]">
          <a-radio value="male">男</a-radio>
          <a-radio value="female">女</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="Hobbies">
        <a-checkbox-group
          v-decorator="[['hobbies'], { initialValue: ['reading'] }]"
          :options="hobbyOptions"
        />
      </a-form-item>

      <a-form-item label="City">
        <a-select
          v-decorator="['city', { rules: [{ required: true }] }]"
          placeholder="请选择城市"
          :options="cityOptions"
          show-search
          :filter-option="filterCity"
        />
      </a-form-item>

      <a-form-item label="Birthday">
        <a-date-picker
          v-decorator="['birthday']"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
        />
      </a-form-item>

      <a-form-item label="Bio">
        <a-textarea
          v-decorator="['bio', { rules: [{ max: 200 }] }]"
          :rows="4"
          placeholder="自我介绍"
        />
      </a-form-item>

      <a-form-item label="Agreement">
        <a-checkbox v-decorator="['agreement', { valuePropName: 'checked' }]">
          我已阅读 <a href="#">协议</a>
        </a-checkbox>
      </a-form-item>

      <a-form-item :wrapper-col="{ span: 12, offset: 5 }">
        <a-button type="primary" html-type="submit" :loading="submitting">
          提交
        </a-button>
        <a-button style="margin-left: 8px" @click="handleReset">重置</a-button>
        <a-button style="margin-left: 8px" @click="handleValidate">手动校验</a-button>
      </a-form-item>
    </a-form>

    <h3>动态增减字段 (v-decorator + key 数组)</h3>
    <a-form :form="dynamicForm" @submit.prevent="handleDynamicSubmit">
      <a-form-item
        v-for="(field, idx) in dynamicFields"
        :key="field.key"
        :label="`Field ${idx}`"
      >
        <a-input
          v-decorator="[
            `field[${field.key}]`,
            { rules: [{ required: true, message: '必填' }] }
          ]"
          style="width: 60%; margin-right: 8px"
        />
        <a-icon
          v-if="dynamicFields.length > 1"
          class="dynamic-delete-button"
          type="minus-circle-o"
          @click="() => removeDynamic(field)"
        />
      </a-form-item>
      <a-form-item>
        <a-button type="dashed" @click="addDynamic">
          <a-icon type="plus" /> Add field
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup>
import { ElMessage } from "element-plus";

import { onUnmounted, reactive, ref } from 'vue'

const form = reactive($form.createForm(this))
const dynamicForm = reactive($form.createForm(this))
const submitting = ref(false)
const userStatus = ref('')
const userHelp = ref('')
const hobbyOptions = reactive([{
  label: '阅读',
  value: 'reading'
}, {
  label: '音乐',
  value: 'music'
}, {
  label: '游戏',
  value: 'games'
}, {
  label: '运动',
  value: 'sports'
}])
const cityOptions = reactive([{
  label: '北京',
  value: 'beijing'
}, {
  label: '上海',
  value: 'shanghai'
}, {
  label: '深圳',
  value: 'shenzhen'
}, {
  label: '广州',
  value: 'guangzhou'
}, {
  label: '杭州',
  value: 'hangzhou'
}])
const dynamicFields = reactive([{
  key: 0
}, {
  key: 1
}])
const dynamicKey = ref(2)

function handleSubmit(e) {
    e.preventDefault();
  form.validateFields((err, values) => {
    if (!err) {
      submitting.value = true;
      console.log('Received values of form: ', values);
      ElMessage.success('提交成功');
      setTimeout(() => {
        submitting.value = false;
      }, 1500);
    }
  });
}
function handleReset() {
    form.resetFields();
  userStatus.value = '';
  userHelp.value = '';
}
function handleValidate() {
    form.validateFields(['username'], err => {
    if (err) {
      userStatus.value = 'error';
      userHelp.value = '用户名不合法';
    } else {
      userStatus.value = 'success';
      userHelp.value = '';
    }
  });
}
function filterCity(input, option) {
    return option.componentOptions.children[0].text.toLowerCase().includes(input.toLowerCase());
}
function addDynamic() {
    dynamicFields.push({
    key: dynamicKey.value++
  });
}
function removeDynamic(field) {
    const idx = dynamicFields.indexOf(field);
  if (idx !== -1) dynamicFields.splice(idx, 1);
}
function handleDynamicSubmit(e) {
    e.preventDefault();
  dynamicForm.validateFields((err, values) => {
    if (!err) console.log('dynamic:', values);
  });
}

onUnmounted(() => {
    console.log('form destroyed');
})

;
</script>
