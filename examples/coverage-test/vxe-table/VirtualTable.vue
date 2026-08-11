<template>
  <div class="virtual-table">
    <h3>虚拟滚动 (scroll-x/y 自定义 + 大数据)</h3>
    <vxe-table
      :data="bigData"
      :height="500"
      :scroll-x="{ gt: 50 }"
      :scroll-y="{ gt: 30, oSize: 20, rSize: 30 }"
      :optimization="{ scroll: { x: 50, y: 30 }, animat: true, delayHover: 250, scrollX: { gt: 50 }, scrollY: { gt: 30 } }"
      :row-config="{ keyField: 'id' }"
      :loading="loading"
      show-overflow="title"
    >
      <vxe-table-column type="seq" width="60" fixed="left" />
      <vxe-table-column field="id" title="ID" width="80" fixed="left" />
      <vxe-table-column field="col0" title="列 0" width="120" />
      <vxe-table-column field="col1" title="列 1" width="120" />
      <vxe-table-column field="col2" title="列 2" width="120" />
      <vxe-table-column field="col3" title="列 3" width="120" />
      <vxe-table-column field="col4" title="列 4" width="120" />
      <vxe-table-column field="col5" title="列 5" width="120" />
      <vxe-table-column field="col6" title="列 6" width="120" />
      <vxe-table-column field="col7" title="列 7" width="120" />
      <vxe-table-column field="col8" title="列 8" width="120" />
      <vxe-table-column field="col9" title="列 9" width="120" />
      <vxe-table-column field="col10" title="列 10" width="120" />
      <vxe-table-column field="col11" title="列 11" width="120" />
      <vxe-table-column field="col12" title="列 12" width="120" />
      <vxe-table-column field="col13" title="列 13" width="120" />
      <vxe-table-column field="col14" title="列 14" width="120" />
      <vxe-table-column field="col15" title="列 15" width="120" />
      <vxe-table-column field="col16" title="列 16" width="120" />
      <vxe-table-column field="col17" title="列 17" width="120" />
      <vxe-table-column field="col18" title="列 18" width="120" />
      <vxe-table-column field="col19" title="列 19" width="120" />
      <vxe-table-column title="操作" width="200" fixed="right">
        <template #default="{ row }">
          <vxe-button mode="text" type="text" @click="onEdit(row)">编辑</vxe-button>
        </template>
      </vxe-table-column>
    </vxe-table>

    <h3>优化配置 (自定义列宽 / tooltip / 自定义渲染)</h3>
    <vxe-table
      :data="bigData"
      :height="400"
      :show-footer="true"
      :footer-method="footerMethod"
      :tooltip-config="{ theme: 'light', enterable: true, leave-delay: 300 }"
      :mouse-config="{ area: true }"
      :area-config="{ multiple: true, areaLimit: 4 }"
    >
      <vxe-table-column type="seq" width="60" />
      <vxe-table-column field="id" title="ID" width="100" />
      <vxe-table-column field="name" title="名称" min-width="200">
        <template #default="{ row }">
          <a-tag color="blue">{{ row.name }}</a-tag>
        </template>
      </vxe-table-column>
      <vxe-table-column field="description" title="描述" min-width="300" show-overflow="tooltip" show-header-overflow="tooltip" />
      <vxe-table-column field="status" title="状态" width="100" />
    </vxe-table>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxeVirtualTable',
  data() {
    return {
      loading: false,
      bigData: []
    }
  },
  mounted() {
    this.generateData(5000)
  },
  beforeDestroy() {
    console.log('virtual-table destroying')
  },
  methods: {
    generateData(count) {
      this.loading = true
      const data = []
      for (let i = 0; i < count; i++) {
        const row = {
          id: i + 1,
          name: `User ${i + 1}`,
          col0: `val0-${i}`,
          col1: `val1-${i}`,
          col2: `val2-${i}`,
          col3: `val3-${i}`,
          col4: `val4-${i}`,
          col5: `val5-${i}`,
          col6: `val6-${i}`,
          col7: `val7-${i}`,
          col8: `val8-${i}`,
          col9: `val9-${i}`,
          col10: `val10-${i}`,
          col11: `val11-${i}`,
          col12: `val12-${i}`,
          col13: `val13-${i}`,
          col14: `val14-${i}`,
          col15: `val15-${i}`,
          col16: `val16-${i}`,
          col17: `val17-${i}`,
          col18: `val18-${i}`,
          col19: `val19-${i}`,
          description: `描述 ${i + 1}: 这是一个很长的描述用来测试 tooltip 功能...`,
          status: ['active', 'inactive', 'pending'][i % 3]
        }
        data.push(row)
      }
      this.bigData = data
      this.loading = false
    },
    footerMethod({ columns, data }) {
      return [
        columns.map((column, columnIndex) => {
          if (columnIndex === 0) return '合计'
          if (column.field === 'id') return data.length
          if (column.field === 'name') return `共 ${data.length} 条`
          return ''
        })
      ]
    },
    onEdit(row) {
      this.$message.info(`编辑 ${row.name}`)
    }
  }
}
</script>

<style lang="scss" scoped>
.virtual-table { padding: 16px; }
</style>
