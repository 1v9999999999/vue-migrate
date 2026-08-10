<template>
    <div>
     	<head-top></head-top>
        <el-row style="margin-top: 20px;">
  			<el-col :span="14" :offset="4">
  				<header class="form_header">选择食品种类</header>
	  			<el-form :model="categoryForm" ref="categoryFormRef" label-width="110px" class="form">
		  			<el-row class="category_select">
		  				<el-form-item label="食品种类">
			  				<el-select v-model="categoryForm.categorySelect" :placeholder="selectValue.label" style="width:100%;">
							    <el-option
							      	v-for="item in categoryForm.categoryList"
							      	:key="item.value"
							      	:label="item.label"
							      	:value="item.value">
							    </el-option>
						  	</el-select>
						</el-form-item>
					</el-row>
					<el-row class="add_category_row" :class="showAddCategory? 'showEdit': ''">
						<div class="add_category">
							<el-form-item label="食品种类" prop="name">
								<el-input v-model="categoryForm.name"></el-input>
							</el-form-item>
							<el-form-item label="种类描述" prop="description">
								<el-input v-model="categoryForm.description"></el-input>
							</el-form-item>
							<el-form-item>
								<el-button type="primary" @click="submitcategoryForm('categoryForm')">提交</el-button>
							</el-form-item>
						</div>
					</el-row>
					<div class="add_category_button" @click="addCategoryFun">
						<el-icon class="edit_icon" v-if="showAddCategory"><CaretTop /></el-icon>
						<el-icon class="edit_icon" v-else><CaretBottom /></el-icon>
						<span>添加食品种类</span>
					</div>
	  			</el-form>
	  			<header class="form_header">添加食品</header>
	  			<el-form :model="foodForm" :rules="foodrules" ref="foodFormRef" label-width="110px" class="form food_form">
	  				<el-form-item label="食品名称" prop="name">
						<el-input v-model="foodForm.name"></el-input>
					</el-form-item>
					<el-form-item label="食品活动" prop="activity">
						<el-input v-model="foodForm.activity"></el-input>
					</el-form-item>
					<el-form-item label="食品详情" prop="description">
						<el-input v-model="foodForm.description"></el-input>
					</el-form-item>
					<el-form-item label="上传食品图片">
						<el-upload
						  class="avatar-uploader"
						  :action="baseUrlData + '/v1/addimg/food'"
						  :show-file-list="false"
						  :on-success="uploadImg"
						  :before-upload="beforeImgUpload">
						  <img v-if="foodForm.image_path" :src="baseImgPathData + foodForm.image_path" class="avatar">
						  <el-icon class="avatar-uploader-icon" v-else ><Plus /></el-icon>
						</el-upload>
					</el-form-item>
					<el-form-item label="食品特点">
						<el-select v-model="foodForm.attributes" multiple placeholder="请选择">
						    <el-option
						      	v-for="item in attributes"
						      	:key="item.value"
						      	:label="item.label"
						      	:value="item.value">
						    </el-option>
					 	</el-select>
					</el-form-item>
					<el-form-item label="食品规格">
						<el-radio class="radio" v-model="foodSpecs" label="one">单规格</el-radio>
  						<el-radio class="radio" v-model="foodSpecs" label="more">多规格</el-radio>
					</el-form-item>
					<el-row v-if="foodSpecs == 'one'">
						<el-form-item label="包装费">
							<el-input-number v-model="foodForm.specs[0].packing_fee" :min="0" :max="100"></el-input-number>
						</el-form-item>
						<el-form-item label="价格">
							<el-input-number v-model="foodForm.specs[0].price" :min="0" :max="10000"></el-input-number>
						</el-form-item>
					</el-row>
					<el-row v-else style="overflow: auto; text-align: center;">
						<el-button type="primary" @click="dialogFormVisible = true" style="margin-bottom: 10px;">添加规格</el-button>
						<el-table
					    :data="foodForm.specs"
					    style="margin-bottom: 20px;"
					    :row-class-name="tableRowClassName">
						    <el-table-column
						      prop="specs"
						      label="规格">
						    </el-table-column>
						    <el-table-column
						      prop="packing_fee"
						      label="包装费">
						    </el-table-column>
						    <el-table-column
						      prop="price"
						      label="价格">
						    </el-table-column>
						    <el-table-column label="操作" >
						    <template #default="scope">
						        <el-button
						          size="small"
						          type="danger"
						          @click="handleDelete(scope.$index)">删除</el-button>
						    </template>
						    </el-table-column>
						</el-table>
					</el-row>
					<el-form-item>
						<el-button type="primary" @click="addFood('foodForm')">确认添加食品</el-button>
					</el-form-item>
	  			</el-form>
	  			<el-dialog title="添加规格" v-model="dialogFormVisible">
				  	<el-form :rules="specsFormrules" :model="specsForm">
					    <el-form-item label="规格" label-width="100px" prop="specs">
					     	<el-input v-model="specsForm.specs" auto-complete="off"></el-input>
					    </el-form-item>
					    <el-form-item label="包装费" label-width="100px">
							<el-input-number v-model="specsForm.packing_fee" :min="0" :max="100"></el-input-number>
						</el-form-item>
						<el-form-item label="价格" label-width="100px">
							<el-input-number v-model="specsForm.price" :min="0" :max="10000"></el-input-number>
						</el-form-item>
				  	</el-form>
				  <template #footer>
				      <div class="dialog-footer">
    				    <el-button @click="dialogFormVisible = false">取 消</el-button>
    				    <el-button type="primary" @click="addspecs">确 定</el-button>
				      </div>
				  </template>
				</el-dialog>
  			</el-col>
  		</el-row>
    </div>
