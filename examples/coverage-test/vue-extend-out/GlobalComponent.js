// iter-122a: Vue.component (非 entry) 覆盖率测试
// 这是 plugin / 工具库 风格, 没有 entry chain, Vue.component 应该被标 review

import Vue from 'vue';
import MyComponent from './MyComponent';

// 这种情况会标 review "改 app.component()"
Vue.component('MyComponent', MyComponent);
Vue.component('AnotherComp', {
  template: '<div>Another</div>'
});
