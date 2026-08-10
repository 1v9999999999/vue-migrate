<template>
    <div>
        <head-top></head-top>
        <el-row style="margin-top: 20px;">
  			<el-col :span="12" :offset="4">
		        <el-form :model="formData" :rules="rules" ref="formDataRef" label-width="110px" class="demo-formData">
					<el-form-item label="店铺名称" prop="name">
						<el-input v-model="formData.name"></el-input>
					</el-form-item>
					<el-form-item label="详细地址" prop="address">
						<el-autocomplete
						  v-model="formData.address"
						  :fetch-suggestions="querySearchAsync"
						  placeholder="请输入地址"
						  style="width: 100%;"
						  @select="addressSelect"
						></el-autocomplete>
						<span>当前城市：{{city.name}}</span>
					</el-form-item>
					<el-form-item label="联系电话" prop="phone">
						<el-input v-model.number="formData.phone" maxLength="11"></el-input>
					</el-form-item>
					<el-form-item label="店铺简介" prop="description">
						<el-input v-model="formData.description"></el-input>
					</el-form-item>
					<el-form-item label="店铺标语" prop="promotion_info">
						<el-input v-model="formData.promotion_info"></el-input>
					</el-form-item>
					<el-form-item label="店铺分类">
						<el-cascader
						  :options="categoryOptions"
						  v-model="selectedCategory"
						  change-on-select
						></el-cascader>
					</el-form-item>
					<el-form-item label="店铺特点" style="white-space: nowrap;">
						<span>品牌保证</span>
						<el-switch on-text="" off-text="" v-model="formData.is_premium"></el-switch>
						<span>蜂鸟专送</span>
						<el-switch on-text="" off-text="" v-model="formData.delivery_mode"></el-switch>
						<span>新开店铺</span>
						<el-switch on-text="" off-text="" v-model="formData.new"></el-switch>
					</el-form-item>
					<el-form-item style="white-space: nowrap;">
						<span>外卖保</span>
						<el-switch on-text="" off-text="" v-model="formData.bao"></el-switch>
						<span>准时达</span>
						<el-switch on-text="" off-text="" v-model="formData.zhun"></el-switch>
						<span>开发票</span>
						<el-switch on-text="" off-text="" v-model="formData.piao"></el-switch>
					</el-form-item>
					<el-form-item label="配送费" prop="float_delivery_fee">
						<el-input-number v-model="formData.float_delivery_fee" :min="0" :max="20"></el-input-number>
					</el-form-item>
					<el-form-item label="起送价" prop="float_minimum_order_amount">
						<el-input-number v-model="formData.float_minimum_order_amount" :min="0" :max="100"></el-input-number>
					</el-form-item>
					<el-form-item label="营业时间" style="white-space: nowrap;">
						<el-time-select
							placeholder="起始时间"
							v-model="formData.startTime"
							:picker-options="{
							start: '05:30',
							step: '00:15',
							end: '23:30'
							}">
						</el-time-select>
						<el-time-select
							placeholder="结束时间"
							v-model="formData.endTime"
							:picker-options="{
							start: '05:30',
							step: '00:15',
							end: '23:30',
							minTime: formData.startTime
							}">
						</el-time-select>
					</el-form-item>

					<el-form-item label="上传店铺头像">
						<el-upload
						  class="avatar-uploader"
						  :action="baseUrlData + '/v1/addimg/shop'"
						  :show-file-list="false"
						  :on-success="handleShopAvatarScucess"
						  :before-upload="beforeAvatarUpload">
						  <img v-if="formData.image_path" :src="baseImgPathData + formData.image_path" class="avatar">
						  <el-icon class="avatar-uploader-icon" v-else ><Plus /></el-icon>
						</el-upload>
					</el-form-item>
					<el-form-item label="上传营业执照">
						<el-upload
						  class="avatar-uploader"
						  :action="baseUrlData + '/v1/addimg/shop'"
						  :show-file-list="false"
						  :on-success="handleBusinessAvatarScucess"
						  :before-upload="beforeAvatarUpload">
						  <img v-if="formData.business_license_image" :src="baseImgPathData + formData.business_license_image" class="avatar">
						  <el-icon class="avatar-uploader-icon" v-else ><Plus /></el-icon>
						</el-upload>
					</el-form-item>
					<el-form-item label="上传餐饮服务许可证">
						<el-upload
						  class="avatar-uploader"
						  :action="baseUrlData + '/v1/addimg/shop'"
						  :show-file-list="false"
						  :on-success="handleServiceAvatarScucess"
						  :before-upload="beforeAvatarUpload">
						  <img v-if="formData.catering_service_license_image" :src="baseImgPathData + formData.catering_service_license_image" class="avatar">
						  <el-icon class="avatar-uploader-icon" v-else ><Plus /></el-icon>
						</el-upload>
					</el-form-item>
					<el-form-item label="优惠活动">
						<el-select v-model="activityValue" @change="selectActivity" :placeholder="activityValue">
						    <el-option
						      	v-for="item in options"
						      	:key="item.value"
						      	:label="item.label"
						      	:value="item.value">
						    </el-option>
						</el-select>
					</el-form-item>
					<el-table
					    :data="activities"
					    style="min-width: 600px;margin-bottom: 20px;"
						align="cneter"
					    :row-class-name="tableRowClassName">
					    <el-table-column
					      prop="icon_name"
					      label="活动标题"
					      align="cneter"
					      width="120">
					    </el-table-column>
					    <el-table-column
					      prop="name"
					      label="活动名称"
					      align="cneter"
					      width="120">
					    </el-table-column>
					    <el-table-column
					      prop="description"
					      align="cneter"
					      label="活动详情">
					    </el-table-column>
					    <el-table-column
					    	label="操作"
					    	width="120">
					    <template #default="scope">
					        <el-button
					          size="small"
					          type="danger"
					          @click="handleDelete(scope.$index)">删除</el-button>
					    </template>
					    </el-table-column>
					</el-table>
					<el-form-item class="button_submit">
						<el-button type="primary" @click="submitForm('formData')">立即创建</el-button>
					</el-form-item>
				</el-form>
  			</el-col>
  		</el-row>
    </div>
