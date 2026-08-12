<template>
  <div class="clipboard-demo">
    <input v-model="text" />
    <button @click="copy">复制</button>
    <button @click="paste">粘贴</button>
    <p>已复制: {{ copiedText }}</p>
    <p>剪贴板: {{ clipboardText }}</p>
  </div>
</template>

<script>
import ClipboardJS from 'clipboard'

export default {
  name: 'ClipboardDemo',
  data() {
    return {
      text: '复制我',
      copiedText: '',
      clipboardText: '',
      clipboard: null
    }
  },
  mounted() {
    this.clipboard = new ClipboardJS('.copy-btn', {
      text: () => this.text
    })
    this.clipboard.on('success', (e) => {
      this.copiedText = e.text
      console.log('copied:', e.text)
      e.clearSelection()
    })
    this.clipboard.on('error', (e) => {
      console.error('copy failed:', e)
    })
  },
  beforeUnmount() {
    this.clipboard?.destroy()
  },
  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.text)
        this.copiedText = this.text
      } catch (e) {
        console.error('clipboard write failed:', e)
      }
    },
    async paste() {
      try {
        this.clipboardText = await navigator.clipboard.readText()
      } catch (e) {
        console.error('clipboard read failed:', e)
      }
    }
  }
}
</script>

<style scoped>
.clipboard-demo {
  padding: 20px;
}
button {
  margin: 4px;
  padding: 6px 12px;
}
</style>
