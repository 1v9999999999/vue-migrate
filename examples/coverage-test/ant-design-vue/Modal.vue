<template>
  <div class="modal-demo">
    <h3>基础 Modal (v-model:visible + 5 slot)</h3>
    <a-button type="primary" @click="visible1 = true">Open</a-button>
    <a-modal
      v-model="visible1"
      title="基础弹窗"
      :width="520"
      :confirm-loading="confirmLoading"
      :mask-closable="false"
      :keyboard="true"
      :ok-text="'确认'"
      :cancel-text="'取消'"
      @ok="onOk1"
      @cancel="onCancel1"
    >
      <template slot="title">
        <a-icon type="info-circle" /> 自定义标题
      </template>
      <p>基础内容</p>
      <p>第二行</p>
      <template slot="footer">
        <a-button @click="visible1 = false">返回</a-button>
        <a-button type="primary" :loading="confirmLoading" @click="onOk1">
          确认加载
        </a-button>
      </template>
    </a-modal>

    <h3>异步关闭 (beforeCancel / beforeOk)</h3>
    <a-button @click="visible2 = true">Async close</a-button>
    <a-modal
      v-model="visible2"
      title="异步关闭"
      @ok="onOk2"
    >
      <p>点确认会触发异步 loading</p>
    </a-modal>

    <h3>嵌套信息 (info / success / error / warning 4 种)</h3>
    <a-button @click="onInfo">Info</a-button>
    <a-button @click="onSuccess">Success</a-button>
    <a-button @click="onError">Error</a-button>
    <a-button @click="onWarning">Warning</a-button>

    <h3>Drawer (右侧抽屉)</h3>
    <a-button type="primary" @click="drawerVisible = true">Open Drawer</a-button>
    <a-drawer
      v-model="drawerVisible"
      title="Basic Drawer"
      placement="right"
      :width="320"
      :closable="true"
      :mask-closable="true"
      @close="onDrawerClose"
    >
      <p>抽屉内容</p>
      <a-button @click="onNestedOpen">嵌套打开 Modal</a-button>
    </a-drawer>

    <h3>Modal.method() 静态调用 (4 种)</h3>
    <a-button @click="onConfirmMethod">Confirm</a-button>
    <a-button @click="onInfoMethod">Info</a-button>
    <a-button @click="onSuccessMethod">Success</a-button>
    <a-button @click="onErrorMethod">Error</a-button>
    <a-button @click="onWarningMethod">Warning</a-button>
    <a-button @click="onModalMethod">Modal</a-button>

    <h3>自定义 footer (h render 函数, Vue 2 旧写法)</h3>
    <a-button @click="customFooterVisible = true">Custom footer</a-button>
    <a-modal
      v-model="customFooterVisible"
      title="h() render footer"
      :footer="customFooter"
    >
      <p>用 h 函数构造 footer</p>
    </a-modal>

    <h3>Modal + Form (嵌套表单)</h3>
    <a-button type="primary" @click="formModalVisible = true">表单 Modal</a-button>
    <a-modal
      v-model="formModalVisible"
      title="表单"
      :ok-button-props="{ props: { disabled: formInvalid } }"
      @ok="submitForm"
    >
      <a-form :form="modalForm" layout="vertical">
        <a-form-item label="标题">
          <a-input
            v-decorator="['title', { rules: [{ required: true }] }]"
            placeholder="请输入"
          />
        </a-form-item>
        <a-form-item label="类型">
          <a-select
            v-decorator="['type', { initialValue: 'bug' }]"
            :options="[{ label: 'Bug', value: 'bug' }, { label: 'Feature', value: 'feature' }]"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
export default {
  name: 'AntModalDemo',
  data() {
    return {
      visible1: false,
      visible2: false,
      drawerVisible: false,
      customFooterVisible: false,
      formModalVisible: false,
      confirmLoading: false,
      formInvalid: false,
      modalForm: this.$form.createForm(this)
    }
  },
  computed: {
    customFooter() {
      const h = this.$createElement
      return [
        h('a-button', { on: { click: () => { this.customFooterVisible = false } } }, '返回'),
        h('a-button', {
          props: { type: 'danger' },
          on: { click: () => { this.$message.error('危险操作') } }
        }, '危险'),
        h('a-button', {
          props: { type: 'primary' },
          on: { click: () => { this.customFooterVisible = false } }
        }, '确认')
      ]
    }
  },
  methods: {
    onOk1() {
      this.confirmLoading = true
      setTimeout(() => {
        this.visible1 = false
        this.confirmLoading = false
        this.$message.success('已确认')
      }, 1500)
    },
    onCancel1() {
      this.$message.info('已取消')
    },
    onOk2(e) {
      // Vue 2 Modal 不原生支持 async ok, 用 loading state
      this.$message.loading({ content: '加载中...', key: 'async' })
      setTimeout(() => {
        this.$message.success({ content: '完成!', key: 'async' })
        this.visible2 = false
      }, 1500)
    },
    onInfo() { this.$message.info('信息提示') },
    onSuccess() { this.$message.success('操作成功') },
    onError() { this.$message.error('操作失败') },
    onWarning() { this.$message.warning('警告') },

    onConfirmMethod() {
      this.$confirm({
        title: '确认?',
        content: '这是 confirm 方法',
        onOk: () => this.$message.success('OK'),
        onCancel: () => this.$message.info('Cancel')
      })
    },
    onInfoMethod() { this.$info({ title: 'Info', content: 'info content' }) },
    onSuccessMethod() { this.$success({ title: 'Success', content: 'success content' }) },
    onErrorMethod() { this.$error({ title: 'Error', content: 'error content' }) },
    onWarningMethod() { this.$warning({ title: 'Warning', content: 'warning content' }) },
    onModalMethod() {
      this.$modal.confirm({
        title: 'Modal confirm',
        content: 'modal method',
        onOk() {}
      })
    },

    onDrawerClose() {
      console.log('drawer closed')
    },
    onNestedOpen() {
      this.drawerVisible = false
      this.visible1 = true
    },

    submitForm() {
      this.modalForm.validateFields((err, values) => {
        if (err) {
          this.formInvalid = true
          return
        }
        this.formInvalid = false
        this.$message.success(`提交: ${values.title}`)
        this.formModalVisible = false
      })
    }
  },
  watch: {
    formModalVisible(val) {
      if (val) {
        this.$nextTick(() => {
          this.modalForm.validateFields(() => {})
        })
      }
    }
  }
}
</script>
