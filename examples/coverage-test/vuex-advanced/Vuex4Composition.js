<script>
import { useStore } from 'vuex'
import { computed, ref } from 'vue'

export default {
  name: 'Vuex4Composition',
  setup() {
    const store = useStore()
    const localCount = ref(0)

    // 响应式
    const user = computed(() => store.state.user)
    const isAdmin = computed(() => store.getters['user/isAdmin'])

    function login(creds) {
      return store.dispatch('user/login', creds)
    }

    // 同步修改 (commit)
    function increment() {
      store.commit('INCREMENT')
    }

    return { user, isAdmin, login, increment, localCount }
  }
}
</script>

<template>
  <div>
    <p>user: {{ user?.name }}</p>
    <p>isAdmin: {{ isAdmin }}</p>
    <button @click="increment">+1</button>
  </div>
</template>