</template>

<script setup>
import { CaretTop, CaretBottom, Plus } from '@element-plus/icons-vue';
import headTop from '@/components/headTop';
import { getCategory, addCategory, addFood } from '@/api/getData';
import { baseUrl, baseImgPath } from '@/config/env';
import { ElMessageBox, ElMessage, ElNotification } from "element-plus";
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'

import { computed, reactive, ref } from 'vue'

const baseUrlData = ref(baseUrl)
const baseImgPathData = ref(baseImgPath)
const restaurant_id = ref(1)
const categoryForm = reactive({
  categoryList: [],
  categorySelect: '',
  name: '',
  description: ''
})
const foodForm = reactive({
  name: '',
  description: '',
  image_path: '',
  activity: '',
  attributes: [],
  specs: [{
    specs: '默认',
    packing_fee: 0,
    price: 20
  }]
})
const foodrules = reactive({
  name: [{
    required: true,
    message: '请输入食品名称',
    trigger: 'blur'
  }]
})
const attributes = reactive([{
  value: '新',
  label: '新品'
}, {
  value: '招牌',
  label: '招牌'
}])
const showAddCategory = ref(false)
const foodSpecs = ref('one')
const dialogFormVisible = ref(false)
const specsForm = reactive({
  specs: '',
  packing_fee: 0,
  price: 20
})
const specsFormrules = reactive({
  specs: [{
    required: true,
    message: '请输入规格',
    trigger: 'blur'
  }]
})

const categoryFormRef = ref(null)
const foodFormRef = ref(null)

const __refsMap = {
  categoryFormRef: categoryFormRef,
  foodFormRef: foodFormRef,
  categoryForm: categoryFormRef,
  foodForm: foodFormRef
}

const selectValue = computed(() => {
    return categoryForm.categoryList[categoryForm.categorySelect] || {};
})

const route = useRoute()
const router = useRouter()
// --- created() inline ---
  if (route.query.restaurant_id) {
    restaurant_id.value = route.query.restaurant_id;
  } else {
    restaurant_id.value = Math.ceil(Math.random() * 10);
    ElMessageBox({
      title: '提示',
      message: '添加食品需要选择一个商铺，先去就去选择商铺吗？',
      showCancelButton: true,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      beforeClose:
      /*
       * vue3-types TODO:
       * 
       *   - $router ×1: router → useRouter()  (vue-router@4)
       */
      (action, instance, done) => {
        if (action === 'confirm') {
          router.push('/shopList');
          done();
        } else {
          ElMessage({
            type: 'info',
            message: '取消'
          });
          done();
        }
      }
    });
  }
  initData();
