import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCounterStore } from '@/store/counter'
import Counter from '@/components/Counter.vue'

describe('Counter Component with Pinia', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders initial count from store', () => {
    const store = useCounterStore()
    store.count = 5
    const wrapper = mount(Counter, { global: { plugins: [createPinia()] } })
    expect(wrapper.text()).toContain('5')
  })

  it('increments via store action', async () => {
    const wrapper = mount(Counter, { global: { plugins: [createPinia()] } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('1')
  })

  it('mocks store with custom state', () => {
    const pinia = createPinia()
    const store = useCounterStore(pinia)
    store.count = 100
    const wrapper = mount(Counter, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('100')
  })
})
