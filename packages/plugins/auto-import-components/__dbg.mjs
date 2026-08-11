import { _testable } from './src/index.ts'

// 模拟 ctx.project.root
const root = 'D:/Projects/NB_EST/test1/111/vue-element-admin-master'
const fromFile = root + '/src/views/excel/upload-excel.vue'
const r = _testable.inferComponentPaths(fromFile, root, 'upload-excel-component')
console.log('cands:', r)

// 直接检查实际文件存在
import { existsSync } from 'node:fs'
import { join } from 'node:path'
const candidates = [
  'src/components/UploadExcel/index.vue',
  'src/components/UploadExcel.vue',
  'src/components/UploadExcelComponent/index.vue',
]
for (const c of candidates) {
  const abs = join(root, c)
  console.log(`  ${c} exists: ${existsSync(abs)}`)
}
