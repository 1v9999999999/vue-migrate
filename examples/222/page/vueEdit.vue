<template>
    <div>
        <head-top></head-top>
        <div class="edit_container">
        	<quill-editor v-model="content"
                ref="myQuillEditor"
                class="editer"
                :options="editorOption"
                @ready="onEditorReady($event)">
  			</quill-editor>
        </div>
        <div class="submit_btn">
  			<el-button type="primary" @click="submit">提交</el-button>
        </div>
    </div>
</template>

<script setup>
import headTop from '../components/headTop'
    import { quillEditor } from 'vue-quill-editor'
import { ElMessage } from 'element-plus'

import { computed, reactive, ref } from 'vue'

const content = ref<string>('<h3>文本编辑</h3>')
const editorOption = reactive<object>({

})

const myQuillEditor = ref<any>(null)

const editor = computed(() => myQuillEditor.value.quill)

function onEditorReady(editor) {
  console.log('editor ready!', editor)
}

function submit() {
  console.log(content.value);
  ElMessage.success('提交成功！');
}

</script>

<style lang="less">
	@import '../style/mixin';
	.edit_container{
		padding: 40px;
		margin-bottom: 40px;
	}
	.editer{
		height: 350px;
	}
	.submit_btn{
		text-align: center;
	}
</style>
