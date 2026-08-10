import { createApp } from 'vue';
import App from './App';
import router from './router';
import store from './store/';
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
const app = createApp(App).use(router).use(store).use(ElementPlus).mount("#app");
