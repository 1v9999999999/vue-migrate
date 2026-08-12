import { mount, shallowMount, flushPromises } from '@vue/test-utils'
import Form from '@/components/Form.vue'

describe('Form with Test Utils Advanced', () => {
  it('uses findComponent by name', () => {
    const wrapper = mount(Form, {
      global: {
        stubs: { ChildComponent: true }
      }
    })
    const child = wrapper.findComponent({ name: 'ChildComponent' })
    expect(child.exists()).toBe(true)
  })

  it('uses findAll', () => {
    const wrapper = mount(Form)
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(3)
  })

  it('uses setProps reactive update', async () => {
    const wrapper = mount(Form, { props: { mode: 'edit' } })
    await wrapper.setProps({ mode: 'view' })
    expect(wrapper.vm.mode).toBe('view')
  })

  it('uses setValue on input', async () => {
    const wrapper = mount(Form)
    await wrapper.find('input[name=email]').setValue('test@example.com')
    expect(wrapper.vm.email).toBe('test@example.com')
  })

  it('uses emitted() to assert events', async () => {
    const wrapper = mount(Form)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeTruthy()
    expect(wrapper.emitted('submit')[0][0]).toEqual({ email: '' })
  })

  it('uses createWrapper for DOM access', () => {
    const wrapper = mount(Form)
    const html = wrapper.html()
    expect(html).toContain('<form')
  })
})
