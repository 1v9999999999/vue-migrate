<template>
    <el-dialog
    :append-to-body="true"
    :width="wxModal.width"
    :height="wxModal.height"
    v-model="wxModal.show"
    :before-close="handleClose"
    >
        <div class="wxContent">
            <p class="qrtitle">打开微信“扫一扫”，打开网页后点击屏幕右上角分享按钮</p>
            <div class="qrcode" ref="qrCodeUrl5"></div>
        </div>
    </el-dialog>
</template>

<script>import QRCode from 'qrcodejs2';
import { shareUrl } from "@/utils/env";
export default {
  name: 'wxCodeModal',
  /*
   * vue3-types inferred data() return type:
   * @returns {{qrcodeObj: { text: unknown; width: number; height: number; colorDark: string; colorLight: string; correctLevel: any }}}
   */
  data() {
    return {
      qrcodeObj: {
        text: shareUrl,
        // 要分享的网页路径
        width: 190,
        height: 190,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      }
    };
  },
  /*
   * vue3-types inferred props shape:
   * @type {{ wxModal: Record<string, unknown> }}
   * (In Vue3, the recommended equivalent is
   *   const props = defineProps<{ wxModal: Record<string, unknown> }>()
   *   in <script setup>. For Options API, runtime props are kept as-is.)
   */
  props: {
    wxModal: Object
  },
  mounted() {},
  methods: {
    /*
     * this 类型:
     * {
     *   $refs: unknown,
      qrcodeObj: unknown
     * }
     */
    /*
     * vue3-types TODO:
     * 
     *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
     */
    creatQrCode() {
      const qrcode = new QRCode(this.$refs.qrCodeUrl5, this.qrcodeObj);
    },
    /*
     * this 类型:
     * {
     *   $emit: unknown
     * }
     */
    handleClose() {
      this.$emit('hideWxCodeModal');
    }
  },
  watch: {
    'wxModal.show': {
      handler(newName, oldName) {
        console.log(newName);
        newName ? this.creatQrCode() : '';
      },
      deep: true,
      immediate: true
    }
  }
};</script>

<style lang="less" scoped>
  .wxContent{
         text-align: center;
         padding: 20px;
        .qrtitle{
            margin-bottom: 30px;
        }
        .qrcode{
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
  }
	
</style>
