<template>
    <el-dialog 
        v-model="isVisible"
        :title="addFundDialog.title" 
        :close-on-click-modal='false'
        :close-on-press-escape='false'
        :modal-append-to-body="false"
        @close="closeDialog">
        <div class="form">
            <el-form 
                ref="form" 
                :model="form"
                :rules="form_rules"
                :label-width="dialog.formLabelWidth" 
                style="margin:10px;width:auto;">
                <el-form-item prop='incomePayType' label="收支类型:" >
                    <el-select v-model="form.incomePayType" placeholder="收支类型">
                        <el-option
                            v-for="item in payType"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value">
                        </el-option>
                    </el-select>
                </el-form-item>

                <el-form-item prop='username' label="用户名:">
                    <el-input type="text" v-model="form.username"></el-input>
                </el-form-item>
                
                 <el-form-item prop="address" label="籍贯:">
                    <el-cascader
                        v-model="form.address"
                        placeholder="请选择地区"
                        :props="{ expandTrigger: 'hover'}"
                        :options="areaData"
                        @change="handleChange"
                        ref="cascaderAddr">
                    </el-cascader>
                </el-form-item>

                <el-form-item prop='income'  label="收入:">
                    <el-input v-model.number="form.income"></el-input>
                </el-form-item>

                <el-form-item prop='pay' label="支出:">
                    <el-input v-model.number="form.pay"></el-input>
                </el-form-item>

                <el-form-item prop='accoutCash' label="账户现金:">
                    <el-input v-model.number="form.accoutCash"></el-input>
                </el-form-item>

                <el-form-item label="备注:">
                    <el-input type="textarea" v-model="form.remarks"></el-input>
                </el-form-item>

                <el-form-item  class="text_right">
                    <el-button @click="isVisible = false">取 消</el-button>
                    <el-button type="primary" @click='onSubmit("form")'>提  交</el-button>
                </el-form-item>

            </el-form>
        </div>
    </el-dialog>
</template>

