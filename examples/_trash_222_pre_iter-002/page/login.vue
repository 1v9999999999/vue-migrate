<template>
  	<div class="login_page fillcontain">
	  	<transition name="form-fade" mode="in-out">
	  		<section class="form_contianer" v-show="showLogin">
		  		<div class="manage_tip">
		  			<p>elm后台管理系统</p>
		  		</div>
		    	<el-form :model="loginForm" :rules="rules" ref="loginFormRef">
					<el-form-item prop="username">
						<el-input v-model="loginForm.username" placeholder="用户名"><span>dsfsf</span></el-input>
					</el-form-item>
					<el-form-item prop="password">
						<el-input type="password" placeholder="密码" v-model="loginForm.password"></el-input>
					</el-form-item>
					<el-form-item>
				    	<el-button type="primary" @click="submitForm('loginForm')" class="submit_btn">登录</el-button>
				  	</el-form-item>
				</el-form>
				<p class="tip">温馨提示：</p>
				<p class="tip">未登录过的新用户，自动注册</p>
				<p class="tip">注册过的用户可凭账号密码登录</p>
	  		</section>
	  	</transition>
  	</div>
</template>

<script setup>
import {login, getAdminInfo} from '@/api/getData'
	import {mapActions, mapState} from 'vuex'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { ElNotification } from 'element-plus'

import { onMounted, reactive, ref, watch } from 'vue'

const loginForm = reactive<object>({
  username: '',
  password: '',
})
const rules = reactive<object>({
  username: [
            { required: true, message: '请输入用户名', trigger: 'blur' },
        ],
  password: [
   { required: true, message: '请输入密码', trigger: 'blur' }
  ],
})
const showLogin = ref<boolean>(false)

const loginFormRef = ref<any>(null)

const store = useStore()
// TODO: 迁移到 Pinia (useXxxStore)；暂时用 Vuex useStore()
const router = useRouter()

watch(() => store.adminInfo, (newValue) => {
    if (newValue.id) {
    	ElMessage({
                        type: 'success',
                        message: '检测到您之前登录过，将自动登录'
                    });
    	router.push('manage')
    }
})

async function submitForm(formName) {
  (__refsMap[formName] as any)?.value.validate(async (valid) => {
  	if (valid) {
  		const res = await login({user_name: loginForm.username, password: loginForm.password})
  		if (res.status == 1) {
  			ElMessage({
                        type: 'success',
                        message: '登录成功'
                    });
  			router.push('manage')
  		}else{
  			ElMessage({
                        type: 'error',
                        message: res.message
                    });
  		}
  	} else {
  		ElNotification.error({
  			title: '错误',
  			message: '请输入正确的用户名密码',
  			offset: 100
  		});
  		return false;
  	}
  });
}

onMounted(() => {
  showLogin.value = true;
  if (!store.adminInfo.id) {
   			store.dispatch('getAdminData')
   		}
});

// 动态 ref 映射：this.$refs[原名] → __refsMap[原名]?.value
const __refsMap: Record<string, any> = {
  loginForm: loginFormRef,
}

</script>

<style lang="less" scoped>
	@import '../style/mixin';
	.login_page{
		background-color: #324057;
	}
	.manage_tip{
		position: absolute;
		width: 100%;
		top: -100px;
		left: 0;
		p{
			font-size: 34px;
			color: #fff;
		}
	}
	.form_contianer{
		.wh(320px, 210px);
		.ctp(320px, 210px);
		padding: 25px;
		border-radius: 5px;
		text-align: center;
		background-color: #fff;
		.submit_btn{
			width: 100%;
			font-size: 16px;
		}
	}
	.tip{
		font-size: 12px;
		color: red;
	}
	.form-fade-enter-active, .form-fade-leave-active {
	  	transition: all 1s;
	}
	.form-fade-enter, .form-fade-leave-active {
	  	transform: translate3d(0, -50px, 0);
	  	opacity: 0;
	}
</style>
