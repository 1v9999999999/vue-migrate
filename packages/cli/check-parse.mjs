// 用 babel parser parse 文件, 找出 syntax error 位置
import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { parse } = require('packages/cli/node_modules/@vue-migrate/plugin-composition/node_modules/@babel/parser')

const f = process.argv[2]
if (!f) { console.error('usage: node check-parse.mjs <file>'); process.exit(1) }
const text = readFileSync(f, 'utf8')
try {
  parse(text, { sourceType: 'module', plugins: ['typescript'], errorRecovery: true })
  console.log('OK')
} catch (e) {
  console.log('Error:', e.message)
  if (e.loc) console.log('Location:', e.loc)
}
