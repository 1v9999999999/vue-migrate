<template>
    <div class="fillcontain">
        <head-top></head-top>
        <div class="table_container">
            <el-table
                :data="tableData"
                @expand='expand'
                :expand-row-keys='expendRow'
                :row-key="row => row.index"
                style="width: 100%">
                <el-table-column type="expand">
                  <template #default="props">
                    <el-form label-position="left" inline class="demo-table-expand">
                      <el-form-item label="食品名称">
                        <span>{{ props.row.name }}</span>
                      </el-form-item>
                      <el-form-item label="餐馆名称">
                        <span>{{ props.row.restaurant_name }}</span>
                      </el-form-item>
                      <el-form-item label="食品 ID">
                        <span>{{ props.row.item_id }}</span>
                      </el-form-item>
                      <el-form-item label="餐馆 ID">
                        <span>{{ props.row.restaurant_id }}</span>
                      </el-form-item>
                      <el-form-item label="食品介绍">
                        <span>{{ props.row.description }}</span>
                      </el-form-item>
                      <el-form-item label="餐馆地址">
                        <span>{{ props.row.restaurant_address }}</span>
                      </el-form-item>
                      <el-form-item label="食品评分">
                        <span>{{ props.row.rating }}</span>
                      </el-form-item>
                      <el-form-item label="食品分类">
                        <span>{{ props.row.category_name }}</span>
                      </el-form-item>
                      <el-form-item label="月销量">
                        <span>{{ props.row.month_sales }}</span>
                      </el-form-item>
                    </el-form>
                  </template>
                </el-table-column>
                <el-table-column
                  label="食品名称"
                  prop="name">
                </el-table-column>
                <el-table-column
                  label="食品介绍"
                  prop="description">
                </el-table-column>
                <el-table-column
                  label="评分"
                  prop="rating">
                </el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="scope">
                    <el-button
                      size="small"
                      @click="handleEdit(scope.row)">编辑</el-button>
                    <el-button
                      size="small"
                      type="danger"
                      @click="handleDelete(scope.$index, scope.row)">删除</el-button>
                  </template>
                </el-table-column>
            </el-table>
            <div class="Pagination">
                <el-pagination
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                  :current-page="currentPage"
                  :page-size="20"
                  layout="total, prev, pager, next"
                  :total="count">
                </el-pagination>
            </div>
            <el-dialog title="修改食品信息" v-model="dialogFormVisible">
                <el-form :model="selectTable">
                    <el-form-item label="食品名称" label-width="100px">
                        <el-input v-model="selectTable.name" auto-complete="off"></el-input>
                    </el-form-item>
                    <el-form-item label="食品介绍" label-width="100px">
                        <el-input v-model="selectTable.description"></el-input>
                    </el-form-item>
                    <el-form-item label="食品分类" label-width="100px">
	                    <el-select v-model="selectIndex" :placeholder="selectMenu.label" @change="handleSelect">
						    <el-option
						      v-for="item in menuOptions"
						      :key="item.value"
						      :label="item.label"
						      :value="item.index">
						    </el-option>
						</el-select>
                    </el-form-item>
                    <el-form-item label="食品图片" label-width="100px">
                        <el-upload
                          class="avatar-uploader"
                          :action="baseUrl + '/v1/addimg/food'"
                          :show-file-list="false"
                          :on-success="handleServiceAvatarScucess"
                          :before-upload="beforeAvatarUpload">
                          <img v-if="selectTable.image_path" :src="baseImgPath + selectTable.image_path" class="avatar">
                          <el-icon class="avatar-uploader-icon" v-else ><Plus /></el-icon>
                        </el-upload>
                    </el-form-item>
                </el-form>
                <el-row style="overflow: auto; text-align: center;">
	                <el-table
				    :data="specs"
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
					          @click="deleteSpecs(scope.$index)">删除</el-button>
					    </template>
					    </el-table-column>
					</el-table>
					<el-button type="primary" @click="specsFormVisible = true" style="margin-bottom: 10px;">添加规格</el-button>
				</el-row>
              <template #footer>
                  <div class="dialog-footer">
                    <el-button @click="dialogFormVisible = false">取 消</el-button>
                    <el-button type="primary" @click="updateFood">确 定</el-button>
                  </div>
              </template>
            </el-dialog>


            <el-dialog title="添加规格" v-model="specsFormVisible">
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
    			    <el-button @click="specsFormVisible = false">取 消</el-button>
    			    <el-button type="primary" @click="addspecs">确 定</el-button>
			      </div>
			  </template>
			</el-dialog>
        </div>
    </div>
</template>

<script setup>
import headTop from '../components/headTop';

import { baseUrl, baseImgPath } from '@/config/env';

import { getFoods, getFoodsCount, getMenu, updateFood, deleteFood, getResturantDetail, getMenuById } from '@/api/getData';

import { ElMessage } from "element-plus";

import { useRoute } from 'vue-router';

import { nextTick } from 'vue';


import { computed, reactive, ref } from 'vue';


const baseUrlData = ref(baseUrl)
const baseImgPathData = ref(baseImgPath)
const restaurant_id = ref(null)
const city = reactive({})
const offset = ref(0)
const limit = ref(20)
const count = ref(0)
const tableData = reactive([])
const currentPage = ref(1)
const selectTable = reactive({})
const dialogFormVisible = ref(false)
const menuOptions = reactive([])
const selectMenu = reactive({})
const selectIndex = ref(null)
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
const specsFormVisible = ref(false)
const expendRow = reactive([])