</template>

<script setup>
import { Plus } from '@element-plus/icons-vue';
import headTop from '@/components/headTop';
import { cityGuess, addShop, searchplace, foodCategory } from '@/api/getData';
import { baseUrl, baseImgPath } from '@/config/env';
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";

import { onMounted, reactive, ref } from 'vue'

const city = reactive({})
const formData = reactive({
  name: '',
  //店铺名称
  address: '',
  //地址
  latitude: '',
  longitude: '',
  description: '',
  //介绍
  phone: '',
  promotion_info: '',
  float_delivery_fee: 5,
  //运费
  float_minimum_order_amount: 20,
  //起价
  is_premium: true,
  delivery_mode: true,
  new: true,
  bao: true,
  zhun: true,
  piao: true,
  startTime: '',
  endTime: '',
  image_path: '',
  business_license_image: '',
  catering_service_license_image: ''
})
const rules = reactive({
  name: [{
    required: true,
    message: '请输入店铺名称',
    trigger: 'blur'
  }],
  address: [{
    required: true,
    message: '请输入详细地址',
    trigger: 'blur'
  }],
  phone: [{
    required: true,
    message: '请输入联系电话'
  }, {
    type: 'number',
    message: '电话号码必须是数字'
  }]
})
const options = reactive([{
  value: '满减优惠',
  label: '满减优惠'
}, {
  value: '优惠大酬宾',
  label: '优惠大酬宾'
}, {
  value: '新用户立减',
  label: '新用户立减'
}, {
  value: '进店领券',
  label: '进店领券'
}])
const activityValue = ref('满减优惠')
const activities = reactive([{
  icon_name: '减',
  name: '满减优惠',
  description: '满30减5，满60减8'
}])
const baseUrlData = ref(baseUrl)
const baseImgPathData = ref(baseImgPath)
const categoryOptions = reactive([])
const selectedCategory = reactive(['快餐便当', '简餐'])

const formDataRef = ref(null)

const __refsMap = {
  formDataRef: formDataRef,
  formData: formDataRef
}

