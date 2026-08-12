<template>
  <div class="echarts-demo">
    <h2>ECharts 集成</h2>
    <div ref="chartRef" :style="{ width: '600px', height: '400px' }"></div>
    <button @click="updateData">更新数据</button>
    <button @click="toggleTheme">切换主题</button>
  </div>
</template>

<script>
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent
} from 'echarts/components'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'

// 按需注册
echarts.use([
  LineChart, BarChart, PieChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  DatasetComponent, TransformComponent,
  LabelLayout, UniversalTransition,
  CanvasRenderer
])

export default {
  name: 'EChartsDemo',
  data() {
    return {
      chart: null,
      currentTheme: 'light',
      option: {
        title: { text: '销售数据' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['销量', '利润'] },
        xAxis: {
          type: 'category',
          data: ['1月', '2月', '3月', '4月', '5月', '6月']
        },
        yAxis: { type: 'value' },
        series: [
          {
            name: '销量',
            type: 'bar',
            data: [120, 200, 150, 80, 70, 110]
          },
          {
            name: '利润',
            type: 'line',
            data: [50, 80, 60, 30, 25, 45]
          }
        ]
      }
    }
  },
  mounted() {
    this.chart = echarts.init(this.$refs.chartRef, this.currentTheme)
    this.chart.setOption(this.option)
    window.addEventListener('resize', this.handleResize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
    this.chart?.dispose()
  },
  methods: {
    updateData() {
      this.chart.setOption({
        series: [
          { data: [Math.random() * 200, Math.random() * 200, Math.random() * 200] },
          { data: [Math.random() * 100, Math.random() * 100, Math.random() * 100] }
        ]
      })
    },
    toggleTheme() {
      this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light'
      this.chart.dispose()
      this.chart = echarts.init(this.$refs.chartRef, this.currentTheme)
      this.chart.setOption(this.option)
    },
    handleResize() {
      this.chart?.resize()
    }
  }
}
</script>