async function initData() {
    try {
    const result = await getCategory(restaurant_id.value);
    if (result.status == 1) {
      result.category_list.map((item, index) => {
        item.value = index;
        item.label = item.name;
      });
      categoryForm.categoryList = result.category_list;
    } else {
      console.log(result);
    }
  } catch (err) {
    console.log(err);
  }
}
function addCategoryFun() {
    showAddCategory.value = !showAddCategory.value;
}
function submitcategoryForm(categoryForm) {
    __refsMap[categoryForm]?.value.validate(async valid => {
    if (valid) {
      const params = {
        name: categoryForm.name,
        description: categoryForm.description,
        restaurant_id: restaurant_id.value
      };
      try {
        const result = await addCategory(params);
        if (result.status == 1) {
          initData();
          categoryForm.name = '';
          categoryForm.description = '';
          showAddCategory.value = false;
          ElMessage({
            type: 'success',
            message: '添加成功'
          });
        }
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
function uploadImg(res, file) {
    if (res.status == 1) {
    foodForm.image_path = res.image_path;
  } else {
    ElMessage.error('上传图片失败！');
  }
}
function beforeImgUpload(file) {
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
function addspecs() {
    foodForm.specs.push({
    ...specsForm
  });
  specsForm.specs = '';
  specsForm.packing_fee = 0;
  specsForm.price = 20;
  dialogFormVisible.value = false;
}
function handleDelete(index) {
    foodForm.specs.splice(index, 1);
}
function tableRowClassName(row, index) {
    if (index === 1) {
    return 'info-row';
  } else if (index === 3) {
    return 'positive-row';
  }
  return '';
}
function __addFood(foodForm) {
    __refsMap[foodForm]?.value.validate(async valid => {
    if (valid) {
      const params = {
        ...foodForm,
        category_id: selectValue.value.id,
        restaurant_id: restaurant_id.value
      };
      try {
        const result = await addFood(params);
        if (result.status == 1) {
          console.log(result);
          ElMessage({
            type: 'success',
            message: '添加成功'
          });
          Object.assign(foodForm, {
            name: '',
            description: '',
            image_path: '',
            activity: '',
            attributes: [],
            specs: [{
              specs: '默认',
              packing_fee: 0,
              price: 20
            }]
          });
        } else {
          ElMessage({
            type: 'error',
            message: result.message
          });
        }
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


;
</script>

<style lang="less">
	@import '../style/mixin';
	.form{
		min-width: 400px;
		margin-bottom: 30px;
		&:hover{
			box-shadow: 0 0 8px 0 rgba(232,237,250,.6), 0 2px 4px 0 rgba(232,237,250,.5);
			border-radius: 6px;
			transition: all 400ms;
		}
	}
	.food_form{
		border: 1px solid #eaeefb;
		padding: 10px 10px 0;
	}
	.form_header{
		text-align: center;
		margin-bottom: 10px;
	}
	.category_select{
		border: 1px solid #eaeefb;
		padding: 10px 30px 10px 10px;
		border-top-right-radius: 6px;
		border-top-left-radius: 6px;
	}
	.add_category_row{
		height: 0;
		overflow: hidden;
		transition: all 400ms;
		background: #f9fafc;
	}
	.showEdit{
		height: 185px;
	}
	.add_category{
		background: #f9fafc;
		padding: 10px 30px 0px 10px;
		border: 1px solid #eaeefb;
		border-top: none;
	}
	.add_category_button{
		text-align: center;
		line-height: 40px;
		border-bottom-right-radius: 6px;
		border-bottom-left-radius: 6px;
		border: 1px solid #eaeefb;
		border-top: none;
		transition: all 400ms;
		&:hover{
			background: #f9fafc;
			span, .edit_icon{
				color: #20a0ff;
			}
		}
		span{
			.sc(14px, #999);
			transition: all 400ms;
		}
		.edit_icon{
			color: #ccc;
			transition: all 400ms;
		}
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
	.cell{
		text-align: center;
	}
</style>
