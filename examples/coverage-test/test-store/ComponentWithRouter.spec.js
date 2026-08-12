import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavMenu from '@/components/NavMenu.vue'
import Home from '@/views/Home.vue'
import About from '@/views/About.vue'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Home },
      { path: '/about', component: About }
    ]
  })
}

describe('NavMenu with router', () => {
  it('navigates on link click', async () => {
    const router = createTestRouter()
    router.push('/')
    await router.isReady()
    const wrapper = mount(NavMenu, {
      global: { plugins: [router] }
    })
    await wrapper.find('a[href="/about"]').trigger('click')
    expect(router.currentRoute.value.path).toBe('/about')
  })

  it('shows active class on current route', async () => {
    const router = createTestRouter()
    router.push('/about')
    await router.isReady()
    const wrapper = mount(NavMenu, { global: { plugins: [router] } })
    expect(wrapper.find('a.active').text()).toBe('About')
  })
})
