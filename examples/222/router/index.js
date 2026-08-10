import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
const login = r => () => /* webpackChunkName: "login" */import("@/page/login");
const manage = r => () => /* webpackChunkName: "manage" */import("@/page/manage");
const home = r => () => /* webpackChunkName: "home" */import("@/page/home");
const addShop = r => () => /* webpackChunkName: "addShop" */import("@/page/addShop");
const addGoods = r => () => /* webpackChunkName: "addGoods" */import("@/page/addGoods");
const userList = r => () => /* webpackChunkName: "userList" */import("@/page/userList");
const shopList = r => () => /* webpackChunkName: "shopList" */import("@/page/shopList");
const foodList = r => () => /* webpackChunkName: "foodList" */import("@/page/foodList");
const orderList = r => () => /* webpackChunkName: "orderList" */import("@/page/orderList");
const adminList = r => () => /* webpackChunkName: "adminList" */import("@/page/adminList");
const visitor = r => () => /* webpackChunkName: "visitor" */import("@/page/visitor");
const newMember = r => () => /* webpackChunkName: "newMember" */import("@/page/newMember");
const uploadImg = r => () => /* webpackChunkName: "uploadImg" */import("@/page/uploadImg");
const vueEdit = r => () => /* webpackChunkName: "vueEdit" */import("@/page/vueEdit");
const adminSet = r => () => /* webpackChunkName: "adminSet" */import("@/page/adminSet");
const sendMessage = r => () => /* webpackChunkName: "sendMessage" */import("@/page/sendMessage");
const explain = r => () => /* webpackChunkName: "explain" */import("@/page/explain");
const routes = [{
  path: '/',
  component: login
}, {
  path: '/manage',
  component: manage,
  name: '',
  children: [{
    path: '',
    component: home,
    meta: []
  }, {
    path: '/addShop',
    component: addShop,
    meta: ['添加数据', '添加商铺']
  }, {
    path: '/addGoods',
    component: addGoods,
    meta: ['添加数据', '添加商品']
  }, {
    path: '/userList',
    component: userList,
    meta: ['数据管理', '用户列表']
  }, {
    path: '/shopList',
    component: shopList,
    meta: ['数据管理', '商家列表']
  }, {
    path: '/foodList',
    component: foodList,
    meta: ['数据管理', '食品列表']
  }, {
    path: '/orderList',
    component: orderList,
    meta: ['数据管理', '订单列表']
  }, {
    path: '/adminList',
    component: adminList,
    meta: ['数据管理', '管理员列表']
  }, {
    path: '/visitor',
    component: visitor,
    meta: ['图表', '用户分布']
  }, {
    path: '/newMember',
    component: newMember,
    meta: ['图表', '用户数据']
  }, {
    path: '/uploadImg',
    component: uploadImg,
    meta: ['文本编辑', 'MarkDown']
  }, {
    path: '/vueEdit',
    component: vueEdit,
    meta: ['编辑', '文本编辑']
  }, {
    path: '/adminSet',
    component: adminSet,
    meta: ['设置', '管理员设置']
  }, {
    path: '/sendMessage',
    component: sendMessage,
    meta: ['设置', '发送通知']
  }, {
    path: '/explain',
    component: explain,
    meta: ['说明', '说明']
  }]
}];
export default createRouter({
  history: createWebHashHistory(),
  routes,
  strict: process.env.NODE_ENV !== 'production'
});