<script>import { mapState, mapGetters } from 'vuex';
import { addMoney, updateMoney } from "@/api/money";
import AreaJson from "@/assets/datas/area.json";
import { ElMessage } from "element-plus";
export default {
  name: 'addFundDialogs',
  /*
   * vue3-types inferred data() return type:
   * @returns {{areaData: any[], isVisible: any, form: { incomePayType: string; address: any[]; tableAddress: string; username: string; income: string; pay: string; accoutCash: string; remarks: string }, payType: { label: string; value: string }[], form_rules: { username: { required: boolean; message: string; trigger: string }[]; income: { required: boolean; validator: unknown; trigger: string }[]; pay: { required: boolean; validator: unknown; trigger: string }[]; accoutCash: { required: boolean; validator: unknown; trigger: string }[]; incomePayType: { required: boolean; message: string; trigger: string }[]; address: { required: boolean; message: string; trigger: string }[] }, dialog: { width: string; formLabelWidth: string }}}
   */
  data() {
    let validateData = (rule, value, callback) => {
      if (value === '') {
        let text;
        if (rule.field == "income") {
          text = '收入';
        } else if (rule.field == "pay") {
          text = '支出';
        } else if (rule.field == 'accoutCash') {
          text = '账户现金';
        }
        callback(new Error(text + '不能为空~'));
      } else {
        let numReg = /^[0-9]+.?[0-9]*$/;
        if (!numReg.test(value)) {
          callback(new Error('请输入正数值'));
        } else {
          callback();
        }
      }
    };
    return {
      areaData: [],
      isVisible: this.isShow,
      form: {
        incomePayType: '',
        address: [],
        tableAddress: '',
        username: '',
        income: '',
        pay: '',
        accoutCash: '',
        remarks: ''
      },
      payType: [{
        label: '提现',
        value: '0'
      }, {
        label: '提现手续费',
        value: '1'
      }, {
        label: '提现锁定',
        value: '2'
      }, {
        label: '理财服务退出',
        value: '3'
      }, {
        label: '购买宜定盈',
        value: '4'
      }, {
        label: '充值',
        value: '5'
      }, {
        label: '优惠券',
        value: '6'
      }, {
        label: '充值礼券',
        value: '7'
      }, {
        label: '转账',
        value: '8'
      }],
      form_rules: {
        username: [{
          required: true,
          message: '用户名不能为空！',
          trigger: 'blur'
        }],
        income: [{
          required: true,
          validator: validateData,
          trigger: 'blur'
        }],
        pay: [{
          required: true,
          validator: validateData,
          trigger: 'blur'
        }],
        accoutCash: [{
          required: true,
          validator: validateData,
          trigger: 'blur'
        }],
        incomePayType: [{
          required: true,
          message: '请选择收支类型',
          trigger: 'change'
        }],
        address: [{
          required: true,
          message: '请选择籍贯',
          trigger: 'change'
        }]
      },
      //详情弹框信息
      dialog: {
        width: '400px',
        formLabelWidth: '120px'
      }
    };
  },
  /*
   * vue3-types inferred props shape:
   * @type {{ isShow: boolean; dialogRow: Record<string, unknown> }}
   * (In Vue3, the recommended equivalent is
   *   const props = defineProps<{ isShow: boolean; dialogRow: Record<string, unknown> }>()
   *   in <script setup>. For Options API, runtime props are kept as-is.)
   */
  props: {
    isShow: Boolean,
    dialogRow: Object
  },
  computed: {
    ...mapGetters(['addFundDialog'])
  },
  created() {
    this.areaData = AreaJson;
  },
  mounted() {
    if (this.addFundDialog.type === 'edit') {
      this.form = this.dialogRow;
      console.log(this.form);
      this.form.incomePayType = this.dialogRow.incomePayType.toString();
      // this.form.address = ["120000", "120200", "120223"]
    } else {
      this.$nextTick(
      /*
       * vue3-types TODO:
       * 
       *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
       */
      () => {
        this.$refs['form'].resetFields();
      });
    }
  },
  methods: {
    getCascaderObj(val, opt) {
      return val.map(function (value, index, array) {
        for (var item of opt) {
          if (item.value == value) {
            opt = item.children;
            return item.label;
          }
        }
        return null;
      });
    },
    /*
     * this 类型:
     * {
     *   form: unknown,
      getCascaderObj: Function,
      areaData: unknown
     * }
     */
    handleChange(value) {
      console.log([...value]); // ["120000", "120200", "120223"]
      this.form.address = [...value];
      let vals = this.getCascaderObj([...value], this.areaData); // arr
      this.form.tableAddress = vals.join(',').replace(/,/g, '');
    },
    /*
     * this 类型:
     * {
     *   $emit: unknown
     * }
     */
    closeDialog() {
      this.$emit('closeDialog');
    },
    //表单提交
    /*
     * this 类型:
     * {
     *   $refs: unknown,
      addFundDialog: unknown,
      isVisible: unknown,
      $emit: unknown
     * }
     */
    /*
     * vue3-types TODO:
     * 
     *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
     */
    onSubmit(form) {
      this.$refs[form].validate(valid => {
        if (valid) {
          //表单数据验证完成之后，提交数据;
          let formData = this[form];
          const para = Object.assign({}, formData);
          console.log(para);
          // edit
          if (this.addFundDialog.type === 'edit') {
            updateMoney(para).then(
            /*
             * vue3-types TODO:
             * 
             *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
             */
            res => {
              ElMessage({
                message: '修改成功',
                type: 'success'
              });
              this.$refs['form'].resetFields();
              this.isVisible = false;
              this.$emit('getFundList');
            });
          } else {
            // add
            addMoney(para).then(
            /*
             * vue3-types TODO:
             * 
             *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
             */
            res => {
              ElMessage({
                message: '新增成功',
                type: 'success'
              });
              this.$refs['form'].resetFields();
              this.isVisible = false;
              this.$emit('getFundList');
            });
          }
        }
      });
    }
  }
};</script>

<style lang="less" scoped>
    .search_container{
        margin-bottom: 20px;
    }
    .btnRight{
        float: right;
        margin-right: 0px !important;
    }
    .searchArea{
        background:rgba(255,255,255,1);
        border-radius:2px;
        padding: 18px 18px 0;
    }
</style>
