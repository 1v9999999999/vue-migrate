// Debug parseMethods on aegis Layout/index.vue
import _babelParser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import fs from 'fs'

const src = fs.readFileSync('D:/Projects/NB_EST/qiuzhi/vue-migrate/examples/vue2-aegis/src/components/Layout/index.vue', 'utf8')

// Extract script inner
const scriptMatch = src.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
if (!scriptMatch) { console.log('No script tag'); process.exit(1) }
const scriptInner = scriptMatch[1]
console.log('Script inner length:', scriptInner.length)

// Parse with babel
const ast = _babelParser.parse(scriptInner, {
  sourceType: 'module',
  allowImportExportEverywhere: true,
  plugins: ['typescript'],
})

// Find export default
let exportDefault = null
for (const stmt of ast.program.body) {
  if (stmt.type === 'ExportDefaultDeclaration') {
    exportDefault = stmt.declaration
    break
  }
}
if (!exportDefault) { console.log('No export default'); process.exit(1) }
console.log('Export default found. Properties:', exportDefault.properties.length)

// Find methods
const methodsProp = exportDefault.properties.find(p =>
  t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'methods'
)
if (!methodsProp) { console.log('No methods prop'); process.exit(1) }

const generate = (_generate.default || _generate)
console.log('Methods count:', methodsProp.value.properties.length)
let i = 0
for (const prop of methodsProp.value.properties) {
  i++
  if (i > 5) break
  const key = t.isIdentifier(prop.key) ? prop.key.name : prop.key.value
  let value = prop.value
  let body = null
  if (t.isObjectMethod(prop)) {
    body = prop.body
    console.log(`[${i}] method: ${key}, body type=${body?.type}, body.code (first 100 chars):`)
    if (body) {
      const code = generate(body).code
      console.log(code.substring(0, 200))
      console.log('---')
    }
  } else if (t.isFunction(value)) {
    body = value.body
    console.log(`[${i}] func: ${key}, body type=${body?.type}, body.code (first 100 chars):`)
    if (body) {
      const code = generate(body).code
      console.log(code.substring(0, 200))
      console.log('---')
    }
  }
}
