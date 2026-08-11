<!--
  element-ui/Message.vue — Message / Notification / Loading 穷举
  iter-090 P3 验证: this.$message / $notify / $message.* 各种 type + offset / duration / dangerouslyUseHTMLString
-->
<template>
  <div>
    <h2>Message / Notification / Loading</h2>

    <!-- 1. $message.success / warning / error / info -->
    <el-button @click="onSuccess">Success</el-button>
    <el-button @click="onWarning">Warning</el-button>
    <el-button @click="onError">Error</el-button>
    <el-button @click="onInfo">Info</el-button>

    <!-- 2. 自定义 duration / offset / showClose -->
    <el-button @click="onCustomDuration">Custom Duration</el-button>
    <el-button @click="onCustomOffset">Custom Offset</el-button>
    <el-button @click="onShowClose">Show Close</el-button>

    <!-- 3. dangerouslyUseHTMLString (生僻) -->
    <el-button @click="onHtmlMessage">HTML Message</el-button>

    <!-- 4. 中心化 (center) -->
    <el-button @click="onCenter">Center Message</el-button>

    <!-- 5. grouping (生僻) -->
    <el-button @click="onGrouped">Grouped Message</el-button>

    <!-- 6. $notify (Notification) -->
    <h3>Notification 通知</h3>
    <el-button @click="onNotifySuccess">Notify Success</el-button>
    <el-button @click="onNotifyWarning">Notify Warning</el-button>
    <el-button @click="onNotifyError">Notify Error</el-button>

    <!-- 7. Notification 自定义 duration / position / offset -->
    <el-button @click="onNotifyCustom">Custom Position</el-button>

    <!-- 8. $message.closeAll() / $notify.closeAll() -->
    <el-button @click="onCloseAll">Close All</el-button>

    <!-- 9. Loading -->
    <h3>Loading 加载</h3>
    <el-button @click="onLoading" :loading="loading">Open Loading</el-button>
    <el-button @click="onLoadingService">Loading Service</el-button>

    <!-- 10. MessageBox (本应放 Dialog.vue, 这里补充) -->
    <el-button @click="onMsgboxCustom">Msgbox with Custom HTML</el-button>
  </div>
</template>

<script>
export default {
  data() {
    return { loading: false }
  },
  methods: {
    onSuccess() { this.$message.success('操作成功') },
    onWarning() { this.$message.warning('警告信息') },
    onError() { this.$message.error('错误信息') },
    onInfo() { this.$message.info('提示信息') },
    onCustomDuration() {
      this.$message({ message: '10秒后关闭', duration: 10000 })
    },
    onCustomOffset() {
      this.$message({ message: '距离顶部 200px', offset: 200 })
    },
    onShowClose() {
      this.$message({ message: '可关闭', showClose: true, duration: 0 })
    },
    onHtmlMessage() {
      this.$message({
        message: '<strong>HTML</strong> 内容',
        dangerouslyUseHTMLString: true
      })
    },
    onCenter() {
      this.$message({ message: '居中', center: true })
    },
    onGrouped() {
      this.$message({ message: '分组消息 1', grouping: true })
      this.$message({ message: '分组消息 2', grouping: true })
    },
    onNotifySuccess() {
      this.$notify.success({ title: '成功', message: '操作已完成' })
    },
    onNotifyWarning() {
      this.$notify.warning({ title: '警告', message: '请检查' })
    },
    onNotifyError() {
      this.$notify.error({ title: '错误', message: '操作失败' })
    },
    onNotifyCustom() {
      this.$notify({
        title: '自定义位置',
        message: '右下角通知',
        position: 'bottom-right',
        duration: 5000
      })
    },
    onCloseAll() {
      this.$message.closeAll()
      this.$notify.closeAll()
    },
    onLoading() {
      this.loading = true
      setTimeout(() => { this.loading = false }, 2000)
    },
    onLoadingService() {
      const loading = this.$loading({
        lock: true,
        text: '加载中...',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.7)'
      })
      setTimeout(() => loading.close(), 2000)
    },
    onMsgboxCustom() {
      this.$alert('<strong>HTML</strong> 内容', 'HTML Title', {
        dangerouslyUseHTMLString: true,
        confirmButtonText: 'OK'
      })
    }
  }
}
</script>
