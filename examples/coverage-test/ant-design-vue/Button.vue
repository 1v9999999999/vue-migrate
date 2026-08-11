<template>
  <div class="button-demo">
    <h3>基础按钮 (6 type)</h3>
    <a-button type="primary" @click="onPrimary">Primary</a-button>
    <a-button type="default" @click="onDefault">Default</a-button>
    <a-button type="dashed">Dashed</a-button>
    <a-button type="danger" @click="onDanger">Danger</a-button>
    <a-button type="link" href="https://www.antdv.com" target="_blank">Link</a-button>
    <a-button type="text">Text</a-button>

    <h3>3 size</h3>
    <a-button size="large">Large</a-button>
    <a-button size="default">Default</a-button>
    <a-button size="small">Small</a-button>

    <h3>状态</h3>
    <a-button :loading="loading1" @click="toggleLoading1">Toggle loading</a-button>
    <a-button :loading="loading2" loading-type="spinner" />
    <a-button :disabled="disabled" @click="onDisable">Disabled after click</a-button>
    <a-button ghost type="primary">Ghost</a-button>
    <a-button block type="primary">Block (full width)</a-button>

    <h3>icon (3 种用法)</h3>
    <a-button type="primary" icon="search">Search</a-button>
    <a-button type="primary">
      <a-icon slot="icon" type="search" />
      <span>slot icon (Vue 2.6 旧)</span>
    </a-button>
    <a-button type="primary" @click="onDownload">
      <a-icon type="download" />
      <span>icon component</span>
    </a-button>

    <h3>shape / nativeType</h3>
    <a-button shape="circle" icon="search" />
    <a-button shape="round" type="primary">Round</a-button>
    <a-button html-type="submit" type="primary">Submit</a-button>
    <a-button html-type="reset">Reset</a-button>
    <a-button html-type="button">Plain button</a-button>

    <h3>ButtonGroup (Vue 2.x 旧 API)</h3>
    <a-button-group>
      <a-button type="primary">
        <a-icon type="left" />Backward
      </a-button>
      <a-button type="primary">
        Forward<a-icon type="right" />
      </a-button>
    </a-button-group>

    <h3>Dropdown trigger</h3>
    <a-dropdown>
      <a-menu slot="overlay" @click="onMenuClick">
        <a-menu-item key="1">
          <a-icon type="user" />1st menu item
        </a-menu-item>
        <a-menu-item key="2">
          <a-icon type="user" />2nd menu item
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="3">3rd menu item</a-menu-item>
      </a-menu>
      <a-button>
        Actions <a-icon type="down" />
      </a-button>
    </a-dropdown>

    <h3>权限 / 异步 loading</h3>
    <a-button :loading="asyncLoading" @click="onAsyncAction" type="primary">
      异步操作
    </a-button>
  </div>
</template>

<script>
export default {
  name: 'AntButtonDemo',
  data() {
    return {
      loading1: false,
      loading2: false,
      disabled: false,
      asyncLoading: false
    }
  },
  methods: {
    onPrimary() {
      this.$message.success('Primary clicked')
    },
    onDefault() {
      this.$message.info('Default clicked')
    },
    onDanger() {
      this.$confirm({
        title: '危险操作',
        content: '确认执行?',
        onOk() { console.log('ok') },
        onCancel() { console.log('cancel') }
      })
    },
    onDisable() {
      this.disabled = true
      this.$message.warning('Button disabled')
    },
    onDownload() {
      // Vue 2.x 旧 instance API
      const blob = new Blob(['hello'])
      this.$forceUpdate() // 强制刷新
    },
    onMenuClick({ key }) {
      this.$message.info(`menu: ${key}`)
    },
    onAsyncAction() {
      this.asyncLoading = true
      setTimeout(() => {
        this.asyncLoading = false
        this.$message.success('done')
      }, 1500)
    },
    toggleLoading1() {
      this.loading1 = !this.loading1
    }
  },
  mounted() {
    this.timer = setTimeout(() => {
      this.loading2 = true
    }, 2000)
  },
  beforeDestroy() {
    clearTimeout(this.timer)
  }
}
</script>
