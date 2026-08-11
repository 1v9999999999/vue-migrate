<template>
  <div class="wangeditor-upload">
    <h3>图片上传 (3 模式)</h3>
    <a-radio-group v-model="uploadMode">
      <a-radio value="server">server URL</a-radio>
      <a-radio value="base64">base64 (本地)</a-radio>
      <a-radio value="custom">custom hook</a-radio>
    </a-radio-group>

    <div ref="editorRef" class="editor" />

    <h3>上传进度条 (自定义 UI)</h3>
    <a-progress :percent="uploadProgress" :status="uploadStatus" />
    <a-button @click="manualUpload">手动上传测试</a-button>

    <h3>远程 URL paste 自动 upload</h3>
    <a-switch v-model="pasteHandle" />
    <span>启用 paste URL 自动抓取</span>

    <h3>视频 / 音频 上传</h3>
    <div ref="editorRef2" class="editor" />
  </div>
</template>

<script>
import WangEditor from 'wangeditor'

export default {
  name: 'WangeditorUploadDemo',
  data() {
    return {
      uploadMode: 'server',
      editor: null,
      editor2: null,
      uploadProgress: 0,
      uploadStatus: 'normal',
      pasteHandle: true
    }
  },
  watch: {
    uploadMode() {
      this.$nextTick(() => this.initEditor())
    }
  },
  mounted() {
    this.initEditor()
    this.initEditor2()
  },
  beforeDestroy() {
    if (this.editor) this.editor.destroy()
    if (this.editor2) this.editor2.destroy()
  },
  methods: {
    initEditor() {
      if (this.editor) this.editor.destroy()
      this.editor = new WangEditor(this.$refs.editorRef)
      const c = this.editor.customConfig
      c.onchange = (html) => console.log('change', html)
      if (this.uploadMode === 'server') {
        c.uploadImgServer = '/api/upload/image'
        c.uploadFileName = 'file'
        c.uploadImgParams = { type: 'editor' }
        c.uploadImgHeaders = { Authorization: `Bearer ${this.$store.getters.token}` }
        c.uploadImgTimeout = 30 * 1000
        c.uploadImgMaxSize = 10 * 1024 * 1024
        c.uploadImgMaxLength = 9
        c.uploadImgHooks = {
          before: (xhr, editor, files) => {
            this.uploadProgress = 0
            this.uploadStatus = 'active'
            console.log('before', files)
          },
          progress: (xhr, editor, percent) => {
            this.uploadProgress = Math.round(percent * 100)
          },
          success: (xhr, editor, result) => {
            this.uploadStatus = 'success'
            this.$message.success('uploaded')
            const url = result.data && result.data.url
            if (url) editor.cmd.do('insertHTML', `<img src="${url}" />`)
          },
          fail: (xhr, editor, result) => {
            this.uploadStatus = 'exception'
            this.$message.error(result.message || '上传失败')
          },
          error: (xhr, editor) => {
            this.uploadStatus = 'exception'
            this.$message.error('网络错误')
          },
          timeout: () => this.$message.warning('上传超时')
        }
      } else if (this.uploadMode === 'base64') {
        c.uploadImgShowBase64 = true
      } else {
        c.customUploadImg = (files, insert) => {
          // 完全自定义
          for (const file of files) {
            const reader = new FileReader()
            reader.onload = () => {
              insert(reader.result)
            }
            reader.readAsDataURL(file)
          }
        }
      }
      c.pasteIgnoreImg = false
      c.onfocus = () => console.log('focus')
      c.onblur = (html) => console.log('blur', html)
      this.editor.create()
    },
    initEditor2() {
      this.editor2 = new WangEditor(this.$refs.editorRef2)
      const c2 = this.editor2.customConfig
      c2.menus = ['video', 'audio', 'code']
      c2.uploadVideoServer = '/api/upload/video'
      c2.uploadVideoAccept = ['mp4', 'webm', 'ogg']
      c2.uploadVideoName = 'file'
      c2.uploadVideoHeaders = { Authorization: `Bearer ${this.$store.getters.token}` }
      c2.uploadAudioServer = '/api/upload/audio'
      c2.uploadAudioAccept = ['mp3', 'wav', 'ogg']
      c2.create()
    },
    manualUpload() {
      this.uploadStatus = 'active'
      this.uploadProgress = 0
      const fakeProgress = setInterval(() => {
        this.uploadProgress = Math.min(this.uploadProgress + 10, 100)
        if (this.uploadProgress >= 100) {
          clearInterval(fakeProgress)
          this.uploadStatus = 'success'
        }
      }, 200)
    }
  }
}
</script>
