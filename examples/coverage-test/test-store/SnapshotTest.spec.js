import { mount } from '@vue/test-utils'
import Card from '@/components/Card.vue'

describe('Card snapshot', () => {
  it('matches snapshot', () => {
    const wrapper = mount(Card, {
      props: { title: 'Hello', content: 'World' }
    })
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('matches snapshot with slot', () => {
    const wrapper = mount(Card, {
      props: { title: 'T' },
      slots: { default: '<p>content</p>' }
    })
    expect(wrapper.html()).toMatchSnapshot()
  })
})
