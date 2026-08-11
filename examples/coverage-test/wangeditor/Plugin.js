// wangeditor 自定义 menu / plugin 工厂 (Vue 2 旧版本兼容性封装)

import WangEditor from 'wangeditor'

// 1. 自定义 menu: 插入 mention
export function createMentionMenu(editor) {
  const { $, DropList, Panel, Util } = WangEditor
  // 自定义 menu
  class MentionMenu extends WangEditor.Menu {
    constructor(editor) {
      const $elem = WangEditor.$(
        `<div class="w-e-menu"><i class="w-e-icon-mention"><b>@</b></i></div>`
      )
      super(editor, $elem)
    }
    onClick() {
      const range = this.editor.selection.getRange()
      if (range) {
        this.editor.cmd.do('insertHTML', '<span class="mention">@username</span>&nbsp;')
      }
    }
  }
  MentionMenu.prototype.modelId = 'mention'
  editor.menus.extend('mention', MentionMenu)
}

// 2. 自定义 plugin: highlight 关键字
export function createHighlightPlugin(editor) {
  editor.cmd.register('highlight', (color = '#ffff00') => {
    const range = editor.selection.getRange()
    if (!range) return
    const span = WangEditor.$(
      `<span style="background-color: ${color}" data-highlight="true">${range.toString()}</span>`
    )
    range.insertNode(span)
  })
}

// 3. 自定义 plugin: 插入 @ 提醒列表
export function createAtPlugin(editor) {
  const $atListContainer = WangEditor.$(
    `<div class="at-list" style="position: absolute; background: white; border: 1px solid #ccc; max-height: 200px; overflow-y: auto; display: none; z-index: 1000;"></div>`
  )
  document.body.appendChild($atListContainer)

  const atUsers = [
    { name: '张三', id: 1 },
    { name: '李四', id: 2 },
    { name: '王五', id: 3 },
    { name: '赵六', id: 4 }
  ]

  editor.txt.eventHooks.keyupEvents.push((e) => {
    if (e.key === '@') {
      const sel = editor.selection.getRange()
      const rect = sel.getBoundingClientRect()
      $atListContainer.style.top = (rect.bottom + window.scrollY) + 'px'
      $atListContainer.style.left = (rect.left + window.scrollX) + 'px'
      $atListContainer.innerHTML = atUsers.map(u => `<div data-id="${u.id}">${u.name}</div>`).join('')
      $atListContainer.style.display = 'block'
    }
  })

  $atListContainer.addEventListener('click', (e) => {
    const id = e.target.dataset.id
    const user = atUsers.find(u => String(u.id) === id)
    if (user) {
      editor.cmd.do('insertHTML', `<span class="at-user" data-id="${user.id}">@${user.name}</span>&nbsp;`)
    }
    $atListContainer.style.display = 'none'
  })
}

// 4. 工厂: 创建一个完整 wangeditor 实例 (Vue 2 用)
export function createFullEditor(elem, options = {}) {
  const editor = new WangEditor(elem)
  const c = editor.customConfig
  c.uploadImgServer = options.uploadImgServer || '/api/upload'
  c.uploadFileName = options.uploadFileName || 'file'
  c.uploadImgHeaders = options.uploadImgHeaders || {}
  c.uploadImgParams = options.uploadImgParams || {}
  c.onchange = options.onchange || ((html) => console.log('change', html))
  c.zIndex = options.zIndex || 100
  c.lang = options.lang || 'zh-CN'
  c.pasteIgnoreImg = options.pasteIgnoreImg || false
  c.menus = options.menus || [
    'head', 'bold', 'fontSize', 'fontName', 'italic', 'underline',
    'strikeThrough', 'foreColor', 'backColor', 'link', 'list',
    'justify', 'quote', 'emoticon', 'image', 'table', 'code',
    'splitLine', 'undo', 'redo'
  ]

  if (options.mentionMenu) createMentionMenu(editor)
  if (options.highlight) createHighlightPlugin(editor)
  if (options.atPlugin) createAtPlugin(editor)

  editor.create()
  if (options.initialHtml) editor.txt.html(options.initialHtml)
  return editor
}

// 5. 销毁工具
export function destroyEditor(editor) {
  if (editor && typeof editor.destroy === 'function') {
    editor.destroy()
  }
}

// 6. Vue 2 旧 prototype 注入方式
export function setupWangeditorGlobal(Vue, options = {}) {
  Vue.prototype.$wangeditor = {
    create: createFullEditor,
    destroy: destroyEditor,
    MentionMenu: createMentionMenu,
    HighlightPlugin: createHighlightPlugin,
    AtPlugin: createAtPlugin
  }
}
