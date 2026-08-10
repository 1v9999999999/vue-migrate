<template>
    <div class="fillcontain">
        <head-top></head-top>
        <header class="admin_title">管理员信息</header>
        <div class="admin_set">
            <ul>
                <li>
                    <span>姓名：</span><span>{{store.adminInfo.user_name}}</span>
                </li>
                <li>
                    <span>注册时间：</span><span>{{store.adminInfo.create_time}}</span>
                </li>
                <li>
                    <span>管理员权限：</span><span>{{store.adminInfo.admin}}</span>
                </li>
                <li>
                    <span>管理员 ID：</span><span>{{store.adminInfo.id}}</span>
                </li>
                <li>
                    <span>更换头像：</span>
                    <el-upload
                      class="avatar-uploader"
                      :action="baseUrlData + '/admin/update/avatar/' + store.adminInfo.id"
                      :show-file-list="false"
                      :on-success="uploadImg"
                      :before-upload="beforeImgUpload">
                      <img v-if="store.adminInfo.avatar" :src="baseImgPathData + store.adminInfo.avatar" class="avatar">
                      <el-icon class="avatar-uploader-icon" v-else ><Plus /></el-icon>
                    </el-upload>
                </li>    
            </ul>
        </div>
    </div>
</template>

<script setup>
import { Plus } from '@element-plus/icons-vue';

import headTop from '../components/headTop';

import { baseUrl, baseImgPath } from '@/config/env';

import { ElMessage } from "element-plus";

import { useAppStore } from '@/store';


import { computed, ref } from 'vue';


const baseUrlData = ref(baseUrl)
const baseImgPathData = ref(baseImgPath)

const adminInfo = computed(() => useAppStore().adminInfo)

function uploadImg(res, file) {
    if (res.status == 1) {
    adminInfo.value.avatar = res.image_path;
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


;
</script>

<style lang="less">
	@import '../style/mixin';
	.explain_text{
		margin-top: 20px;
		text-align: center;
		font-size: 20px;
		color: #333;
	}
    .admin_set{
        width: 60%;
        background-color: #F9FAFC;
        min-height: 400px;
        margin: 20px auto 0;
        border-radius: 10px;
        ul > li{
            padding: 20px;
            span{
                color: #666;
            }
        }
    }
    .admin_title{
        margin-top: 20px;
        .sc(24px, #666);
        text-align: center;
    }
    .avatar-uploader .el-upload {
        border: 1px dashed #d9d9d9;
        margin-top: 10px;
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