async function initData() {
    try {
    Object.assign(city, await cityGuess());
    const categories = await foodCategory();
    categories.forEach(item => {
      if (item.sub_categories.length) {
        const addnew = {
          value: item.name,
          label: item.name,
          children: []
        };
        item.sub_categories.forEach((subitem, index) => {
          if (index == 0) {
            return;
          }
          addnew.children.push({
            value: subitem.name,
            label: subitem.name
          });
        });
        categoryOptions.push(addnew);
      }
    });
  } catch (err) {
    console.log(err);
  }
}
async function querySearchAsync(queryString, cb) {
    if (queryString) {
    try {
      const cityList = await searchplace(city.id, queryString);
      if (cityList instanceof Array) {
        cityList.map(item => {
          item.value = item.address;
          return item;
        });
        cb(cityList);
      }
    } catch (err) {
      console.log(err);
    }
  }
}
function addressSelect(address) {
    formData.latitude = address.latitude;
  formData.longitude = address.longitude;
  console.log(formData.latitude, formData.longitude);
}
function handleShopAvatarScucess(res, file) {
    if (res.status == 1) {
    formData.image_path = res.image_path;
  } else {
    ElMessage.error('上传图片失败！');
  }
}
function handleBusinessAvatarScucess(res, file) {
    if (res.status == 1) {
    formData.business_license_image = res.image_path;
  } else {
    ElMessage.error('上传图片失败！');
  }
}
function handleServiceAvatarScucess(res, file) {
    if (res.status == 1) {
    formData.catering_service_license_image = res.image_path;
  } else {
    ElMessage.error('上传图片失败！');
  }
}
function beforeAvatarUpload(file) {
    const isRightType = file.type === 'image/jpeg' || file.type === 'image/png';
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isRightType) {
    ElMessage.error('上传头像图片只能是 JPG 格式!');
  }
  if (!isLt2M) {
    ElMessage.error('上传头像图片大小不能超过 2MB!');
  }
  return isRightType && isLt2M;
}
function tableRowClassName(row, index) {
    if (index === 1) {
    return 'info-row';
  } else if (index === 3) {
    return 'positive-row';
  }
  return '';
}
function selectActivity() {
    ElMessageBox.prompt('请输入活动详情', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).then(({
    value
  }) => {
    if (value == null) {
      ElMessage({
        type: 'info',
        message: '请输入活动详情'
      });
      return;
    }
    let newObj = {};
    switch (activityValue.value) {
      case '满减优惠':
        newObj = {
          icon_name: '减',
          name: '满减优惠',
          description: value
        };
        break;
      case '优惠大酬宾':
        newObj = {
          icon_name: '特',
          name: '优惠大酬宾',
          description: value
        };
        break;
      case '新用户立减':
        newObj = {
          icon_name: '新',
          name: '新用户立减',
          description: value
        };
        break;
      case '进店领券':
        newObj = {
          icon_name: '领',
          name: '进店领券',
          description: value
        };
        break;
    }
    activities.push(newObj);
  }).catch(() => {
    ElMessage({
      type: 'info',
      message: '取消输入'
    });
  });
}
function handleDelete(index) {
    activities.splice(index, 1);
}
function submitForm(formName) {
    __refsMap[formName]?.value.validate(async valid => {
    if (valid) {
      Object.assign(formData, {
        activities: activities
      }, {
        category: selectedCategory.join('/')
      });
      try {
        let result = await addShop(formData);
        if (result.status == 1) {
          ElMessage({
            type: 'success',
            message: '添加成功'
          });
          Object.assign(formData, {
            name: '',
            //店铺名称
            address: '',
            //地址
            latitude: '',
            longitude: '',
            description: '',
            //介绍
            phone: '',
            promotion_info: '',
            float_delivery_fee: 5,
            //运费
            float_minimum_order_amount: 20,
            //起价
            is_premium: true,
            delivery_mode: true,
            new: true,
            bao: true,
            zhun: true,
            piao: true,
            startTime: '',
            endTime: '',
            image_path: '',
            business_license_image: '',
            catering_service_license_image: ''
          });
          selectedCategory.splice(0, selectedCategory.length, ...['快餐便当', '简餐']);
          activities.splice(0, activities.length, ...[{
            icon_name: '减',
            name: '满减优惠',
            description: '满30减5，满60减8'
          }]);
        } else {
          ElMessage({
            type: 'error',
            message: result.message
          });
        }
        console.log(result);
      } catch (err) {
        console.log(err);
      }
    } else {
      ElNotification({
        type: "error",
        title: '错误',
        message: '请检查输入是否正确',
        offset: 100
      });
      return false;
    }
  });
}

onMounted(() => {
    initData();
})

;
</script>

<style lang="less">
	@import '../style/mixin';
	.button_submit{
		text-align: center;
	}
	.avatar-uploader .el-upload {
	    border: 1px dashed #d9d9d9;
	    border-radius: 6px;
	    cursor: pointer;
	    position: relative;
	    overflow: hidden;
	}
	.avatar-uploader .el-upload:hover {
	    border-color: #20a0ff;
	}
	.avatar-uploader-icon {
	    font-size: 28px;
	    color: #8c939d;
	    width: 120px;
	    height: 120px;
	    line-height: 120px;
	    text-align: center;
	}
	.avatar {
	    width: 120px;
	    height: 120px;
	    display: block;
	}
	.el-table .info-row {
	    background: #c9e5f5;
	}

	.el-table .positive-row {
	    background: #e2f0e4;
	}
</style>
