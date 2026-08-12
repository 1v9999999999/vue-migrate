// iter-122a: Vue.extend basic + chain 覆盖率测试

import { defineComponent } from 'vue';

// Vue.extend basic
const MyComponent = defineComponent({
  template: '<div>{{ msg }}</div>',
  data() {
    return {
      msg: 'hi'
    };
  },
  methods: {
    greet() {
      return 'Hello, ' + this.msg;
    }
  }
});

// 链式 extend (Vue 2 子类继承)
const SubComponent = defineComponent({
  data() {
    return {
      msg: 'sub'
    };
  }
});
export { MyComponent, SubComponent };
export default MyComponent;
