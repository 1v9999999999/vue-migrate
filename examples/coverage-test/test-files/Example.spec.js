/**
 * Jest + @vue/test-utils 单元测试示例 (Vue 2 写法)
 * Vue 3 迁移: @vue/test-utils v1 → v2, shallowMount API 变化
 */
import { shallowMount, mount, createWrapper } from '@vue/test-utils'
import { expect } from 'chai'
import sinon from 'sinon'

import MyComponent from './MyComponent.vue'
import ChildComponent from './ChildComponent.vue'
import FormComponent from './FormComponent.vue'
import TableComponent from './TableComponent.vue'
import ModalComponent from './ModalComponent.vue'

// ====== 基础 mount 测试 ======
describe('MyComponent', () => {
  it('renders props.msg when passed', () => {
    const msg = 'new message'
    const wrapper = mount(MyComponent, {
      propsData: { msg }
    })
    expect(wrapper.text()).to.include(msg)
  })

  it('renders default msg when not passed', () => {
    const wrapper = mount(MyComponent)
    expect(wrapper.text()).to.include('default')
  })

  it('has a created hook', () => {
    const spy = sinon.spy()
    const wrapper = mount(MyComponent, {
      methods: { fetchData: spy }
    })
    expect(spy.calledOnce).to.be.true
  })

  it('emits click event', async () => {
    const wrapper = mount(MyComponent)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).to.have.lengthOf(1)
    expect(wrapper.emitted('click')[0]).to.deep.equal(['payload'])
  })
})

// ====== shallowMount + 子组件 stub ======
describe('ChildComponent with shallowMount', () => {
  it('stubs child components', () => {
    const wrapper = shallowMount(ChildComponent, {
      stubs: ['AsyncChild', 'HeavyComponent']
    })
    expect(wrapper.findComponent({ name: 'AsyncChild' }).exists()).to.be.true
    expect(wrapper.html()).to.include('asyncchild-stub')
  })

  it('uses global stubs', () => {
    const wrapper = shallowMount(ChildComponent, {
      global: {
        stubs: { ElButton: true, ElInput: true }
      }
    })
    expect(wrapper.findComponent({ name: 'ElButton' }).exists()).to.be.true
  })
})

// ====== Vuex store mock 测试 ======
describe('FormComponent with store', () => {
  it('dispatches login action', async () => {
    const actions = {
      login: sinon.stub().resolves({ token: 'fake' })
    }
    const store = {
      dispatch: actions.login,
      state: { user: { token: '' } },
      getters: { isAuthenticated: () => false }
    }
    const wrapper = mount(FormComponent, {
      mocks: { $store: store }
    })
    await wrapper.find('form').trigger('submit.prevent')
    expect(actions.login.calledOnce).to.be.true
    expect(actions.login.firstCall.args[1]).to.deep.equal({
      username: 'admin',
      password: '123456'
    })
  })

  it('computes from store getters', () => {
    const getters = { 'user/isAdmin': () => true }
    const wrapper = mount(FormComponent, {
      mocks: {
        $store: { state: { user: { roles: ['admin'] } }, getters }
      },
      computed: { isAdmin() { return getters['user/isAdmin']() } }
    })
    expect(wrapper.vm.isAdmin).to.be.true
  })
})

// ====== Table 组件 slot 测试 ======
describe('TableComponent slots', () => {
  it('renders default slot', () => {
    const wrapper = mount(TableComponent, {
      slots: {
        default: '<tr><td>custom row</td></tr>'
      }
    })
    expect(wrapper.html()).to.include('custom row')
  })

  it('renders named slots', () => {
    const wrapper = mount(TableComponent, {
      slots: {
        header: '<th>Name</th>',
        footer: '<tr><td>Total: 100</td></tr>'
      }
    })
    expect(wrapper.find('thead').html()).to.include('Name')
    expect(wrapper.find('tfoot').html()).to.include('Total: 100')
  })

  it('renders scoped slots', () => {
    const wrapper = mount(TableComponent, {
      scopedSlots: {
        row: '<template #row="{ item }"><td>{{ item.name }}</td></template>'
      }
    })
    expect(wrapper.html()).to.include('test-item')
  })
})

// ====== Modal 组件 v-model 测试 ======
describe('ModalComponent v-model', () => {
  it('syncs visible via v-model', async () => {
    const wrapper = mount(ModalComponent, {
      propsData: { value: false }
    })
    expect(wrapper.vm.value).to.be.false

    await wrapper.setProps({ value: true })
    expect(wrapper.find('.modal-mask').exists()).to.be.true

    await wrapper.find('.modal-close').trigger('click')
    expect(wrapper.emitted('input')).to.have.lengthOf(1)
    expect(wrapper.emitted('input')[0]).to.deep.equal([false])
  })

  it('emits confirm event with payload', async () => {
    const wrapper = mount(ModalComponent, {
      propsData: { value: true }
    })
    await wrapper.find('.modal-confirm').trigger('click')
    expect(wrapper.emitted('confirm')).to.have.lengthOf(1)
  })
})

// ====== 生命周期测试 ======
describe('lifecycle hooks', () => {
  it('calls mounted hook', () => {
    const mounted = sinon.spy()
    const wrapper = mount({
      template: '<div>test</div>',
      mounted() { mounted() }
    })
    expect(mounted.calledOnce).to.be.true
    wrapper.destroy()
  })

  it('calls beforeDestroy on destroy', () => {
    const beforeDestroy = sinon.spy()
    const wrapper = mount({
      template: '<div>test</div>',
      beforeDestroy() { beforeDestroy() }
    })
    wrapper.destroy()
    expect(beforeDestroy.calledOnce).to.be.true
  })

  it('updates on data change', async () => {
    const wrapper = mount({
      template: '<div>{{ count }}</div>',
      data() { return { count: 0 } }
    })
    expect(wrapper.text()).to.equal('0')
    await wrapper.setData({ count: 5 })
    expect(wrapper.text()).to.equal('5')
  })
})

// ====== 自定义指令测试 ======
describe('custom directives', () => {
  it('applies v-focus directive', () => {
    const focus = sinon.spy()
    const wrapper = mount({
      directives: {
        focus: { inserted: focus }
      },
      template: '<input v-focus />'
    })
    expect(focus.calledOnce).to.be.true
    wrapper.destroy()
  })
})

// ====== mock + 异步测试 ======
describe('async behavior', () => {
  it('waits for async data', async () => {
    const mockApi = {
      fetch: sinon.stub().resolves([{ id: 1, name: 'test' }])
    }
    const wrapper = mount(MyComponent, {
      mocks: { $api: mockApi }
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.items).to.have.lengthOf(1)
    expect(wrapper.vm.items[0].name).to.equal('test')
  })

  it('handles loading state', async () => {
    const wrapper = mount(MyComponent, {
      mocks: {
        $api: { fetch: () => new Promise(r => setTimeout(r, 100)) }
      }
    })
    expect(wrapper.vm.loading).to.be.true
    await new Promise(r => setTimeout(r, 150))
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.loading).to.be.false
  })
})

// ====== createWrapper + 事件总线测试 ======
describe('event bus', () => {
  it('listens to bus events', async () => {
    const bus = new Vue()
    const handler = sinon.spy()
    const wrapper = mount({
      created() { bus.$on('refresh', handler) },
      beforeDestroy() { bus.$off('refresh', handler) },
      template: '<div/>'
    })
    bus.$emit('refresh', { type: 'full' })
    expect(handler.calledOnce).to.be.true
    expect(handler.firstCall.args[0]).to.deep.equal({ type: 'full' })
    wrapper.destroy()
  })
})
