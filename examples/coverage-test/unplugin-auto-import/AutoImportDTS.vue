// src/auto-imports.d.ts (unplugin-auto-import 自动生成)
// 包含 ref, computed, watch, useRoute, useRouter 等的全局类型声明

<!-- 组件内无需 import, IDE 仍有类型补全 -->
<script setup lang="ts">
const count = ref<number>(0)
const route = useRoute()
const router = useRouter()
const store = useUserStore()

// 类型安全的 props
interface Props {
  msg: string
  count?: number
}
const props = withDefaults(defineProps<Props>(), { count: 0 })
</script>
