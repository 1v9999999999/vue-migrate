/**
 * Jest + @vue/test-utils 组件测试 — 复杂场景
 * 覆盖: computed mock, $route mock, $router mock, provide/inject, transition
 */
import { mount, shallowMount } from '@vue/test-utils'
import sinon from 'sinon'
import flushPromises from 'flush-promises'

import UserProfile from './UserProfile.vue'
import PermissionButton from './PermissionButton.vue'
import DataTable from './DataTable.vue'
import ExportButton from './ExportButton.vue'

// ====== $route / $router mock ======
describe('UserProfile with router', () => {
  const mockRoute = {
    path: '/user/123',
    params: { id: '123' },
    query: { tab: 'profile' },
    meta: { requiresAuth: true }
  }
  const mockRouter = {
    push: sinon.spy(),
    replace: sinon.spy(),
    go: sinon.spy(),
    back: sinon.spy()
  }

  it('reads route params', () => {
    const wrapper = mount(UserProfile, {
      mocks: { $route: mockRoute, $router: mockRouter }
    })
    expect(wrapper.vm.userId).to.equal('123')
    expect(wrapper.vm.activeTab).to.equal('profile')
  })

  it('navigates on button click', async () => {
    const wrapper = mount(UserProfile, {
      mocks: { $route: mockRoute, $router: mockRouter }
    })
    await wrapper.find('.back-btn').trigger('click')
    expect(mockRouter.back.calledOnce).to.be.true
  })

  it('pushes to edit page', async () => {
    const wrapper = mount(UserProfile, {
      mocks: { $route: mockRoute, $router: mockRouter }
    })
    await wrapper.find('.edit-btn').trigger('click')
    expect(mockRouter.push.calledWith({ name: 'user-edit', params: { id: '123' } })).to.be.true
  })
})

// ====== provide / inject 测试 ======
describe('PermissionButton with provide/inject', () => {
  it('injects permission from parent', () => {
    const wrapper = mount(PermissionButton, {
      provide: {
        permissions: ['edit', 'delete', 'create']
      }
    })
    expect(wrapper.vm.canEdit).to.be.true
    expect(wrapper.vm.canDelete).to.be.true
    expect(wrapper.vm.canAdmin).to.be.false
  })

  it('hides button when no permission', () => {
    const wrapper = mount(PermissionButton, {
      provide: { permissions: ['view'] }
    })
    expect(wrapper.find('.delete-btn').exists()).to.be.false
  })
})

// ====== DataTable 复杂交互 ======
describe('DataTable interactions', () => {
  it('sorts on header click', async () => {
    const wrapper = mount(DataTable, {
      propsData: {
        data: [
          { id: 3, name: 'Charlie' },
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ]
      }
    })
    await wrapper.find('th.sortable').trigger('click')
    expect(wrapper.vm.sortedData[0].name).to.equal('Alice')
    await wrapper.find('th.sortable').trigger('click')
    expect(wrapper.vm.sortedData[0].name).to.equal('Charlie')
  })

  it('emits selection-change', async () => {
    const wrapper = mount(DataTable, {
      propsData: { data: [{ id: 1 }, { id: 2 }] }
    })
    await wrapper.find('input[type=checkbox]').setChecked()
    expect(wrapper.emitted('selection-change')).to.have.lengthOf(1)
    expect(wrapper.emitted('selection-change')[0][0]).to.have.lengthOf(1)
  })

  it('paginates correctly', async () => {
    const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }))
    const wrapper = mount(DataTable, {
      propsData: { data, pageSize: 10 }
    })
    expect(wrapper.findAll('tbody tr')).to.have.lengthOf(10)
    await wrapper.find('.next-page').trigger('click')
    expect(wrapper.findAll('tbody tr')).to.have.lengthOf(10)
    expect(wrapper.vm.currentPage).to.equal(2)
  })
})

// ====== 异步导出 + loading ======
describe('ExportButton async', () => {
  it('shows loading during export', async () => {
    const exportFn = sinon.stub().resolves(new Blob())
    const wrapper = mount(ExportButton, {
      mocks: { $api: { export: exportFn } }
    })

    wrapper.find('button').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.loading).to.be.true
    expect(wrapper.find('.el-icon-loading').exists()).to.be.true

    await flushPromises()
    expect(wrapper.vm.loading).to.be.false
    expect(wrapper.find('.el-icon-loading').exists()).to.be.false
    expect(wrapper.find('.success-msg').exists()).to.be.true
  })

  it('shows error on failure', async () => {
    const exportFn = sinon.stub().rejects(new Error('network'))
    const wrapper = mount(ExportButton, {
      mocks: { $api: { export: exportFn } }
    })

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.vm.error).to.equal('network')
    expect(wrapper.find('.error-msg').exists()).to.be.true
  })
})

// ====== Vue.set / Vue.delete 测试 ======
describe('reactivity with Vue.set', () => {
  it('triggers update with $set', async () => {
    const wrapper = mount({
      template: '<div>{{ obj.newKey }}</div>',
      data() { return { obj: { existing: 1 } } },
      methods: {
        addKey() { this.$set(this.obj, 'newKey', 'added') }
      }
    })
    expect(wrapper.text()).to.equal('')
    wrapper.vm.addKey()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).to.equal('added')
  })

  it('removes key with $delete', async () => {
    const wrapper = mount({
      template: '<div>{{ obj.key }}</div>',
      data() { return { obj: { key: 'value' } } },
      methods: {
        removeKey() { this.$delete(this.obj, 'key') }
      }
    })
    expect(wrapper.text()).to.equal('value')
    wrapper.vm.removeKey()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).to.equal('')
  })
})
