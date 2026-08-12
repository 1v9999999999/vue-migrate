// 1. 独立 namespace helper
import { createNamespacedHelpers } from 'vuex'
const userHelpers = createNamespacedHelpers('user')
const productHelpers = createNamespacedHelpers('product')

export default {
  computed: {
    ...userHelpers.mapState(['name', 'roles']),
    ...userHelpers.mapGetters(['isAdmin']),
    ...productHelpers.mapState(['list', 'currentPage']),
    ...productHelpers.mapGetters({ totalProducts: 'count' })
  },
  methods: {
    ...userHelpers.mapActions(['login', 'logout']),
    ...productHelpers.mapMutations({ setPage: 'SET_PAGE' })
  }
}

// 2. 自定义 helper
export function mapNamespacedActions(namespace, mappings) {
  return Object.fromEntries(
    Object.entries(mappings).map(([key, type]) => [
      key,
      function (...args) {
        return this.$store.dispatch(`${namespace}/${type}`, ...args)
      }
    ])
  )
}
