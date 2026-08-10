import Vue from 'vue';
import { defineStore } from "pinia";
import { getAdminInfo } from '@/api/getData';
export const useAppStore = defineStore("app", {
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
