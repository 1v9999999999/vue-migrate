/**
 * 规则 2.12: prefix-icon="el-icon-xxx" → <template #prefix><el-icon><Xxx /></el-icon></template>
 *
 * Element Plus 中 el-input / el-select 等组件不再支持 prefix-icon 字符串属性。
 * 需要在 children 里加：
 *   <el-input v-model="...">
 *     <template #prefix>
 *       <el-icon><Document /></el-icon>
 *     </template>
 *   </el-input>
 *
 * 实现策略（避免 offset 偏移问题）：
 *   1. 一次性扫描 template 字符，重建一个新 string
 *   2. 在遇到 prefix-icon 属性时跳过它
 *   3. 在 open tag 之后插入 <template #prefix>...</template> 内容
 *   4. self-closing 元素时改成 <el-xxx>...</el-xxx> 形式
 */

const SUPPORTED_TAGS = new Set([
  'el-input',
  'el-select',
  'el-autocomplete',
  'el-cascader',
  'el-date-picker',
  'el-time-picker',
  'el-time-select',
  'el-tree-select',
])

const ICON_MAP: Record<string, string> = {
  'el-icon-document': 'Document',
  'el-icon-search': 'Search',
  'el-icon-close': 'Close',
  'el-icon-delete': 'Delete',
  'el-icon-edit': 'Edit',
  'el-icon-edit-outline': 'EditPen',
  'el-icon-setting': 'Setting',
  'el-icon-arrow-left': 'ArrowLeft',
  'el-icon-arrow-right': 'ArrowRight',
  'el-icon-arrow-up': 'ArrowUp',
  'el-icon-arrow-down': 'ArrowDown',
  'el-icon-loading': 'Loading',
  'el-icon-check': 'Check',
  'el-icon-plus': 'Plus',
  'el-icon-minus': 'Minus',
  'el-icon-info': 'InfoFilled',
  'el-icon-warning': 'Warning',
  'el-icon-success': 'SuccessFilled',
  'el-icon-error': 'CircleClose',
  'el-icon-question': 'QuestionFilled',
  'el-icon-user': 'User',
  'el-icon-phone': 'Phone',
  'el-icon-message': 'Message',
  'el-icon-star-on': 'Star',
  'el-icon-star-off': 'Star',
  'el-icon-s-home': 'HomeFilled',
  'el-icon-s-tools': 'Tools',
  'el-icon-s-operation': 'Operation',
  'el-icon-s-order': 'List',
  'el-icon-s-unfold': 'Expand',
  'el-icon-s-fold': 'Fold',
  'el-icon-s-data': 'DataAnalysis',
  'el-icon-s-marketing': 'TrendCharts',
  'el-icon-s-flag': 'Flag',
  'el-icon-s-comment': 'ChatDotRound',
  'el-icon-s-finance': 'Money',
  'el-icon-s-custom': 'UserFilled',
  'el-icon-s-claim': 'FirstAidKit',
  'el-icon-s-management': 'Management',
  'el-icon-s-check': 'Select',
  'el-icon-s-cooperation': 'Connection',
  'el-icon-s-ticket': 'Postcard',
  'el-icon-s-release': 'UploadFilled',
  'el-icon-s-shop': 'Shop',
  'el-icon-s-open': 'Promotion',
  'el-icon-s-tour': 'Compass',
  'el-icon-s-promotion': 'Promotion',
  'el-icon-s-platform': 'Platform',
  'el-icon-s-grid': 'Grid',
  'el-icon-s-goods': 'Goods',
  'el-icon-sold-out': 'GoodsFilled',
  'el-icon-sell': 'Sell',
  'el-icon-camera-solid': 'Camera',
  'el-icon-upload': 'Upload',
  'el-icon-download': 'Download',
  'el-icon-refresh': 'Refresh',
  'el-icon-view': 'View',
  'el-icon-bell': 'Bell',
  'el-icon-chat-dot-round': 'ChatDotRound',
  'el-icon-chat-line-round': 'ChatLineRound',
  'el-icon-chat-line-square': 'ChatLineSquare',
  'el-icon-chat-dot-square': 'ChatDotSquare',
  'el-icon-position': 'Position',
  'el-icon-date': 'Calendar',
  'el-icon-key': 'Key',
  'el-icon-lock': 'Lock',
  'el-icon-unlock': 'Unlock',
  'el-icon-coordinate': 'Coordinate',
  'el-icon-data-line': 'DataLine',
  'el-icon-data-board': 'DataBoard',
  'el-icon-data-analysis': 'DataAnalysis',
  'el-icon-share': 'Share',
  'el-icon-collection': 'Collection',
  'el-icon-collection-tag': 'CollectionTag',
  'el-icon-files': 'Files',
  'el-icon-folder': 'Folder',
  'el-icon-folder-opened': 'FolderOpened',
  'el-icon-document-add': 'DocumentAdd',
  'el-icon-document-checked': 'DocumentChecked',
  'el-icon-document-copy': 'DocumentCopy',
  'el-icon-document-delete': 'DocumentDelete',
  'el-icon-document-remove': 'DocumentRemove',
  'el-icon-filter': 'Filter',
  'el-icon-first-aid-kit': 'FirstAidKit',
  'el-icon-food': 'Food',
  'el-icon-goblet': 'Goblet',
  'el-icon-goblet-square': 'GobletSquare',
  'el-icon-goods-filled': 'GoodsFilled',
  'el-icon-grape': 'Grape',
  'el-icon-house': 'House',
  'el-icon-ice-cream-round': 'IceCreamRound',
  'el-icon-ice-cream-square': 'IceCreamSquare',
  'el-icon-coin': 'Coin',
  'el-icon-cold-drink': 'ColdDrink',
  'el-icon-coffee': 'Coffee',
  'el-icon-crop': 'Crop',
  'el-icon-cpu': 'Cpu',
  'el-icon-magic-stick': 'MagicStick',
  'el-icon-magnet': 'Magnet',
  'el-icon-male': 'Male',
  'el-icon-female': 'Female',
  'el-icon-medal': 'Medal',
  'el-icon-mic': 'Microphone',
  'el-icon-mobile-phone': 'Cellphone',
  'el-icon-money': 'Money',
  'el-icon-moon': 'Moon',
  'el-icon-mouse': 'Mouse',
  'el-icon-mug': 'Mug',
  'el-icon-no-smoking': 'NoSmoking',
  'el-icon-odometer': 'Odometer',
  'el-icon-orange': 'Orange',
  'el-icon-paperclip': 'Paperclip',
  'el-icon-partly-cloudy': 'PartlyCloudy',
  'el-icon-pear': 'Pear',
  'el-icon-pie-chart': 'PieChart',
  'el-icon-playlist': 'List',
  'el-icon-pomegranate': 'Pomegranate',
  'el-icon-potato-strips': 'PotatoStrips',
  'el-icon-printer': 'Printer',
  'el-icon-reading': 'Reading',
  'el-icon-refresh-left': 'RefreshLeft',
  'el-icon-refresh-right': 'RefreshRight',
  'el-icon-refrigerator': 'Refrigerator',
  'el-icon-remove': 'Remove',
  'el-icon-remove-filled': 'RemoveFilled',
  'el-icon-right': 'Right',
  'el-icon-school': 'School',
  'el-icon-scissor': 'Scissor',
  'el-icon-search-locate': 'Search',
  'el-icon-service': 'Service',
  'el-icon-set-up': 'SetUp',
  'el-icon-suitcase': 'Suitcase',
  'el-icon-sunrise': 'Sunrise',
  'el-icon-sunset': 'Sunset',
  'el-icon-switch-button': 'Switch',
  'el-icon-takeaway-box': 'TakeawayBox',
  'el-icon-tickets': 'Tickets',
  'el-icon-trophy': 'Trophy',
  'el-icon-truck': 'Truck',
  'el-icon-tv': 'Tv',
  'el-icon-umbrella': 'Umbrella',
  'el-icon-wallet': 'Wallet',
  'el-icon-watch': 'Watch',
  'el-icon-watermelon': 'Watermelon',
  'el-icon-wind-power': 'WindPower',
  'el-icon-zoom-in': 'ZoomIn',
  'el-icon-zoom-out': 'ZoomOut',
  'el-icon-thumb': 'Thumb',
  'el-icon-rank': 'Rank',
  'el-icon-caret-left': 'CaretLeft',
  'el-icon-caret-right': 'CaretRight',
  'el-icon-caret-top': 'CaretTop',
  'el-icon-caret-bottom': 'CaretBottom',
  'el-icon-d-arrow-left': 'DCaretLeft',
  'el-icon-d-arrow-right': 'DCaretRight',
  'el-icon-d-caret': 'DCaret',
  'el-icon-bottom': 'Bottom',
  'el-icon-top': 'Top',
  'el-icon-top-left': 'TopLeft',
  'el-icon-top-right': 'TopRight',
  'el-icon-bottom-left': 'BottomLeft',
  'el-icon-bottom-right': 'BottomRight',
  'el-icon-back': 'Back',
  'el-icon-bangzhu': 'QuestionFilled',
  'el-icon-bell-filled': 'BellFilled',
  'el-icon-box': 'Box',
  'el-icon-brush': 'Brush',
  'el-icon-bulb': 'Bulb',
  'el-icon-camera': 'Camera',
  'el-icon-aim': 'Aim',
  'el-icon-alarm-clock': 'AlarmClock',
  'el-icon-apple': 'Apple',
  'el-icon-avatar': 'Avatar',
  'el-icon-backspace': 'Backspace',
  'el-icon-basketball': 'Basketball',
  'el-icon-bicycle': 'Bicycle',
  'el-icon-bowl': 'Bowl',
  'el-icon-burger': 'Burger',
  'el-icon-calendar': 'Calendar',
  'el-icon-candy': 'Candy',
  'el-icon-car': 'Car',
  'el-icon-card': 'CreditCard',
  'el-icon-carousel': 'Pictures',
  'el-icon-coupon': 'Coupon',
  'el-icon-connection': 'Connection',
  'el-icon-cup': 'Cup',
  'el-icon-delete-location': 'DeleteLocation',
  'el-icon-delete-solid': 'DeleteFilled',
  'el-icon-discount': 'Discount',
  'el-icon-dish': 'Dish',
  'el-icon-dish-dot': 'DishDot',
  'el-icon-edit-pen': 'EditPen',
}