const specs = computed(() => {
    let specs = [];
  if (selectTable.specfoods) {
    selectTable.specfoods.forEach(item => {
      specs.push({
        specs: item.specs_name,
        packing_fee: item.packing_fee,
        price: item.price
      });
    });
  }
  return specs;
})

const route = useRoute()
// --- created() inline ---
  restaurant_id.value = route.query.restaurant_id;
  initData();
async function initData() {
    try {
    const countData = await getFoodsCount({
      restaurant_id: restaurant_id.value
    });
    if (countData.status == 1) {
      count.value = countData.count;
    } else {
      throw new Error('获取数据失败');
    }
    getFoods();
  } catch (err) {
    console.log('获取数据失败', err);
  }
}
async function __getMenu() {
    menuOptions.splice(0, menuOptions.length, ...[]);
  try {
    const menu = await getMenu({
      restaurant_id: selectTable.restaurant_id,
      allMenu: true
    });
    menu.forEach((item, index) => {
      menuOptions.push({
        label: item.name,
        value: item.id,
        index
      });
    });
  } catch (err) {
    console.log('获取食品种类失败', err);
  }
}
async function __getFoods() {
    const Foods = await getFoods({
    offset: offset.value,
    limit: limit.value,
    restaurant_id: restaurant_id.value
  });
  tableData.splice(0, tableData.length, ...[]);
  Foods.forEach((item, index) => {
    const tableData = {};
    tableData.name = item.name;
    tableData.item_id = item.item_id;
    tableData.description = item.description;
    tableData.rating = item.rating;
    tableData.month_sales = item.month_sales;
    tableData.restaurant_id = item.restaurant_id;
    tableData.category_id = item.category_id;
    tableData.image_path = item.image_path;
    tableData.specfoods = item.specfoods;
    tableData.index = index;
    tableData.push(tableData);
  });
}
function tableRowClassName(row, index) {
    if (index === 1) {
    return 'info-row';
  } else if (index === 3) {
    return 'positive-row';
  }
  return '';
}
function addspecs() {
    specs.value.push({
    ...specsForm
  });
  specsForm.specs = '';
  specsForm.packing_fee = 0;
  specsForm.price = 20;
  specsFormVisible.value = false;
}
function deleteSpecs(index) {
    specs.value.splice(index, 1);
}
function handleSizeChange(val) {
    console.log(`每页 ${val} 条`);
}
function handleCurrentChange(val) {
    currentPage.value = val;
  offset.value = (val - 1) * limit.value;
  getFoods();
}
function expand(row, status) {
    if (status) {
    getSelectItemData(row);
  } else {
    const index = expendRow.indexOf(row.index);
    expendRow.splice(index, 1);
  }
}
function handleEdit(row) {
    getSelectItemData(row, 'edit');
  dialogFormVisible.value = true;
}
async function getSelectItemData(row, type) {
    const restaurant = await getResturantDetail(row.restaurant_id);
  const category = await getMenuById(row.category_id);
  Object.assign(selectTable, {
    ...row,
    ...{
      restaurant_name: restaurant.name,
      restaurant_address: restaurant.address,
      category_name: category.name
    }
  });
  Object.assign(selectMenu, {
    label: category.name,
    value: row.category_id
  });
  tableData.splice(row.index, 1, {
    ...selectTable
  });
  nextTick(() => {
    expendRow.push(row.index);
  });
  if (type == 'edit' && restaurant_id.value != row.restaurant_id) {
    getMenu();
  }
}
function handleSelect(index) {
    selectIndex.value = index;
  Object.assign(selectMenu, menuOptions[index]);
}
async function handleDelete(index, row) {
    try {
    const res = await deleteFood(row.item_id);
    if (res.status == 1) {
      ElMessage({
        type: 'success',
        message: '删除食品成功'
      });
      tableData.splice(index, 1);
    } else {
      throw new Error(res.message);
    }
  } catch (err) {
    ElMessage({
      type: 'error',
      message: err.message
    });
    console.log('删除食品失败');
  }
}
function handleServiceAvatarScucess(res, file) {
    if (res.status == 1) {
    selectTable.image_path = res.image_path;
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
async function __updateFood() {
    dialogFormVisible.value = false;
  try {
    const subData = {
      new_category_id: selectMenu.value,
      specs: specs
    };
    const postData = {
      ...selectTable,
      ...subData
    };
    const res = await updateFood(postData);
    if (res.status == 1) {
      ElMessage({
        type: 'success',
        message: '更新食品信息成功'
      });
      getFoods();
    } else {
      ElMessage({
        type: 'error',
        message: res.message
      });
    }
  } catch (err) {
    console.log('更新餐馆信息失败', err);
  }
}


;
</script>

<style lang="less">
	@import '../style/mixin';
    .demo-table-expand {
        font-size: 0;
    }
    .demo-table-expand label {
        width: 90px;
        color: #99a9bf;
    }
    .demo-table-expand .el-form-item {
        margin-right: 0;
        margin-bottom: 0;
        width: 50%;
    }
    .table_container{
        padding: 20px;
    }
    .Pagination{
        display: flex;
        justify-content: flex-start;
        margin-top: 8px;
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
</style>
