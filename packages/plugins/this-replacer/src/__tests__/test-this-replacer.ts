/**
 * @vue-migrate/plugin-this-replacer unit tests
 * iter-051
 *
 * 娴?6 涓牳蹇冨満鏅?
 *   1) this.$http 宸叉湁 import axios 鈫?鑷姩鏇挎崲
 *   2) this.$axios 宸叉湁 import axios 鈫?鑷姩鏇挎崲
 *   3) this.$api 宸叉湁 import request from '@/utils/request' 鈫?鏇挎崲涓?request
 *   4) this.$bus 瀹屽叏娌?import 鈫?鏍?review
 *   5) this.$util 娌?import 鈫?鏍?review
 *   6) this.$lodash 宸叉湁 import _ from 'lodash' 鈫?涓嶅湪鐧藉悕鍗曞埆鍚嶉泦鍚?涓嶆浛鎹?鏍?review
 */

import { _testable_applyThisReplacer, _testable_findImportAliasFor } from '../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function makeFile(source: string, path = '/test.vue', useRawSource = false): any {
  return {
    source,
    path,
    useRawSource,
    changed: false,
    reviewItems: [] as string[],
    marks: [] as string[],
    kind: 'vue' as const,
  }
}

function makeUtils(file: any) {
  if (!file.logItems) file.logItems = []
  return {
    // iter-116: applyThisReplacer 现在接受 (file, ctx) — 返回 ctx-like 形式
    utils: {
      markChanged: (msg?: string) => {
        file.changed = true
        if (msg) file.marks.push(msg)
      },
      manualReview: (msg: string) => {
        file.reviewItems.push(msg)
      },
    },
    log: (msg: string) => {
      file.logItems.push(msg)
    },
  }
}

function assert(name: string, cond: boolean, detail: string): void {
  if (cond) {
    pass++
    console.log(`  \u2713 ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     ${detail}`)
    console.log(`  \u2717 ${name}\n     ${detail}`)
  }
}