export interface PrefixIconResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
  /** 需要在 script 块顶部 import 的 Element Plus icon 组件名（去重） */
  iconImports: Set<string>
}

export function convertPrefixIconToSlot(
  template: string,
): PrefixIconResult {
  const iconImports = new Set<string>()
  const changes: string[] = []
  const reviewItems: string[] = []

  // 单遍扫描：识别 <el-xxx prefix-icon="..." > 整段
  const out: string[] = []
  let i = 0
  const n = template.length

  while (i < n) {
    const c = template[i]

    // 跳过注释
    if (c === '<' && template.startsWith('<!--', i)) {
      const end = template.indexOf('-->', i + 4)
      if (end < 0) {
        out.push(template.slice(i))
        break
      }
      out.push(template.slice(i, end + 3))
      i = end + 3
      continue
    }

    // 开始标签？
    if (c === '<' && /[a-zA-Z]/.test(template[i + 1] || '')) {
      // 找 tag name
      const m = /^<([a-zA-Z][\w-]*)(\s[^>]*?)?(\/?)>/.exec(template.slice(i))
      if (m) {
        const tagName = m[1]
        const attrText = m[2] || ''
        const selfSlash = m[3] || ''
        const fullMatch = m[0]

        if (SUPPORTED_TAGS.has(tagName) && /\sprefix-icon\s*=/.test(attrText)) {
          // 提取 prefix-icon="el-icon-xxx" 的值
          const pm = /\sprefix-icon\s*=\s*"([^"]+)"/.exec(attrText)
          if (pm) {
            const iconClass = pm[1]
            const iconNameMatch = /^el-icon-([a-z0-9-]+)$/i.exec(iconClass)
            if (iconNameMatch) {
              const iconName = iconNameMatch[1]
              const componentName = ICON_MAP[iconClass] || capitalizeWords(iconName)
              iconImports.add(componentName)

              // 检测缩进
              const indent = detectLineIndent(template, i)
              const innerIndent = indent + '  '

              // 重写 attrText：去掉 prefix-icon="..." 及其前面的空白
              const newAttrText = attrText.replace(
                /\s*prefix-icon\s*=\s*"[^"]+"/,
                '',
              )

              // 新 open tag
              let newOpenTag: string
              let insertion: string
              let suffix: string

              if (selfSlash) {
                // self-closing <el-input ... /> → <el-input ...><template #prefix>...</template></el-input>
                newOpenTag = `<${tagName}${newAttrText}>`
                insertion =
                  `\n${innerIndent}<template #prefix>` +
                  `\n${innerIndent}  <el-icon><${componentName} /></el-icon>` +
                  `\n${innerIndent}</template>`
                suffix = `\n${indent}</${tagName}>`
              } else {
                // 有 close tag：在 open 后插入 slot
                newOpenTag = `<${tagName}${newAttrText}>`
                insertion =
                  `\n${innerIndent}<template #prefix>` +
                  `\n${innerIndent}  <el-icon><${componentName} /></el-icon>` +
                  `\n${innerIndent}</template>`
                suffix = ''
              }

              out.push(newOpenTag + insertion + suffix)
              i += fullMatch.length
              changes.push(
                `<${tagName} prefix-icon="${iconClass}"> → <${tagName}> + <template #prefix><el-icon><${componentName} /></el-icon></template>`,
              )
              reviewItems.push(
                `已转换 <${tagName}> 的 prefix-icon="${iconClass}" 到 <template #prefix>。需要确认 Element Plus icon <${componentName}> 已 import 到 script。`,
              )
              continue
            }
          }
        }

        // 不需要改写：原样输出
        out.push(fullMatch)
        i += fullMatch.length
        continue
      }
    }

    // 普通字符
    out.push(c)
    i++
  }

  if (changes.length === 0) {
    return { out: template, changed: false, changes, reviewItems, iconImports }
  }
  return { out: out.join(''), changed: true, changes, reviewItems, iconImports }
}

function capitalizeWords(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

function detectLineIndent(source: string, offset: number): string {
  let i = offset - 1
  while (i >= 0 && source[i] !== '\n') i--
  const start = i + 1
  let j = start
  while (j < offset && (source[j] === ' ' || source[j] === '\t')) j++
  return source.slice(start, j)
}
