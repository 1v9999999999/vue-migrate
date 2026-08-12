// iter-122a: Pinia-only store
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    name: '',
    email: ''
  }),
  actions: {
    setName(name) {
      this.name = name
    },
    setEmail(email) {
      this.email = email
    }
  }
})
