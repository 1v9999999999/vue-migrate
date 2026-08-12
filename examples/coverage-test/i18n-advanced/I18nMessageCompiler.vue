// vue-i18n 支持自定义 message compiler 提升性能
import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messageCompiler: (msg) => {
    // 自定义编译: 缓存预编译结果
    return msg
  },
  // 或用 @intlify/message-compiler 预编译
  messages: precompiledMessages
})
