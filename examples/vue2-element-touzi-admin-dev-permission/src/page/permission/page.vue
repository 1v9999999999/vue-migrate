<template>
  <div class="fillcontain" >
    <div  class="contain" ref="contain">
       <switch-roles @change="handleRolesChange" />
    </div>
  </div>
</template>

<script>import SwitchRoles from './components/SwitchRoles';
import * as mutils from '@/utils/mUtils';
export default {
  name: 'pagePermission',
  components: {
    SwitchRoles
  },
  /*
   * vue3-types TODO:
   * 
   *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
   */
  mounted() {
    mutils.setContentHeight(this, this.$refs.contain, 210);
  },
  methods: {
    /*
     * this 类型:
     * {
     *   $router: unknown
     * }
     */
    /*
     * vue3-types TODO:
     * 
     *   - $router ×1: this.$router → useRouter()  (vue-router@4)
     */
    handleRolesChange() {
      // 没有这个可以匹配的路由"/permission/index"，则会定位到404页面
      this.$router.push({
        path: '/permission/index?time=' + +new Date()
      });
    }
  }
};</script>

<style lang="less" scoped>
 .contain{
    background: #fff;
    padding: 20px;
    box-sizing: border-box;
  }
</style>
