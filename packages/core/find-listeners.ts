import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import { readFile } from 'node:fs/promises'

const traverse = _traverse.default || _traverse
const src = await readFile('D:/Projects/NB_EST/qiuzhi/vue-migrate/examples/stress-compo/StressTest.vue', 'utf8')

const match = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
if (!match) { console.log('no script block'); process.exit(1) }
const scriptContent = match[1]
const ast = parse(scriptContent, { sourceType: 'module', plugins: ['typescript'] })

let count = 0
traverse(ast, {
  MemberExpression(path) {
    const obj = path.node.object
    const prop = path.node.property
    const computed = path.node.computed
    const objDesc = obj?.type === 'ThisExpression' ? 'this' : obj?.type === 'Identifier' ? obj.name : obj?.type
    const propDesc = prop?.type === 'Identifier' ? prop.name : prop?.type
    if (propDesc && String(propDesc).includes('listeners')) {
      console.log(`found: object=${objDesc}, property=${propDesc}, computed=${computed}`)
      count++
    }
  }
})
console.log('total listener-related members:', count)
