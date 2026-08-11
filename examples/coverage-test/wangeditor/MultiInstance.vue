<template>
  <div class="wangeditor-multi">
    <h3>同页面多 editor (动态增删)</h3>
    <a-button @click="addEditor">添加 editor</a-button>
    <a-button @click="removeEditor">移除最后一个</a-button>
    <a-button @click="clearAll">清空所有</a-button>

    <div v-for="(item, idx) in editors" :key="item.id" style="margin: 12px 0">
      <h4>Editor #{{ idx + 1 }}</h4>
      <div :ref="el => setEditorRef(item.id, el)" class="editor-instance" />
    </div>

    <h3>editor 实例 (数组) 双向管理</h3>
    <a-button @click="logAll">打印所有 content</a-button>
    <a-button @click="syncAll">全部同步到 Vue</a-button>

    <h3>editor form 嵌套 (dynamic form)</h3>
    <a-form :form="form" layout="vertical">
      <a-form-item label="标题">
        <a-input v-decorator="['title', { rules: [{ required: true }] }]" />
      </a-form-item>
      <a-form-item label="内容">
        <div ref="formEditorRef" class="editor-form" />
        <a-button @click="syncFormContent">同步内容到 hidden field</a-button>
        <a-form-item v-show="false">
          <a-input v-decorator="['content']" />
        </a-form-item>
      </a-form-item>
    </a-form>
  </div>
</template>

<script>
import WangEditor from 'wangeditor'

export default {
  name: 'WangeditorMultiInstanceDemo',
  data() {
    return {
      editors: [{ id: 1 }, { id: 2 }],
      nextId: 3,
      editorInstances: new Map(),
      editorRefs: new Map(),
      form: this.$form.createForm(this)
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.editors.forEach(e => this.createEditor(e))
      this.createFormEditor()
    })
  },
  beforeDestroy() {
    this.editorInstances.forEach(editor => editor.destroy())
    this.editorInstances.clear()
  },
  methods: {
    setEditorRef(id, el) {
      if (el) this.editorRefs.set(id, el)
    },
    createEditor(item) {
      const el = this.editorRefs.get(item.id)
      if (!el) return
      const editor = new WangEditor(el)
      editor.customConfig = editor.customConfig || {}
      editor.customConfig.onchange = (html) => {
        this.$set(item, 'html', html)
      }
      editor.customConfig.uploadImgServer = '/api/upload'
      editor.customConfig.menus = ['bold', 'italic', 'image', 'link']
      editor.create()
      editor.txt.html(`<p>Editor ${item.id} initial content</p>`)
      this.editorInstances.set(item.id, editor)
    },
    addEditor() {
      const item = { id: this.nextId++ }
      this.editors.push(item)
      this.$nextTick(() => this.createEditor(item))
    },
    removeEditor() {
      if (!this.editors.length) return
      const last = this.editors.pop()
      const inst = this.editorInstances.get(last.id)
      if (inst) {
        inst.destroy()
        this.editorInstances.delete(last.id)
        this.editorRefs.delete(last.id)
      }
    },
    clearAll() {
      this.editorInstances.forEach(e => e.txt.clear())
    },
    logAll() {
      this.editors.forEach((e, i) => {
        const inst = this.editorInstances.get(e.id)
        console.log(`editor ${i}:`, inst ? inst.txt.html().length : 'none')
      })
    },
    syncAll() {
      this.editors.forEach(e => {
        const inst = this.editorInstances.get(e.id)
        if (inst) this.$set(e, 'html', inst.txt.html())
      })
      this.$message.success('已同步')
    },
    createFormEditor() {
      const editor = new WangEditor(this.$refs.formEditorRef)
      editor.customConfig = editor.customConfig || {}
      editor.customConfig.onchange = (html) => {
        this.form.setFieldsValue({ content: html })
      }
      editor.customConfig.uploadImgServer = '/api/upload'
      editor.create()
      this.formEditor = editor
    },
    syncFormContent() {
      this.form.setFieldsValue({ content: this.formEditor.txt.html() })
      this.$message.success('已同步到表单')
    }
  }
}
</script>

<style scoped>
.editor-instance, .editor-form {
  border: 1px solid #d9d9d9;
  min-height: 200px;
}
</style>
