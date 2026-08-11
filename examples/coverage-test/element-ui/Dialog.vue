<!--
  element-ui/Dialog.vue — Dialog / Drawer 穷举
  iter-090 P3 验证: modal / close-on-press-escape / fullscreen / center / before-close
-->
<template>
  <div>
    <h2>Dialog 组件</h2>

    <!-- 1. 基础 dialog -->
    <el-button @click="basicDialog = true">打开基础</el-button>
    <el-dialog title="基础对话框" :visible.sync="basicDialog" width="50%">
      <span>这是一段内容</span>
      <template #footer>
        <el-button @click="basicDialog = false">取消</el-button>
        <el-button type="primary" @click="basicDialog = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 2. modal (无遮罩) -->
    <el-button @click="modalDialog = true">打开无遮罩</el-button>
    <el-dialog title="无遮罩" :visible.sync="modalDialog" :modal="false">
      <span>没有遮罩</span>
    </el-dialog>

    <!-- 3. close-on-press-escape = false (生僻) -->
    <el-button @click="noEscDialog = true">禁用 ESC 关闭</el-button>
    <el-dialog title="禁用 ESC" :visible.sync="noEscDialog" :close-on-press-escape="false">
      <span>按 ESC 不关</span>
    </el-dialog>

    <!-- 4. fullscreen / center -->
    <el-button @click="fullDialog = true">全屏对话框</el-button>
    <el-dialog title="全屏" :visible.sync="fullDialog" fullscreen>
      <span>全屏</span>
    </el-dialog>
    <el-button @click="centerDialog = true">居中对话框</el-button>
    <el-dialog title="居中" :visible.sync="centerDialog" center>
      <span>居中 (header/footer 居中)</span>
    </el-dialog>

    <!-- 5. before-close -->
    <el-button @click="beforeCloseDialog = true">带 beforeClose</el-button>
    <el-dialog
      title="beforeClose"
      :visible.sync="beforeCloseDialog"
      :before-close="onBeforeClose"
    >
      <span>关闭前询问</span>
    </el-dialog>

    <!-- 6. 自定义 header / 内容 插槽 -->
    <el-button @click="customDialog = true">自定义插槽</el-button>
    <el-dialog :visible.sync="customDialog" width="30%">
      <template #title>
        <h3 style="color: red">Custom Title</h3>
      </template>
      <span>Custom Content</span>
      <template #footer>
        <el-button>Custom Footer</el-button>
      </template>
    </el-dialog>

    <!-- 7. Drawer (抽屉) -->
    <el-button @click="drawer = true" type="primary">打开抽屉</el-button>
    <el-drawer title="Drawer 抽屉" :visible.sync="drawer" direction="rtl" size="50%">
      <span>抽屉内容</span>
    </el-drawer>

    <!-- 8. MessageBox (通过 this.$alert / $confirm / $prompt) -->
    <el-button @click="onAlert">Alert</el-button>
    <el-button @click="onConfirm">Confirm</el-button>
    <el-button @click="onPrompt">Prompt</el-button>
    <el-button @click="onMsgbox">Msgbox</el-button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      basicDialog: false,
      modalDialog: false,
      noEscDialog: false,
      fullDialog: false,
      centerDialog: false,
      beforeCloseDialog: false,
      customDialog: false,
      drawer: false
    }
  },
  methods: {
    onBeforeClose(done) {
      this.$confirm('确认关闭？').then(() => done()).catch(() => {})
    },
    onAlert() {
      this.$alert('这是一段内容', '标题', { confirmButtonText: '确定' })
    },
    onConfirm() {
      this.$confirm('此操作将永久删除该文件, 是否继续?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => this.$message.success('删除成功'))
        .catch(() => this.$message.info('已取消'))
    },
    onPrompt() {
      this.$prompt('请输入邮箱', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/,
        inputErrorMessage: '邮箱格式不正确'
      }).then(({ value }) => this.$message.success('邮箱: ' + value))
    },
    onMsgbox() {
      this.$msgbox({
        title: '自定义',
        message: '自定义内容',
        showCancelButton: true,
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'success'
      })
    }
  }
}
</script>
