/**
 * .vue 内 JSX render — Vue 2 写法
 * 包含 template + script(render) 混合
 */
export default {
  name: 'VueWithJsx',

  components: {
    // 局部注册
  },

  props: {
    data: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },

  data() {
    return {
      sortKey: '',
      sortOrder: 'asc',
      filterText: ''
    }
  },

  computed: {
    filteredData() {
      if (!this.filterText) return this.data
      return this.data.filter(item =>
        Object.values(item).some(v =>
          String(v).toLowerCase().includes(this.filterText.toLowerCase())
        )
      )
    },

    sortedData() {
      if (!this.sortKey) return this.filteredData
      const order = this.sortOrder === 'asc' ? 1 : -1
      return [...this.filteredData].sort((a, b) => {
        const av = a[this.sortKey]
        const bv = b[this.sortKey]
        if (av < bv) return -1 * order
        if (av > bv) return 1 * order
        return 0
      })
    }
  },

  methods: {
    handleSort(key) {
      if (this.sortKey === key) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortKey = key
        this.sortOrder = 'asc'
      }
    },

    renderHeader() {
      return (
        <div class="table-header">
          <input
            class="filter-input"
            placeholder="搜索..."
            value={this.filterText}
            on-input={(e) => { this.filterText = e.target.value }}
          />
          {this.sortKey && (
            <span class="sort-indicator">
              排序: {this.sortKey} ({this.sortOrder})
            </span>
          )}
        </div>
      )
    },

    renderTable() {
      if (this.loading) {
        return <div class="table-loading">加载中...</div>
      }

      if (!this.sortedData.length) {
        return <div class="table-empty">暂无数据</div>
      }

      return (
        <table class="jsx-table">
          <thead>
            <tr>
              {this.columns.map(col => (
                <th
                  key={col.prop}
                  class={{ sortable: col.sortable !== false, active: this.sortKey === col.prop }}
                  on-click={() => this.handleSort(col.prop)}
                >
                  {col.label}
                  {this.sortKey === col.prop && (
                    <span class="sort-icon">{this.sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {this.sortedData.map((row, index) => (
              <tr key={row.id || index} class={{ 'row-odd': index % 2 === 0 }}>
                {this.columns.map(col => (
                  <td key={col.prop}>
                    {col.render
                      ? col.render(h, row[col.prop], row, index)
                      : row[col.prop]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    },

    renderFooter() {
      const slot = this.$slots.footer
      if (slot) {
        return <div class="table-footer">{slot}</div>
      }
      return (
        <div class="table-footer">
          <span class="total">共 {this.sortedData.length} 条</span>
        </div>
      )
    }
  },

  render(h) {
    return (
      <div class="vue-jsx-table">
        {this.renderHeader()}
        {this.renderTable()}
        {this.renderFooter()}
      </div>
    )
  }
}
