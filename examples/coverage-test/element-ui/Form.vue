<!--
  element-ui/Form.vue — Form / FormItem / Input 穷举
  iter-090 P3 验证: rules / validate / resetFields / clearValidate / label position / inline form
-->
<template>
  <div>
    <h2>Form 组件</h2>

    <!-- 1. 基础 form + rules + validate -->
    <el-form :model="form" :rules="rules" ref="ruleForm" label-width="120px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="年龄" prop="age">
        <el-input-number v-model="form.age" :min="0" :max="150" />
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-radio-group v-model="form.gender">
          <el-radio label="male">男</el-radio>
          <el-radio label="female">女</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="爱好" prop="hobbies">
        <el-checkbox-group v-model="form.hobbies">
          <el-checkbox label="music">音乐</el-checkbox>
          <el-checkbox label="sports">运动</el-checkbox>
          <el-checkbox label="reading">阅读</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="城市" prop="city">
        <el-select v-model="form.city" placeholder="请选择" clearable filterable>
          <el-option label="北京" value="bj" />
          <el-option label="上海" value="sh" />
          <el-option label="深圳" value="sz" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期" prop="date">
        <el-date-picker v-model="form.date" type="date" placeholder="选择日期" />
      </el-form-item>
      <el-form-item label="时间" prop="time">
        <el-time-picker v-model="form.time" placeholder="选择时间" />
      </el-form-item>
      <el-form-item label="开关" prop="enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item label="描述" prop="desc">
        <el-input type="textarea" v-model="form.desc" :rows="3" />
      </el-form-item>
      <el-form-item label="滑块" prop="score">
        <el-slider v-model="form.score" :min="0" :max="100" />
      </el-form-item>
      <el-form-item label="评分" prop="rate">
        <el-rate v-model="form.rate" />
      </el-form-item>
      <el-form-item label="颜色" prop="color">
        <el-color-picker v-model="form.color" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSubmit('ruleForm')">提交</el-button>
        <el-button @click="onReset('ruleForm')">重置</el-button>
        <el-button @click="onClear('ruleForm')">清空验证</el-button>
      </el-form-item>
    </el-form>

    <!-- 2. inline form -->
    <el-form :model="searchForm" inline>
      <el-form-item label="搜索">
        <el-input v-model="searchForm.q" placeholder="关键词" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">搜索</el-button>
      </el-form-item>
    </el-form>

    <!-- 3. label position -->
    <el-form :model="form" label-position="top">
      <el-form-item label="顶部标签">
        <el-input v-model="form.username" />
      </el-form-item>
    </el-form>

    <!-- 4. label-suffix -->
    <el-form :model="form" label-suffix="：">
      <el-form-item label="用户名">
        <el-input v-model="form.username" />
      </el-form-item>
    </el-form>

    <!-- 5. status (生僻: form-item 验证状态) -->
    <el-form :model="form">
      <el-form-item label="错误态" status="error" error="用户名已存在">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="成功态" status="success">
        <el-input v-model="form.email" />
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
export default {
  data() {
    return {
      form: {
        username: '',
        password: '',
        email: '',
        age: 18,
        gender: 'male',
        hobbies: [],
        city: '',
        date: null,
        time: '',
        enabled: false,
        desc: '',
        score: 50,
        rate: 0,
        color: '#409eff'
      },
      searchForm: { q: '' },
      rules: {
        username: [
          { required: true, message: '请输入用户名', trigger: 'blur' },
          { min: 3, max: 20, message: '长度 3-20', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' },
          { min: 6, message: '密码至少 6 位', trigger: 'change' },
          { pattern: /^[a-zA-Z0-9]+$/, message: '只能包含字母数字' }
        ],
        email: [
          { required: true, message: '请输入邮箱', trigger: 'blur' },
          { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
        ],
        age: [
          { required: true, message: '请输入年龄' },
          { type: 'number', message: '必须是数字' }
        ]
      }
    }
  },
  methods: {
    onSubmit(formName) {
      this.$refs[formName].validate((valid) => {
        if (valid) alert('submit!')
        else { console.log('error submit!!'); return false }
      })
    },
    onReset(formName) { this.$refs[formName].resetFields() },
    onClear(formName) { this.$refs[formName].clearValidate() },
    onSearch() { console.log('search', this.searchForm) }
  }
}
</script>
