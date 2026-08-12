#!/usr/bin/env node
import { parse } from '@babel/parser'

const code = `import { ref, reactive, computed, onMounted, watch } from 'vue';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

const items0 = reactive([])
const msg0 = ref('message 0')
`
try {
  parse(code, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: ['decorators-legacy', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'jsx'],
  })
  console.log('OK')
} catch (e) {
  console.log('FAIL:', e.message)
  const m = e.message.match(/\((\d+):(\d+)\)/)
  if (m) {
    const line = parseInt(m[1])
    const col = parseInt(m[2])
    const lines = code.split('\n')
    for (let i = Math.max(0, line - 3); i < Math.min(lines.length, line + 3); i++) {
      console.log(`${i+1}: ${lines[i]}`)
      if (i+1 === line) console.log('  ' + ' '.repeat(col-1) + '^')
    }
  }
}
