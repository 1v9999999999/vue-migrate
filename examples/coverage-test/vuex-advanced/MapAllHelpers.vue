<template>
  <div>
    <p>count: {{ count }}</p>
    <p>double: {{ double }}</p>
    <p>user name: {{ userName }}</p>
    <button @click="increment()">+1</button>
    <button @click="asyncIncrement()">async +1</button>
    <button @click="reset()">reset</button>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from 'vuex'

export default {
  name: 'MapAllHelpers',
  computed: {
    // array 形式
    ...mapState(['count', 'items']),
    // object 形式 (rename)
    ...mapState({
      userName: state => state.user.name,
      countPlus: state => state.count + 1
    }),
    // mapGetters
    ...mapGetters(['double', 'isEven']),
    // 命名空间 (假设在 namespaced module 'cart')
    ...mapState('cart', ['items', 'total']),
    ...mapGetters('cart', ['cartCount']),
    // 嵌套命名空间
    ...mapState('user/profile', ['avatar'])
  },
  methods: {
    // mutations
    ...mapMutations(['increment', 'decrement']),
    ...mapMutations({ inc: 'increment' }),
    // actions
    ...mapActions(['asyncIncrement', 'reset']),
    ...mapActions({ asyncInc: 'asyncIncrement' }),
    // 命名空间
    ...mapMutations('cart', ['addItem']),
    ...mapActions('cart', { addToCart: 'addItem' })
  }
}
</script>