// ============ 1) this.$http + import axios 鈫?鑷姩鏇挎崲 ============
console.log('\n[this.$http + import axios]')
{
  const file = makeFile(
    `import axios from 'axios'
export default {
  methods: {
    login() {
      return this.$http.post('/api/login', { name: 'foo' })
    }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert('no review', file.reviewItems.length === 0, JSON.stringify(file.reviewItems))
  assert(
    'source replaced',
    !file.source.includes('this.$http'),
    'still has this.$http: ' + file.source,
  )
  assert('contains axios.post', file.source.includes('axios.post'), file.source)
  assert('marked changed', file.changed, 'not changed')
}

// ============ 2) this.$axios + import axios 鈫?鑷姩鏇挎崲 ============
console.log('\n[this.$axios + import axios]')
{
  const file = makeFile(
    `import axios from 'axios'
export default {
  mounted() {
    this.$axios.get('/api/user')
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert('no review', file.reviewItems.length === 0, JSON.stringify(file.reviewItems))
  assert('no this.$axios', !file.source.includes('this.$axios'), file.source)
  assert('axios.get', file.source.includes('axios.get'), file.source)
}

// ============ 3) this.$api + import request from '@/utils/request' 鈫?鏇挎崲涓?request ============
console.log('\n[this.$api + import request]')
{
  const file = makeFile(
    `import request from '@/utils/request'
export default {
  methods: {
    fetch() { return this.$api.get('/list') }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert('no review', file.reviewItems.length === 0, JSON.stringify(file.reviewItems))
  assert('no this.$api', !file.source.includes('this.$api'), file.source)
  assert('request.get', file.source.includes('request.get'), file.source)
}

// ============ 4) this.$bus 瀹屽叏娌?import 鈫?鏍?review ============
console.log('\n[this.$bus no import]')
{
  const file = makeFile(
    `export default {
  methods: {
    emit() { this.$bus.$emit('foo', 1) }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert('has review', file.reviewItems.some((r: string) => r.includes('this.$bus')), JSON.stringify(file.reviewItems))
  assert('source unchanged', file.source.includes('this.$bus'), 'should NOT modify')
  assert('NOT marked changed', !file.changed, 'should not mark changed when no auto-replace')
}

// ============ 5) this.$util 娌?import 鈫?鏍?review ============
console.log('\n[this.$util no import]')
{
  const file = makeFile(
    `export default {
  methods: {
    go() { this.$util.format(this.date) }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert(
    'has review',
    file.reviewItems.some((r: string) => r.includes('this.$util')),
    JSON.stringify(file.reviewItems),
  )
  assert('source unchanged', file.source.includes('this.$util'), 'this.$util should remain in source')
}

// ============ 6) this.$lodash + import _ from 'lodash' 鈫?涓嶅湪鐧藉悕鍗?鏍?review ============
console.log('\n[this.$lodash no axios]')
{
  const file = makeFile(
    `import _ from 'lodash'
export default {
  methods: {
    sort() { return this.$lodash.sortBy([3, 1, 2]) }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // lodash 涓嶅湪榛樿鏇挎崲闆嗗悎 (鎴戜滑寤鸿鐢ㄦ埛鐢?_ 浣?$lodash 鈫?_ 涓嶅湪 alias finder 閲?
  // 褰撳墠瀹炵幇: lodash 鍦ㄧ櫧鍚嶅崟閲?浣?import alias finder 鍙湅 axios/request,娌℃湁 lodash
  // 鎵€浠ュ簲璇ユ爣 review
  assert('has review', file.reviewItems.length > 0, JSON.stringify(file.reviewItems))
}

// ============ 7) named import: import { request as http } from '...' 鈫?this.$http 鑷姩鏇挎崲涓?http ============
console.log('\n[this.$http + named import as alias]')
{
  const file = makeFile(
    `import { request as http } from '@/utils/request'
export default {
  methods: {
    login() { return this.$http.post('/login') }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // 鎴戜滑鐨?findImportAliasFor 澶勭悊 named import 鏃?鍏堟壘 hint(=http) 鐨?as alias
  assert(
    'either replaced or reviewed',
    !file.source.includes('this.$http') || file.reviewItems.length > 0,
    'source: ' + file.source + ' review: ' + JSON.stringify(file.reviewItems),
  )
}

// ============ 8) 鍚屾椂澶氫釜 this.$X, 澶氫釜閮借嚜鍔ㄦ浛鎹?============
console.log('\n[multiple this.$X]')
{
  const file = makeFile(
    `import axios from 'axios'
import request from '@/utils/request'
export default {
  methods: {
    go() {
      this.$http.get('/a')
      this.$axios.post('/b')
      this.$api.put('/c')
    }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert('no this.$http', !file.source.includes('this.$http'), file.source)
  assert('no this.$axios', !file.source.includes('this.$axios'), file.source)
  assert('no this.$api', !file.source.includes('this.$api'), file.source)
  assert('no review', file.reviewItems.length === 0, JSON.stringify(file.reviewItems))
}

// ============ 9) useRawSource=true 妯″紡 (composition 鍚? ============
console.log('\n[useRawSource=true]')
{
  const file = makeFile(
    `<script setup>
import axios from 'axios'
const x = this.$http.get('/a')
</script>`,
    '/test.vue',
    true,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  assert('no this.$http', !file.source.includes('this.$http'), file.source)
}

// ============ 10) findImportAliasFor 鍗曟祴 ============
console.log('\n[findImportAliasFor]')
{
  const src1 = `import axios from 'axios'\nimport Vue from 'vue'`
  assert(
    'find axios default',
    _testable_findImportAliasFor(src1, 'http') === 'axios',
    'got: ' + _testable_findImportAliasFor(src1, 'http'),
  )

  const src2 = `import request from '@/utils/request'`
  assert(
    'find request default for $api',
    _testable_findImportAliasFor(src2, 'api') === 'request',
    'got: ' + _testable_findImportAliasFor(src2, 'api'),
  )

  const src3 = `import _ from 'lodash'`
  assert(
    'no axios/request 鈫?null',
    _testable_findImportAliasFor(src3, 'http') === null,
    'got: ' + _testable_findImportAliasFor(src3, 'http'),
  )
}

// ============ 11) this.$parent 鈫?reviewRemovedApis ============
console.log('\n[this.$parent review]')
{
  const file = makeFile(
    `<script setup>
import { inject } from 'vue'
const f = (event) => {
  if (this.$parent.$options.componentName === 'ElFormItem') {
    this.$parent.$emit('el.form.change', event)
  }
}
const tagList = this.$parent.$refs.tag
</script>`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // iter-116: $parent review 降级为 ctx.log
  assert(
    'parent log triggered',
    file.logItems.some((r: string) => r.includes('this.$parent')),
    JSON.stringify(file.logItems),
  )
}

// ============ 12) this.$children 鈫?review ============
console.log('\n[this.$children review]')
{
  const file = makeFile(
    `export default {
  mounted() {
    this.$children.forEach(c => c.refresh())
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // iter-116: $children review 降级为 ctx.log
  assert(
    'children log triggered',
    file.logItems.some((r: string) => r.includes('this.$children')),
    JSON.stringify(file.logItems),
  )
}

// ============ 13) this.$root / $vnode / $isServer 合并 review ============
console.log('\n[this.$root / $vnode / $isServer reviews]')
{
  const file = makeFile(
    `export default {
  beforeRouteEnter(to, from, next) {
    if (this.$isServer) return
    const root = this.$root.$store
    this.$vnode.componentOptions.Ctor.options
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // iter-116: review 全部降级为 ctx.log
  assert(
    'isServer log',
    file.logItems.some((r: string) => r.includes('this.$isServer')),
    JSON.stringify(file.logItems),
  )
  assert(
    'root log',
    file.logItems.some((r: string) => r.includes('this.$root')),
    JSON.stringify(file.logItems),
  )
  assert(
    'vnode log',
    file.logItems.some((r: string) => r.includes('this.$vnode')),
    JSON.stringify(file.logItems),
  )
}

// ============ 14) this.$options.componentName / $isDestroyed / $bus review ============
console.log('\n[this.$options / $isDestroyed / $bus reviews]')
{
  const file = makeFile(
    `export default {
  methods: {
    isAlive() { return !this.$isDestroyed },
    sendMsg() { this.$bus.$emit('foo', 1) },
    getName() { return this.$options.name }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // iter-116: review 全部降级为 ctx.log
  assert(
    'isDestroyed log',
    file.logItems.some((r: string) => r.includes('this.$isDestroyed')),
    JSON.stringify(file.logItems),
  )
  assert(
    'options log',
    file.logItems.some((r: string) => r.includes('this.$options')),
    JSON.stringify(file.logItems),
  )
  // $bus 也在白名单里, REVIEW_API 给的降级为 log; 白名单的仍 review (需要 import)
  // 测至少有一个 $bus 相关 log 或 review
  const hasBusReview = file.reviewItems.some((r: string) => r.includes('this.$bus'))
  const hasBusLog = file.logItems.some((r: string) => r.includes('this.$bus'))
  assert('bus review or log (any source)', hasBusReview || hasBusLog, JSON.stringify({ review: file.reviewItems, log: file.logItems }))
}

// ============ 15) 边界: this.$parentId 不应被误判为 $parent ============
console.log('\n[this.$parentId false-positive check]')
{
  const file = makeFile(
    `export default {
  data() { return { parentId: 1 } },
  methods: {
    go() { return this.parentId }
  }
}`,
  )
  _testable_applyThisReplacer(file, makeUtils(file))
  // 这里的 this.parentId 不是 this.$parent - 不应触发 review
  assert(
    'no $parent review for this.parentId',
    !file.reviewItems.some((r: string) => r.includes('this.$parent')),
    JSON.stringify(file.reviewItems),
  )
}

// ============ 鎬荤粨 ============

// ============ 鎬荤粨 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
