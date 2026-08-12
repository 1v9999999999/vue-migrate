import Vue from 'vue'
import axios from 'axios'

// 注入全局属性
Vue.prototype.$http = axios
Vue.prototype.$api = {
  get: (url) => axios.get(url),
  post: (url, data) => axios.post(url, data)
}
Vue.prototype.$bus = new Vue()  // 事件总线
Vue.prototype.$eventHub = new Vue()
Vue.prototype.$utils = {
  formatDate: (d) => new Date(d).toLocaleString(),
  formatMoney: (v) => `$${v.toFixed(2)}`
}
Vue.prototype.$auth = {
  isLoggedIn: () => !!localStorage.getItem('token'),
  getUser: () => JSON.parse(localStorage.getItem('user') || 'null')
}

// 在组件内用
// this.$http.get('/api/x')
// this.$utils.formatDate(date)
// this.$bus.$emit('event')
