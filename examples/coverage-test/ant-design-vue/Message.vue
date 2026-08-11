<template>
  <div class="message-demo">
    <h3>$message (4 种 type + duration + onClose)</h3>
    <a-button @click="showInfo">Info</a-button>
    <a-button @click="showSuccess">Success</a-button>
    <a-button @click="showError">Error</a-button>
    <a-button @click="showWarning">Warning</a-button>
    <a-button @click="showLoading">Loading</a-button>

    <h3>自定义 duration + onClose + icon</h3>
    <a-button @click="showCustom">Custom (10s)</a-button>

    <h3>多个 message 顺序触发 (key 标识, 可手动关闭)</h3>
    <a-button @click="showSequential">Sequential 3</a-button>
    <a-button @click="closeAllKey">Close by key</a-button>

    <h3>$notification (4 种 type + placement 4 种)</h3>
    <a-button @click="notifTopRight">TopRight</a-button>
    <a-button @click="notifTopLeft">TopLeft</a-button>
    <a-button @click="notifBottomRight">BottomRight</a-button>
    <a-button @click="notifBottomLeft">BottomLeft</a-button>

    <h3>带 btn 通知 (custom btn slot)</h3>
    <a-button @click="notifWithBtn">Custom btn</a-button>

    <h3>群组通知 (grouping + closeAll)</h3>
    <a-button @click="notifGrouping">3 same msgs</a-button>
    <a-button @click="notifCloseAll">closeAll</a-button>

    <h3>loading 组件 (静态 + 包裹)</h3>
    <a-button @click="showStaticLoading">Static loading</a-button>
    <a-button @click="showWrapLoading">Wrap loading</a-button>
  </div>
</template>

<script>
export default {
  name: 'AntMessageDemo',
  data() {
    return {
      seqKey: 'seq-msg'
    }
  },
  methods: {
    showInfo() {
      this.$message.info('这是一条 info 提示', 2)
    },
    showSuccess() {
      this.$message.success('操作成功', 3)
    },
    showError() {
      this.$message.error('操作失败', 3)
    },
    showWarning() {
      this.$message.warning('警告信息', 2)
    },
    showLoading() {
      const hide = this.$message.loading('加载中...', 0)
      setTimeout(hide, 2000)
    },
    showCustom() {
      this.$message.info({
        content: '持续 10 秒, 带关闭回调',
        duration: 10,
        icon: <a-icon type="smile" />,
        onClose: () => this.$message.info('关闭了')
      })
    },
    showSequential() {
      this.$message.loading({ content: '步骤 1', key: this.seqKey })
      setTimeout(() => {
        this.$message.info({ content: '步骤 2', key: this.seqKey })
      }, 1000)
      setTimeout(() => {
        this.$message.success({ content: '步骤 3', key: this.seqKey, duration: 2 })
      }, 2000)
    },
    closeAllKey() {
      this.$message.destroy(this.seqKey)
    },
    notifTopRight() {
      this.$notification.success({
        message: 'TopRight',
        description: '右上角通知',
        placement: 'topRight',
        duration: 3
      })
    },
    notifTopLeft() {
      this.$notification.info({
        message: 'TopLeft',
        description: '左上角通知',
        placement: 'topLeft'
      })
    },
    notifBottomRight() {
      this.$notification.error({
        message: 'BottomRight',
        description: '右下角通知',
        placement: 'bottomRight'
      })
    },
    notifBottomLeft() {
      this.$notification.warning({
        message: 'BottomLeft',
        description: '左下角通知',
        placement: 'bottomLeft'
      })
    },
    notifWithBtn() {
      const h = this.$createElement
      this.$notification.open({
        message: '需要操作',
        description: '带按钮的通知',
        btn: h('a-button', {
          props: { type: 'primary', size: 'small' },
          on: { click: () => this.$notification.close(this.notifKey) }
        }, '立即查看'),
        key: this.notifKey
      })
    },
    notifGrouping() {
      // 3 条同 key 只会展示最后一条
      for (let i = 1; i <= 3; i++) {
        this.$notification.info({
          message: '群组测试',
          description: `第 ${i} 次`,
          key: 'group-notif'
        })
      }
    },
    notifCloseAll() {
      this.$notification.destroy()
      this.$message.success('已关闭所有通知')
    },
    showStaticLoading() {
      const h = this.$createElement
      this.$loading({
        spinning: true,
        tip: '加载中...',
        size: 'large'
      }, h('div', { style: 'height: 200px; background: #f5f5f5' }, '静态内容'))
      setTimeout(() => {
        this.$loading.destroy()
      }, 2000)
    },
    showWrapLoading() {
      this.loading = true
      this.$nextTick(() => {
        this.loading = false
        this.$message.success('done')
      })
    }
  }
}
</script>
