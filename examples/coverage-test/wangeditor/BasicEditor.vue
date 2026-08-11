<template>
  <div class="wangeditor-basic">
    <h3>基础用法 (v-model + onchange)</h3>
    <div ref="editorRef" style="border: 1px solid #ccc; min-height: 300px" />

    <h3>工具栏配置 (mode=simple / default / custom)</h3>
    <a-radio-group v-model="mode">
      <a-radio-button value="default">default</a-radio-button>
      <a-radio-button value="simple">simple</a-radio-button>
    </a-radio-group>

    <h3>readOnly / placeholder / zIndex</h3>
    <a-space>
      <a-switch v-model="readOnly" />
      <span>ReadOnly</span>
    </a-space>

    <h3>双向绑定 (显示 + 编辑)</h3>
    <a-textarea :rows="6" :value="htmlContent" readonly />

    <h3>insertText API 调用</h3>
    <a-button @click="insertHello">插入 hello</a-button>
    <a-button @click="appendEmoji">追加 emoji</a-button>
    <a-button @click="clearAll">清空</a-button>
    <a-button @click="getText">取纯文本</a-button>
    <a-button @click="getHtml">取 HTML</a-button>
  </div>
</template>

<script>
import WangEditor from 'wangeditor'

export default {
  name: 'WangeditorBasicDemo',
  data() {
    return {
      editor: null,
      mode: 'default',
      readOnly: false,
      htmlContent: '<p>初始内容</p>'
    }
  },
  watch: {
    mode(val) {
      this.editor && this.editor.customConfig && (this.editor.customConfig.menus = [])
      // wangEditor 4 旧 API 通过 destroy + recreate
      this.$nextTick(() => this.initEditor())
    },
    readOnly(val) {
      this.editor && this.editor.$textElem.attr('contenteditable', !val)
    }
  },
  mounted() {
    this.initEditor()
  },
  beforeDestroy() {
    this.editor && this.editor.destroy()
    this.editor = null
  },
  methods: {
    initEditor() {
      if (this.editor) {
        this.editor.destroy()
        this.editor = null
      }
      this.editor = new WangEditor(this.$refs.editorRef)
      // wangEditor 4 customConfig 链
      this.editor.customConfig = this.editor.customConfig || {}
      this.editor.customConfig.onchange = (html) => {
        this.htmlContent = html
        this.$emit('change', html)
      }
      this.editor.customConfig.onchangeTimeout = 400
      this.editor.customConfig.uploadImgServer = '/api/upload'
      this.editor.customConfig.uploadFileName = 'file'
      this.editor.customConfig.uploadImgHeaders = {
        token: this.$store.getters.token
      }
      this.editor.customConfig.uploadImgMaxSize = 5 * 1024 * 1024
      this.editor.customConfig.uploadImgMaxLength = 5
      this.editor.customConfig.uploadImgParams = {
        from: 'wangeditor'
      }
      this.editor.customConfig.uploadImgHooks = {
        before: (xhr, editor, files) => {
          console.log('upload before', files)
        },
        success: (xhr, editor, result) => {
          console.log('success', result)
        },
        fail: (xhr, editor, result) => {
          console.log('fail', result)
        },
        error: (xhr, editor) => {
          console.log('error')
        },
        timeout: (xhr, editor) => {
          console.log('timeout')
        },
        customInsert: (insertImg, result, editor) => {
          const url = result.data.url
          insertImg(url)
        }
      }
      this.editor.customConfig.zIndex = 100
      this.editor.customConfig.lang = 'zh-CN'
      this.editor.customConfig.pasteIgnoreImg = true
      this.editor.create()
      this.editor.txt.html(this.htmlContent)
    },
    insertHello() {
      this.editor.cmd.do('insertHTML', '<strong>hello</strong>')
    },
    appendEmoji() {
      this.editor.cmd.do('insertHTML', '😊')
    },
    clearAll() {
      this.editor.txt.clear()
    },
    getText() {
      const text = this.editor.txt.text()
      this.$message.info(`text: ${text.length} chars`)
    },
    getHtml() {
      const html = this.editor.txt.html()
      this.$message.info(`html: ${html.length} chars`)
    }
  }
}
</script>
