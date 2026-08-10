import { defineStore } from "pinia";
import { getAdminInfo } from '@/api/getData';
const state = {
  adminInfo: {
    avatar: 'default.jpg'
  }
};
const mutations = {
  saveAdminInfo(state, adminInfo) {
    state.adminInfo = adminInfo;
  }
};
const actions = {
  async getAdminData({
    commit
  }) {
    try {
      const res = await getAdminInfo();
      if (res.status == 1) {
        commit('saveAdminInfo', res.data);
      } else {
        throw new Error(res.type);
      }
    } catch (err) {
      // console.log(err.message)
    }
  }
};
export const useStoreStore = defineStore("store", {
  state: () => ({
    adminInfo: {
      avatar: 'default.jpg'
    }
  }),
  actions: {
    saveAdminInfo: function (adminInfo) {
      this.adminInfo = adminInfo;
    },
    getAdminData: async function () {
      try {
        const res = await getAdminInfo();
        if (res.status == 1) {
          this.saveAdminInfo(res.data);
        } else {
          throw new Error(res.type);
        }
      } catch (err) {
        // console.log(err.message)
      }
    }
  }
});
