<template>
  <div class="wangeditor-custom-toolbar">
    <h3>完全自定义 toolbar (menus 白名单)</h3>
    <div ref="editorRef" class="editor" />

    <h3>自定义菜单按钮 (扩展 menu)</h3>
    <a-button @click="customInsertMention">插入 @ 提醒</a-button>
    <a-button @click="customInsertCode">插入代码块</a-button>
    <a-button @click="customInsertLink">插入外部链接</a-button>

    <h3>menuConfig 全字段</h3>
    <a-textarea :rows="4" :value="htmlContent" readonly />
  </div>
</template>

<script>
import WangEditor from 'wangeditor'

export default {
  name: 'WangeditorCustomToolbarDemo',
  data() {
    return {
      editor: null,
      htmlContent: ''
    }
  },
  mounted() {
    this.initEditor()
  },
  beforeDestroy() {
    if (this.editor) this.editor.destroy()
  },
  methods: {
    initEditor() {
      this.editor = new WangEditor(this.$refs.editorRef)
      const config = this.editor.customConfig
      config.menus = [
        'head',
        'bold',
        'fontSize',
        'fontName',
        'italic',
        'underline',
        'strikeThrough',
        'foreColor',
        'backColor',
        'link',
        'list',
        'justify',
        'quote',
        'emoticon',
        'image',
        'table',
        'code',
        'splitLine',
        'undo',
        'redo'
      ]
      config.fontNames = [
        '宋体', '微软雅黑', '黑体', '楷体',
        'Arial', 'Tahoma', 'Verdana', 'Times New Roman'
      ]
      config.fontSizes = {
        'x-small': { name: '12px', value: '12px' },
        small: { name: '14px', value: '14px' },
        normal: { name: '16px', value: '16px' },
        large: { name: '18px', value: '18px' },
        'x-large': { name: '20px', value: '20px' },
        'xx-large': { name: '24px', value: '24px' },
        'xxx-large': { name: '32px', value: '32px' }
      }
      config.colors = [
        '#000000', '#eeece0', '#1c487f', '#4d80bf',
        '#c24f4a', '#8baa4a', '#7b5ba1', '#46acc8',
        '#f9963b', '#ffffff'
      ]
      config.emotions = [
        { alt: '[呵呵]', src: 'http://img.t.sinajs.cn/t4/appstyle/expression/ext/normal/50/pcmoren_wuhao02.png' },
        { alt: '[嘻嘻]', src: 'http://img.t.sinajs.cn/t4/appstyle/expression/ext/normal/0/pcmoren_heiaa.png' },
        { alt: '[哈哈]', src: 'http://img.t.sinajs.cn/t4/appstyle/expression/ext/normal/8/pcmoren_88.png' }
      ]
      config.linkImgCheck = (imgSrc) => {
        if (imgSrc.indexOf('http') !== 0) {
          return false
        }
        return true
      }
      config.linkCheck = (text, link) => {
        if (link.indexOf('javascript:') === 0) {
          return false
        }
        return true
      }
      config.showLinkImg = false
      config.uploadImgAccept = ['jpg', 'jpeg', 'png', 'gif', 'bmp']
      config.withCredentials = true
      config.onchange = (html) => {
        this.htmlContent = html
      }
      this.editor.create()
      this.editor.txt.html('<h1>自定义 toolbar 演示</h1>')
    },
    customInsertMention() {
      this.editor.cmd.do('insertHTML', '<span style="color: #1890ff">@username</span>&nbsp;')
    },
    customInsertCode() {
      this.editor.cmd.do('insertHTML', '<pre><code>const a = 1</code></pre>')
    },
    customInsertLink() {
      this.editor.cmd.do('insertHTML', '<a href="https://github.com/wangfupeng1988/wangEditor">wangEditor GitHub</a>')
    }
  }
}
</script>
