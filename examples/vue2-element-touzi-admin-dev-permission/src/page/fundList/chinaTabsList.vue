<template>
    <div class="fillcontain">
        <div class="tabContainer" ref="tabContainer">
            <el-tabs type="border-card">
                <el-tab-pane>
                    <template #label>
                        <span slot="label" @click="toggleTabs('eastChina')"><icon-svg icon-class="icondashboard" />华东区域</span>
                    </template>
                    <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                    <template #label>
                        <span slot="label" @click="toggleTabs('southChina')"><icon-svg icon-class="iconecharts" />华南区域</span>
                    </template>
                    <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                    <template #label>
                        <span slot="label" @click="toggleTabs('centralChina')"><icon-svg icon-class="iconinfo" />华中区域</span>
                    </template>
                    <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                    <template #label>
                        <span slot="label" @click="toggleTabs('northChina')"><icon-svg icon-class="iconpermission" />华北区域</span>
                    </template>
                    <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                    <template #label>
                        <span slot="label" @click="toggleTabs('northwestChina')"><icon-svg icon-class="iconuser" />西北区域</span>
                    </template>
                    <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                    <template #label>
                        <span slot="label" @click="toggleTabs('southwestChina')"><icon-svg icon-class="iconError" />西南地区</span>
                    </template>
                    <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                     <template #label>
                         <span slot="label" @click="toggleTabs('northeastChina')"><icon-svg icon-class="iconfufei0" />东北地区</span>
                     </template>
                     <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
                <el-tab-pane>
                     <template #label>
                         <span slot="label" @click="toggleTabs('specialareaChina')"><icon-svg icon-class="iconpay1" />台港澳地区</span>
                     </template>
                     <china-tabs-table :toggleData="toggleData"></china-tabs-table>
                </el-tab-pane>
            </el-tabs>
            <pagination :pageTotal="pageTotal"></pagination>
        </div>
    </div>
</template>

<script>import chinaTabsTable from './components/chinaTabsTable';
import data from './data/chinaTabs.json';
import Pagination from "@/components/pagination";
export default {
  /*
   * vue3-types inferred data() return type:
   * @returns {{toggleData: string, pageTotal: number}}
   */
  data() {
    return {
      toggleData: '',
      pageTotal: 60
    };
  },
  components: {
    chinaTabsTable,
    Pagination
  },
  mounted() {
    //  this.setTabHeight();
    //  window.onresize = () => {
    //     this.setTabHeight();
    //  }
    this.toggleTabs('eastChina');
  },
  methods: {
    /*
     * this 类型:
     * {
     *   $nextTick: unknown,
      $refs: unknown
     * }
     */
    setTabHeight() {
      this.$nextTick(
      /*
       * vue3-types TODO:
       * 
       *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
       */
      () => {
        this.$refs.tabContainer.style.height = document.body.clientHeight - 160 + 'px';
      });
    },
    /*
     * this 类型:
     * {
     *   toggleData: unknown
     * }
     */
    toggleTabs(item) {
      this.toggleData = item;
    }
  }
};</script>

<style lang="less" scoped>
 
</style>


